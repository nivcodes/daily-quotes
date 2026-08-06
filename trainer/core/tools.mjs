// The tool surface the model is given, and the dispatcher behind it.
//
// Same architectural stance as before: the model is the interface, not the
// brain. It decides when to call and how to phrase the answer; the numbers,
// streaks, and observations all come from tested code.

import { today } from './days.mjs';
import * as A from './accountability.mjs';
import { observations } from './patterns.mjs';
import { smoothWeights, observedRate } from '../engine/trend.mjs';
import { parseWeight, kgToLb } from '../engine/units.mjs';

const DAY_NAMES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const cadenceSchema = {
  type: 'object',
  description:
    'How often this is expected. Use "daily" for every day, "days" for specific weekdays, ' +
    '"perWeek" for "N times a week, whenever".',
  properties: {
    type: { type: 'string', enum: ['daily', 'days', 'perWeek'] },
    days: {
      type: 'array',
      items: { type: 'string', enum: Object.keys(DAY_NAMES) },
      description: 'Required when type is "days".',
    },
    count: { type: 'integer', description: 'Required when type is "perWeek".' },
  },
  required: ['type'],
};

function toCadence(input) {
  if (!input || input.type === 'daily') return { type: 'daily' };
  if (input.type === 'days') return { type: 'days', days: (input.days ?? []).map((d) => DAY_NAMES[d]) };
  return { type: 'perWeek', count: input.count ?? 3 };
}

export const TOOLS = [
  {
    name: 'get_status',
    description:
      'Current state of every commitment: streaks, adherence, what is due today and still unanswered, ' +
      'plus recent weight trend. Call this at the start of any conversation where you need to know how ' +
      'things are going, and before making any claim about the user\'s progress — never state a streak ' +
      'or a rate from memory.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_observations',
    description:
      'Patterns worth raising: goalpost-moving, slipping adherence, a weekday that keeps failing, ' +
      'commitments quietly abandoned, commitments that fail together. Call this during a check-in or ' +
      'weekly review. Returns them ranked; mention at most one unless the user asks for more.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'add_commitment',
    description:
      'Record something the user has said they will do. Call this whenever they commit to a repeating ' +
      'action ("I\'ll walk every morning", "gym Tuesdays and Thursdays"). Keep the text in their own words.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: "The commitment, in the user's own phrasing." },
        cadence: cadenceSchema,
      },
      required: ['text', 'cadence'],
    },
  },
  {
    name: 'revise_commitment',
    description:
      'Change an existing commitment\'s wording or frequency. Use this rather than archiving and re-adding, ' +
      'because it keeps the record of what changed — repeatedly easing the same commitment is a signal ' +
      'worth having.',
    input_schema: {
      type: 'object',
      properties: {
        commitment_id: { type: 'string' },
        text: { type: 'string' },
        cadence: cadenceSchema,
      },
      required: ['commitment_id'],
    },
  },
  {
    name: 'archive_commitment',
    description: 'Retire a commitment the user is genuinely done with. Confirm before calling.',
    input_schema: {
      type: 'object',
      properties: { commitment_id: { type: 'string' } },
      required: ['commitment_id'],
    },
  },
  {
    name: 'check_in',
    description:
      'Record whether a commitment happened. Call this as soon as the user tells you, in any phrasing — ' +
      '"went this morning" is a done, "didn\'t make it" is a missed. Use "skipped" only for legitimate ' +
      'interruptions (illness, travel); it neither extends nor breaks a streak.',
    input_schema: {
      type: 'object',
      properties: {
        commitment_id: { type: 'string' },
        status: { type: 'string', enum: ['done', 'missed', 'skipped'] },
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        note: { type: 'string', description: 'Anything the user said about why.' },
      },
      required: ['commitment_id', 'status'],
    },
  },
  {
    name: 'log_weight',
    description:
      'Record a weigh-in. Accepts "183", "83kg", "183.4 lb". Returns the smoothed trend, not the raw ' +
      'number — report the trend, since day-to-day scale movement is mostly water.',
    input_schema: {
      type: 'object',
      properties: {
        value: { type: 'string', description: 'As the user said it.' },
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
      },
      required: ['value'],
    },
  },
  {
    name: 'log_note',
    description:
      'Save anything else worth remembering: what they ate, how they slept, why a week was hard, ' +
      'something they are working toward. Call this liberally — remembering context is most of what ' +
      'makes this useful later.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
];

export function dispatch(state, name, input) {
  switch (name) {
    case 'get_status': {
      const s = A.summary(state);
      return { ...s, weight: weightSummary(state) };
    }

    case 'get_observations':
      return { observations: observations(state) };

    case 'add_commitment': {
      const c = A.addCommitment(state, { text: input.text, cadence: toCadence(input.cadence) });
      return { added: { id: c.id, text: c.text, cadence: c.cadence } };
    }

    case 'revise_commitment': {
      const c = A.reviseCommitment(state, input.commitment_id, {
        text: input.text,
        cadence: input.cadence ? toCadence(input.cadence) : undefined,
      });
      if (!c) return { error: 'no such commitment' };
      return { revised: { id: c.id, text: c.text, cadence: c.cadence, revisions: c.revisions.length } };
    }

    case 'archive_commitment': {
      const c = A.archiveCommitment(state, input.commitment_id);
      return c ? { archived: { id: c.id, text: c.text } } : { error: 'no such commitment' };
    }

    case 'check_in': {
      if (!A.getCommitment(state, input.commitment_id)) return { error: 'no such commitment' };
      A.checkIn(state, input.commitment_id, {
        status: input.status,
        date: input.date ?? today(),
        note: input.note,
      });
      return {
        recorded: input.status,
        streak: A.streak(state, input.commitment_id),
        adherence: A.adherence(state, input.commitment_id),
        weekProgress: A.weekProgress(state, input.commitment_id),
      };
    }

    case 'log_weight': {
      const kg = parseWeight(input.value);
      if (!kg) return { error: `could not read a weight from "${input.value}"` };
      const date = input.date ?? today();
      const existing = state.weights.find((w) => w.date === date);
      if (existing) existing.weightKg = kg;
      else state.weights.push({ date, weightKg: kg });
      return { recorded: { date, lb: Number(kgToLb(kg).toFixed(1)) }, ...weightSummary(state) };
    }

    case 'log_note':
      state.notes.push({ date: today(), text: input.text });
      return { saved: true };

    default:
      return { error: `unknown tool: ${name}` };
  }
}

export function weightSummary(state) {
  if (state.weights.length === 0) return { entries: 0 };
  const smoothed = smoothWeights(state.weights);
  const latest = smoothed[smoothed.length - 1];
  const rate = observedRate(state.weights);
  return {
    entries: state.weights.length,
    trendLb: Number(kgToLb(latest.trendKg).toFixed(1)),
    // Deliberately not the raw latest reading — see log_weight's description.
    rate: rate?.ready
      ? { ready: true, lbPerWeek: Number(kgToLb(rate.kgPerWeek).toFixed(2)), overDays: rate.spanDays }
      : { ready: false, reason: rate?.reason ?? 'no_data' },
  };
}
