import crypto from 'crypto';

export class Certificate {
  constructor({ studentId, studentName, courseId, courseTitle, instructorName }) {
    this.id = crypto.randomUUID();
    this.certificateNumber = `CERT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    this.studentId = studentId;
    this.studentName = studentName;
    this.courseId = courseId;
    this.courseTitle = courseTitle;
    this.instructorName = instructorName;
    this.issuedAt = new Date().toISOString();
  }

  display() {
    const border = '═'.repeat(60);
    return `
╔${border}╗
║${'CERTIFICATE OF COMPLETION'.padStart(42).padEnd(60)}║
╠${border}╣
║${' '.repeat(60)}║
║${'This certifies that'.padStart(39).padEnd(60)}║
║${this.studentName.padStart(30 + this.studentName.length / 2).padEnd(60)}║
║${' '.repeat(60)}║
║${'has successfully completed'.padStart(42).padEnd(60)}║
║${this.courseTitle.padStart(30 + this.courseTitle.length / 2).padEnd(60)}║
║${' '.repeat(60)}║
║${`Instructor: ${this.instructorName}`.padStart(36 + this.instructorName.length / 2).padEnd(60)}║
║${`Certificate #: ${this.certificateNumber}`.padStart(37 + this.certificateNumber.length / 2).padEnd(60)}║
║${`Date: ${this.issuedAt.split('T')[0]}`.padStart(33).padEnd(60)}║
║${' '.repeat(60)}║
╚${border}╝`;
  }

  static fromJSON(json) {
    const cert = Object.create(Certificate.prototype);
    return Object.assign(cert, json);
  }
}
