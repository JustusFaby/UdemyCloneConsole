import authService from '../services/AuthService.js';
import courseService from '../services/CourseService.js';
import adminService from '../services/AdminService.js';
import reviewService from '../services/ReviewService.js';
import { UserRole } from '../models/User.js';
import { prompt, promptChoice, promptNumber, promptYesNo, showHeader, showTable, pressEnter } from '../utils/InputHelper.js';

/**
 * Admin dashboard menu.
 */
export async function showAdminMenu(user) {
  let running = true;

  while (running) {
    showHeader(`ADMIN PANEL — ${user.firstName} ${user.lastName}`);

    const choice = await promptChoice('Admin Actions:', [
      'Platform Analytics',
      'Manage Users',
      'Manage Courses (Approve / Remove)',
      'View Flagged Reviews',
      'Create Admin Account',
      'Logout',
    ]);

    switch (choice) {
      case 0: await viewAnalytics(); break;
      case 1: await manageUsers(); break;
      case 2: await manageCourses(); break;
      case 3: await manageFlaggedReviews(); break;
      case 4: await createAdmin(); break;
      case 5: running = false; break;
    }
  }
}

// ─── Analytics ────────────────────────────────────────────

async function viewAnalytics() {
  showHeader('PLATFORM ANALYTICS');
  const stats = adminService.getAnalytics();

  console.log('  ── Users ──');
  console.log(`    Total       : ${stats.users.total}`);
  console.log(`    Students    : ${stats.users.students}`);
  console.log(`    Instructors : ${stats.users.instructors}`);
  console.log(`    Admins      : ${stats.users.admins}`);
  console.log(`    Banned      : ${stats.users.banned}`);

  console.log('\n  ── Courses ──');
  console.log(`    Total       : ${stats.courses.total}`);
  console.log(`    Approved    : ${stats.courses.approved}`);
  console.log(`    Pending     : ${stats.courses.pending}`);
  console.log(`    Drafts      : ${stats.courses.draft}`);

  console.log('\n  ── Enrollments ──');
  console.log(`    Total       : ${stats.enrollments.total}`);
  console.log(`    Active      : ${stats.enrollments.active}`);
  console.log(`    Completed   : ${stats.enrollments.completed}`);

  console.log('\n  ── Other ──');
  console.log(`    Reviews     : ${stats.reviews.total} (${stats.reviews.flagged} flagged)`);
  console.log(`    Certificates: ${stats.certificates}`);
  console.log(`    Revenue     : $${stats.revenue.toFixed(2)}`);

  if (Object.keys(stats.categoryStats).length > 0) {
    console.log('\n  ── Courses by Category ──');
    Object.entries(stats.categoryStats).forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count}`);
    });
  }

  if (stats.topCourses.length > 0) {
    console.log('\n  ── Top Courses ──');
    stats.topCourses.forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.title} — ${c.enrollments} students, ${c.rating} ★`);
    });
  }

  await pressEnter();
}

// ─── Manage Users ─────────────────────────────────────────

async function manageUsers() {
  showHeader('USER MANAGEMENT');

  const filterIdx = await promptChoice('Filter by role:', ['All', 'Students', 'Instructors', 'Admins']);
  const filters = [null, UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN];
  const users = adminService.getUsers(filters[filterIdx]);

  if (users.length === 0) {
    console.log('  No users found.');
    await pressEnter();
    return;
  }

  showTable(users, [
    { header: '#', accessor: (_, i) => i + 1 },
    { header: 'Name', accessor: u => `${u.firstName} ${u.lastName}` },
    { header: 'Email', accessor: u => u.email },
    { header: 'Role', accessor: u => u.role },
    { header: 'Banned', accessor: u => u.isBanned ? 'YES' : 'No' },
    { header: 'Created', accessor: u => u.createdAt.split('T')[0] },
  ]);

  const action = await promptChoice('Actions:', [
    'Ban / Unban a User',
    'Promote a User',
    'Reset User Password',
    'Back',
  ]);

  switch (action) {
    case 0: {
      const idx = await promptNumber('  User # : ', 1, users.length) - 1;
      const result = authService.toggleBan(users[idx].id);
      console.log(`  ${result.message}`);
      await pressEnter();
      break;
    }
    case 1: {
      const idx = await promptNumber('  User # : ', 1, users.length) - 1;
      const roleIdx = await promptChoice('  New role:', ['Student', 'Instructor', 'Admin']);
      const roles = [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN];
      const result = authService.promoteUser(users[idx].id, roles[roleIdx]);
      console.log(`  ${result.message}`);
      await pressEnter();
      break;
    }
    case 2: {
      const idx = await promptNumber('  User # : ', 1, users.length) - 1;
      const newPw = await prompt('  New password (min 6 chars): ');
      const result = authService.resetPassword(users[idx].id, newPw);
      console.log(`  ${result.message}`);
      await pressEnter();
      break;
    }
    case 3: break;
  }
}

// ─── Manage Courses ───────────────────────────────────────

async function manageCourses() {
  showHeader('COURSE MANAGEMENT');

  const viewIdx = await promptChoice('View:', [
    'Pending Approval',
    'All Courses',
  ]);

  let courses;
  if (viewIdx === 0) {
    courses = courseService.getPendingCourses();
    if (courses.length === 0) {
      console.log('  No courses pending approval.');
      await pressEnter();
      return;
    }
  } else {
    courses = adminService.getAllCourses();
    if (courses.length === 0) {
      console.log('  No courses in the system.');
      await pressEnter();
      return;
    }
  }

  showTable(courses, [
    { header: '#', accessor: (_, i) => i + 1 },
    { header: 'Title', accessor: c => c.title.substring(0, 25) },
    { header: 'Instructor', accessor: c => c.instructorName },
    { header: 'Status', accessor: c => c.status },
    { header: 'Lessons', accessor: c => c.lessons.length },
    { header: 'Price', accessor: c => `$${c.price.toFixed(2)}` },
  ]);

  const action = await promptChoice('Actions:', [
    'Approve a Course',
    'Reject a Course',
    'Delete a Course',
    'View Course Details',
    'Back',
  ]);

  switch (action) {
    case 0: {
      const idx = await promptNumber('  Course # : ', 1, courses.length) - 1;
      const result = courseService.reviewCourse(courses[idx].id, true);
      console.log(`  ${result.message}`);
      await pressEnter();
      break;
    }
    case 1: {
      const idx = await promptNumber('  Course # : ', 1, courses.length) - 1;
      const result = courseService.reviewCourse(courses[idx].id, false);
      console.log(`  ${result.message}`);
      await pressEnter();
      break;
    }
    case 2: {
      const idx = await promptNumber('  Course # : ', 1, courses.length) - 1;
      const confirm = await promptYesNo('  Are you sure?');
      if (confirm) {
        const result = courseService.deleteCourse(courses[idx].id, null, true);
        console.log(`  ${result.message}`);
      }
      await pressEnter();
      break;
    }
    case 3: {
      const idx = await promptNumber('  Course # : ', 1, courses.length) - 1;
      const stats = adminService.getCourseStats(courses[idx].id);
      if (!stats) {
        console.log('  Course not found.');
      } else {
        showHeader(`COURSE DETAIL: ${stats.title}`);
        console.log(`  Instructor   : ${stats.instructorName}`);
        console.log(`  Category     : ${stats.category}`);
        console.log(`  Status       : ${stats.status}`);
        console.log(`  Price        : $${stats.price.toFixed(2)}`);
        console.log(`  Lessons      : ${stats.lessons.length}`);
        console.log(`  Enrollments  : ${stats.enrollmentCount}`);
        console.log(`  Completion   : ${stats.completionRate}%`);
        console.log(`  Rating       : ${stats.averageRating > 0 ? stats.averageRating + ' ★' : 'N/A'}`);
        console.log(`  Reviews      : ${stats.reviewCount}`);
        console.log(`  Description  : ${stats.description}`);

        if (stats.lessons.length > 0) {
          console.log('\n  ── Lessons ──');
          stats.lessons.forEach(l => console.log(`    ${l.order}. ${l.title} (${l.duration} min)`));
        }
      }
      await pressEnter();
      break;
    }
    case 4: break;
  }
}

// ─── Manage Flagged Reviews ──────────────────────────────

async function manageFlaggedReviews() {
  showHeader('FLAGGED REVIEWS');
  const flagged = reviewService.getFlaggedReviews();

  if (flagged.length === 0) {
    console.log('  No flagged reviews.');
    await pressEnter();
    return;
  }

  flagged.forEach((r, i) => {
    console.log(`  [${i + 1}] ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} by ${r.studentName}`);
    console.log(`      "${r.comment}"`);
    console.log(`      Course ID: ${r.courseId}\n`);
  });

  const action = await promptChoice('Actions:', [
    'Approve a Review',
    'Delete a Review',
    'Back',
  ]);

  switch (action) {
    case 0: {
      const idx = await promptNumber('  Review # : ', 1, flagged.length) - 1;
      const result = reviewService.approveReview(flagged[idx].id);
      console.log(`  ${result.message}`);
      await pressEnter();
      break;
    }
    case 1: {
      const idx = await promptNumber('  Review # : ', 1, flagged.length) - 1;
      const result = reviewService.deleteReview(flagged[idx].id);
      console.log(`  ${result.message}`);
      await pressEnter();
      break;
    }
    case 2: break;
  }
}

// ─── Create Admin Account ────────────────────────────────

async function createAdmin() {
  showHeader('CREATE ADMIN ACCOUNT');
  const firstName = await prompt('  First name: ');
  const lastName = await prompt('  Last name: ');
  const email = await prompt('  Email: ');
  const password = await prompt('  Password (min 6 chars): ');

  // Bypass the admin-check in register by directly creating
  const { hashPassword } = await import('../utils/PasswordHasher.js');
  const { User } = await import('../models/User.js');
  const store = (await import('../data/DataStore.js')).default;

  if (store.findUserByEmail(email)) {
    console.log('  An account with this email already exists.');
    await pressEnter();
    return;
  }

  const admin = new User({
    email,
    passwordHash: hashPassword(password),
    firstName,
    lastName,
    role: UserRole.ADMIN,
  });
  store.addUser(admin);
  console.log(`\n  Admin account created for ${firstName} ${lastName}.`);
  await pressEnter();
}
