import readline from 'readline';

let rl = null;

function getRL() {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

/**
 * Prompt the user and return their input as a trimmed string.
 */
export function prompt(question) {
  return new Promise(resolve => {
    getRL().question(question, answer => resolve(answer.trim()));
  });
}

/**
 * Prompt for a number within a range.
 */
export async function promptNumber(question, min = -Infinity, max = Infinity) {
  while (true) {
    const raw = await prompt(question);
    const num = Number(raw);
    if (!isNaN(num) && num >= min && num <= max) return num;
    console.log(`  Please enter a valid number${min !== -Infinity ? ` (${min}-${max})` : ''}.`);
  }
}

/**
 * Prompt selection from a numbered list. Returns the index (0-based).
 */
export async function promptChoice(question, options) {
  console.log();
  options.forEach((opt, i) => console.log(`  [${i + 1}] ${opt}`));
  const choice = await promptNumber(`${question} `, 1, options.length);
  return choice - 1;
}

/**
 * Prompt yes/no.
 */
export async function promptYesNo(question) {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase().startsWith('y');
}

/**
 * Show a pause message.
 */
export async function pressEnter() {
  await prompt('\nPress Enter to continue...');
}

/**
 * Display a header banner.
 */
export function showHeader(title) {
  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(line);
}

/**
 * Display a table-like list.
 */
export function showTable(rows, columns) {
  if (rows.length === 0) {
    console.log('  (No items to display)');
    return;
  }
  // Calculate column widths
  const widths = columns.map(col => {
    const vals = rows.map((r, ri) => String(col.accessor(r, ri)).length);
    return Math.max(col.header.length, ...vals) + 2;
  });
  // Header
  const headerLine = columns.map((col, i) => col.header.padEnd(widths[i])).join('│');
  const separator = widths.map(w => '─'.repeat(w)).join('┼');
  console.log(`  ${headerLine}`);
  console.log(`  ${separator}`);
  // Rows
  rows.forEach((row, rowIdx) => {
    const line = columns.map((col, i) => String(col.accessor(row, rowIdx)).padEnd(widths[i])).join('│');
    console.log(`  ${line}`);
  });
}

/**
 * Close readline interface.
 */
export function closeInput() {
  if (rl) {
    rl.close();
    rl = null;
  }
}
