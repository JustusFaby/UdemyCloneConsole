import authService from '../services/AuthService.js';
import { UserRole } from '../models/User.js';
import { prompt, promptChoice, showHeader, pressEnter } from '../utils/InputHelper.js';
import { showStudentMenu } from './StudentMenu.js';
import { showInstructorMenu } from './InstructorMenu.js';
import { showAdminMenu } from './AdminMenu.js';

/**
 * Main application menu: login, register, or exit.
 */
export async function showMainMenu() {
  let running = true;

  while (running) {
    showHeader('UDEMY CLONE — Learning Platform');
    console.log('  Your gateway to knowledge!\n');

    const choice = await promptChoice('Select an option:', [
      'Login',
      'Register',
      'Exit',
    ]);

    switch (choice) {
      case 0:
        await handleLogin();
        break;
      case 1:
        await handleRegister();
        break;
      case 2:
        running = false;
        console.log('\n  Thank you for using Udemy Clone. Goodbye!\n');
        break;
    }
  }
}

// ─── Login Flow ────────────────────────────────────────────

async function handleLogin() {
  showHeader('LOGIN');
  const email = await prompt('  Email: ');
  const password = await prompt('  Password: ');

  const result = await authService.login(email, password);
  console.log(`\n  ${result.message}`);

  if (!result.success) {
    await pressEnter();
    return;
  }

  const user = result.user;

  // ── Handle Instructor logging in: ask which role to use ──
  if (user.role === UserRole.INSTRUCTOR) {
    console.log('\n  You are registered as an Instructor.');
    console.log('  You can operate as an Instructor or browse as a Student.');

    const roleChoice = await promptChoice('How do you want to log in?', [
      'Instructor — manage your courses',
      'Student — browse & enroll in courses',
    ]);

    const sessionRole = roleChoice === 0 ? UserRole.INSTRUCTOR : UserRole.STUDENT;
    const effectiveRole = authService.getEffectiveRole(sessionRole);

    if (effectiveRole === UserRole.STUDENT) {
      console.log('\n  Logged in as Student (Instructor mode available next login).');
      await showStudentMenu(user, true /* isInstructorActingAsStudent */);
    } else {
      await showInstructorMenu(user);
    }
  } else if (user.role === UserRole.ADMIN) {
    await showAdminMenu(user);
  } else {
    await showStudentMenu(user, false);
  }

  // After menu exits, log out
  const msg = authService.logout();
  console.log(`\n  ${msg}`);
  await pressEnter();
}

// ─── Registration Flow ────────────────────────────────────

async function handleRegister() {
  showHeader('REGISTER');

  const roleChoice = await promptChoice('Register as:', [
    'Student',
    'Instructor',
  ]);
  const role = roleChoice === 0 ? UserRole.STUDENT : UserRole.INSTRUCTOR;

  const firstName = await prompt('  First name: ');
  const lastName = await prompt('  Last name: ');
  const email = await prompt('  Email: ');
  const password = await prompt('  Password (min 6 chars): ');

  const result = await authService.register({ email, password, firstName, lastName, role });
  console.log(`\n  ${result.message}`);
  await pressEnter();
}
