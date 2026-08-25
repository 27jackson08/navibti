import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_LIBRARY, ACCOMMODATION_PLACEHOLDERS } from '@/data/accommodations';
import { getCheckIns, getPatient } from '@/db/store';
import { buildSession, isoDay, type Session } from '@/engine/session';
import { composePacket, diffPackets, selectAccommodations, signatureOf } from './compose';
import { deriveSlots, fillSlots } from './slots';
import { applyRewrites, validateRewrite } from './validate';

function sessionFor(id: string): Session {
  const patient = getPatient(id);
  if (!patient) throw new Error(`no seeded patient ${id}`);
  return buildSession(patient, getCheckIns(id), isoDay(new Date()));
}

const maya = sessionFor('maya');
const daniel = sessionFor('daniel');

describe('slot derivation', () => {
  const slots = deriveSlots(daniel.plan!);

  it('produces a value for every slot the library can use', () => {
    for (const placeholder of ACCOMMODATION_PLACEHOLDERS) {
      expect(slots[placeholder], placeholder).toBeDefined();
      expect(slots[placeholder]).not.toBe('');
    }
  });

  it('keeps a working block schedulable', () => {
    const minutes = Number(slots.workMinutes);
    expect(minutes).toBeGreaterThanOrEqual(10);
    expect(minutes).toBeLessThanOrEqual(45);
  });

  const withCognitive = (dose: number) =>
    deriveSlots({
      ...daniel.plan!,
      recommendations: daniel.plan!.recommendations.map((item) =>
        item.domain === 'cognitive' ? { ...item, dose } : item,
      ),
    });

  it('gives proportionally more recovery to someone with less capacity', () => {
    const ratio = (dose: number) => {
      const slot = withCognitive(dose);
      return Number(slot.breakMinutes) / Number(slot.workMinutes);
    };
    expect(ratio(30)).toBeGreaterThan(ratio(300));
  });

  it('never asks for a break longer than the block it follows', () => {
    // "A 15-minute break after every 10 minutes of work" is not something a
    // timetable can carry out.
    for (const dose of [20, 45, 120, 300]) {
      const slot = withCognitive(dose);
      expect(Number(slot.breakMinutes), `at ${dose} minutes`).toBeLessThanOrEqual(
        Number(slot.workMinutes),
      );
    }
  });

  it('never proposes a full day when concentration is very limited', () => {
    expect(withCognitive(45).hours).toBe('1 hour');
    expect(withCognitive(20).hours).toMatch(/minutes$/);
  });

  it('carries its own unit, so no template has to pluralise', () => {
    // A letter to a school saying "1 hours of class" undermines everything else
    // in the document.
    expect(withCognitive(60).hours).toBe('1 hour');
    expect(withCognitive(180).hours).toBe('3 hours');
    expect(withCognitive(150).hours).toBe('2.5 hours');
  });

  it('budgets meetings against the concentration allowance', () => {
    const heavy = deriveSlots({
      ...daniel.plan!,
      recommendations: daniel.plan!.recommendations.map((item) =>
        item.domain === 'cognitive' ? { ...item, dose: 300 } : item,
      ),
    });
    const light = deriveSlots({
      ...daniel.plan!,
      recommendations: daniel.plan!.recommendations.map((item) =>
        item.domain === 'cognitive' ? { ...item, dose: 40 } : item,
      ),
    });
    expect(Number(heavy.meetingCount)).toBeGreaterThan(Number(light.meetingCount));
    expect(Number(light.meetingCount)).toBe(0);
  });

  it('starts the day later when there is little room for sleep debt', () => {
    const fragile = deriveSlots({
      ...daniel.plan!,
      recommendations: daniel.plan!.recommendations.map((item) =>
        item.domain === 'sleepFatigue' ? { ...item, dose: 0.5 } : item,
      ),
    });
    expect(fragile.earliestHour).toBe('10am');
  });
});

describe('fillSlots', () => {
  const slots = deriveSlots(daniel.plan!);

  it('leaves no mustache behind for any item in the library', () => {
    for (const item of ACCOMMODATION_LIBRARY) {
      expect(fillSlots(item.text, slots), item.id).not.toMatch(/\{\{|\}\}/);
    }
  });

  it('refuses an unknown slot rather than shipping it to a school', () => {
    expect(() => fillSlots('Allow {{nonsense}} per day.', slots)).toThrow(/unknown slot/);
  });
});

describe('selection', () => {
  it('only offers items for the requested role', () => {
    for (const item of selectAccommodations(daniel, 'employer')) {
      expect(item.role).toBe('employer');
    }
  });

  it('produces something for every role a patient has', () => {
    for (const role of maya.patient.roles) {
      expect(selectAccommodations(maya, role).length, role).toBeGreaterThan(0);
    }
  });

  it('orders by priority so the most important adjustment leads', () => {
    const priorities = selectAccommodations(daniel, 'employer').map((item) => item.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });

  it('drops items once the patient has outgrown their step range', () => {
    const early = { ...maya, learnStage: { ...maya.learnStage, step: 2 } };
    const late = { ...maya, learnStage: { ...maya.learnStage, step: 4 } };
    expect(selectAccommodations(late, 'school').length).toBeLessThan(
      selectAccommodations(early, 'school').length,
    );
  });

  it('stages physical items on the sport ladder when the patient is on one', () => {
    // Maya is on Return-to-Sport, so the gym-class restriction has to follow
    // that ladder rather than her school progress.
    const items = selectAccommodations(maya, 'school');
    const physical = items.filter((item) => item.domain === 'physical');
    expect(physical.length).toBeGreaterThan(0);
  });
});

describe('composing a packet', () => {
  const packet = composePacket(daniel, 'employer')!;

  it('names the patient and the role', () => {
    expect(packet.patientName).toBe('Daniel');
    expect(packet.intro).toContain('Daniel');
    expect(packet.title).toMatch(/workplace/i);
  });

  it('carries a source for every item', () => {
    expect(packet.sources.length).toBeGreaterThan(0);
    for (const item of packet.items) {
      expect(packet.sources.map((source) => source.id)).toContain(item.citation);
    }
  });

  it('states the school clearance asymmetry in the school packet', () => {
    const school = composePacket(maya, 'school')!;
    expect(school.intro).toMatch(/clearance is not required to return to school/i);
  });

  it('produces no packet on a red-flag day', () => {
    const halted: Session = { ...daniel, plan: null };
    expect(composePacket(halted, 'employer')).toBeNull();
  });
});

describe('versioning by content, not by clock', () => {
  it('gives an unchanged packet an unchanged signature', () => {
    const a = composePacket(daniel, 'employer')!;
    const b = composePacket({ ...daniel, today: '2099-01-01' }, 'employer')!;
    expect(b.signature).toBe(a.signature);
  });

  it('changes the signature when a number in the letter changes', () => {
    const a = composePacket(daniel, 'employer')!;
    const shifted: Session = {
      ...daniel,
      plan: {
        ...daniel.plan!,
        recommendations: daniel.plan!.recommendations.map((item) =>
          item.domain === 'cognitive' ? { ...item, dose: item.dose + 120 } : item,
        ),
      },
    };
    expect(composePacket(shifted, 'employer')!.signature).not.toBe(a.signature);
  });
});

describe('diffing, so a recipient sees what moved', () => {
  const current = composePacket(daniel, 'employer')!;

  it('reports no changes against itself', () => {
    expect(diffPackets(current, current).hasChanges).toBe(false);
  });

  it('treats a first issue as everything added', () => {
    const diff = diffPackets(null, current);
    expect(diff.added).toHaveLength(current.items.length);
    expect(diff.removed).toHaveLength(0);
  });

  it('reports a reworded item as changed rather than added and removed', () => {
    const edited = {
      ...current,
      items: current.items.map((item, index) =>
        index === 0 ? { ...item, text: `${item.text} (revised)` } : item,
      ),
    };
    const diff = diffPackets(current, edited);
    expect(diff.changed).toHaveLength(1);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('reports a dropped item as removed', () => {
    const shorter = { ...current, items: current.items.slice(1) };
    const diff = diffPackets(current, shorter);
    expect(diff.removed).toHaveLength(1);
  });

  it('signs only content, so the same items produce the same signature', () => {
    expect(signatureOf(current.items)).toBe(signatureOf([...current.items]));
  });
});

describe('the rewrite guard', () => {
  const packet = composePacket(daniel, 'employer')!;
  const item = packet.items.find((entry) => /\d/.test(entry.text))!;

  it('accepts a genuine rephrasing', () => {
    const rephrased = item.text.replace(/^Cap/, 'Please cap');
    expect(validateRewrite(item, rephrased === item.text ? item.text : rephrased)).toEqual([]);
  });

  it('rejects an invented number', () => {
    const violations = validateRewrite(item, `${item.text} Aim for 3 short walks too.`);
    expect(violations.map((violation) => violation.kind)).toContain('invented-number');
  });

  it('rejects a dropped limit', () => {
    const violations = validateRewrite(item, 'Keep meetings light where you can.');
    expect(violations.map((violation) => violation.kind)).toContain('dropped-number');
  });

  it.each([
    ['Daniel has been cleared for full duties.', 'issuing clearance'],
    ['Consider medication if symptoms persist.', 'medication advice'],
    ['An MRI may be warranted.', 'imaging advice'],
    ['This guarantees a full recovery.', 'guaranteeing an outcome'],
  ])('rejects %s', (text) => {
    const violations = validateRewrite(item, `${item.text} ${text}`);
    expect(violations.some((violation) => violation.kind === 'forbidden-language')).toBe(true);
  });

  it('rejects a rewrite that grew enough to have added something', () => {
    const violations = validateRewrite(item, `${item.text} ${item.text} ${item.text}`);
    expect(violations.map((violation) => violation.kind)).toContain('excessive-length');
  });

  it('falls back to the template rather than shipping a bad rewrite', () => {
    const result = applyRewrites(packet, { [item.id]: 'Take it easy.' });
    expect(result.rejected).toContain(item.id);
    expect(result.items.find((entry) => entry.id === item.id)?.text).toBe(item.text);
  });

  it('refuses to add an item nobody selected', () => {
    const result = applyRewrites(packet, { 'invented-accommodation': 'Do yoga.' });
    expect(result.violations.map((violation) => violation.kind)).toContain('unselected-item');
    expect(result.items).toHaveLength(packet.items.length);
  });

  it('keeps a rewrite that passes every check', () => {
    const safe = item.text.replace(/\.$/, ' where possible.');
    const result = applyRewrites(packet, { [item.id]: safe });
    if (validateRewrite(item, safe).length === 0) {
      expect(result.items.find((entry) => entry.id === item.id)?.text).toBe(safe);
      expect(result.rejected).not.toContain(item.id);
    }
  });
});

describe('the red-flag card', () => {
  it('is attached to the caregiver packet', () => {
    const packet = composePacket(maya, 'caregiver')!;
    expect(packet.redFlags).not.toBeNull();
    expect(packet.redFlags?.items).toHaveLength(10);
    expect(packet.redFlags?.instruction).toMatch(/urgent medical care/i);
  });

  it('is not attached to a school or employer packet', () => {
    // A school is not the right audience for an emergency list; a caregiver is
    // the person who will be in the room.
    expect(composePacket(maya, 'school')!.redFlags).toBeNull();
    expect(composePacket(daniel, 'employer')!.redFlags).toBeNull();
  });

  it('does not change the content signature, being fixed content', () => {
    const a = composePacket(maya, 'caregiver')!;
    const b = composePacket({ ...maya, today: '2099-01-01' }, 'caregiver')!;
    expect(a.signature).toBe(b.signature);
  });
});
