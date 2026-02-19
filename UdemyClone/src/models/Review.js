import crypto from 'crypto';

export class Review {
  constructor({ studentId, studentName, courseId, rating, comment }) {
    this.id = crypto.randomUUID();
    this.studentId = studentId;
    this.studentName = studentName;
    this.courseId = courseId;
    this.rating = Math.min(5, Math.max(1, Math.round(rating)));  // 1-5 stars
    this.comment = comment;
    this.isVerified = false;      // set true once enrollment is confirmed
    this.isFlagged = false;       // for spam detection
    this.createdAt = new Date().toISOString();
  }

  static fromJSON(json) {
    const review = Object.create(Review.prototype);
    return Object.assign(review, json);
  }
}
