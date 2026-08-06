// Agentic-loop wiring, with a stubbed client. Run: node trainer/core/loop.test.mjs
//
// This covers the part that has no unit-testable seam otherwise: that tool_use
// blocks get dispatched, that results are handed back with the right ids, and
// that the loop terminates. It needs no API key and makes no network call.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyState, save, load } from './store.mjs';
import { respond } from './coach.mjs';
import { createSession } from '../channels/adapter.mjs';

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

/** A client that replays a scripted list of responses and records requests. */
function stubClient(responses) {
  const requests = [];
  return {
    requests,
    messages: {
      create: async (req) => {
        requests.push(req);
        const next = responses.shift();
        if (!next) throw new Error('stub client ran out of scripted responses');
        return next;
      },
    },
  };
}

const text = (t) => ({ type: 'text', text: t });
const toolUse = (id, name, input) => ({ type: 'tool_use', id, name, input });

test('a tool call is dispatched and its result fed back', async () => {
  const state = emptyState();
  const client = stubClient([
    {
      stop_reason: 'tool_use',
      content: [toolUse('t1', 'add_commitment', { text: 'walk after dinner', cadence: { type: 'daily' } })],
    },
    { stop_reason: 'end_turn', content: [text('Got it — walking after dinner, every day.')] },
  ]);

  const reply = await respond(state, "I'm going to walk after dinner every day", { client });

  assert.equal(reply, 'Got it — walking after dinner, every day.');
  assert.equal(state.commitments.length, 1);
  assert.equal(state.commitments[0].text, 'walk after dinner');

  // The second request must carry a tool_result matching the tool_use id.
  const followup = client.requests[1].messages.at(-1);
  assert.equal(followup.role, 'user');
  assert.equal(followup.content[0].type, 'tool_result');
  assert.equal(followup.content[0].tool_use_id, 't1');
  assert.ok(JSON.parse(followup.content[0].content).added);
});

test('several tool calls in one turn all come back in a single user message', async () => {
  const state = emptyState();
  const client = stubClient([
    {
      stop_reason: 'tool_use',
      content: [
        toolUse('a', 'add_commitment', { text: 'gym', cadence: { type: 'days', days: ['tue', 'thu'] } }),
        toolUse('b', 'log_note', { text: 'wants to feel less winded on stairs' }),
      ],
    },
    { stop_reason: 'end_turn', content: [text('Noted.')] },
  ]);

  await respond(state, 'gym tuesdays and thursdays; I want to stop getting winded', { client });

  const followup = client.requests[1].messages.at(-1);
  assert.equal(followup.content.length, 2, 'both results in one message');
  assert.deepEqual(followup.content.map((r) => r.tool_use_id), ['a', 'b']);
  assert.equal(state.commitments.length, 1);
  assert.equal(state.notes.length, 1);
});

test('a throwing tool returns an error result instead of crashing the turn', async () => {
  const state = emptyState();
  const client = stubClient([
    { stop_reason: 'tool_use', content: [toolUse('t1', 'check_in', { commitment_id: 'x', status: 'nope' })] },
    { stop_reason: 'end_turn', content: [text('Let me try that differently.')] },
  ]);

  const reply = await respond(state, 'done', { client });
  assert.equal(reply, 'Let me try that differently.');
  // Unknown id is handled in dispatch; an invalid status throws and is caught.
  const result = client.requests[1].messages.at(-1).content[0];
  assert.ok(result.is_error || JSON.parse(result.content).error);
});

test('a refusal is handled before the content array is read', async () => {
  const state = emptyState();
  const client = stubClient([{ stop_reason: 'refusal', content: [], stop_details: { category: 'bio' } }]);
  const reply = await respond(state, '...', { client });
  assert.match(reply, /can't help/);
});

test('the loop gives up rather than spinning forever', async () => {
  const state = emptyState();
  const forever = Array.from({ length: 10 }, () => ({
    stop_reason: 'tool_use',
    content: [toolUse('t', 'get_status', {})],
  }));
  const reply = await respond(state, 'hi', { client: stubClient(forever), maxTurns: 3 });
  assert.match(reply, /stuck in a loop/);
});

test('the system prompt is cached and carries today\'s date', async () => {
  const state = emptyState();
  const client = stubClient([{ stop_reason: 'end_turn', content: [text('hi')] }]);
  await respond(state, 'hello', { client });

  const [system] = client.requests[0].system;
  assert.deepEqual(system.cache_control, { type: 'ephemeral' });
  assert.match(system.text, /Today is \w+day, \d{4}-\d{2}-\d{2}\./);
  assert.equal(client.requests[0].model, 'claude-opus-5');
  assert.ok(client.requests[0].max_tokens >= 4096, 'thinking shares the budget');
});

test('a session persists across restarts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trainer-'));
  const dataPath = join(dir, 'data.json');
  try {
    const client = stubClient([
      { stop_reason: 'tool_use', content: [toolUse('t1', 'add_commitment', { text: 'stretch', cadence: { type: 'daily' } })] },
      { stop_reason: 'end_turn', content: [text('Logged.')] },
    ]);

    const session = createSession({ dataPath, client });
    await session.handle('I will stretch daily');

    const reopened = createSession({ dataPath, client: stubClient([]) });
    assert.equal(reopened.state.commitments.length, 1);
    assert.equal(reopened.state.commitments[0].text, 'stretch');
    assert.equal(reopened.status().commitments[0].text, 'stretch');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a hand-edited file missing a key still loads', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trainer-'));
  const dataPath = join(dir, 'data.json');
  try {
    const partial = emptyState();
    delete partial.notes;
    save(partial, dataPath);
    assert.deepEqual(load(dataPath).notes, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- runner

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}
console.log(`\n${passed}/${tests.length} passed${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);
