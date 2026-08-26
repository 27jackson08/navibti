import { NextResponse } from 'next/server';
import { issueActorCookie } from '@/auth/actor';
import { getPatient } from '@/db/store';

/**
 * Entering a patient's record. Sets the acting-as cookie and redirects.
 *
 * A route handler rather than middleware because signing needs node:crypto, and
 * rather than a Server Component because those cannot set cookies.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ patient: string }> },
) {
  const { patient: patientId } = await params;
  if (!getPatient(patientId)) return new NextResponse('Not found', { status: 404 });

  const response = NextResponse.redirect(new URL(`/${patientId}/today`, request.url));
  const cookie = issueActorCookie(patientId, new URL(request.url).protocol === 'https:');
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
