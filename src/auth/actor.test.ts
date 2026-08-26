import { describe, expect, it } from 'vitest';
import { issueActorCookie, verifyActorCookie } from './actor';

/**
 * The cookie is the only thing standing between a crafted request and somebody
 * else's record, so it is tested as a signature rather than as a string.
 */

const maya = issueActorCookie('maya', true);

describe('the acting-as cookie', () => {
  it('carries the patient and a signature', () => {
    expect(maya.value.startsWith('maya.')).toBe(true);
    expect(maya.value.length).toBeGreaterThan('maya.'.length + 20);
  });

  it('round-trips', () => {
    expect(verifyActorCookie(maya.value)).toBe('maya');
  });

  it('is not readable by client script', () => {
    expect(maya.options.httpOnly).toBe(true);
  });

  it('is Secure over HTTPS and not over plain HTTP', () => {
    // Not keyed off NODE_ENV: a production build served over http for a demo
    // would mark it Secure, and WebKit grants no localhost exemption, so every
    // mutation fails on Safari and only on Safari.
    expect(issueActorCookie('maya', true).options.secure).toBe(true);
    expect(issueActorCookie('maya', false).options.secure).toBe(false);
  });

  it('does not ride along on cross-site requests', () => {
    // Without this a third-party page could drive a mutation with the cookie
    // attached, which is the whole point of having one.
    expect(maya.options.sameSite).toBe('lax');
  });
});

describe('forgery', () => {
  it('rejects a hand-written cookie', () => {
    expect(verifyActorCookie('daniel.whatever')).toBeNull();
  });

  it('rejects a patient swapped under a valid signature', () => {
    const signature = maya.value.split('.')[1];
    expect(verifyActorCookie(`daniel.${signature}`)).toBeNull();
  });

  it('rejects an unsigned value', () => {
    expect(verifyActorCookie('maya')).toBeNull();
    expect(verifyActorCookie('maya.')).toBeNull();
  });

  it('rejects a truncated signature', () => {
    expect(verifyActorCookie(maya.value.slice(0, -4))).toBeNull();
  });

  it('rejects missing and empty cookies', () => {
    expect(verifyActorCookie(undefined)).toBeNull();
    expect(verifyActorCookie('')).toBeNull();
    expect(verifyActorCookie('.')).toBeNull();
  });

  it('does not confuse one patient for another', () => {
    const daniel = issueActorCookie('daniel', true);
    expect(verifyActorCookie(daniel.value)).toBe('daniel');
    expect(daniel.value).not.toBe(maya.value);
  });
});

describe('the signing key', () => {
  it('is never a hardcoded constant in source', async () => {
    // A shared default in the repository is worse than no signature, because it
    // looks like one.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./actor.ts', import.meta.url), 'utf8'),
    );
    expect(source).toMatch(/process\.env\.NAVITBI_SESSION_SECRET/);
    expect(source).toMatch(/randomBytes\(32\)/);
    expect(source).not.toMatch(/SECRET = ['"`][a-zA-Z0-9]/);
  });
});
