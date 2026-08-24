import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPatient } from '@/db/store';
import { CheckInFlow } from './CheckInFlow';

export const dynamic = 'force-dynamic';

export default async function CheckInPage({ params }: PageProps<'/[patient]/check-in'>) {
  const { patient: patientId } = await params;
  const patient = getPatient(patientId);
  if (!patient) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <nav className="flex items-baseline justify-between gap-4">
        <Link href={`/${patient.id}/today`} className="font-mono text-xs text-ink-faint hover:text-ink">
          ← Back to today
        </Link>
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-faint">
          About a minute
        </span>
      </nav>

      <div className="mt-8">
        <CheckInFlow patientId={patient.id} patientName={patient.displayName} />
      </div>
    </main>
  );
}
