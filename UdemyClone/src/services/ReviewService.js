import store from '../data/DataStore.js';
import { Review } from '../models/Review.js';

// Simple spam keywords list
const SPAM_KEYWORDS = ['buy now', 'click here', 'free money', 'http://', 'https://', 'www.', 'earn cash'];
const MIN_REVIEW_LENGTH = 10;
const MAX_REVIEWS_PER_HOUR = 3;

class ReviewService {
  /**
   * Submit a review for a course.
   * Anti-spam: checks enrollment, duplicate, rate limiting, and spam keywords.
   */
  submitReview({ studentId, studentName, courseId, rating, comment }) {
    // Must be enrolled
    const enrollment = store.findEnrollment(studentId, courseId);
    if (!enrollment) {
      return { success: false, message: 'You must be enrolled in this course to leave a review.' };
    }

    // Must have some progress
    if (enrollment.progressPercent < 10) {
      return { success: false, message: 'Complete at least 10% of the course before reviewing.' };
    }

    // No duplicate reviews
    const existing = store.findReviewByStudentAndCourse(studentId, courseId);
    if (existing) {
      return { success: false, message: 'You have already reviewed this course.' };
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return { success: false, message: 'Rating must be between 1 and 5.' };
    }

    // Validate comment length
    if (!comment || comment.length < MIN_REVIEW_LENGTH) {
      return { success: false, message: `Review must be at least ${MIN_REVIEW_LENGTH} characters long.` };
    }

    // Rate limiting: max reviews per hour
    const recentReviews = store.reviews.filter(r => {
      if (r.studentId !== studentId) return false;
      const diff = Date.now() - new Date(r.createdAt).getTime();
      return diff < 3600000; // 1 hour
    });
    if (recentReviews.length >= MAX_REVIEWS_PER_HOUR) {
      return { success: false, message: 'You are submitting reviews too quickly. Please wait a while.' };
    }

    // Spam detection
    const lowerComment = comment.toLowerCase();
    const isSpam = SPAM_KEYWORDS.some(kw => lowerComment.includes(kw));

    const review = new Review({ studentId, studentName, courseId, rating, comment });
    review.isVerified = true;  // verified because enrollment exists
    review.isFlagged = isSpam;

    store.addReview(review);

    if (isSpam) {
      return { success: true, message: 'Review submitted (pending moderation due to content check).' };
    }

    // Recalculate course rating
    this._recalculateCourseRating(courseId);

    return { success: true, message: 'Review submitted successfully!' };
  }

  /**
   * Get all non-flagged reviews for a course.
   */
  getCourseReviews(courseId) {
    return store.findReviewsByCourse(courseId);
  }

  /**
   * Admin: get all flagged reviews.
   */
  getFlaggedReviews() {
    return store.reviews.filter(r => r.isFlagged);
  }

  /**
   * Admin: approve a flagged review.
   */
  approveReview(reviewId) {
    const review = store.reviews.find(r => r.id === reviewId);
    if (!review) return { success: false, message: 'Review not found.' };
    review.isFlagged = false;
    store.saveReviews();
    this._recalculateCourseRating(review.courseId);
    return { success: true, message: 'Review approved.' };
  }

  /**
   * Admin: delete a review.
   */
  deleteReview(reviewId) {
    const review = store.reviews.find(r => r.id === reviewId);
    if (!review) return { success: false, message: 'Review not found.' };
    const courseId = review.courseId;
    store.reviews = store.reviews.filter(r => r.id !== reviewId);
    store.saveReviews();
    this._recalculateCourseRating(courseId);
    return { success: true, message: 'Review deleted.' };
  }

  /**
   * Recalculate and update the average rating for a course.
   */
  _recalculateCourseRating(courseId) {
    const reviews = store.findReviewsByCourse(courseId);
    const course = store.findCourseById(courseId);
    if (!course) return;

    if (reviews.length === 0) {
      course.updateRating(0, 0);
    } else {
      const sum = reviews.reduce((s, r) => s + r.rating, 0);
      course.updateRating(+(sum / reviews.length).toFixed(2), reviews.length);
    }
    store.saveCourses();
  }
}

const reviewService = new ReviewService();
export default reviewService;
