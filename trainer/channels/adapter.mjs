// The channel seam.
//
// Everything above this line is channel-agnostic: a session takes text and
// returns text. A Telegram bot, a Twilio webhook, or the CLI in this repo are
// all the same three calls — `handle`, `nudge`, `status`.
//
// To add a channel, write a file that:
//   1. creates a session once at startup
//   2. calls `session.handle(text)` on each inbound message and sends the reply
//   3. calls `session.nudge()` on whatever schedule you want and sends that
// There is nothing else to implement. No coach logic belongs in a channel.

import { load, save, DEFAULT_PATH } from '../core/store.mjs';
import { respond, nudge as coachNudge, createClient } from '../core/coach.mjs';
import { summary } from '../core/accountability.mjs';
import { observations } from '../core/patterns.mjs';

export function createSession({ dataPath = DEFAULT_PATH, client } = {}) {
  const state = load(dataPath);
  // One client per session — it holds the connection pool, and rebuilding it
  // per message would throw away keep-alive for no reason.
  const anthropic = client ?? createClient();

  const persist = () => save(state, dataPath);

  return {
    state,
    dataPath,

    async handle(text) {
      const reply = await respond(state, text, { client: anthropic });
      persist();
      return reply;
    },

    async nudge() {
      const reply = await coachNudge(state, { client: anthropic });
      persist();
      return reply;
    },

    /** Local read — no API call, no cost. Useful for a `/status` command. */
    status() {
      return { ...summary(state), observations: observations(state) };
    },

    save: persist,
  };
}
