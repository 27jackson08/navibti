'use client';

/**
 * Reading-comfort preferences, held in localStorage and read through
 * useSyncExternalStore.
 *
 * The obvious implementation — read localStorage in an effect, then setState —
 * has a flaw that matters more here than it would elsewhere: the first paint
 * uses the default surface, and only the second applies the stored one. For a
 * photophobia setting that is a flash of the bright version directly into the
 * eyes of the person who chose not to see it. The inline script in the document
 * head applies the attributes before first paint, and this hook simply reads
 * what is already there.
 */

import { useSyncExternalStore } from 'react';

export const SURFACE_KEY = 'navitbi-surface';
export const TEXT_KEY = 'navitbi-text';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function setPreference(key: string, value: string | null): void {
  const attribute = key === SURFACE_KEY ? 'data-surface' : 'data-text';

  if (value === null) {
    window.localStorage.removeItem(key);
    document.documentElement.removeAttribute(attribute);
  } else {
    window.localStorage.setItem(key, value);
    document.documentElement.setAttribute(attribute, value);
  }
  emit();
}

export function useDisplayPreference(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    // No preference is knowable on the server, so it renders as unset and the
    // operating system's own light/dark choice decides.
    () => null,
  );
}

/**
 * Applied before first paint. Kept as a string because it has to run as an
 * inline script, ahead of any React code.
 */
export const PREFERENCE_BOOTSTRAP = `
try {
  var s = localStorage.getItem('${SURFACE_KEY}');
  if (s) document.documentElement.setAttribute('data-surface', s);
  var t = localStorage.getItem('${TEXT_KEY}');
  if (t && t !== 'default') document.documentElement.setAttribute('data-text', t);
} catch (e) {}
`.trim();
