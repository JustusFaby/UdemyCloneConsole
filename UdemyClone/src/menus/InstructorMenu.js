import courseService from '../services/CourseService.js';
import enrollmentService from '../services/EnrollmentService.js';
import reviewService from '../services/ReviewService.js';
import store from '../data/DataStore.js';
import { CourseCategory } from '../models/Course.js';
import { prompt, promptChoice, promptNumber, promptYesNo, showHeader, showTable, pressEnter } from '../utils/InputHelper.js';

/**
 * Instructor dashboard menu.
 */
export async function showInstructorMenu(user) {
  let running = true;

  while (running) {
    showHeader(`INSTRUCTOR DASHBOARD — ${user.firstName} ${user.lastName}`);

    const choice = await promptChoice('What would you like to do?', [
      'Create a New Course',
      'Manage My Courses',
      'View Course Statistics',
      'Logout',
    ]);

    switch (choice) {
      case 0: await createCourse(user); break;
      case 1: await manageCourses(user); break;
      case 2: await viewCourseStats(user); break;
      case 3: running = false; break;
    }
  }
}

// ─── Create Course ────────────────────────────────────────

async function createCourse(user) {
  showHeader('CREATE NEW COURSE');

  const title = await prompt('  Course title: ');
  const description = await prompt('  Description: ');
  const price = await promptNumber('  Price ($): ', 0, 999999);
  const categories = courseService.getCategories();
  const catIdx = await promptChoice('  Category:', categories);
  const category = categories[catIdx];

  const result = courseService.createCourse({
    title,
    description,
    price,
    category,
    instructorId: user.id,
    instructorName: `${user.firstName} ${user.lastName}`,
  });

  console.log(`\n  ${result.message}`);

  if (result.success) {
    const addLessons = await promptYesNo('  Add lessons now?');
    if (addLessons) {
      await addLessonsLoop(result.course.id);
    }

    const addMaterials = await promptYesNo('  Add course materials?');
    if (addMaterials) {
      await addMaterialsLoop(result.course.id);
    }

    const submit = await promptYesNo('  Submit for approval?');
    if (submit) {
      const subResult = courseService.submitForApproval(result.course.id, user.id);
      console.log(`  ${subResult.message}`);
    }
  }
  await pressEnter();
}

// ─── Add Lessons Loop ─────────────────────────────────────

async function addLessonsLoop(courseId) {
  let adding = true;
  while (adding) {
    console.log('\n  ── Add Lesson ──');
    const title = await prompt('  Lesson title: ');
    const content = await prompt('  Lesson content/description: ');
    const duration = await promptNumber('  Duration (minutes): ', 1, 600);
    const videoUrl = await prompt('  Video URL (or press Enter): ');
    const isFreePreview = await promptYesNo('  Mark as free preview?');

    const result = courseService.addLesson(courseId, { title, content, duration, videoUrl, isFreePreview });
    console.log(`  ${result.message}`);

    adding = await promptYesNo('  Add another lesson?');
  }
}

// ─── Add Materials Loop ───────────────────────────────────

async function addMaterialsLoop(courseId) {
  let adding = true;
  while (adding) {
    console.log('\n  ── Add Material ──');
    const typeIdx = await promptChoice('  Material type:', ['Video Link', 'Text File', 'Quiz']);
    const types = ['video', 'text', 'quiz'];
    const type = types[typeIdx];
    const title = await prompt('  Material title: ');
    const content = await prompt('  URL or Content: ');

    const result = courseService.addMaterial(courseId, { type, title, content });
    console.log(`  ${result.message}`);

    adding = await promptYesNo('  Add another material?');
  }
}

// ─── Manage Courses ───────────────────────────────────────

async function manageCourses(user) {
  showHeader('MY COURSES');
  const courses = courseService.getInstructorCourses(user.id);

  if (courses.length === 0) {
    console.log('  You have not created any courses yet.');
    await pressEnter();
    return;
  }

  showTable(courses, [
    { header: '#', accessor: (_, i) => i + 1 },
    { header: 'Title', accessor: c => c.title.substring(0, 25) },
    { header: 'Status', accessor: c => c.status },
    { header: 'Lessons', accessor: c => c.lessons.length },
    { header: 'Price', accessor: c => `$${c.price.toFixed(2)}` },
    { header: 'Rating', accessor: c => c.averageRating > 0 ? `${c.averageRating} ★` : 'N/A' },
    { header: 'Enrolled', accessor: c => c.totalEnrollments },
  ]);

  const idx = await promptNumber('\n  Select course # : ', 1, courses.length) - 1;
  const course = courses[idx];

  const action = await promptChoice(`Actions for "${course.title}":`, [
    'Edit Course Details',
    'Add Lessons',
    'Remove a Lesson',
    'Add Materials',
    'Submit for Approval',
    'Delete Course',
    'View Reviews',
    'Back',
  ]);

  switch (action) {
    case 0: await editCourse(course); break;
    case 1: await addLessonsLoop(course.id); break;
    case 2: await removeLessonMenu(course); break;
    case 3: await addMaterialsLoop(course.id); break;
    case 4: {
      const r = courseService.submitForApproval(course.id, user.id);
      console.log(`  ${r.message}`);
      await pressEnter();
      break;
    }
    case 5: {
      const confirm = await promptYesNo('  Are you sure you want to delete this course?');
      if (confirm) {
        const r = courseService.deleteCourse(course.id, user.id);
        console.log(`  ${r.message}`);
      }
      await pressEnter();
      break;
    }
    case 6: await viewReviews(course); break;
    case 7: break;
  }
}

// ─── Edit Course ──────────────────────────────────────────

async function editCourse(course) {
  showHeader(`EDIT: ${course.title}`);
  console.log('  (Press Enter to keep current value)\n');

  const title = await prompt(`  Title [${course.title}]: `);
  const description = await prompt(`  Description [${course.description.substring(0, 40)}...]: `);
  const priceStr = await prompt(`  Price [$${course.price}]: `);

  const updates = {};
  if (title) updates.title = title;
  if (description) updates.description = description;
  if (priceStr) updates.price = Number(priceStr);

  const wantCat = await promptYesNo('  Change category?');
  if (wantCat) {
    const categories = courseService.getCategories();
    const catIdx = await promptChoice('  New category:', categories);
    updates.category = categories[catIdx];
  }

  const result = courseService.editCourse(course.id, updates);
  console.log(`\n  ${result.message}`);
  await pressEnter();
}

// ─── Remove Lesson ────────────────────────────────────────

async function removeLessonMenu(course) {
  if (course.lessons.length === 0) {
    console.log('  No lessons to remove.');
    await pressEnter();
    return;
  }
  console.log('\n  Lessons:');
  course.lessons.forEach((l, i) => console.log(`    [${i + 1}] ${l.title}`));

  const idx = await promptNumber('  Remove lesson # : ', 1, course.lessons.length) - 1;
  const result = courseService.removeLesson(course.id, course.lessons[idx].id);
  console.log(`  ${result.message}`);
  await pressEnter();
}

// ─── View Reviews ─────────────────────────────────────────

async function viewReviews(course) {
  showHeader(`REVIEWS FOR: ${course.title}`);
  const reviews = reviewService.getCourseReviews(course.id);

  if (reviews.length === 0) {
    console.log('  No reviews yet.');
    await pressEnter();
    return;
  }

  reviews.forEach((r, i) => {
    console.log(`  [${i + 1}] ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} by ${r.studentName}`);
    console.log(`      "${r.comment}"`);
    console.log(`      ${r.createdAt.split('T')[0]}\n`);
  });

  console.log(`  Average: ${course.averageRating} ★ (${course.totalRatings} reviews)`);
  await pressEnter();
}

// ─── View Stats ───────────────────────────────────────────

async function viewCourseStats(user) {
  showHeader('COURSE STATISTICS');
  const courses = courseService.getInstructorCourses(user.id);

  if (courses.length === 0) {
    console.log('  No courses found.');
    await pressEnter();
    return;
  }

  let totalStudents = 0;
  let totalRevenue = 0;

  courses.forEach(c => {
    totalStudents += c.totalEnrollments;
    totalRevenue += c.price * c.totalEnrollments;
  });

  console.log(`  Total Courses    : ${courses.length}`);
  console.log(`  Total Students   : ${totalStudents}`);
  console.log(`  Total Revenue    : $${totalRevenue.toFixed(2)}\n`);

  showTable(courses, [
    { header: '#', accessor: (_, i) => i + 1 },
    { header: 'Title', accessor: c => c.title.substring(0, 25) },
    { header: 'Status', accessor: c => c.status },
    { header: 'Students', accessor: c => c.totalEnrollments },
    { header: 'Revenue', accessor: c => `$${(c.price * c.totalEnrollments).toFixed(2)}` },
    { header: 'Rating', accessor: c => c.averageRating > 0 ? `${c.averageRating} ★` : 'N/A' },
  ]);

  await pressEnter();
}
