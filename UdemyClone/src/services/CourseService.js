import store from '../data/DataStore.js';
import { Course, CourseStatus, CourseCategory } from '../models/Course.js';
import { Lesson } from '../models/Lesson.js';

class CourseService {
  /**
   * Create a new course (Instructor only).
   */
  createCourse({ title, description, price, category, instructorId, instructorName }) {
    if (!title || title.length < 3) {
      return { success: false, message: 'Course title must be at least 3 characters.' };
    }
    if (price < 0) {
      return { success: false, message: 'Price cannot be negative.' };
    }
    if (!Object.values(CourseCategory).includes(category)) {
      return { success: false, message: 'Invalid category.' };
    }
    const course = new Course({ title, description, price, category, instructorId, instructorName });
    store.addCourse(course);
    return { success: true, message: 'Course created as Draft.', course };
  }

  /**
   * Add a lesson to a course.
   */
  addLesson(courseId, { title, content, duration, videoUrl, isFreePreview }) {
    const course = store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };
    const lesson = new Lesson({ title, content, duration, videoUrl });
    lesson.isFreePreview = !!isFreePreview;
    course.addLesson(lesson);
    store.saveCourses();
    return { success: true, message: `Lesson "${title}" added.`, lesson };
  }

  /**
   * Remove a lesson from a course.
   */
  removeLesson(courseId, lessonId) {
    const course = store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };
    const before = course.lessons.length;
    course.removeLesson(lessonId);
    if (course.lessons.length === before) return { success: false, message: 'Lesson not found.' };
    store.saveCourses();
    return { success: true, message: 'Lesson removed.' };
  }

  /**
   * Add course material (video link, text file, quiz).
   */
  addMaterial(courseId, { type, title, content }) {
    const course = store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };
    if (!['video', 'text', 'quiz'].includes(type)) {
      return { success: false, message: 'Material type must be video, text, or quiz.' };
    }
    course.addMaterial({ type, title, content });
    store.saveCourses();
    return { success: true, message: `Material "${title}" added.` };
  }

  /**
   * Edit course details.
   */
  editCourse(courseId, updates) {
    const course = store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };
    if (updates.title !== undefined) course.title = updates.title;
    if (updates.description !== undefined) course.description = updates.description;
    if (updates.price !== undefined) course.price = updates.price;
    if (updates.category !== undefined) course.category = updates.category;
    course.updatedAt = new Date().toISOString();
    store.saveCourses();
    return { success: true, message: 'Course updated.' };
  }

  /**
   * Delete a course (Instructor can delete draft; Admin can delete any).
   */
  deleteCourse(courseId, userId, isAdmin = false) {
    const course = store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };
    if (!isAdmin && course.instructorId !== userId) {
      return { success: false, message: 'You can only delete your own courses.' };
    }
    store.removeCourse(courseId);
    return { success: true, message: `Course "${course.title}" deleted.` };
  }

  /**
   * Submit a course for approval.
   */
  submitForApproval(courseId, instructorId) {
    const course = store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };
    if (course.instructorId !== instructorId) {
      return { success: false, message: 'Not your course.' };
    }
    if (course.lessons.length === 0) {
      return { success: false, message: 'Add at least one lesson before submitting.' };
    }
    if (course.status !== CourseStatus.DRAFT && course.status !== CourseStatus.REJECTED) {
      return { success: false, message: `Course is already ${course.status}.` };
    }
    course.status = CourseStatus.PENDING_APPROVAL;
    course.updatedAt = new Date().toISOString();
    store.saveCourses();
    return { success: true, message: 'Course submitted for admin approval.' };
  }

  /**
   * Admin: approve or reject a course.
   */
  reviewCourse(courseId, approve) {
    const course = store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };
    course.status = approve ? CourseStatus.APPROVED : CourseStatus.REJECTED;
    course.updatedAt = new Date().toISOString();
    store.saveCourses();
    return { success: true, message: `Course "${course.title}" ${approve ? 'approved' : 'rejected'}.` };
  }

  /**
   * Get courses pending approval.
   */
  getPendingCourses() {
    return store.courses.filter(c => c.status === CourseStatus.PENDING_APPROVAL);
  }

  /**
   * Get an instructor's courses.
   */
  getInstructorCourses(instructorId) {
    return store.findCoursesByInstructor(instructorId);
  }

  /**
   * Get all approved courses.
   */
  getApprovedCourses() {
    return store.getApprovedCourses();
  }

  /**
   * Get all categories.
   */
  getCategories() {
    return Object.values(CourseCategory);
  }

  /**
   * Get course details (with free preview lessons visible to all).
   */
  getCoursePreview(courseId) {
    const course = store.findCourseById(courseId);
    if (!course) return null;
    return {
      ...course,
      previewLessons: course.lessons.filter(l => l.isFreePreview),
      totalLessons: course.lessons.length,
    };
  }
}

const courseService = new CourseService();
export default courseService;
