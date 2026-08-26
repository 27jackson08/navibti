'use client';

/**
 * Reading the check-in aloud.
 *
 * The point is not novelty. A daily check-in that requires looking at a lit
 * screen is a check-in a photophobic person skips on exactly the days worth
 * recording — the bad ones. Hearing the question means the log survives the
 * days it most needs to.
 *
 * Opt-in, never automatic. Speech starting unbidden is its own kind of assault
 * on someone with a headache.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'navitbi-speech';

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function noopSubscribe(): () => void {
  return () => {};
}

export function useSpeech() {
  // Read through useSyncExternalStore rather than setState in an effect: the
  // effect version renders once with speech off and once with it on, which is
  // a cascading render for a value that was already knowable.
  const enabled = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(STORAGE_KEY) === 'on',
    () => false,
  );

  const supported = useSyncExternalStore(
    noopSubscribe,
    () => 'speechSynthesis' in window,
    () => false,
  );

  const lastSpoken = useRef<string | null>(null);

  const toggle = useCallback(() => {
    const next = window.localStorage.getItem(STORAGE_KEY) === 'on' ? 'off' : 'on';
    window.localStorage.setItem(STORAGE_KEY, next);
    if (next === 'off' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    for (const listener of listeners) listener();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !supported) return;
      // Repeating a prompt because a component re-rendered would be maddening
      // rather than helpful.
      if (lastSpoken.current === text) return;
      lastSpoken.current = text;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    },
    [enabled, supported],
  );

  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  return { enabled, supported, toggle, speak };
}
