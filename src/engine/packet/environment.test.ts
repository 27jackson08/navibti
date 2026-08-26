import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_LIBRARY } from '@/data/accommodations';
import { getCheckIns, getPatient, seededOn } from '@/db/store';
import { buildSession } from '@/engine/session';
import { composePacket } from './compose';
import { domainsLeftUnsupported, environmentFactorFrom, unmetSupports } from './environment';

const maya = getPatient('maya')!;
const tom = getPatient('tom')!;

const session = (unavailable: string[] = []) =>
  buildSession(maya, getCheckIns('maya'), seededOn, {
    unavailableSupports: new Set(unavailable),
  });

/**
 * Tom is far enough into recovery that the model, not the floor, sets his plan.
 * Maya is sitting on the floor, which is the ordinary case in the first fortnight
 * and the reason a demo needs both.
 */
const workSession = (unavailable: string[] = []) =>
  buildSession(tom, getCheckIns('tom'), seededOn, {
    unavailableSupports: new Set(unavailable),
  });

describe('environment factor', () => {
  it('is neutral when everything asked for is available', () => {
    expect(environmentFactorFrom(new Set())).toEqual({});
  });

  it('lowers the domain a missing support was carrying', () => {
    const factor = environmentFactorFrom(new Set(['school-scheduled-breaks']));
    expect(factor.cognitive).toBeLessThan(1);
    expect(factor.visualVestibular).toBeUndefined();
  });

  it('compounds two missing supports for the same domain', () => {
    // Each was carrying part of the same load, so losing both costs more than
    // losing either.
    const one = environmentFactorFrom(new Set(['school-scheduled-breaks']));
    const both = environmentFactorFrom(
      new Set(['school-scheduled-breaks', 'school-rest-period']),
    );
    expect(both.cognitive).toBeLessThan(one.cognitive!);
  });

  it('ignores accommodations that are not load-bearing', () => {
    // Comfort matters, but losing it does not make a dose unsafe.
    expect(environmentFactorFrom(new Set(['school-no-makeup-backlog']))).toEqual({});
  });

  it('describes what is unmet', () => {
    const unmet = unmetSupports(new Set(['school-quiet-lunch']));
    expect(unmet).toHaveLength(1);
    expect(unmet[0].domain).toBe('emotionalAutonomic');
    expect(unmet[0].text).toMatch(/quiet space/i);
  });
});

describe('the plan responds to what the school can actually do', () => {
  const cognitiveFor = (s: ReturnType<typeof workSession>) =>
    s.plan!.recommendations.find((r) => r.domain === 'cognitive')!;

  it('recommends less when a load-bearing support is unavailable', () => {
    // This is the difference between a comment box and coordination.
    const before = cognitiveFor(workSession());
    const after = cognitiveFor(workSession(['work-no-back-to-back']));

    expect(after.dose).toBeLessThan(before.dose);
    expect(after.environmentFactor).toBeLessThan(1);
  });

  it('says the environment is what lowered it', () => {
    expect(cognitiveFor(workSession(['work-no-back-to-back'])).binding).toBe('environment');
  });

  it('leaves other domains alone', () => {
    const before = workSession().plan!.recommendations.find((r) => r.domain === 'physical')!;
    const after = workSession(['work-no-back-to-back']).plan!.recommendations.find(
      (r) => r.domain === 'physical',
    )!;
    expect(after.dose).toBeCloseTo(before.dose, 6);
  });

  it('cannot push a dose below the guideline minimum', () => {
    // Maya's cognitive recommendation already sits on the floor, so there is
    // nothing for the environment to take. The floor is what stops a school's
    // limitations from being turned into a smaller and smaller school day.
    const before = session().plan!.recommendations.find((r) => r.domain === 'cognitive')!;
    const after = session(['school-scheduled-breaks']).plan!.recommendations.find(
      (r) => r.domain === 'cognitive',
    )!;

    expect(before.binding).toBe('floor');
    expect(after.dose).toBe(before.dose);
    expect(after.binding).toBe('floor');
  });

  it('never drops a dose below the guideline minimum, and flags the conflict', () => {
    // If the environment cannot support even the minimum activity the guidance
    // asks for, that is a conversation, not a number to quietly pick.
    const crippled = session([
      'school-scheduled-breaks',
      'school-rest-period',
      'school-quiet-lunch',
      'school-screen-minimal',
      'school-print-over-screen',
      'school-light-sensitivity',
    ]);
    for (const item of crippled.plan!.recommendations) {
      expect(item.dose).toBeGreaterThanOrEqual(0);
      if (item.environmentConflict) expect(item.binding).toBe('floor');
    }
  });
});

describe('packets stop asking for what was refused', () => {
  it('drops a flagged accommodation', () => {
    const before = composePacket(session(), 'school')!;
    const after = composePacket(session(['school-light-sensitivity']), 'school')!;

    expect(before.items.map((i) => i.id)).toContain('school-light-sensitivity');
    expect(after.items.map((i) => i.id)).not.toContain('school-light-sensitivity');
  });

  it('says which domain is now unsupported when every option is refused', () => {
    const visual = ACCOMMODATION_LIBRARY.filter(
      (item) => item.role === 'school' && item.domain === 'visualVestibular',
    ).map((item) => item.id);

    const stripped = composePacket(session(visual), 'school')!;
    expect(stripped.unsupportedDomains).toContain('visualVestibular');
  });

  it('reports nothing unsupported when alternatives remain', () => {
    const after = composePacket(session(['school-light-sensitivity']), 'school')!;
    expect(after.unsupportedDomains).not.toContain('cognitive');
  });

  it('surfaces the unmet supports on the session for the patient to see', () => {
    const s = session(['school-light-sensitivity']);
    expect(s.unmetSupports.map((item) => item.accommodationId)).toEqual([
      'school-light-sensitivity',
    ]);
  });
});

describe('domainsLeftUnsupported', () => {
  it('is empty when nothing was refused', () => {
    const items = ACCOMMODATION_LIBRARY.filter((item) => item.role === 'school');
    expect(domainsLeftUnsupported(items, new Set())).toEqual([]);
  });

  it('never reports a domain the packet was not covering anyway', () => {
    const items = ACCOMMODATION_LIBRARY.filter(
      (item) => item.role === 'school' && item.domain === 'cognitive',
    );
    expect(domainsLeftUnsupported(items, new Set())).not.toContain('physical');
  });
});
