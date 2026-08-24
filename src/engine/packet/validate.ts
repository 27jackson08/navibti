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
  | 'excessive-length';

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
];

/** Every distinct number in a string, normalised so "10" and "10." match. */
function numbersIn(text: string): Set<string> {
  return new Set((text.match(/\d+(?:\.\d+)?/g) ?? []).map((value) => String(Number(value))));
}

const MAX_LENGTH_RATIO = 1.6;

/**
 * Checks one rewritten item against the template it came from.
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
