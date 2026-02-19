import store from '../data/DataStore.js';
import { UserRole } from '../models/User.js';

class AdminService {
  /**
   * Get all users (with optional role filter).
   */
  getUsers(roleFilter = null) {
    let users = store.users;
    if (roleFilter) {
      users = users.filter(u => u.role === roleFilter);
    }
    return users.map(u => u.toSafeObject ? u.toSafeObject() : u);
  }

  /**
   * Get platform analytics.
   */
  getAnalytics() {
    const totalUsers = store.users.length;
    const students = store.users.filter(u => u.role === UserRole.STUDENT).length;
    const instructors = store.users.filter(u => u.role === UserRole.INSTRUCTOR).length;
    const admins = store.users.filter(u => u.role === UserRole.ADMIN).length;
    const bannedUsers = store.users.filter(u => u.isBanned).length;

    const totalCourses = store.courses.length;
    const approvedCourses = store.courses.filter(c => c.status === 'Approved').length;
    const pendingCourses = store.courses.filter(c => c.status === 'PendingApproval').length;
    const draftCourses = store.courses.filter(c => c.status === 'Draft').length;

    const totalEnrollments = store.enrollments.length;
    const completedEnrollments = store.enrollments.filter(e => e.isCompleted).length;
    const activeEnrollments = store.enrollments.filter(e => !e.isCompleted && !e.isPaused).length;

    const totalReviews = store.reviews.length;
    const flaggedReviews = store.reviews.filter(r => r.isFlagged).length;

    const totalCertificates = store.certificates.length;

    // Revenue calculation (sum of course prices × enrollments)
    let totalRevenue = 0;
    store.enrollments.forEach(e => {
      const course = store.findCourseById(e.courseId);
      if (course) totalRevenue += course.price;
    });

    // Category distribution
    const categoryStats = {};
    store.courses.forEach(c => {
      categoryStats[c.category] = (categoryStats[c.category] || 0) + 1;
    });

    // Top courses by enrollment
    const topCourses = [...store.courses]
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
  getAllCourses() {
    return store.courses;
  }

  /**
   * Get course statistics.
   */
  getCourseStats(courseId) {
    const course = store.findCourseById(courseId);
    if (!course) return null;
    const enrollments = store.findEnrollmentsByCourse(courseId);
    const reviews = store.findReviewsByCourse(courseId);
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
