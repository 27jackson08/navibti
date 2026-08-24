/**
 * NaviTBI persistence schema.
 *
 * Two decisions here are load-bearing rather than incidental:
 *
 *  1. `modelSnapshots` stores the full posterior each day, not a point
 *     estimate. Without it the history view cannot show uncertainty, the
 *     evaluation harness cannot replay a trajectory, and a clinician cannot
 *     see how confident the estimate was on the day it was acted on.
 *
 *  2. `packets` are versioned and `shareLinks` are scoped, expiring and
 *     revocable. A school keeps a copy of what we send; we need to know which
 *     copy they have, and the patient needs to be able to take it back.
 */

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const protocolEnum = pgEnum('protocol', ['return-to-learn', 'return-to-sport']);
export const roleEnum = pgEnum('packet_role', ['school', 'employer', 'caregiver', 'clinician']);
export const loadDomainEnum = pgEnum('load_domain', [
  'cognitive',
  'visualVestibular',
  'physical',
  'sleepFatigue',
  'emotionalAutonomic',
]);

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  /** Drives which escalation window applies. Not used for anything else. */
  isMinor: boolean('is_minor').notNull().default(false),
  injuryDate: date('injury_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per day. `deltaPoints` and `deltaDurationMinutes` are the two fields
 * the tolerance model is fitted against — they encode the guideline's
 * "mild and brief" test directly, measured against the pre-activity value.
 */
export const checkIns = pgTable(
  'check_ins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    preActivitySeverity: real('pre_activity_severity').notNull(),
    worstSeverity: real('worst_severity').notNull(),
    deltaPoints: real('delta_points').notNull(),
    deltaDurationMinutes: integer('delta_duration_minutes').notNull(),
    sleepHours: real('sleep_hours'),
    notes: text('notes'),
    /** True when any CRT6 flag was reported. No plan is generated for this day. */
    redFlagged: boolean('red_flagged').notNull().default(false),
    redFlagIds: jsonb('red_flag_ids').$type<string[]>().notNull().default([]),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('check_ins_patient_day').on(table.patientId, table.day)],
);

/** Actual load logged per domain, in that domain's unit. */
export const exposures = pgTable(
  'exposures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checkInId: uuid('check_in_id')
      .notNull()
      .references(() => checkIns.id, { onDelete: 'cascade' }),
    domain: loadDomainEnum('domain').notNull(),
    dose: real('dose').notNull(),
    unit: text('unit').notNull(),
  },
  (table) => [uniqueIndex('exposures_check_in_domain').on(table.checkInId, table.domain)],
);

export const stageTransitions = pgTable(
  'stage_transitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    protocol: protocolEnum('protocol').notNull(),
    fromStep: smallint('from_step'),
    toStep: smallint('to_step').notNull(),
    /** Why the stage machine moved. Never 'model' — the model cannot advance a stage. */
    reason: text('reason').notNull(),
    /** Set only where a human recorded clearance outside the app. */
    clearanceRecordedBy: text('clearance_recorded_by'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('stage_transitions_patient').on(table.patientId, table.occurredAt)],
);

/**
 * The posterior after each day's update, stored whole.
 *
 * `meanWeights` and `covariance` are the Normal-Inverse-Gamma parameters; the
 * point estimate anyone sees on screen is derived from these, never stored
 * instead of them.
 */
export const modelSnapshots = pgTable(
  'model_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    meanWeights: jsonb('mean_weights').$type<Record<string, number>>().notNull(),
    covariance: jsonb('covariance').$type<number[][]>().notNull(),
    shape: real('shape').notNull(),
    rate: real('rate').notNull(),
    observationCount: integer('observation_count').notNull(),
    /** False until MIN_CHECK_INS_FOR_PERSONALIZATION is met; UI labels it provisional. */
    isPersonalized: boolean('is_personalized').notNull().default(false),
  },
  (table) => [uniqueIndex('model_snapshots_patient_day').on(table.patientId, table.day)],
);

/** The recommended dose per domain, plus which of the three caps bound it. */
export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    protocol: protocolEnum('protocol').notNull(),
    step: smallint('step').notNull(),
    doses: jsonb('doses').$type<Record<string, number>>().notNull(),
    /** Per domain: 'model' | 'ramp' | 'stage'. Drives the "why this number" copy. */
    bindingConstraint: jsonb('binding_constraint').$type<Record<string, string>>().notNull(),
    attribution: jsonb('attribution').$type<unknown>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('plans_patient_day').on(table.patientId, table.day)],
);

/**
 * Versioned because a recipient keeps their copy. We regenerate only on
 * material change and can show what moved since the version they hold.
 */
export const packets = pgTable(
  'packets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    version: integer('version').notNull(),
    /** Ids from the accommodation library. The composer selects; it never writes. */
    accommodationIds: jsonb('accommodation_ids').$type<string[]>().notNull(),
    renderedBody: text('rendered_body').notNull(),
    supersedesId: uuid('supersedes_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('packets_patient_role_version').on(table.patientId, table.role, table.version)],
);

export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    token: text('token').notNull().unique(),
    /** Patient's choice: share tolerance bands without raw symptom scores. */
    includesRawSymptoms: boolean('includes_raw_symptoms').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('share_links_patient').on(table.patientId)],
);

/** Who opened what, and when. The patient can see this. */
export const accessLog = pgTable(
  'access_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareLinkId: uuid('share_link_id')
      .notNull()
      .references(() => shareLinks.id, { onDelete: 'cascade' }),
    packetVersion: integer('packet_version'),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('access_log_link').on(table.shareLinkId, table.accessedAt)],
);
