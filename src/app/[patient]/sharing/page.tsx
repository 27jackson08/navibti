import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { accessFor, isLive, listShareLinks, type ShareRole } from '@/db/share';
import { getPatient } from '@/db/store';
import { RevokeButton } from './RevokeButton';
import { ShareForm } from './ShareForm';

export const dynamic = 'force-dynamic';

export default async function SharingPage({ params }: PageProps<'/[patient]/sharing'>) {
  const { patient: patientId } = await params;
  const patient = getPatient(patientId);
  if (!patient) notFound();

  const roles: ShareRole[] = [...patient.roles, 'clinician'];
  const links = listShareLinks(patient.id);

  // A bare path is not something anyone can send. Build the absolute URL from
  // the request so what is on screen is what gets pasted into an email.
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <nav>
        <Link href={`/${patient.id}/today`} className="font-mono text-xs text-ink-faint hover:text-ink">
          ← Back to today
        </Link>
      </nav>

      <h1 className="mt-6 text-[clamp(1.9rem,1.4rem+2vw,2.8rem)] leading-[1.08]">
        Who can see {patient.displayName}’s plan
      </h1>
      <p className="mt-4 max-w-[56ch] text-ink-soft">
        Anyone with a link can open it — no account needed, which is the point. So each link is
        scoped to one audience, expires on a date {patient.displayName} chooses, can be revoked
        instantly, and records every time it is opened.
      </p>

      <div className="mt-8">
        <ShareForm patientId={patient.id} patientName={patient.displayName} roles={roles} />
      </div>

      <section className="mt-12">
        <h2 className="border-t border-rule pt-5 text-xl">Existing links</h2>

        {links.length === 0 ? (
          <p className="mt-4 text-ink-soft">No links yet.</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-px bg-rule">
            {links.map((link) => {
              const views = accessFor(link.id);
              const live = isLive(link);
              return (
                <li key={link.id} className="flex flex-col gap-3 bg-ground p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="font-medium">{link.label}</p>
                      <p className="font-mono text-xs text-ink-faint">
                        <span className="capitalize">{link.role}</span> ·{' '}
                        {live ? `expires ${link.expiresAt.slice(0, 10)}` : 'no longer active'}
                        {link.includesRawSymptoms && ' · includes symptom scores'}
                      </p>
                    </div>
                    {live && (
                      <RevokeButton
                        patientId={patient.id}
                        linkId={link.id}
                        linkLabel={link.label}
                      />
                    )}
                  </div>

                  {live && (
                    <a
                      href={`/s/${link.token}`}
                      className="overflow-x-auto whitespace-nowrap border border-rule bg-surface-sunken px-3 py-2 font-mono text-xs text-accent"
                    >
                      {origin}/s/{link.token}
                    </a>
                  )}

                  <p className="font-mono text-xs text-ink-faint">
                    {views.length === 0
                      ? 'Not opened yet'
                      : `Opened ${views.length} time${views.length === 1 ? '' : 's'}, last ${views.at(-1)!.at.slice(0, 16).replace('T', ' ')}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
