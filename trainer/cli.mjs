#!/usr/bin/env node
// The CLI channel.
//
//   node trainer/cli.mjs           interactive
//   node trainer/cli.mjs nudge     one check-in message, then exit (cron-friendly)
//   node trainer/cli.mjs status    local summary, no API call
//
// Data lives at ~/.trainer/data.json (override with TRAINER_DATA).

import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { createSession } from './channels/adapter.mjs';
import { CADENCE } from './core/accountability.mjs';
import { WEEKDAY_NAMES } from './core/days.mjs';

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

function describeCadence(cadence) {
  if (cadence.type === CADENCE.daily) return 'daily';
  if (cadence.type === CADENCE.days) return cadence.days.map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join('/');
  return `${cadence.count}x/week`;
}

function printStatus(status) {
  if (status.commitments.length === 0) {
    console.log(c.dim('No commitments yet. Just say what you want to start doing.'));
    return;
  }
  console.log(c.bold(`\n${status.date}`));
  for (const item of status.commitments) {
    const streak = item.streak.current > 0 ? c.green(`${item.streak.current} in a row`) : c.dim('no streak');
    const rate = item.adherence?.ready
      ? `${Math.round(item.adherence.rate * 100)}% of ${item.adherence.due}`
      : c.dim('not enough data');
    const mark = item.answeredToday === 'done' ? '✓' : item.dueToday ? '·' : ' ';
    console.log(`  ${mark} ${item.text} ${c.dim(`(${describeCadence(item.cadence)})`)}`);
    console.log(`      ${streak}  ${c.dim('·')}  ${rate}`);
  }
  if (status.observations.length > 0) {
    console.log(c.bold('\nWorth noticing'));
    for (const o of status.observations.slice(0, 3)) console.log(`  ${c.yellow('•')} ${o.text}`);
  }
  console.log();
}

async function main() {
  const command = argv[2];
  let session;
  try {
    session = createSession();
  } catch (err) {
    console.error(`\n${err.message}\n`);
    exit(1);
  }

  if (command === 'status') {
    printStatus(session.status());
    return;
  }

  if (command === 'nudge') {
    console.log(`\n${await session.nudge()}\n`);
    return;
  }

  console.log(c.dim(`\ndata: ${session.dataPath}`));
  console.log(c.dim('/status for a summary, /quit to leave. Otherwise just talk.\n'));

  const rl = createInterface({ input: stdin, output: stdout });

  // A returning user gets asked about what's open rather than a blank prompt —
  // the whole point is that it starts the conversation, not that you remember to.
  if (session.status().open.length > 0) {
    console.log(`${await session.nudge()}\n`);
  }

  while (true) {
    const line = (await rl.question(c.bold('> '))).trim();
    if (!line) continue;
    if (line === '/quit' || line === '/exit') break;
    if (line === '/status') {
      printStatus(session.status());
      continue;
    }

    try {
      console.log(`\n${await session.handle(line)}\n`);
    } catch (err) {
      console.error(c.yellow(`\n${err.message}\n`));
    }
  }

  rl.close();
  session.save();
  console.log(c.dim('saved.'));
}

main();
