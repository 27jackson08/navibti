import { describe, expect, it } from 'vitest';
import {
  accessFor,
  canShareRawSymptoms,
  createShareLink,
  createToken,
  isLive,
  listShareLinks,
  recordAccess,
  resolveToken,
  revokeShareLink,
  type ShareRole,
} from './share';

function make(overrides: Partial<Parameters<typeof createShareLink>[0]> = {}) {
  return createShareLink({
    patientId: 'test-patient',
    role: 'school',
    includesRawSymptoms: false,
    expiresInDays: 14,
    label: 'Ms Okafor, Year 11',
    ...overrides,
  });
}

describe('tokens', () => {
  it('are long enough to be unguessable', () => {
    // 24 random bytes is 192 bits. Base64url of that is 32 characters.
    expect(createToken()).toHaveLength(32);
  });

  it('are never repeated', () => {
    const tokens = new Set(Array.from({ length: 500 }, createToken));
    expect(tokens.size).toBe(500);
  });

  it('do not encode the patient they belong to', () => {
    const link = make({ patientId: 'maya' });
    expect(link.token.toLowerCase()).not.toContain('maya');
  });
});

describe('resolution', () => {
  it('finds a live link', () => {
    const link = make();
    expect(resolveToken(link.token)?.id).toBe(link.id);
  });

  it('returns null for a token that never existed', () => {
    expect(resolveToken(createToken())).toBeNull();
  });

  it('returns null once revoked, exactly as it does for an unknown token', () => {
    const link = make();
    revokeShareLink('test-patient', link.id);
    expect(resolveToken(link.token)).toBeNull();
  });

  it('returns null once expired', () => {
    const link = make({ expiresInDays: 1 });
    const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    expect(resolveToken(link.token, later)).toBeNull();
  });

  it('does not resolve a token that merely shares a prefix', () => {
    const link = make();
    expect(resolveToken(`${link.token.slice(0, -1)}A`)).toBeNull();
    expect(resolveToken(link.token.slice(0, 10))).toBeNull();
  });
});

describe('data minimisation', () => {
  it.each<[ShareRole, boolean]>([
    ['clinician', true],
    ['caregiver', true],
    ['school', false],
    ['employer', false],
  ])('%s may see raw symptoms: %s', (role, allowed) => {
    expect(canShareRawSymptoms(role)).toBe(allowed);
  });

  it('strips raw symptoms from a school link even when asked for them', () => {
    // Enforced in the store rather than the form, so a crafted request cannot
    // do what the interface does not offer.
    const link = make({ role: 'school', includesRawSymptoms: true });
    expect(link.includesRawSymptoms).toBe(false);
  });

  it('honours the choice for a clinician link', () => {
    expect(make({ role: 'clinician', includesRawSymptoms: true }).includesRawSymptoms).toBe(true);
    expect(make({ role: 'clinician', includesRawSymptoms: false }).includesRawSymptoms).toBe(false);
  });
});

describe('revocation', () => {
  it('takes effect immediately, with no grace period', () => {
    const link = make();
    expect(resolveToken(link.token)).not.toBeNull();
    revokeShareLink('test-patient', link.id);
    expect(resolveToken(link.token)).toBeNull();
  });

  it('refuses to revoke a link belonging to someone else', () => {
    const link = make({ patientId: 'patient-a' });
    expect(revokeShareLink('patient-b', link.id)).toBe(false);
    expect(resolveToken(link.token)).not.toBeNull();
  });

  it('reports a revoked link as no longer live', () => {
    const link = make();
    revokeShareLink('test-patient', link.id);
    const stored = listShareLinks('test-patient').find((entry) => entry.id === link.id)!;
    expect(isLive(stored)).toBe(false);
    expect(stored.revokedAt).not.toBeNull();
  });
});

describe('the access log', () => {
  it('records every view', () => {
    const link = make();
    recordAccess(link.id);
    recordAccess(link.id);
    expect(accessFor(link.id)).toHaveLength(2);
  });

  it('keeps one link’s views out of another’s log', () => {
    const a = make();
    const b = make();
    recordAccess(a.id);
    expect(accessFor(b.id)).toHaveLength(0);
  });
});

describe('listing', () => {
  it('only ever returns one patient’s links', () => {
    make({ patientId: 'patient-c' });
    make({ patientId: 'patient-d' });
    for (const link of listShareLinks('patient-c')) {
      expect(link.patientId).toBe('patient-c');
    }
  });
});
