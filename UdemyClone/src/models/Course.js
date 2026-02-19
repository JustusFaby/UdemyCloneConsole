import crypto from 'crypto';

export const CourseStatus = Object.freeze({
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'PendingApproval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
});

export const CourseCategory = Object.freeze({
  PROGRAMMING: 'Programming',
  BUSINESS: 'Business',
  DESIGN: 'Design',
  MARKETING: 'Marketing',
  MUSIC: 'Music',
  PHOTOGRAPHY: 'Photography',
  HEALTH: 'Health & Fitness',
  PERSONAL_DEV: 'Personal Development',
  OTHER: 'Other',
});

export class Course {
  constructor({ title, description, price, category, instructorId, instructorName }) {
    this.id = crypto.randomUUID();
    this.title = title;
    this.description = description;
    this.price = price;
    this.category = category;
    this.instructorId = instructorId;
    this.instructorName = instructorName;
    this.status = CourseStatus.DRAFT;
    this.lessons = [];
    this.materials = [];       // { type: 'video'|'text'|'quiz', title, url/content }
    this.totalEnrollments = 0;
    this.averageRating = 0;
    this.totalRatings = 0;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  addLesson(lesson) {
    lesson.order = this.lessons.length + 1;
    this.lessons.push(lesson);
    this.updatedAt = new Date().toISOString();
  }

  removeLesson(lessonId) {
    this.lessons = this.lessons.filter(l => l.id !== lessonId);
    this.lessons.forEach((l, i) => (l.order = i + 1));
    this.updatedAt = new Date().toISOString();
  }

  addMaterial(material) {
    this.materials.push({ id: crypto.randomUUID(), ...material });
    this.updatedAt = new Date().toISOString();
  }

  updateRating(newAvg, totalCount) {
    this.averageRating = newAvg;
    this.totalRatings = totalCount;
  }

  static fromJSON(json) {
    const course = Object.create(Course.prototype);
    return Object.assign(course, json);
  }
}
