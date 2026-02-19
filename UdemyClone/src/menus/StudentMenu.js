import searchService from '../services/SearchService.js';
import enrollmentService from '../services/EnrollmentService.js';
import reviewService from '../services/ReviewService.js';
import courseService from '../services/CourseService.js';
import { prompt, promptChoice, promptNumber, promptYesNo, showHeader, showTable, pressEnter } from '../utils/InputHelper.js';

/**
 * Student dashboard menu.
 * @param {Object} user - current user
 * @param {boolean} isInstructorActing - true if an instructor is using student mode
 */
export async function showStudentMenu(user, isInstructorActing = false) {
  let running = true;

  while (running) {
    const label = isInstructorActing ? '(Instructor as Student)' : '';
    showHeader(`STUDENT DASHBOARD ${label} — ${user.firstName}`);

    const choice = await promptChoice('What would you like to do?', [
      'Browse / Search Courses',
      'View Recommendations',
      'My Enrolled Courses',
      'View Course Progress',
      'My Certificates',
      'Logout',
    ]);

    switch (choice) {
      case 0: await browseCourses(user); break;
      case 1: await viewRecommendations(user); break;
      case 2: await viewEnrollments(user); break;
      case 3: await viewProgress(user); break;
      case 4: await viewCertificates(user); break;
      case 5: running = false; break;
    }
  }
}

// ─── Browse / Search ──────────────────────────────────────

async function browseCourses(user) {
  showHeader('BROWSE COURSES');

  const filters = {};

  const keyword = await prompt('  Search keyword (or press Enter to skip): ');
  if (keyword) filters.query = keyword;

  const categories = courseService.getCategories();
  const wantCategory = await promptYesNo('  Filter by category?');
  if (wantCategory) {
    const catIdx = await promptChoice('  Select category:', categories);
    filters.category = categories[catIdx];
  }

  const wantRating = await promptYesNo('  Filter by minimum rating?');
  if (wantRating) {
    filters.minRating = await promptNumber('  Minimum rating (1-5): ', 1, 5);
  }

  const wantPrice = await promptYesNo('  Filter by max price?');
  if (wantPrice) {
    filters.maxPrice = await promptNumber('  Max price: $', 0, 999999);
  }

  const sortIdx = await promptChoice('  Sort by:', [
    'Popularity', 'Newest', 'Highest Rated', 'Price: Low to High', 'Price: High to Low',
  ]);
  const sortOptions = ['popularity', 'newest', 'highest-rated', 'price-low', 'price-high'];
  filters.sortBy = sortOptions[sortIdx];

  const results = searchService.search(filters);

  showHeader(`SEARCH RESULTS (${results.length} courses)`);
  if (results.length === 0) {
    console.log('  No courses match your criteria.');
    await pressEnter();
    return;
  }

  showTable(results, [
    { header: '#', accessor: (_, i) => i + 1 },
    { header: 'Title', accessor: r => r.title.substring(0, 30) },
    { header: 'Instructor', accessor: r => r.instructorName },
    { header: 'Category', accessor: r => r.category },
    { header: 'Price', accessor: r => `$${r.price.toFixed(2)}` },
    { header: 'Rating', accessor: r => r.averageRating > 0 ? `${r.averageRating} ★` : 'N/A' },
    { header: 'Students', accessor: r => r.totalEnrollments },
  ]);

  const viewMore = await promptYesNo('\n  View a course detail?');
  if (viewMore) {
    const idx = await promptNumber('  Enter course # : ', 1, results.length) - 1;
    await viewCourseDetail(user, results[idx]);
  }
}

// ─── Course Detail & Enrollment ───────────────────────────

async function viewCourseDetail(user, course) {
  const preview = courseService.getCoursePreview(course.id);
  if (!preview) {
    console.log('  Course not found.');
    await pressEnter();
    return;
  }

  showHeader(`COURSE: ${preview.title}`);
  console.log(`  Instructor  : ${preview.instructorName}`);
  console.log(`  Category    : ${preview.category}`);
  console.log(`  Price       : $${preview.price.toFixed(2)}`);
  console.log(`  Rating      : ${preview.averageRating > 0 ? preview.averageRating + ' ★' : 'No ratings yet'} (${preview.totalRatings} reviews)`);
  console.log(`  Enrollments : ${preview.totalEnrollments}`);
  console.log(`  Lessons     : ${preview.totalLessons}`);
  console.log(`\n  Description:\n  ${preview.description}`);

  // Free preview lessons
  if (preview.previewLessons.length > 0) {
    console.log('\n  ── Free Preview Lessons ──');
    preview.previewLessons.forEach(l => {
      console.log(`    ${l.order}. ${l.title} (${l.duration} min)`);
      console.log(`       ${l.content}`);
    });
  }

  // Course outline (titles only)
  console.log('\n  ── Course Outline ──');
  preview.lessons.forEach(l => {
    const lockIcon = l.isFreePreview ? '🔓' : '🔒';
    console.log(`    ${l.order}. ${lockIcon} ${l.title} (${l.duration} min)`);
  });

  // Show reviews
  const reviews = reviewService.getCourseReviews(course.id);
  if (reviews.length > 0) {
    console.log('\n  ── Student Reviews ──');
    reviews.slice(0, 5).forEach(r => {
      console.log(`    ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} by ${r.studentName}`);
      console.log(`    "${r.comment}"\n`);
    });
  }

  const choice = await promptChoice('Actions:', [
    'Enroll in this course',
    'Back',
  ]);

  if (choice === 0) {
    const result = enrollmentService.enroll(user.id, course.id);
    console.log(`\n  ${result.message}`);
    await pressEnter();
  }
}

// ─── Recommendations ──────────────────────────────────────

async function viewRecommendations(user) {
  showHeader('RECOMMENDED FOR YOU');
  const recs = searchService.getRecommendations(user.id);

  if (recs.length === 0) {
    console.log('  No recommendations available. Browse and enroll in courses to get personalized suggestions!');
    await pressEnter();
    return;
  }

  showTable(recs, [
    { header: '#', accessor: (_, i) => i + 1 },
    { header: 'Title', accessor: r => r.title.substring(0, 30) },
    { header: 'Category', accessor: r => r.category },
    { header: 'Price', accessor: r => `$${r.price.toFixed(2)}` },
    { header: 'Rating', accessor: r => r.averageRating > 0 ? `${r.averageRating} ★` : 'N/A' },
  ]);

  const enroll = await promptYesNo('\n  Enroll in a recommended course?');
  if (enroll) {
    const idx = await promptNumber('  Enter course # : ', 1, recs.length) - 1;
    const result = enrollmentService.enroll(user.id, recs[idx].id);
    console.log(`\n  ${result.message}`);
  }
  await pressEnter();
}

// ─── My Enrollments ───────────────────────────────────────

async function viewEnrollments(user) {
  showHeader('MY ENROLLED COURSES');
  const enrollments = enrollmentService.getStudentEnrollments(user.id);

  if (enrollments.length === 0) {
    console.log('  You have not enrolled in any courses yet.');
    await pressEnter();
    return;
  }

  showTable(enrollments, [
    { header: '#', accessor: (_, i) => i + 1 },
    { header: 'Course', accessor: e => e.courseTitle.substring(0, 30) },
    { header: 'Progress', accessor: e => `${e.progressPercent}%` },
    { header: 'Status', accessor: e => e.isCompleted ? 'Completed' : e.isPaused ? 'Paused' : 'In Progress' },
  ]);

  const choice = await promptChoice('Actions:', [
    'Continue a course (mark lessons complete)',
    'Pause / Resume a course',
    'Leave a review',
    'Back',
  ]);

  switch (choice) {
    case 0: {
      const idx = await promptNumber('  Enter course # : ', 1, enrollments.length) - 1;
      await continueCourse(user, enrollments[idx]);
      break;
    }
    case 1: {
      const idx = await promptNumber('  Enter course # : ', 1, enrollments.length) - 1;
      await togglePause(user, enrollments[idx]);
      break;
    }
    case 2: {
      const idx = await promptNumber('  Enter course # : ', 1, enrollments.length) - 1;
      await leaveReview(user, enrollments[idx]);
      break;
    }
    case 3: break;
  }
}

// ─── Continue Course (Lesson Completion) ──────────────────

async function continueCourse(user, enrollment) {
  const progress = enrollmentService.getProgress(user.id, enrollment.courseId);
  if (!progress) {
    console.log('  Could not load course progress.');
    await pressEnter();
    return;
  }

  showHeader(`COURSE: ${progress.courseTitle} — ${progress.progressPercent}% Complete`);
  progress.lessons.forEach(l => {
    const icon = l.isCompleted ? '✅' : '⬜';
    console.log(`  ${icon} ${l.order}. ${l.title}`);
  });

  const incomplete = progress.lessons.filter(l => !l.isCompleted);
  if (incomplete.length === 0) {
    console.log('\n  All lessons completed! 🎉');
    await pressEnter();
    return;
  }

  const markMore = await promptYesNo('\n  Mark a lesson as completed?');
  if (markMore) {
    console.log('\n  Incomplete lessons:');
    incomplete.forEach((l, i) => console.log(`    [${i + 1}] ${l.order}. ${l.title}`));
    const lIdx = await promptNumber('  Select lesson # : ', 1, incomplete.length) - 1;
    const result = enrollmentService.completeLesson(user.id, enrollment.courseId, incomplete[lIdx].id);
    console.log(`\n  ${result.message}`);

    if (result.certificate) {
      console.log(result.certificate.display());
    }
  }
  await pressEnter();
}

// ─── Pause / Resume ───────────────────────────────────────

async function togglePause(user, enrollment) {
  if (enrollment.isPaused) {
    const result = enrollmentService.resumeEnrollment(user.id, enrollment.courseId);
    console.log(`  ${result.message}`);
  } else {
    const result = enrollmentService.pauseEnrollment(user.id, enrollment.courseId);
    console.log(`  ${result.message}`);
  }
  await pressEnter();
}

// ─── Leave Review ─────────────────────────────────────────

async function leaveReview(user, enrollment) {
  showHeader('LEAVE A REVIEW');
  const rating = await promptNumber('  Rating (1-5 stars): ', 1, 5);
  const comment = await prompt('  Your review (min 10 chars): ');

  const result = reviewService.submitReview({
    studentId: user.id,
    studentName: user.firstName + ' ' + user.lastName,
    courseId: enrollment.courseId,
    rating,
    comment,
  });
  console.log(`\n  ${result.message}`);
  await pressEnter();
}

// ─── View Progress ────────────────────────────────────────

async function viewProgress(user) {
  showHeader('COURSE PROGRESS');
  const enrollments = enrollmentService.getStudentEnrollments(user.id);

  if (enrollments.length === 0) {
    console.log('  No enrollments yet.');
    await pressEnter();
    return;
  }

  const idx = await promptNumber(`  Select course (1-${enrollments.length}):\n${enrollments.map((e, i) => `    [${i + 1}] ${e.courseTitle}`).join('\n')}\n  Choice: `, 1, enrollments.length) - 1;

  const progress = enrollmentService.getProgress(user.id, enrollments[idx].courseId);
  if (!progress) {
    console.log('  Could not load progress.');
    await pressEnter();
    return;
  }

  showHeader(`${progress.courseTitle} — ${progress.progressPercent}%`);
  const bar = '█'.repeat(Math.floor(progress.progressPercent / 5)) + '░'.repeat(20 - Math.floor(progress.progressPercent / 5));
  console.log(`  [${bar}] ${progress.progressPercent}%`);
  console.log(`  ${progress.completedLessons} / ${progress.totalLessons} lessons completed`);
  console.log(`  Status: ${progress.isCompleted ? 'Completed ✅' : progress.isPaused ? 'Paused ⏸️' : 'In Progress ▶️'}\n`);

  progress.lessons.forEach(l => {
    const icon = l.isCompleted ? '✅' : '⬜';
    console.log(`  ${icon} ${l.order}. ${l.title}`);
  });

  await pressEnter();
}

// ─── My Certificates ─────────────────────────────────────

async function viewCertificates(user) {
  showHeader('MY CERTIFICATES');
  const certs = enrollmentService.getStudentCertificates(user.id);

  if (certs.length === 0) {
    console.log('  No certificates yet. Complete a course to earn one!');
    await pressEnter();
    return;
  }

  certs.forEach((cert, i) => {
    console.log(`\n  [${i + 1}] ${cert.courseTitle}`);
    console.log(`      Certificate #: ${cert.certificateNumber}`);
    console.log(`      Issued: ${cert.issuedAt.split('T')[0]}`);
  });

  const viewFull = await promptYesNo('\n  View full certificate?');
  if (viewFull) {
    const idx = await promptNumber('  Enter # : ', 1, certs.length) - 1;
    console.log(certs[idx].display());
  }
  await pressEnter();
}
