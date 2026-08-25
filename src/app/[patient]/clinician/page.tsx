import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClinicianSummaryView } from '@/components/packet/ClinicianSummaryView';
import { getCheckIns, getPatient } from '@/db/store';
import { clinicianSummary } from '@/engine/packet/clinician';
import { isoDay } from '@/engine/session';

export const dynamic = 'force-dynamic';

export default async function ClinicianPage({ params }: PageProps<'/[patient]/clinician'>) {
  const { patient: patientId } = await params;
  const patient = getPatient(patientId);
  if (!patient) notFound();

  const summary = clinicianSummary(patient, getCheckIns(patient.id), isoDay(new Date()));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
      <nav className="flex items-baseline justify-between gap-4 print:hidden">
        <Link href={`/${patient.id}/today`} className="font-mono text-xs text-ink-faint hover:text-ink">
          ← Back to today
        </Link>
        <Link href={`/${patient.id}/sharing`} className="font-mono text-xs text-accent">
          Share this →
        </Link>
      </nav>
      <div className="mt-10">
        <ClinicianSummaryView summary={summary} includeRawSymptoms />
      </div>
    </main>
  );
}
