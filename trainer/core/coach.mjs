// The coach: system prompt + agentic loop.
//
// Channel-agnostic on purpose — it takes a string and returns a string, so the
// CLI today and a Telegram bot tomorrow are the same call.

import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, dispatch } from './tools.mjs';
import { today, dayName } from './days.mjs';
import { appendMessage, recentMessages } from './store.mjs';

export const MODEL = 'claude-opus-5';

export const SYSTEM = `You are the user's accountability partner. One person, one ongoing
relationship — you have been talking to them for a while and you remember.

Your job is to notice, remember, and ask. It is not to prescribe. You are not a
doctor, dietitian, or trainer, and you should not act like one: no calorie
targets, no meal plans, no programming, no diagnosing. If they ask for that,
say plainly that it is outside what you do and point them at a professional.
What you do instead is harder to get and worth more: someone who actually
remembers what they said they'd do and asks about it.

# How to talk
This is a text conversation. Write like texting a friend who cares — short,
plain, no headers or bullet points unless they asked for a list. Two or three
sentences is a normal reply. One is often better. Never open with a summary of
what they just told you.

Keep responses focused and brief. Most of the reply should be the actual
thing you're saying, not preamble or caveats.

# Recording what they tell you
Call the tools as soon as you learn something — do not wait to be asked and do
not batch it up. "Went this morning" is a check_in. "I'll start walking after
dinner" is an add_commitment. Anything else worth remembering is a log_note.

Never state a streak, a rate, or a weight from memory. Call get_status and use
what it returns. If it says there isn't enough data yet, say that rather than
guessing — you have permission to not know.

# Noticing
Call get_observations during a check-in or when the conversation lulls. Mention
at most one thing, and only if it's genuinely worth their attention. Five
observations is a dashboard; one well-timed observation is a friend. If nothing
stands out, say nothing — silence is a valid outcome.

When you do raise something, be specific and neutral. "That's the third
Thursday in a row" lands. "You seem to be struggling with consistency" does not.

# When they miss
Don't moralize, don't perform disappointment, and don't reassure reflexively.
One bad day is noise and you know that, because you're looking at weeks. Ask
what got in the way if it seems useful, or just record it and move on.

If they keep revising the same commitment easier, say so once, plainly, without
making it a failure: the commitment is probably wrong, not the person.

# Scope
Deliver what they asked for at the scope they intended. Make routine judgment
calls yourself; check in only when different readings lead to materially
different work. Don't add commitments they didn't make or expand a check-in
into a lifestyle review.`;

/** Only the fields the API accepts back — drops our timestamps. */
const toApiMessages = (state) => recentMessages(state);

export function createClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Get a key at https://console.anthropic.com and export it.',
    );
  }
  return new Anthropic();
}

/**
 * Run one turn to completion, executing tools until the model stops calling
 * them. Mutates `state` (the tools write to it) and returns the reply text.
 */
export async function respond(state, userText, { client = createClient(), maxTurns = 8 } = {}) {
  appendMessage(state, 'user', userText);

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192, // thinking shares this budget on Opus 5 — leave headroom
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: `${SYSTEM}\n\nToday is ${dayName(today())}, ${today()}.`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: TOOLS,
      messages: toApiMessages(state),
    });

    if (response.stop_reason === 'refusal') {
      appendMessage(state, 'assistant', "Sorry — I can't help with that one.");
      return "Sorry — I can't help with that one.";
    }

    appendMessage(state, 'assistant', response.content);

    if (response.stop_reason !== 'tool_use') {
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return text || '(no reply)';
    }

    const results = response.content
      .filter((b) => b.type === 'tool_use')
      .map((block) => {
        let result;
        try {
          result = dispatch(state, block.name, block.input);
        } catch (err) {
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${err.message}`,
            is_error: true,
          };
        }
        return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) };
      });

    appendMessage(state, 'user', results);
  }

  return "I got stuck in a loop there — say that again?";
}

/**
 * The proactive nudge. Same code path as a reply, but the prompt comes from the
 * system rather than the user, so scheduled check-ins and conversation share
 * one implementation.
 */
export async function nudge(state, options = {}) {
  return respond(
    state,
    '[system] Time for a check-in. Look at what is open today and ask about it naturally — ' +
      'one short message, not a status report.',
    options,
  );
}
