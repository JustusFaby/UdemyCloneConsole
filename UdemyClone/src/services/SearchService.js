import store from '../data/DataStore.js';

class SearchService {
  /**
   * Search approved courses with filters.
   * @param {Object} filters
   * @param {string} [filters.query]      - keyword search in title/description
   * @param {string} [filters.category]   - exact category match
   * @param {number} [filters.minRating]  - minimum average rating
   * @param {number} [filters.maxPrice]   - maximum price
   * @param {number} [filters.minPrice]   - minimum price
   * @param {string} [filters.sortBy]     - 'popularity' | 'newest' | 'highest-rated' | 'price-low' | 'price-high'
   */
  search(filters = {}) {
    let results = store.getApprovedCourses();

    // Keyword search (title + description)
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.instructorName.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (filters.category) {
      results = results.filter(c => c.category === filters.category);
    }

    // Rating filter
    if (filters.minRating) {
      results = results.filter(c => c.averageRating >= filters.minRating);
    }

    // Price filter
    if (filters.minPrice !== undefined) {
      results = results.filter(c => c.price >= filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter(c => c.price <= filters.maxPrice);
    }

    // Sorting
    const sortBy = filters.sortBy || 'popularity';
    switch (sortBy) {
      case 'popularity':
        results.sort((a, b) => b.totalEnrollments - a.totalEnrollments);
        break;
      case 'newest':
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'highest-rated':
        results.sort((a, b) => b.averageRating - a.averageRating);
        break;
      case 'price-low':
        results.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        results.sort((a, b) => b.price - a.price);
        break;
    }

    return results;
  }

  /**
   * Generate course recommendations for a student.
   *
   * Strategy:
   * 1. Find categories the student has enrolled in.
   * 2. Recommend top-rated courses in those categories that the student hasn't enrolled in.
   * 3. Fill remaining slots with overall top-rated courses.
   */
  getRecommendations(studentId, limit = 5) {
    const enrollments = store.findEnrollmentsByStudent(studentId);
    const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));

    // Find preferred categories
    const categoryCounts = {};
    enrollments.forEach(e => {
      const course = store.findCourseById(e.courseId);
      if (course) {
        categoryCounts[course.category] = (categoryCounts[course.category] || 0) + 1;
      }
    });
    const preferredCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    const approved = store.getApprovedCourses().filter(c => !enrolledCourseIds.has(c.id));

    // Priority 1: courses in preferred categories, sorted by rating
    const preferred = approved
      .filter(c => preferredCategories.includes(c.category))
      .sort((a, b) => b.averageRating - a.averageRating || b.totalEnrollments - a.totalEnrollments);

    // Priority 2: other popular/highly-rated courses
    const others = approved
      .filter(c => !preferredCategories.includes(c.category))
      .sort((a, b) => b.averageRating - a.averageRating || b.totalEnrollments - a.totalEnrollments);

    const recommendations = [...preferred, ...others].slice(0, limit);

    // If student has no enrollments, just return top courses
    if (recommendations.length === 0) {
      return approved
        .sort((a, b) => b.totalEnrollments - a.totalEnrollments || b.averageRating - a.averageRating)
        .slice(0, limit);
    }

    return recommendations;
  }
}

const searchService = new SearchService();
export default searchService;
