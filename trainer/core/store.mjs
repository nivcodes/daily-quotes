// Persistence: one JSON file.
//
// For a single user this is the right call — inspectable, editable in a text
// editor, trivially backed up, and it means the whole system has no database to
// stand up. If this ever grows past one person, the seam is this file.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_PATH = process.env.TRAINER_DATA ?? join(homedir(), '.trainer', 'data.json');

export const emptyState = () => ({
  version: 1,
  profile: { createdAt: new Date().toISOString(), tier: 'standard' },
  commitments: [],
  checkins: [],
  weights: [],
  notes: [],
  messages: [],
});

export function load(path = DEFAULT_PATH) {
  if (!existsSync(path)) return emptyState();
  const state = JSON.parse(readFileSync(path, 'utf8'));
  // Tolerate a hand-edited file missing a key rather than crashing on it.
  return { ...emptyState(), ...state };
}

export function save(state, path = DEFAULT_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  // Write-then-rename: a crash mid-write can't leave a truncated file behind,
  // which for a file that is the entire product would be unrecoverable.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, path);
  return path;
}

/** Conversation history, trimmed. Old turns stop being useful and cost tokens. */
export function appendMessage(state, role, content, { keep = 40 } = {}) {
  state.messages.push({ role, content, ts: new Date().toISOString() });
  if (state.messages.length > keep) state.messages = state.messages.slice(-keep);
  return state.messages;
}

export function recentMessages(state, { keep = 20 } = {}) {
  return state.messages.slice(-keep).map(({ role, content }) => ({ role, content }));
}
