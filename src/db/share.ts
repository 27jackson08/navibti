/**
 * Share links.
 *
 * A packet is only useful once it reaches the person who has to act on it, and
 * that person will not create an account. So links are unauthenticated — which
 * makes the token itself the entire security boundary, and everything below
 * follows from taking that seriously.
 *
 * The rules, in order of how much damage getting them wrong would do:
 *
 *   unguessable   192 bits from a CSPRNG, never sequential, never derived from
 *                 the patient id
 *   scoped        a school link renders the school packet and nothing else
 *   minimal       raw symptom scores are never attached to a school or employer
 *                 link, whatever the patient ticks
 *   expiring      every link has an end date, chosen by the patient
 *   revocable     one click, immediate, no grace period
 *   logged        every view is recorded and shown back to the patient
 *
 * An expired or revoked token is indistinguishable from one that never existed,
 * so a recipient who keeps a dead link learns nothing from probing it.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

export type ShareRole = 'school' | 'employer' | 'caregiver' | 'clinician';

export interface ShareLink {
  readonly id: string;
  readonly token: string;
  readonly patientId: string;
  readonly role: ShareRole;
  /** Raw daily symptom scores, as opposed to tolerance bands. */
  readonly includesRawSymptoms: boolean;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly label: string;
}

export interface AccessEntry {
  readonly linkId: string;
  readonly at: string;
}

interface ShareStore {
  readonly links: Map<string, ShareLink>;
  readonly access: AccessEntry[];
}

const globalStore = globalThis as typeof globalThis & { __navitbiShare?: ShareStore };
const store: ShareStore = (globalStore.__navitbiShare ??= { links: new Map(), access: [] });

/**
 * Roles that may ever receive raw symptom scores.
 *
 * A school needs to know that a student can manage two hours of class. It does
 * not need their daily headache ratings, and handing them over because a
 * checkbox was ticked is the kind of oversharing that makes families refuse to
 * use a tool like this at all.
 */
const MAY_SEE_RAW_SYMPTOMS: readonly ShareRole[] = ['clinician', 'caregiver'];

export function canShareRawSymptoms(role: ShareRole): boolean {
  return MAY_SEE_RAW_SYMPTOMS.includes(role);
}

export function createToken(): string {
  return randomBytes(24).toString('base64url');
}

export interface CreateShareInput {
  readonly patientId: string;
  readonly role: ShareRole;
  readonly includesRawSymptoms: boolean;
  readonly expiresInDays: number;
  readonly label: string;
}

export function createShareLink(input: CreateShareInput): ShareLink {
  const now = new Date();
  const expires = new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const link: ShareLink = {
    id: randomBytes(8).toString('hex'),
    token: createToken(),
    patientId: input.patientId,
    role: input.role,
    // Enforced here rather than at the form, so a crafted request cannot do
    // what the interface does not offer.
    includesRawSymptoms: input.includesRawSymptoms && canShareRawSymptoms(input.role),
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    revokedAt: null,
    label: input.label,
  };

  store.links.set(link.token, link);
  return link;
}

export function isLive(link: ShareLink, now = new Date()): boolean {
  return link.revokedAt === null && Date.parse(link.expiresAt) > now.getTime();
}

/**
 * Resolves a token, or null.
 *
 * Compared in constant time against every candidate so a timing signal cannot
 * be used to recover a token prefix, and returns null identically for unknown,
 * expired and revoked links.
 */
export function resolveToken(token: string, now = new Date()): ShareLink | null {
  const candidate = Buffer.from(token);

  for (const link of store.links.values()) {
    const stored = Buffer.from(link.token);
    if (stored.length !== candidate.length) continue;
    if (!timingSafeEqual(stored, candidate)) continue;
    return isLive(link, now) ? link : null;
  }
  return null;
}

export function listShareLinks(patientId: string): ShareLink[] {
  return [...store.links.values()]
    .filter((link) => link.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function revokeShareLink(patientId: string, linkId: string): boolean {
  for (const link of store.links.values()) {
    if (link.id !== linkId || link.patientId !== patientId) continue;
    store.links.set(link.token, { ...link, revokedAt: new Date().toISOString() });
    return true;
  }
  return false;
}

export function recordAccess(linkId: string): void {
  store.access.push({ linkId, at: new Date().toISOString() });
}

export function accessFor(linkId: string): AccessEntry[] {
  return store.access.filter((entry) => entry.linkId === linkId);
}
