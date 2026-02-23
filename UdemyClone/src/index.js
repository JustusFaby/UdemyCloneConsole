import { showMainMenu } from './menus/MainMenu.js';
import { closeInput } from './utils/InputHelper.js';
import { testConnection } from './data/db.config.js';

console.clear();
console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║        ██╗   ██╗██████╗ ███████╗███╗   ███╗██╗   ██╗     ║
  ║        ██║   ██║██╔══██╗██╔════╝████╗ ████║╚██╗ ██╔╝     ║
  ║        ██║   ██║██║  ██║█████╗  ██╔████╔██║ ╚████╔╝      ║
  ║        ██║   ██║██║  ██║██╔══╝  ██║╚██╔╝██║  ╚██╔╝       ║
  ║        ╚██████╔╝██████╔╝███████╗██║ ╚═╝ ██║   ██║        ║
  ║         ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝   ╚═╝        ║
  ║                                                          ║
  ║              C L O N E   —   Console Edition             ║
  ║                  Learn Anything, Anywhere                ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
`);

// Verify database connection before starting
const connected = await testConnection();
if (!connected) {
  console.error('\n  Cannot start without a database connection.');
  console.error('  1. Make sure MySQL is running');
  console.error('  2. Run: mysql -u root -p < schema.sql');
  console.error('  3. Update .env with your DB credentials\n');
  process.exit(1);
}

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
