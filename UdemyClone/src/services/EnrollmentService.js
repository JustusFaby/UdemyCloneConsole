import store from '../data/DataStore.js';
import { Enrollment } from '../models/Enrollment.js';
import { Certificate } from '../models/Certificate.js';

class EnrollmentService {
  /**
   * Enroll a student in a course.
   */
  async enroll(studentId, courseId) {
    const course = await store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };
    if (course.status !== 'Approved') {
      return { success: false, message: 'This course is not available for enrollment.' };
    }
    if (course.instructorId === studentId) {
      return { success: false, message: 'You cannot enroll in your own course.' };
    }
    const existing = await store.findEnrollment(studentId, courseId);
    if (existing) return { success: false, message: 'You are already enrolled in this course.' };

    const enrollment = new Enrollment({
      studentId,
      courseId,
      courseTitle: course.title,
    });
    await store.addEnrollment(enrollment);

    // Increment enrollment count
    course.totalEnrollments++;
    await store.updateCourse(course);

    return { success: true, message: `Enrolled in "${course.title}"!`, enrollment };
  }

  /**
   * Mark a lesson as completed.
   */
  async completeLesson(studentId, courseId, lessonId) {
    const enrollment = await store.findEnrollment(studentId, courseId);
    if (!enrollment) return { success: false, message: 'You are not enrolled in this course.' };

    const course = await store.findCourseById(courseId);
    if (!course) return { success: false, message: 'Course not found.' };

    const lesson = course.lessons.find(l => l.id === lessonId);
    if (!lesson) return { success: false, message: 'Lesson not found.' };

    const wasDone = enrollment.isCompleted;
    enrollment.markLessonComplete(lessonId, course.lessons.length);
    await store.updateEnrollment(enrollment);

    // Issue certificate on completion
    if (enrollment.isCompleted && !wasDone) {
      const cert = await this._issueCertificate(studentId, course);
      enrollment.certificateId = cert.id;
      await store.updateEnrollment(enrollment);
      return { success: true, message: 'Lesson completed! You have finished the course!', certificate: cert };
    }

    return { success: true, message: `Lesson "${lesson.title}" marked as completed. Progress: ${enrollment.progressPercent}%` };
  }

  /**
   * Pause enrollment.
   */
  async pauseEnrollment(studentId, courseId) {
    const enrollment = await store.findEnrollment(studentId, courseId);
    if (!enrollment) return { success: false, message: 'Enrollment not found.' };
    enrollment.pause();
    await store.updateEnrollment(enrollment);
    return { success: true, message: 'Course paused. Resume anytime.' };
  }

  /**
   * Resume enrollment.
   */
  async resumeEnrollment(studentId, courseId) {
    const enrollment = await store.findEnrollment(studentId, courseId);
    if (!enrollment) return { success: false, message: 'Enrollment not found.' };
    enrollment.resume();
    await store.updateEnrollment(enrollment);
    return { success: true, message: 'Course resumed!' };
  }

  /**
   * Get student's enrollments.
   */
  async getStudentEnrollments(studentId) {
    return await store.findEnrollmentsByStudent(studentId);
  }

  /**
   * Get progress details.
   */
  async getProgress(studentId, courseId) {
    const enrollment = await store.findEnrollment(studentId, courseId);
    if (!enrollment) return null;
    const course = await store.findCourseById(courseId);
    if (!course) return null;

    return {
      courseTitle: course.title,
      totalLessons: course.lessons.length,
      completedLessons: enrollment.completedLessonIds.length,
      progressPercent: enrollment.progressPercent,
      isCompleted: enrollment.isCompleted,
      isPaused: enrollment.isPaused,
      lessons: course.lessons.map(l => ({
        id: l.id,
        title: l.title,
        order: l.order,
        isCompleted: enrollment.completedLessonIds.includes(l.id),
      })),
    };
  }

  /**
   * Get student certificates.
   */
  async getStudentCertificates(studentId) {
    return await store.findCertificatesByStudent(studentId);
  }

  /**
   * Issue a certificate.
   */
  async _issueCertificate(studentId, course) {
    const student = await store.findUserById(studentId);
    const cert = new Certificate({
      studentId,
      studentName: student ? student.fullName : 'Unknown',
      courseId: course.id,
      courseTitle: course.title,
      instructorName: course.instructorName,
    });
    await store.addCertificate(cert);
    return cert;
  }
}

const enrollmentService = new EnrollmentService();
export default enrollmentService;
