'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Says out loud what a control just did.
 *
 * Every response in this app re-renders on the server, which moves the thing
 * that was acted on somewhere else on the page — a flagged accommodation leaves
 * the list and reappears under "you've told us these aren't possible". Two
 * things break in that moment and neither is visible to an axe scan, because
 * axe reads a static snapshot and this is a defect in the transition:
 *
 *   nothing is announced   the page changed underneath a screen reader user
 *                          with no indication that their click did anything
 *   focus is lost          the button they pressed no longer exists, so focus
 *                          falls to <body> and their place on the page is gone
 *
 * One region fixes both. The message is announced by the live region, and focus
 * moves onto it, so the confirmation is where the user's attention already is
 * rather than at the top of a re-rendered document.
 */
const AnnounceContext = createContext<(message: string) => void>(() => {});

export function useAnnounce(): (message: string) => void {
  return useContext(AnnounceContext);
}

export function Announcer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const region = useRef<HTMLParagraphElement>(null);

  // Focus has to wait for the render that reveals the region. Calling focus()
  // in the same tick as setMessage silently does nothing: the element is still
  // `hidden` at that point, and focusing a hidden element is a no-op — so the
  // fix reads as working while focus stays exactly where it fell.
  useEffect(() => {
    if (message) region.current?.focus();
  }, [message]);

  return (
    <AnnounceContext.Provider value={setMessage}>
      {children}
      {/*
        Visible, not sr-only. Focusing something invisible leaves a sighted
        keyboard user with no focus ring and no idea where they are, which
        trades one group's problem for another's.
      */}
      <p
        ref={region}
        role="status"
        tabIndex={-1}
        // Clears when the user moves on, so a confirmation does not sit over
        // the page for the rest of the session.
        onBlur={() => setMessage('')}
        className={`fixed bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 border border-accent bg-surface px-4 py-2 text-sm shadow-sm print:hidden ${
          message ? '' : 'hidden'
        }`}
      >
        {message}
      </p>
    </AnnounceContext.Provider>
  );
}
