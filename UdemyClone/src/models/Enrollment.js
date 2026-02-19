import crypto from 'crypto';

export class Enrollment {
  constructor({ studentId, courseId, courseTitle }) {
    this.id = crypto.randomUUID();
    this.studentId = studentId;
    this.courseId = courseId;
    this.courseTitle = courseTitle;
    this.completedLessonIds = [];
    this.progressPercent = 0;
    this.isCompleted = false;
    this.isPaused = false;
    this.certificateId = null;
    this.enrolledAt = new Date().toISOString();
    this.completedAt = null;
  }

  markLessonComplete(lessonId, totalLessons) {
    if (!this.completedLessonIds.includes(lessonId)) {
      this.completedLessonIds.push(lessonId);
    }
    this.progressPercent = Math.round((this.completedLessonIds.length / totalLessons) * 100);
    if (this.progressPercent >= 100) {
      this.isCompleted = true;
      this.completedAt = new Date().toISOString();
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  static fromJSON(json) {
    const enrollment = Object.create(Enrollment.prototype);
    return Object.assign(enrollment, json);
  }
}
