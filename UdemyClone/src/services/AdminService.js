import store from '../data/DataStore.js';
import { UserRole } from '../models/User.js';

class AdminService {
  /**
   * Get all users (with optional role filter).
   */
  async getUsers(roleFilter = null) {
    let users = await store.getAllUsers();
    if (roleFilter) {
      users = users.filter(u => u.role === roleFilter);
    }
    return users.map(u => u.toSafeObject ? u.toSafeObject() : u);
  }

  /**
   * Get platform analytics.
   */
  async getAnalytics() {
    const users = await store.getAllUsers();
    const courses = await store.getAllCourses();
    const enrollments = await store.getAllEnrollments();
    const reviews = await store.getAllReviews();
    const certificates = await store.getAllCertificates();

    const totalUsers = users.length;
    const students = users.filter(u => u.role === UserRole.STUDENT).length;
    const instructors = users.filter(u => u.role === UserRole.INSTRUCTOR).length;
    const admins = users.filter(u => u.role === UserRole.ADMIN).length;
    const bannedUsers = users.filter(u => u.isBanned).length;

    const totalCourses = courses.length;
    const approvedCourses = courses.filter(c => c.status === 'Approved').length;
    const pendingCourses = courses.filter(c => c.status === 'PendingApproval').length;
    const draftCourses = courses.filter(c => c.status === 'Draft').length;

    const totalEnrollments = enrollments.length;
    const completedEnrollments = enrollments.filter(e => e.isCompleted).length;
    const activeEnrollments = enrollments.filter(e => !e.isCompleted && !e.isPaused).length;

    const totalReviews = reviews.length;
    const flaggedReviews = reviews.filter(r => r.isFlagged).length;

    const totalCertificates = certificates.length;

    // Revenue calculation (sum of course prices × enrollments)
    let totalRevenue = 0;
    for (const e of enrollments) {
      const course = courses.find(c => c.id === e.courseId);
      if (course) totalRevenue += course.price;
    }

    // Category distribution
    const categoryStats = {};
    courses.forEach(c => {
      categoryStats[c.category] = (categoryStats[c.category] || 0) + 1;
    });

    // Top courses by enrollment
    const topCourses = [...courses]
      .sort((a, b) => b.totalEnrollments - a.totalEnrollments)
      .slice(0, 5)
      .map(c => ({ title: c.title, enrollments: c.totalEnrollments, rating: c.averageRating }));

    return {
      users: { total: totalUsers, students, instructors, admins, banned: bannedUsers },
      courses: { total: totalCourses, approved: approvedCourses, pending: pendingCourses, draft: draftCourses },
      enrollments: { total: totalEnrollments, completed: completedEnrollments, active: activeEnrollments },
      reviews: { total: totalReviews, flagged: flaggedReviews },
      certificates: totalCertificates,
      revenue: totalRevenue,
      categoryStats,
      topCourses,
    };
  }

  /**
   * Get all courses for admin management (any status).
   */
  async getAllCourses() {
    return await store.getAllCourses();
  }

  /**
   * Get course statistics.
   */
  async getCourseStats(courseId) {
    const course = await store.findCourseById(courseId);
    if (!course) return null;
    const enrollments = await store.findEnrollmentsByCourse(courseId);
    const reviews = await store.findReviewsByCourse(courseId);
    return {
      ...course,
      enrollmentCount: enrollments.length,
      completionRate: enrollments.length > 0
        ? Math.round((enrollments.filter(e => e.isCompleted).length / enrollments.length) * 100)
        : 0,
      reviewCount: reviews.length,
      reviews,
    };
  }
}

const adminService = new AdminService();
export default adminService;
