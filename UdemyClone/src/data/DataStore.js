import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import { Enrollment } from '../models/Enrollment.js';
import { Review } from '../models/Review.js';
import { Certificate } from '../models/Certificate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Simple JSON-file-based data store with in-memory caching.
 * Persists all data to individual JSON files in the /data directory.
 */
class DataStore {
  constructor() {
    this.users = [];
    this.courses = [];
    this.enrollments = [];
    this.reviews = [];
    this.certificates = [];
    this._ensureDataDir();
    this._load();
  }

  // ─── Private helpers ───────────────────────────────────────

  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  _filePath(name) {
    return path.join(DATA_DIR, `${name}.json`);
  }

  _readFile(name) {
    const fp = this._filePath(name);
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, 'utf-8');
    return JSON.parse(raw);
  }

  _writeFile(name, data) {
    fs.writeFileSync(this._filePath(name), JSON.stringify(data, null, 2), 'utf-8');
  }

  _load() {
    this.users = this._readFile('users').map(User.fromJSON);
    this.courses = this._readFile('courses').map(Course.fromJSON);
    this.enrollments = this._readFile('enrollments').map(Enrollment.fromJSON);
    this.reviews = this._readFile('reviews').map(Review.fromJSON);
    this.certificates = this._readFile('certificates').map(Certificate.fromJSON);
  }

  // ─── Persist individual collections ────────────────────────

  saveUsers() {
    this._writeFile('users', this.users);
  }

  saveCourses() {
    this._writeFile('courses', this.courses);
  }

  saveEnrollments() {
    this._writeFile('enrollments', this.enrollments);
  }

  saveReviews() {
    this._writeFile('reviews', this.reviews);
  }

  saveCertificates() {
    this._writeFile('certificates', this.certificates);
  }

  saveAll() {
    this.saveUsers();
    this.saveCourses();
    this.saveEnrollments();
    this.saveReviews();
    this.saveCertificates();
  }

  // ─── User queries ──────────────────────────────────────────

  findUserByEmail(email) {
    return this.users.find(u => u.email === email.toLowerCase().trim());
  }

  findUserById(id) {
    return this.users.find(u => u.id === id);
  }

  addUser(user) {
    this.users.push(user);
    this.saveUsers();
  }

  // ─── Course queries ────────────────────────────────────────

  findCourseById(id) {
    return this.courses.find(c => c.id === id);
  }

  findCoursesByInstructor(instructorId) {
    return this.courses.filter(c => c.instructorId === instructorId);
  }

  getApprovedCourses() {
    return this.courses.filter(c => c.status === 'Approved');
  }

  addCourse(course) {
    this.courses.push(course);
    this.saveCourses();
  }

  removeCourse(courseId) {
    this.courses = this.courses.filter(c => c.id !== courseId);
    this.saveCourses();
  }

  // ─── Enrollment queries ────────────────────────────────────

  findEnrollment(studentId, courseId) {
    return this.enrollments.find(e => e.studentId === studentId && e.courseId === courseId);
  }

  findEnrollmentsByStudent(studentId) {
    return this.enrollments.filter(e => e.studentId === studentId);
  }

  findEnrollmentsByCourse(courseId) {
    return this.enrollments.filter(e => e.courseId === courseId);
  }

  addEnrollment(enrollment) {
    this.enrollments.push(enrollment);
    this.saveEnrollments();
  }

  // ─── Review queries ────────────────────────────────────────

  findReviewsByCourse(courseId) {
    return this.reviews.filter(r => r.courseId === courseId && !r.isFlagged);
  }

  findReviewByStudentAndCourse(studentId, courseId) {
    return this.reviews.find(r => r.studentId === studentId && r.courseId === courseId);
  }

  addReview(review) {
    this.reviews.push(review);
    this.saveReviews();
  }

  // ─── Certificate queries ───────────────────────────────────

  findCertificate(studentId, courseId) {
    return this.certificates.find(c => c.studentId === studentId && c.courseId === courseId);
  }

  findCertificatesByStudent(studentId) {
    return this.certificates.filter(c => c.studentId === studentId);
  }

  addCertificate(cert) {
    this.certificates.push(cert);
    this.saveCertificates();
  }
}

// Singleton
const store = new DataStore();
export default store;
