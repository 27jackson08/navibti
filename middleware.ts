import { NextResponse, type NextRequest } from 'next/server';

/**
 * Security headers.
 *
 * This app serves clinical documents to people with no account, at URLs whose
 * secrecy is the entire access control. That makes three things matter more
 * here than on an ordinary site:
 *
 *   the token is in the path   so it must not travel in a Referer header to
 *                              anywhere else
 *   the page can be framed     so a school portal embedding /s/<token> in an
 *                              iframe could overlay it, and a recipient could
 *                              be made to click "we cannot provide this"
 *                              without seeing what they clicked
 *   there is one inline script so a policy that allows inline script at all
 *                              would allow every injected one too
 *
 * The nonce is generated per request and handed to the one inline script we
 * ship. Next reads it back off this header and applies it to its own hydration
 * scripts, so 'unsafe-inline' is never needed in production.
 */
export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const isDev = process.env.NODE_ENV !== 'production';

  const policy = [
    "default-src 'self'",
    // 'strict-dynamic' lets Next's own bootstrap load the chunks it needs
    // without naming every one. Dev needs eval for the HMR runtime; production
    // does not, and does not get it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Tailwind and next/font both emit inline style. There is no user-supplied
    // CSS anywhere in this app, so the exposure is presentational.
    "style-src 'self' 'unsafe-inline'",
    // next/font/google self-hosts at build time, so no external origin is
    // needed for fonts and none is allowed.
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers } });

  response.headers.set('content-security-policy', policy);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');

  // A share URL is a credential. Anywhere else the origin is enough for the
  // analytics nobody has asked for; on a share link even the origin is more
  // than a third party needs to know.
  const isShareLink = request.nextUrl.pathname.startsWith('/s/');

  response.headers.set(
    'referrer-policy',
    isShareLink ? 'no-referrer' : 'strict-origin-when-cross-origin',
  );

  // Belt and braces with the noindex in the route's metadata: the meta tag only
  // reaches a crawler that renders HTML, and the header reaches every fetch.
  // Neither is a security control — robots directives are advisory, which is why
  // the link also expires and can be revoked — but a recipient pasting a link
  // into a public ticket is an accident worth closing.
  if (isShareLink) response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own static output, which is immutable and
    // served without a document context to protect.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
