import pool from './db.config.js';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import { Enrollment } from '../models/Enrollment.js';
import { Review } from '../models/Review.js';
import { Certificate } from '../models/Certificate.js';
import { Lesson } from '../models/Lesson.js';

/**
 * MySQL-backed data store.
 *
 * Public API is kept **identical** to the old JSON-file DataStore so the rest
 * of the application needs zero changes — every public method that previously
 * returned a value synchronously now returns a **Promise** (the callers already
 * use `await` / are inside async functions thanks to the readline-based menus).
 */
class DataStore {
  // ─────────────────────────────────────────────────────────────
  //  Internal helpers
  // ─────────────────────────────────────────────────────────────

  /** Convert ISO-8601 string to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS). */
  _toMySQLDatetime(isoString) {
    if (!isoString) return null;
    return isoString.replace('T', ' ').replace(/\.\d{3}Z$/, '').replace('Z', '');
  }

  /** Shorthand for pool.execute() that returns just the rows. */
  async _query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  // ─────────────────────────────────────────────────────────────
  //  Row → Model mappers
  // ─────────────────────────────────────────────────────────────

  _rowToUser(r) {
    return User.fromJSON({
      id: r.id,
      email: r.email,
      passwordHash: r.password_hash,
      firstName: r.first_name,
      lastName: r.last_name,
      role: r.role,
      isBanned: !!r.is_banned,
      createdAt: r.created_at?.toISOString?.() ?? r.created_at,
      updatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
    });
  }

  _rowToCourse(r, lessons = [], materials = []) {
    return Course.fromJSON({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      price: parseFloat(r.price),
      category: r.category,
      instructorId: r.instructor_id,
      instructorName: r.instructor_name,
      status: r.status,
      lessons,
      materials,
      totalEnrollments: r.total_enrollments,
      averageRating: parseFloat(r.average_rating),
      totalRatings: r.total_ratings,
      createdAt: r.created_at?.toISOString?.() ?? r.created_at,
      updatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
    });
  }

  _rowToLesson(r) {
    return {
      id: r.id,
      title: r.title,
      content: r.content ?? '',
      duration: r.duration,
      videoUrl: r.video_url ?? '',
      order: r.lesson_order,
      isFreePreview: !!r.is_free_preview,
      createdAt: r.created_at?.toISOString?.() ?? r.created_at,
    };
  }

  _rowToMaterial(r) {
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      url: r.url ?? '',
      content: r.content ?? '',
    };
  }

  async _rowToEnrollment(r) {
    // Fetch completed lesson IDs from junction table
    const clRows = await this._query(
      'SELECT lesson_id FROM completed_lessons WHERE enrollment_id = ?',
      [r.id]
    );
    return Enrollment.fromJSON({
      id: r.id,
      studentId: r.student_id,
      courseId: r.course_id,
      courseTitle: r.course_title,
      completedLessonIds: clRows.map(cl => cl.lesson_id),
      progressPercent: r.progress_percent,
      isCompleted: !!r.is_completed,
      isPaused: !!r.is_paused,
      certificateId: r.certificate_id,
      enrolledAt: r.enrolled_at?.toISOString?.() ?? r.enrolled_at,
      completedAt: r.completed_at?.toISOString?.() ?? r.completed_at,
    });
  }

  _rowToReview(r) {
    return Review.fromJSON({
      id: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      courseId: r.course_id,
      rating: r.rating,
      comment: r.comment ?? '',
      isVerified: !!r.is_verified,
      isFlagged: !!r.is_flagged,
      createdAt: r.created_at?.toISOString?.() ?? r.created_at,
    });
  }

  _rowToCertificate(r) {
    return Certificate.fromJSON({
      id: r.id,
      certificateNumber: r.certificate_number,
      studentId: r.student_id,
      studentName: r.student_name,
      courseId: r.course_id,
      courseTitle: r.course_title,
      instructorName: r.instructor_name,
      issuedAt: r.issued_at?.toISOString?.() ?? r.issued_at,
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  Save helpers (no-ops kept for API compat — writes happen
  //  immediately in add/update methods)
  // ─────────────────────────────────────────────────────────────

  async saveUsers() { /* persisted on every write */ }
  async saveCourses() { /* persisted on every write */ }
  async saveEnrollments() { /* persisted on every write */ }
  async saveReviews() { /* persisted on every write */ }
  async saveCertificates() { /* persisted on every write */ }
  async saveAll() { /* persisted on every write */ }

  // ═══════════════════════════════════════════════════════════
  //  USER QUERIES
  // ═══════════════════════════════════════════════════════════

  async findUserByEmail(email) {
    const rows = await this._query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    return rows.length ? this._rowToUser(rows[0]) : undefined;
  }

  async findUserById(id) {
    const rows = await this._query('SELECT * FROM users WHERE id = ?', [id]);
    return rows.length ? this._rowToUser(rows[0]) : undefined;
  }

  async addUser(user) {
    await this._query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_banned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.email, user.passwordHash, user.firstName, user.lastName,
      user.role, user.isBanned ? 1 : 0, this._toMySQLDatetime(user.createdAt), this._toMySQLDatetime(user.updatedAt)]
    );
  }

  /** Helper used by admin ban/unban — update a single user row. */
  async updateUser(user) {
    await this._query(
      `UPDATE users SET email=?, password_hash=?, first_name=?, last_name=?,
       role=?, is_banned=?, updated_at=NOW() WHERE id=?`,
      [user.email, user.passwordHash, user.firstName, user.lastName,
      user.role, user.isBanned ? 1 : 0, user.id]
    );
  }

  /** Get all users (admin panel). */
  async getAllUsers() {
    const rows = await this._query('SELECT * FROM users');
    return rows.map(r => this._rowToUser(r));
  }

  // ═══════════════════════════════════════════════════════════
  //  COURSE QUERIES
  // ═══════════════════════════════════════════════════════════

  async _loadCourseFull(row) {
    const lessonRows = await this._query(
      'SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order', [row.id]
    );
    const matRows = await this._query(
      'SELECT * FROM materials WHERE course_id = ?', [row.id]
    );
    return this._rowToCourse(
      row,
      lessonRows.map(l => this._rowToLesson(l)),
      matRows.map(m => this._rowToMaterial(m)),
    );
  }

  async findCourseById(id) {
    const rows = await this._query('SELECT * FROM courses WHERE id = ?', [id]);
    if (!rows.length) return undefined;
    return this._loadCourseFull(rows[0]);
  }

  async findCoursesByInstructor(instructorId) {
    const rows = await this._query('SELECT * FROM courses WHERE instructor_id = ?', [instructorId]);
    return Promise.all(rows.map(r => this._loadCourseFull(r)));
  }

  async getApprovedCourses() {
    const rows = await this._query("SELECT * FROM courses WHERE status = 'Approved'");
    return Promise.all(rows.map(r => this._loadCourseFull(r)));
  }

  async getAllCourses() {
    const rows = await this._query('SELECT * FROM courses');
    return Promise.all(rows.map(r => this._loadCourseFull(r)));
  }

  async addCourse(course) {
    await this._query(
      `INSERT INTO courses (id, title, description, price, category, instructor_id,
       instructor_name, status, total_enrollments, average_rating, total_ratings,
       created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [course.id, course.title, course.description, course.price, course.category,
      course.instructorId, course.instructorName, course.status,
      course.totalEnrollments, course.averageRating, course.totalRatings,
      this._toMySQLDatetime(course.createdAt), this._toMySQLDatetime(course.updatedAt)]
    );
    // Persist lessons & materials that may already exist on the model
    for (const lesson of course.lessons ?? []) {
      await this._insertLesson(course.id, lesson);
    }
    for (const mat of course.materials ?? []) {
      await this._insertMaterial(course.id, mat);
    }
  }

  async updateCourse(course) {
    await this._query(
      `UPDATE courses SET title=?, description=?, price=?, category=?,
       instructor_id=?, instructor_name=?, status=?, total_enrollments=?,
       average_rating=?, total_ratings=?, updated_at=NOW() WHERE id=?`,
      [course.title, course.description, course.price, course.category,
      course.instructorId, course.instructorName, course.status,
      course.totalEnrollments, course.averageRating, course.totalRatings,
      course.id]
    );
    // Sync lessons: delete & re-insert (simple approach)
    await this._query('DELETE FROM lessons WHERE course_id = ?', [course.id]);
    for (const lesson of course.lessons ?? []) {
      await this._insertLesson(course.id, lesson);
    }
    // Sync materials
    await this._query('DELETE FROM materials WHERE course_id = ?', [course.id]);
    for (const mat of course.materials ?? []) {
      await this._insertMaterial(course.id, mat);
    }
  }

  async removeCourse(courseId) {
    await this._query('DELETE FROM courses WHERE id = ?', [courseId]);
  }

  // ─── Lesson / Material insert helpers ──────────────────────

  async _insertLesson(courseId, lesson) {
    await this._query(
      `INSERT INTO lessons (id, course_id, title, content, duration, video_url, lesson_order, is_free_preview, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lesson.id, courseId, lesson.title, lesson.content ?? '', lesson.duration,
      lesson.videoUrl ?? '', lesson.order ?? 0, lesson.isFreePreview ? 1 : 0,
      this._toMySQLDatetime(lesson.createdAt ?? new Date().toISOString())]
    );
  }

  async _insertMaterial(courseId, mat) {
    await this._query(
      `INSERT INTO materials (id, course_id, type, title, url, content)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [mat.id, courseId, mat.type ?? 'text', mat.title, mat.url ?? '', mat.content ?? '']
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  ENROLLMENT QUERIES
  // ═══════════════════════════════════════════════════════════

  async findEnrollment(studentId, courseId) {
    const rows = await this._query(
      'SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?',
      [studentId, courseId]
    );
    return rows.length ? this._rowToEnrollment(rows[0]) : undefined;
  }

  async findEnrollmentsByStudent(studentId) {
    const rows = await this._query('SELECT * FROM enrollments WHERE student_id = ?', [studentId]);
    return Promise.all(rows.map(r => this._rowToEnrollment(r)));
  }

  async findEnrollmentsByCourse(courseId) {
    const rows = await this._query('SELECT * FROM enrollments WHERE course_id = ?', [courseId]);
    return Promise.all(rows.map(r => this._rowToEnrollment(r)));
  }

  async addEnrollment(enrollment) {
    await this._query(
      `INSERT INTO enrollments (id, student_id, course_id, course_title, progress_percent,
       is_completed, is_paused, certificate_id, enrolled_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [enrollment.id, enrollment.studentId, enrollment.courseId, enrollment.courseTitle,
      enrollment.progressPercent, enrollment.isCompleted ? 1 : 0,
      enrollment.isPaused ? 1 : 0, enrollment.certificateId,
      this._toMySQLDatetime(enrollment.enrolledAt), this._toMySQLDatetime(enrollment.completedAt)]
    );
  }

  async updateEnrollment(enrollment) {
    await this._query(
      `UPDATE enrollments SET progress_percent=?, is_completed=?, is_paused=?,
       certificate_id=?, completed_at=? WHERE id=?`,
      [enrollment.progressPercent, enrollment.isCompleted ? 1 : 0,
      enrollment.isPaused ? 1 : 0, enrollment.certificateId,
      this._toMySQLDatetime(enrollment.completedAt), enrollment.id]
    );
    // Sync completed lessons
    await this._query('DELETE FROM completed_lessons WHERE enrollment_id = ?', [enrollment.id]);
    for (const lessonId of enrollment.completedLessonIds ?? []) {
      await this._query(
        'INSERT INTO completed_lessons (enrollment_id, lesson_id) VALUES (?, ?)',
        [enrollment.id, lessonId]
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  REVIEW QUERIES
  // ═══════════════════════════════════════════════════════════

  async findReviewsByCourse(courseId) {
    const rows = await this._query(
      'SELECT * FROM reviews WHERE course_id = ? AND is_flagged = 0', [courseId]
    );
    return rows.map(r => this._rowToReview(r));
  }

  async findReviewByStudentAndCourse(studentId, courseId) {
    const rows = await this._query(
      'SELECT * FROM reviews WHERE student_id = ? AND course_id = ?',
      [studentId, courseId]
    );
    return rows.length ? this._rowToReview(rows[0]) : undefined;
  }

  async addReview(review) {
    await this._query(
      `INSERT INTO reviews (id, student_id, student_name, course_id, rating, comment,
       is_verified, is_flagged, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [review.id, review.studentId, review.studentName, review.courseId,
      review.rating, review.comment, review.isVerified ? 1 : 0,
      review.isFlagged ? 1 : 0, this._toMySQLDatetime(review.createdAt)]
    );
  }

  async updateReview(review) {
    await this._query(
      `UPDATE reviews SET rating=?, comment=?, is_verified=?, is_flagged=? WHERE id=?`,
      [review.rating, review.comment, review.isVerified ? 1 : 0,
      review.isFlagged ? 1 : 0, review.id]
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  CERTIFICATE QUERIES
  // ═══════════════════════════════════════════════════════════

  async findCertificate(studentId, courseId) {
    const rows = await this._query(
      'SELECT * FROM certificates WHERE student_id = ? AND course_id = ?',
      [studentId, courseId]
    );
    return rows.length ? this._rowToCertificate(rows[0]) : undefined;
  }

  async findCertificatesByStudent(studentId) {
    const rows = await this._query('SELECT * FROM certificates WHERE student_id = ?', [studentId]);
    return rows.map(r => this._rowToCertificate(r));
  }

  async addCertificate(cert) {
    await this._query(
      `INSERT INTO certificates (id, certificate_number, student_id, student_name,
       course_id, course_title, instructor_name, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cert.id, cert.certificateNumber, cert.studentId, cert.studentName,
      cert.courseId, cert.courseTitle, cert.instructorName, this._toMySQLDatetime(cert.issuedAt)]
    );
  }

  async getAllCertificates() {
    const rows = await this._query('SELECT * FROM certificates');
    return rows.map(r => this._rowToCertificate(r));
  }

  // ═══════════════════════════════════════════════════════════
  //  ADDITIONAL QUERIES (needed by services that previously
  //  accessed in-memory arrays directly)
  // ═══════════════════════════════════════════════════════════

  async getAllEnrollments() {
    const rows = await this._query('SELECT * FROM enrollments');
    return Promise.all(rows.map(r => this._rowToEnrollment(r)));
  }

  async getAllReviews() {
    const rows = await this._query('SELECT * FROM reviews');
    return rows.map(r => this._rowToReview(r));
  }

  async getFlaggedReviews() {
    const rows = await this._query('SELECT * FROM reviews WHERE is_flagged = 1');
    return rows.map(r => this._rowToReview(r));
  }

  async findReviewById(reviewId) {
    const rows = await this._query('SELECT * FROM reviews WHERE id = ?', [reviewId]);
    return rows.length ? this._rowToReview(rows[0]) : undefined;
  }

  async removeReview(reviewId) {
    await this._query('DELETE FROM reviews WHERE id = ?', [reviewId]);
  }

  async getRecentReviewsByStudent(studentId, sinceMs = 3600000) {
    const since = this._toMySQLDatetime(new Date(Date.now() - sinceMs).toISOString());
    const rows = await this._query(
      'SELECT * FROM reviews WHERE student_id = ? AND created_at >= ?',
      [studentId, since]
    );
    return rows.map(r => this._rowToReview(r));
  }

  async getPendingCourses() {
    const rows = await this._query("SELECT * FROM courses WHERE status = 'PendingApproval'");
    return Promise.all(rows.map(r => this._loadCourseFull(r)));
  }
}

// Singleton
const store = new DataStore();
export default store;
