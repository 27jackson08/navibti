'use client';

/**
 * Schools file paper. The print stylesheet has existed since the packets did;
 * nothing invited anyone to use it.
 */
export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-0 border border-rule px-4 py-2 font-mono text-xs text-ink-soft hover:border-ink-faint hover:text-ink print:hidden"
    >
      {label}
    </button>
  );
}
