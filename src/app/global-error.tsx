'use client';

/**
 * The last resort: an error in the root layout itself, which replaces the whole
 * document rather than rendering inside it.
 *
 * Styled inline on purpose. This is the one page that renders when the layout —
 * and therefore the stylesheet, the fonts and the surface preference — may not
 * have loaded, so anything that depends on them is a second thing to go wrong.
 * Colours are fixed rather than themed for the same reason, and chosen to be
 * readable rather than bright.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '3rem 1.25rem',
          background: '#f7f6f3',
          color: '#1a1a1a',
          font: '16px/1.6 system-ui, sans-serif',
        }}
      >
        <main style={{ margin: '0 auto', maxWidth: '38rem' }}>
          <h1 style={{ fontSize: '1.75rem', lineHeight: 1.15, margin: '0 0 1rem' }}>
            NaviTBI could not load
          </h1>
          <p style={{ margin: '0 0 1rem' }}>
            Nothing has been changed or lost. Reloading usually fixes it.
          </p>
          <p
            style={{
              borderLeft: '2px solid #8b1a1a',
              background: '#fbeaea',
              padding: '0.9rem 1rem',
              margin: '1.5rem 0',
            }}
          >
            <strong>Do not wait for this to work.</strong> If someone has a symptom that worries
            you, get urgent medical care now, and call emergency services if symptoms are severe or
            worsening quickly.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: '1px solid #1a1a1a',
              background: '#1a1a1a',
              color: '#f7f6f3',
              padding: '0.75rem 1.25rem',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#555' }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
