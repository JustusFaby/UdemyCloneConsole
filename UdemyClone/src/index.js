import { showMainMenu } from './menus/MainMenu.js';
import { closeInput } from './utils/InputHelper.js';

console.clear();
console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║        ██╗   ██╗██████╗ ███████╗███╗   ███╗██╗   ██╗    ║
  ║        ██║   ██║██╔══██╗██╔════╝████╗ ████║╚██╗ ██╔╝    ║
  ║        ██║   ██║██║  ██║█████╗  ██╔████╔██║ ╚████╔╝     ║
  ║        ██║   ██║██║  ██║██╔══╝  ██║╚██╔╝██║  ╚██╔╝      ║
  ║        ╚██████╔╝██████╔╝███████╗██║ ╚═╝ ██║   ██║       ║
  ║         ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝   ╚═╝       ║
  ║                                                          ║
  ║              C L O N E   —   Console Edition             ║
  ║                  Learn Anything, Anywhere                ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
`);

try {
  await showMainMenu();
} catch (err) {
  if (err.message !== 'readline was closed') {
    console.error('An unexpected error occurred:', err);
  }
} finally {
  closeInput();
  process.exit(0);
}
