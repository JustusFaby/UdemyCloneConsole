import crypto from 'crypto';

export class Lesson {
  constructor({ title, content, duration, videoUrl = '' }) {
    this.id = crypto.randomUUID();
    this.title = title;
    this.content = content;        // text description or summary
    this.duration = duration;      // in minutes
    this.videoUrl = videoUrl;      // simulated video link
    this.order = 0;
    this.isFreePreview = false;
    this.createdAt = new Date().toISOString();
  }

  static fromJSON(json) {
    const lesson = Object.create(Lesson.prototype);
    return Object.assign(lesson, json);
  }
}
