/**
 * The constraint that makes a language model safe to use here at all.
 *
 * NaviTBI composes packets by selecting from a curated, cited library. If a
 * tone pass is ever added — and there are good reasons to want one, since a
 * letter assembled from templates reads like a letter assembled from templates —
 * it may rephrase a selected item and nothing else.
 *
 * Concretely: the model can rewrite a sentence. It cannot invent a clinical
 * claim, change a number, drop a limit, or add an item nobody selected. Every
 * one of those is checked here, and any violation falls back to the
 * deterministic template rather than shipping the rewrite.
 *
 * The fallback is what makes this a guard rather than a warning. A validator
 * that logs and continues is decoration.
 */

import { FORBIDDEN_ATTRIBUTION_LANGUAGE } from '@/engine/attribution/attribution';
import type { Packet, PacketItem } from './compose';

export type ViolationKind =
  | 'invented-number'
  | 'dropped-number'
  | 'forbidden-language'
  | 'unselected-item'
  | 'excessive-length'
  | 'added-sentence'
  | 'lost-subject'
  | 'introduced-negation'
  | 'introduced-hedge';

export interface Violation {
  readonly kind: ViolationKind;
  readonly itemId: string;
  readonly detail: string;
}

/**
 * Clinical territory a packet may never enter, whatever produced the text.
 * Broader than the attribution list because a packet is a document that leaves
 * the app and gets filed by someone else.
 */
const FORBIDDEN_PACKET_LANGUAGE: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bdiagnos(e|is|ed|ing)\b/i, label: 'diagnosis' },
  { pattern: /\bprescrib(e|ed|ing)\b/i, label: 'prescribing' },
  { pattern: /\bmedication\b|\bdosage\b/i, label: 'medication advice' },
  { pattern: /\b(is|are|has been|have been) cleared\b/i, label: 'issuing clearance' },
  { pattern: /\bcleared (to|for)\b/i, label: 'issuing clearance' },
  { pattern: /\bsafe to return to (play|sport|contact)\b/i, label: 'clearing return to play' },
  { pattern: /\bMRI\b|\bCT scan\b|\bimaging\b/i, label: 'imaging advice' },
  { pattern: /\bfully recovered\b|\bmade a full recovery\b/i, label: 'declaring recovery' },
  { pattern: /\bguarantee/i, label: 'guaranteeing an outcome' },
  { pattern: /\bhas recovered\b|\bis recovered\b|\bback to normal\b|\bfully fit\b/i, label: 'declaring recovery' },
  { pattern: /\bno (restrictions?|accommodations?|adjustments?) (are |is )?(necessary|needed|required)\b/i, label: 'declaring support unnecessary' },
  { pattern: /\b(doctor|clinician|physician|GP|specialist)\b[^.]{0,40}\b(said|says|confirmed|advised|agreed|approved)\b/i, label: 'attributing a claim to a clinician' },
  { pattern: /\bno longer needs?\b/i, label: 'declaring support unnecessary' },
];

/** Sentences, counted loosely — enough to tell a rephrasing from an addition. */
function sentenceCount(text: string): number {
  return text.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
}

const STOPWORDS = new Set([
  'about','after','again','allow','among','around','because','before','being','between',
  'could','every','from','have','into','more','most','other','over','should','some','such',
  'than','that','their','them','then','there','these','they','this','those','through','under',
  'until','were','what','when','where','which','while','with','would','your',
]);

/**
 * Negations, which are the cheapest way to invert an instruction while keeping
 * every number, every subject word and the sentence count intact.
 *
 * This does not make the validator a semantic checker. It closes one narrow,
 * high-value hole; see the note on validateRewrite for what remains open.
 */
const NEGATIONS = /\b(not|no|never|cannot|avoid|without|refrain|instead of|rather than)\b|n't\b/gi;

/**
 * Words that turn an instruction into a suggestion.
 *
 * Distinct from negation and worth its own check, because softening is the one
 * thing a tone pass is actually *for*. Asked to make a packet friendlier, a
 * model produces "Where convenient, consider capping live meetings at 1 per
 * day" — which keeps every number, every subject word and the sentence count,
 * introduces no negation, and quietly makes a limit optional. Our own attack
 * suite found exactly that.
 *
 * Unlike the inversion hole below it, this one is lexical, so it can be closed.
 * Counted rather than forbidden: one library item already says "ideally", and
 * the rule is that a rewrite may not add hedging the source did not have.
 */
const HEDGES =
  /\b(consider|considering|ideally|preferably|optional|optionally|discretion|suggest\w*|encourage\w*)\b|\b(if|where|wherever|when|whenever)\s+(possible|convenient|practical|practicable|you can|needed|helpful)\b|\bfeel free\b|\b(may|might|could)\s+(wish|want|like|prefer)\b|\bas\s+(far|much)\s+as\s+possible\b|\btry\s+to\b|\bwhere\s+it\s+helps\b/gi;

function hedgeCount(text: string): number {
  return text.match(HEDGES)?.length ?? 0;
}

function negationCount(text: string): number {
  return (text.match(NEGATIONS) ?? []).length;
}

/** Words distinctive enough that losing them means the subject changed. */
function subjectWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 5 && !STOPWORDS.has(word)),
  );
}

/** Every distinct number in a string, normalised so "10" and "10." match. */
function numbersIn(text: string): Set<string> {
  return new Set((text.match(/\d+(?:\.\d+)?/g) ?? []).map((value) => String(Number(value))));
}

const MAX_LENGTH_RATIO = 1.6;

/**
 * Checks one rewritten item against the template it came from.
 *
 * What this provably blocks: added sentences, invented figures, dropped limits,
 * introduced negations, introduced hedging, loss of the item's subject, and
 * named clinical territory — diagnosis, clearance, medication, imaging,
 * declaring recovery, declaring support unnecessary, and attributing a claim to
 * a clinician.
 *
 * What it cannot do is verify that a rephrasing still *means* the same thing.
 * "Cap live meetings at 1 per day" rewritten to "Require at least live meetings
 * at 1 per day" keeps every number, every subject word and the sentence count,
 * introduces no negation, and reverses the instruction. A lexical validator
 * cannot see that, and no amount of pattern-adding will change it.
 *
 * Which is why the actual guarantee is architectural rather than this function:
 * no language model writes packet text. Every sentence a recipient reads is
 * selected from the cited library verbatim. This validator exists so that
 * adding a tone pass later is a bounded, reviewable change — not as a claim
 * that one would be safe today.
 */
export function validateRewrite(original: PacketItem, rewrittenText: string): Violation[] {
  const violations: Violation[] = [];

  const before = numbersIn(original.text);
  const after = numbersIn(rewrittenText);

  for (const value of after) {
    if (!before.has(value)) {
      violations.push({
        kind: 'invented-number',
        itemId: original.id,
        detail: `rewrite introduced the figure ${value}, which is not in the source item`,
      });
    }
  }

  for (const value of before) {
    if (!after.has(value)) {
      violations.push({
        kind: 'dropped-number',
        itemId: original.id,
        detail: `rewrite dropped the figure ${value}, which is the limit this item exists to state`,
      });
    }
  }

  for (const { pattern, label } of FORBIDDEN_PACKET_LANGUAGE) {
    if (pattern.test(rewrittenText)) {
      violations.push({
        kind: 'forbidden-language',
        itemId: original.id,
        detail: `rewrite strays into ${label}`,
      });
    }
  }

  for (const pattern of FORBIDDEN_ATTRIBUTION_LANGUAGE) {
    if (pattern.test(rewrittenText)) {
      violations.push({
        kind: 'forbidden-language',
        itemId: original.id,
        detail: 'rewrite asserts causation',
      });
    }
  }

  if (rewrittenText.length > original.text.length * MAX_LENGTH_RATIO) {
    violations.push({
      kind: 'excessive-length',
      itemId: original.id,
      detail: 'rewrite is long enough to have added something that was not there',
    });
  }

  // A rephrasing does not need more sentences than the thing it rephrases.
  // This is the check that actually stops the dangerous class: every attack
  // that got a fabricated claim past the earlier version of this validator —
  // "He has recovered", "His doctor confirmed this is enough", "No restrictions
  // are necessary", "Also stop taking breaks" — did it by appending a sentence.
  if (sentenceCount(rewrittenText) > sentenceCount(original.text)) {
    violations.push({
      kind: 'added-sentence',
      itemId: original.id,
      detail: 'rewrite adds a sentence, which is how a claim gets in that was not in the source',
    });
  }

  if (negationCount(rewrittenText) > negationCount(original.text)) {
    violations.push({
      kind: 'introduced-negation',
      itemId: original.id,
      detail: 'rewrite introduces a negation the source did not have, which can invert the instruction',
    });
  }

  if (hedgeCount(rewrittenText) > hedgeCount(original.text)) {
    violations.push({
      kind: 'introduced-hedge',
      itemId: original.id,
      detail:
        'rewrite adds hedging the source did not have, which turns a limit into a suggestion',
    });
  }

  // A rewrite that has dropped the words the item is about is not a rewrite of
  // that item.
  const sourceWords = subjectWords(original.text);
  const rewrittenWords = subjectWords(rewrittenText);
  const retained = [...sourceWords].filter((word) => rewrittenWords.has(word)).length;
  if (sourceWords.size > 0 && retained / sourceWords.size < 0.6) {
    violations.push({
      kind: 'lost-subject',
      itemId: original.id,
      detail: 'rewrite no longer mentions what the source item was about',
    });
  }

  return violations;
}

export interface RewriteResult {
  readonly items: readonly PacketItem[];
  readonly violations: readonly Violation[];
  /** Ids where the rewrite was rejected and the template kept. */
  readonly rejected: readonly string[];
}

/**
 * Applies a set of proposed rewrites to a packet, keeping only the ones that
 * pass. Rejected items silently keep their original wording, which is always
 * correct — the fallback is a real document, not an error state.
 */
export function applyRewrites(
  packet: Packet,
  rewrites: Readonly<Record<string, string>>,
): RewriteResult {
  const selected = new Set(packet.items.map((item) => item.id));
  const violations: Violation[] = [];
  const rejected: string[] = [];

  for (const id of Object.keys(rewrites)) {
    if (!selected.has(id)) {
      violations.push({
        kind: 'unselected-item',
        itemId: id,
        detail: 'rewrite refers to an item this packet does not contain',
      });
      rejected.push(id);
    }
  }

  const items = packet.items.map((item) => {
    const proposed = rewrites[item.id];
    if (proposed === undefined) return item;

    const itemViolations = validateRewrite(item, proposed);
    if (itemViolations.length === 0) return { ...item, text: proposed };

    violations.push(...itemViolations);
    rejected.push(item.id);
    return item;
  });

  return { items, violations, rejected };
}
