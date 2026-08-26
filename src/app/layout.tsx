import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { IBM_Plex_Mono, Newsreader, Public_Sans } from 'next/font/google';
import { Announcer } from '@/components/ui/Announcer';
import { SurfaceControls } from '@/components/ui/SurfaceControls';
import { PREFERENCE_BOOTSTRAP } from '@/hooks/useDisplayPreference';
import './globals.css';

/**
 * Newsreader is a low-contrast screen serif, chosen because low-contrast
 * letterforms hold up better for a reader with light sensitivity than a high
 * -contrast display face does. Public Sans is the typeface of US federal forms,
 * which is the world these accommodation letters live in.
 */
const display = Newsreader({ variable: '--font-display', subsets: ['latin'], display: 'swap' });
const body = Public_Sans({ variable: '--font-body', subsets: ['latin'], display: 'swap' });
const mono = IBM_Plex_Mono({
  variable: '--font-mono-data',
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NaviTBI',
  description:
    'Turns a concussion patient’s daily tolerance into accommodations their school, workplace and family can actually act on.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Set per request by middleware.ts, which also names it in the CSP.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored surface before first paint. Without this, a user
            who chose the dim surface gets one frame of the bright one. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PREFERENCE_BOOTSTRAP }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Announcer>
          <SurfaceControls />
          {children}
        </Announcer>
      </body>
    </html>
  );
}
