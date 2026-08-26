import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Who this session is acting as.
 *
 * This is **not** authentication. There are no accounts, no passwords and no
 * identity verification, and a demo where anyone can look at any of three
 * fictional patients is the point. What this does provide is the seam where
 * authentication belongs, with every mutating path already routed through it.
 *
 * Concretely it closes one real hole: before this, `submitCheckIn` and the
 * share-link actions checked only that the target patient existed, so a crafted
 * request could file a check-in against somebody else's record or mint a share
 * link for a patient the caller had never opened. Now every mutation asserts
 * that the acting patient matches the target.
 *
 * What it deliberately does not do is stop someone choosing to act as a
 * different demo patient — they can, by opening that patient. Replacing
 * `currentActor` with a real session lookup is the whole change needed to make
 * that impossible, and `requireActor` is the only place it has to happen.
 */

const COOKIE = 'navitbi-actor';

/**
 * Signing key. From the environment in any real deployment; a random value
 * otherwise, which invalidates cookies on restart and is right for a demo.
 * Never a hardcoded default — a shared constant in source is worse than no
 * signature at all, because it looks like one.
 *
 * Cached on globalThis, and that is not incidental. The route handler that
 * issues the cookie and the server action that verifies it are bundled
 * separately, so a module-scoped random value gives each of them a *different*
 * key and every signature fails to verify. The first version of this file did
 * exactly that, and the symptom was every mutation being rejected as forged —
 * including the legitimate ones.
 *
 * The same reasoning is why a real deployment must set the environment
 * variable: more than one server instance means more than one random key.
 */
const globalSecret = globalThis as typeof globalThis & { __navitbiSecret?: string };

const SECRET =
  process.env.NAVITBI_SESSION_SECRET ??
  (globalSecret.__navitbiSecret ??= randomBytes(32).toString('hex'));

function sign(patientId: string): string {
  return createHmac('sha256', SECRET).update(patientId).digest('base64url');
}

export function issueActorCookie(
  patientId: string,
  /**
   * Whether this request arrived over HTTPS.
   *
   * Taken from the request rather than from NODE_ENV. Keying it off the
   * environment marks the cookie Secure on any production build — including one
   * served over http for a demo — and WebKit, unlike Chromium and Firefox,
   * grants no localhost exemption for Secure cookies. The symptom was every
   * mutation failing on Safari and only on Safari, with the server insisting
   * the session was not acting as anyone.
   */
  overHttps: boolean,
): {
  name: string;
  value: string;
  options: { httpOnly: true; sameSite: 'lax'; path: string; secure: boolean };
} {
  return {
    name: COOKIE,
    value: `${patientId}.${sign(patientId)}`,
    options: {
      // httpOnly so no client script can read or forge it; sameSite lax so a
      // third-party page cannot drive a mutation with it attached.
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: overHttps,
    },
  };
}

/** Reads and verifies the cookie. Returns null for missing, malformed or forged. */
export function verifyActorCookie(raw: string | undefined): string | null {
  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;

  const patientId = raw.slice(0, separator);
  const provided = Buffer.from(raw.slice(separator + 1));
  const expected = Buffer.from(sign(patientId));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? patientId : null;
}

export async function currentActor(): Promise<string | null> {
  const store = await cookies();
  return verifyActorCookie(store.get(COOKIE)?.value);
}

export class NotActingAsPatientError extends Error {
  constructor(target: string) {
    super(
      `This session is not acting as "${target}". Open that patient before changing their record.`,
    );
    this.name = 'NotActingAsPatientError';
  }
}

/**
 * The single gate every mutation passes through. Swapping the body of this
 * function for a real session lookup is the entire change required to make this
 * production-grade authorisation.
 */
export async function requireActor(targetPatientId: string): Promise<void> {
  const actor = await currentActor();
  if (actor !== targetPatientId) throw new NotActingAsPatientError(targetPatientId);
}
