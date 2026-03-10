import java.sql.*;
import java.util.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;

public class UdemyClone {

    // Database config from environment variables
    private static final String RDS_HOSTNAME = System.getenv("RDS_HOSTNAME") != null ? System.getenv("RDS_HOSTNAME") : "localhost";
    private static final String RDS_PORT = System.getenv("RDS_PORT") != null ? System.getenv("RDS_PORT") : "3306";
    private static final String RDS_DB_NAME = System.getenv("RDS_DB_NAME") != null ? System.getenv("RDS_DB_NAME") : "udemy_clone";
    private static final String RDS_USERNAME = System.getenv("RDS_USERNAME") != null ? System.getenv("RDS_USERNAME") : "root";
    private static final String RDS_PASSWORD = System.getenv("RDS_PASSWORD") != null ? System.getenv("RDS_PASSWORD") : "";
    private static final String DB_URL = String.format("jdbc:mysql://%s:%s/%s?useSSL=true&serverTimezone=UTC", RDS_HOSTNAME, RDS_PORT, RDS_DB_NAME);

    enum UserRole { Student, Instructor, Admin }
    enum CourseStatus { Draft, PendingApproval, Approved, Rejected }
    enum CourseCategory { Programming, Business, Design, Marketing, Music, Photography, Health, PersonalDevelopment, Other }

    // Models
    static class User {
        String id, email, passwordHash, firstName, lastName;
        UserRole role;
        boolean isBanned;
        LocalDateTime createdAt, updatedAt;
        
        User() {
            this.id = UUID.randomUUID().toString();
            this.createdAt = LocalDateTime.now();
            this.updatedAt = LocalDateTime.now();
        }
        String getFullName() { return firstName + " " + lastName; }
    }
    
    static class Course {
        String id, title, description, category, instructorId, instructorName;
        double price;
        CourseStatus status;
        List<Lesson> lessons = new ArrayList<>();
        int totalEnrollments, totalRatings;
        double averageRating;
        LocalDateTime createdAt, updatedAt;
        
        Course() {
            this.id = UUID.randomUUID().toString();
            this.status = CourseStatus.Draft;
            this.createdAt = LocalDateTime.now();
            this.updatedAt = LocalDateTime.now();
        }
    }
    
    static class Lesson {
        String id, courseId, title, content, videoUrl;
        int duration, order;
        boolean isFreePreview;
        LocalDateTime createdAt;
        
        Lesson() {
            this.id = UUID.randomUUID().toString();
            this.createdAt = LocalDateTime.now();
        }
    }
    
    static class Enrollment {
        String id, studentId, courseId, courseTitle, certificateId;
        List<String> completedLessonIds = new ArrayList<>();
        int progressPercent;
        boolean isCompleted, isPaused;
        LocalDateTime enrolledAt, completedAt;
        
        Enrollment() {
            this.id = UUID.randomUUID().toString();
            this.enrolledAt = LocalDateTime.now();
        }
        
        void markLessonComplete(String lessonId, int totalLessons) {
            if (!completedLessonIds.contains(lessonId)) completedLessonIds.add(lessonId);
            progressPercent = (int) Math.round((completedLessonIds.size() * 100.0) / totalLessons);
            if (progressPercent >= 100) {
                isCompleted = true;
                completedAt = LocalDateTime.now();
            }
        }
    }
    
    static class Review {
        String id, studentId, studentName, courseId, comment;
        int rating;
        boolean isVerified, isFlagged;
        LocalDateTime createdAt;
        
        Review() {
            this.id = UUID.randomUUID().toString();
            this.createdAt = LocalDateTime.now();
        }
    }
    
    static class Certificate {
        String id, certificateNumber, studentId, studentName, courseId, courseTitle, instructorName;
        LocalDateTime issuedAt;
        
        Certificate() {
            this.id = UUID.randomUUID().toString();
            this.certificateNumber = "CERT-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            this.issuedAt = LocalDateTime.now();
        }
        
        String display() {
            return "\n--- CERTIFICATE OF COMPLETION ---\n" +
                   "This certifies that " + studentName + "\n" +
                   "has successfully completed: " + courseTitle + "\n" +
                   "Instructor: " + instructorName + "\n" +
                   "Certificate #: " + certificateNumber + "\n" +
                   "Date: " + issuedAt.toLocalDate() + "\n" +
                   "---------------------------------\n";
        }
    }
    
    static class Result {
        boolean success;
        String message;
        Object data;
        Result(boolean success, String message) { this.success = success; this.message = message; }
        Result(boolean success, String message, Object data) { this.success = success; this.message = message; this.data = data; }
    }

    // Database layer
    static class DataStore {
        private Connection conn;
        
        void connect() throws SQLException {
            conn = DriverManager.getConnection(DB_URL, RDS_USERNAME, RDS_PASSWORD);
            System.out.println("Connected to database.");
        }
        
        void close() {
            try { if (conn != null && !conn.isClosed()) conn.close(); } 
            catch (SQLException e) { e.printStackTrace(); }
        }
        
        boolean testConnection() {
            try { connect(); return conn != null && !conn.isClosed(); }
            catch (SQLException e) { return false; }
        }
        
        // User operations
        void addUser(User u) throws SQLException {
            String sql = "INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_banned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, u.id); ps.setString(2, u.email); ps.setString(3, u.passwordHash);
                ps.setString(4, u.firstName); ps.setString(5, u.lastName); ps.setString(6, u.role.name());
                ps.setBoolean(7, u.isBanned); ps.setTimestamp(8, Timestamp.valueOf(u.createdAt));
                ps.setTimestamp(9, Timestamp.valueOf(u.updatedAt));
                ps.executeUpdate();
            }
        }
        
        User findUserByEmail(String email) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE email = ?")) {
                ps.setString(1, email.toLowerCase().trim());
                ResultSet rs = ps.executeQuery();
                return rs.next() ? rowToUser(rs) : null;
            }
        }
        
        User findUserById(String id) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE id = ?")) {
                ps.setString(1, id);
                ResultSet rs = ps.executeQuery();
                return rs.next() ? rowToUser(rs) : null;
            }
        }
        
        void updateUser(User u) throws SQLException {
            String sql = "UPDATE users SET email=?, password_hash=?, first_name=?, last_name=?, role=?, is_banned=?, updated_at=? WHERE id=?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, u.email); ps.setString(2, u.passwordHash); ps.setString(3, u.firstName);
                ps.setString(4, u.lastName); ps.setString(5, u.role.name()); ps.setBoolean(6, u.isBanned);
                ps.setTimestamp(7, Timestamp.valueOf(LocalDateTime.now())); ps.setString(8, u.id);
                ps.executeUpdate();
            }
        }
        
        List<User> getAllUsers(UserRole filter) throws SQLException {
            String sql = filter == null ? "SELECT * FROM users ORDER BY created_at DESC" : "SELECT * FROM users WHERE role = ? ORDER BY created_at DESC";
            List<User> users = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                if (filter != null) ps.setString(1, filter.name());
                ResultSet rs = ps.executeQuery();
                while (rs.next()) users.add(rowToUser(rs));
            }
            return users;
        }
        
        private User rowToUser(ResultSet rs) throws SQLException {
            User u = new User();
            u.id = rs.getString("id"); u.email = rs.getString("email"); u.passwordHash = rs.getString("password_hash");
            u.firstName = rs.getString("first_name"); u.lastName = rs.getString("last_name");
            u.role = UserRole.valueOf(rs.getString("role")); u.isBanned = rs.getBoolean("is_banned");
            u.createdAt = rs.getTimestamp("created_at").toLocalDateTime();
            u.updatedAt = rs.getTimestamp("updated_at").toLocalDateTime();
            return u;
        }
        
        // Course operations
        void addCourse(Course c) throws SQLException {
            String sql = "INSERT INTO courses (id, title, description, price, category, instructor_id, instructor_name, status, total_enrollments, average_rating, total_ratings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, c.id); ps.setString(2, c.title); ps.setString(3, c.description);
                ps.setDouble(4, c.price); ps.setString(5, c.category); ps.setString(6, c.instructorId);
                ps.setString(7, c.instructorName); ps.setString(8, c.status.name()); ps.setInt(9, c.totalEnrollments);
                ps.setDouble(10, c.averageRating); ps.setInt(11, c.totalRatings);
                ps.setTimestamp(12, Timestamp.valueOf(c.createdAt)); ps.setTimestamp(13, Timestamp.valueOf(c.updatedAt));
                ps.executeUpdate();
            }
        }
        
        Course findCourseById(String id) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM courses WHERE id = ?")) {
                ps.setString(1, id);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    Course c = rowToCourse(rs);
                    c.lessons = getLessonsByCourse(id);
                    return c;
                }
            }
            return null;
        }
        
        void updateCourse(Course c) throws SQLException {
            String sql = "UPDATE courses SET title=?, description=?, price=?, category=?, status=?, total_enrollments=?, average_rating=?, total_ratings=?, updated_at=? WHERE id=?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, c.title); ps.setString(2, c.description); ps.setDouble(3, c.price);
                ps.setString(4, c.category); ps.setString(5, c.status.name()); ps.setInt(6, c.totalEnrollments);
                ps.setDouble(7, c.averageRating); ps.setInt(8, c.totalRatings);
                ps.setTimestamp(9, Timestamp.valueOf(LocalDateTime.now())); ps.setString(10, c.id);
                ps.executeUpdate();
            }
        }
        
        void removeCourse(String id) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM courses WHERE id = ?")) {
                ps.setString(1, id); ps.executeUpdate();
            }
        }
        
        List<Course> findCoursesByInstructor(String instructorId) throws SQLException {
            return getCourses("SELECT * FROM courses WHERE instructor_id = ? ORDER BY created_at DESC", instructorId);
        }
        
        List<Course> getApprovedCourses() throws SQLException {
            return getCourses("SELECT * FROM courses WHERE status = 'Approved' ORDER BY total_enrollments DESC", null);
        }
        
        List<Course> getPendingCourses() throws SQLException {
            return getCourses("SELECT * FROM courses WHERE status = 'PendingApproval' ORDER BY created_at ASC", null);
        }
        
        List<Course> getAllCourses() throws SQLException {
            return getCourses("SELECT * FROM courses ORDER BY created_at DESC", null);
        }
        
        List<Course> searchCourses(String query, String category, Double minRating, Double maxPrice, String sortBy) throws SQLException {
            StringBuilder sql = new StringBuilder("SELECT * FROM courses WHERE status = 'Approved'");
            List<Object> params = new ArrayList<>();
            
            if (query != null && !query.isEmpty()) {
                sql.append(" AND (title LIKE ? OR description LIKE ?)");
                params.add("%" + query + "%"); params.add("%" + query + "%");
            }
            if (category != null) { sql.append(" AND category = ?"); params.add(category); }
            if (minRating != null) { sql.append(" AND average_rating >= ?"); params.add(minRating); }
            if (maxPrice != null) { sql.append(" AND price <= ?"); params.add(maxPrice); }
            
            sql.append(" ORDER BY ");
            switch (sortBy != null ? sortBy : "popularity") {
                case "newest" -> sql.append("created_at DESC");
                case "highest-rated" -> sql.append("average_rating DESC");
                case "price-low" -> sql.append("price ASC");
                case "price-high" -> sql.append("price DESC");
                default -> sql.append("total_enrollments DESC");
            }
            
            List<Course> courses = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
                for (int i = 0; i < params.size(); i++) {
                    Object p = params.get(i);
                    if (p instanceof String) ps.setString(i + 1, (String) p);
                    else if (p instanceof Double) ps.setDouble(i + 1, (Double) p);
                }
                ResultSet rs = ps.executeQuery();
                while (rs.next()) {
                    Course c = rowToCourse(rs);
                    c.lessons = getLessonsByCourse(c.id);
                    courses.add(c);
                }
            }
            return courses;
        }
        
        private List<Course> getCourses(String sql, String param) throws SQLException {
            List<Course> courses = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                if (param != null) ps.setString(1, param);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) {
                    Course c = rowToCourse(rs);
                    c.lessons = getLessonsByCourse(c.id);
                    courses.add(c);
                }
            }
            return courses;
        }
        
        private Course rowToCourse(ResultSet rs) throws SQLException {
            Course c = new Course();
            c.id = rs.getString("id"); c.title = rs.getString("title"); c.description = rs.getString("description");
            c.price = rs.getDouble("price"); c.category = rs.getString("category");
            c.instructorId = rs.getString("instructor_id"); c.instructorName = rs.getString("instructor_name");
            c.status = CourseStatus.valueOf(rs.getString("status")); c.totalEnrollments = rs.getInt("total_enrollments");
            c.averageRating = rs.getDouble("average_rating"); c.totalRatings = rs.getInt("total_ratings");
            c.createdAt = rs.getTimestamp("created_at").toLocalDateTime();
            c.updatedAt = rs.getTimestamp("updated_at").toLocalDateTime();
            return c;
        }
        
        // Lesson operations
        void addLesson(Lesson l) throws SQLException {
            String sql = "INSERT INTO lessons (id, course_id, title, content, duration, video_url, lesson_order, is_free_preview, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, l.id); ps.setString(2, l.courseId); ps.setString(3, l.title);
                ps.setString(4, l.content); ps.setInt(5, l.duration); ps.setString(6, l.videoUrl);
                ps.setInt(7, l.order); ps.setBoolean(8, l.isFreePreview); ps.setTimestamp(9, Timestamp.valueOf(l.createdAt));
                ps.executeUpdate();
            }
        }
        
        void removeLesson(String id) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM lessons WHERE id = ?")) {
                ps.setString(1, id); ps.executeUpdate();
            }
        }
        
        List<Lesson> getLessonsByCourse(String courseId) throws SQLException {
            List<Lesson> lessons = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order")) {
                ps.setString(1, courseId);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) lessons.add(rowToLesson(rs));
            }
            return lessons;
        }
        
        private Lesson rowToLesson(ResultSet rs) throws SQLException {
            Lesson l = new Lesson();
            l.id = rs.getString("id"); l.courseId = rs.getString("course_id"); l.title = rs.getString("title");
            l.content = rs.getString("content"); l.duration = rs.getInt("duration"); l.videoUrl = rs.getString("video_url");
            l.order = rs.getInt("lesson_order"); l.isFreePreview = rs.getBoolean("is_free_preview");
            l.createdAt = rs.getTimestamp("created_at").toLocalDateTime();
            return l;
        }
        
        // Enrollment operations
        void addEnrollment(Enrollment e) throws SQLException {
            String sql = "INSERT INTO enrollments (id, student_id, course_id, course_title, progress_percent, is_completed, is_paused, certificate_id, enrolled_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, e.id); ps.setString(2, e.studentId); ps.setString(3, e.courseId);
                ps.setString(4, e.courseTitle); ps.setInt(5, e.progressPercent); ps.setBoolean(6, e.isCompleted);
                ps.setBoolean(7, e.isPaused); ps.setString(8, e.certificateId);
                ps.setTimestamp(9, Timestamp.valueOf(e.enrolledAt));
                ps.setTimestamp(10, e.completedAt != null ? Timestamp.valueOf(e.completedAt) : null);
                ps.executeUpdate();
            }
        }
        
        Enrollment findEnrollment(String studentId, String courseId) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?")) {
                ps.setString(1, studentId); ps.setString(2, courseId);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    Enrollment e = rowToEnrollment(rs);
                    e.completedLessonIds = getCompletedLessonIds(e.id);
                    return e;
                }
            }
            return null;
        }
        
        void updateEnrollment(Enrollment e) throws SQLException {
            String sql = "UPDATE enrollments SET progress_percent=?, is_completed=?, is_paused=?, certificate_id=?, completed_at=? WHERE id=?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, e.progressPercent); ps.setBoolean(2, e.isCompleted); ps.setBoolean(3, e.isPaused);
                ps.setString(4, e.certificateId);
                ps.setTimestamp(5, e.completedAt != null ? Timestamp.valueOf(e.completedAt) : null);
                ps.setString(6, e.id);
                ps.executeUpdate();
            }
        }
        
        List<Enrollment> findEnrollmentsByStudent(String studentId) throws SQLException {
            List<Enrollment> list = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM enrollments WHERE student_id = ? ORDER BY enrolled_at DESC")) {
                ps.setString(1, studentId);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) {
                    Enrollment e = rowToEnrollment(rs);
                    e.completedLessonIds = getCompletedLessonIds(e.id);
                    list.add(e);
                }
            }
            return list;
        }
        
        void addCompletedLesson(String enrollmentId, String lessonId) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("INSERT IGNORE INTO completed_lessons (enrollment_id, lesson_id) VALUES (?, ?)")) {
                ps.setString(1, enrollmentId); ps.setString(2, lessonId); ps.executeUpdate();
            }
        }
        
        List<String> getCompletedLessonIds(String enrollmentId) throws SQLException {
            List<String> ids = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement("SELECT lesson_id FROM completed_lessons WHERE enrollment_id = ?")) {
                ps.setString(1, enrollmentId);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) ids.add(rs.getString("lesson_id"));
            }
            return ids;
        }
        
        private Enrollment rowToEnrollment(ResultSet rs) throws SQLException {
            Enrollment e = new Enrollment();
            e.id = rs.getString("id"); e.studentId = rs.getString("student_id"); e.courseId = rs.getString("course_id");
            e.courseTitle = rs.getString("course_title"); e.progressPercent = rs.getInt("progress_percent");
            e.isCompleted = rs.getBoolean("is_completed"); e.isPaused = rs.getBoolean("is_paused");
            e.certificateId = rs.getString("certificate_id"); e.enrolledAt = rs.getTimestamp("enrolled_at").toLocalDateTime();
            Timestamp ca = rs.getTimestamp("completed_at");
            e.completedAt = ca != null ? ca.toLocalDateTime() : null;
            return e;
        }
        
        // Review operations
        void addReview(Review r) throws SQLException {
            String sql = "INSERT INTO reviews (id, student_id, student_name, course_id, rating, comment, is_verified, is_flagged, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, r.id); ps.setString(2, r.studentId); ps.setString(3, r.studentName);
                ps.setString(4, r.courseId); ps.setInt(5, r.rating); ps.setString(6, r.comment);
                ps.setBoolean(7, r.isVerified); ps.setBoolean(8, r.isFlagged); ps.setTimestamp(9, Timestamp.valueOf(r.createdAt));
                ps.executeUpdate();
            }
        }
        
        Review findReviewByStudentAndCourse(String studentId, String courseId) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM reviews WHERE student_id = ? AND course_id = ?")) {
                ps.setString(1, studentId); ps.setString(2, courseId);
                ResultSet rs = ps.executeQuery();
                return rs.next() ? rowToReview(rs) : null;
            }
        }
        
        List<Review> findReviewsByCourse(String courseId) throws SQLException {
            List<Review> list = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM reviews WHERE course_id = ? AND is_flagged = false ORDER BY created_at DESC")) {
                ps.setString(1, courseId);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) list.add(rowToReview(rs));
            }
            return list;
        }
        
        List<Review> getFlaggedReviews() throws SQLException {
            List<Review> list = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM reviews WHERE is_flagged = true ORDER BY created_at DESC")) {
                ResultSet rs = ps.executeQuery();
                while (rs.next()) list.add(rowToReview(rs));
            }
            return list;
        }
        
        void updateReview(Review r) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("UPDATE reviews SET is_flagged=?, is_verified=? WHERE id=?")) {
                ps.setBoolean(1, r.isFlagged); ps.setBoolean(2, r.isVerified); ps.setString(3, r.id);
                ps.executeUpdate();
            }
        }
        
        void deleteReview(String id) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM reviews WHERE id = ?")) {
                ps.setString(1, id); ps.executeUpdate();
            }
        }
        
        double calculateCourseAverageRating(String courseId) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("SELECT AVG(rating) FROM reviews WHERE course_id = ? AND is_flagged = false")) {
                ps.setString(1, courseId);
                ResultSet rs = ps.executeQuery();
                return rs.next() ? rs.getDouble(1) : 0.0;
            }
        }
        
        int getReviewCount(String courseId) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM reviews WHERE course_id = ? AND is_flagged = false")) {
                ps.setString(1, courseId);
                ResultSet rs = ps.executeQuery();
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
        
        private Review rowToReview(ResultSet rs) throws SQLException {
            Review r = new Review();
            r.id = rs.getString("id"); r.studentId = rs.getString("student_id"); r.studentName = rs.getString("student_name");
            r.courseId = rs.getString("course_id"); r.rating = rs.getInt("rating"); r.comment = rs.getString("comment");
            r.isVerified = rs.getBoolean("is_verified"); r.isFlagged = rs.getBoolean("is_flagged");
            r.createdAt = rs.getTimestamp("created_at").toLocalDateTime();
            return r;
        }
        
        // Certificate operations
        void addCertificate(Certificate c) throws SQLException {
            String sql = "INSERT INTO certificates (id, certificate_number, student_id, student_name, course_id, course_title, instructor_name, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, c.id); ps.setString(2, c.certificateNumber); ps.setString(3, c.studentId);
                ps.setString(4, c.studentName); ps.setString(5, c.courseId); ps.setString(6, c.courseTitle);
                ps.setString(7, c.instructorName); ps.setTimestamp(8, Timestamp.valueOf(c.issuedAt));
                ps.executeUpdate();
            }
        }
        
        List<Certificate> findCertificatesByStudent(String studentId) throws SQLException {
            List<Certificate> list = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM certificates WHERE student_id = ? ORDER BY issued_at DESC")) {
                ps.setString(1, studentId);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) list.add(rowToCertificate(rs));
            }
            return list;
        }
        
        private Certificate rowToCertificate(ResultSet rs) throws SQLException {
            Certificate c = new Certificate();
            c.id = rs.getString("id"); c.certificateNumber = rs.getString("certificate_number");
            c.studentId = rs.getString("student_id"); c.studentName = rs.getString("student_name");
            c.courseId = rs.getString("course_id"); c.courseTitle = rs.getString("course_title");
            c.instructorName = rs.getString("instructor_name"); c.issuedAt = rs.getTimestamp("issued_at").toLocalDateTime();
            return c;
        }
        
        // Analytics
        @SuppressWarnings("unchecked")
        Map<String, Object> getAnalytics() throws SQLException {
            Map<String, Object> stats = new HashMap<>();
            
            Map<String, Integer> userStats = new HashMap<>();
            userStats.put("total", countWhere("users", null));
            userStats.put("students", countWhere("users", "role = 'Student'"));
            userStats.put("instructors", countWhere("users", "role = 'Instructor'"));
            userStats.put("admins", countWhere("users", "role = 'Admin'"));
            userStats.put("banned", countWhere("users", "is_banned = true"));
            stats.put("users", userStats);
            
            Map<String, Integer> courseStats = new HashMap<>();
            courseStats.put("total", countWhere("courses", null));
            courseStats.put("approved", countWhere("courses", "status = 'Approved'"));
            courseStats.put("pending", countWhere("courses", "status = 'PendingApproval'"));
            courseStats.put("draft", countWhere("courses", "status = 'Draft'"));
            stats.put("courses", courseStats);
            
            Map<String, Integer> enrollStats = new HashMap<>();
            enrollStats.put("total", countWhere("enrollments", null));
            enrollStats.put("active", countWhere("enrollments", "is_completed = false"));
            enrollStats.put("completed", countWhere("enrollments", "is_completed = true"));
            stats.put("enrollments", enrollStats);
            
            Map<String, Integer> reviewStats = new HashMap<>();
            reviewStats.put("total", countWhere("reviews", null));
            reviewStats.put("flagged", countWhere("reviews", "is_flagged = true"));
            stats.put("reviews", reviewStats);
            
            stats.put("certificates", countWhere("certificates", null));
            
            try (Statement stmt = conn.createStatement()) {
                ResultSet rs = stmt.executeQuery("SELECT SUM(c.price) FROM enrollments e JOIN courses c ON e.course_id = c.id");
                if (rs.next()) stats.put("revenue", rs.getDouble(1));
            }
            return stats;
        }
        
        private int countWhere(String table, String condition) throws SQLException {
            String sql = "SELECT COUNT(*) FROM " + table + (condition != null ? " WHERE " + condition : "");
            try (Statement stmt = conn.createStatement()) {
                ResultSet rs = stmt.executeQuery(sql);
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    // Services
    static class AuthService {
        private DataStore store;
        private User currentUser;
        private boolean adminSeeded = false;
        
        AuthService(DataStore store) { this.store = store; }
        
        void seedAdmin() {
            if (adminSeeded) return;
            try {
                if (store.findUserByEmail("admin@udemy.com") == null) {
                    User admin = new User();
                    admin.email = "admin@udemy.com";
                    admin.passwordHash = hashPassword("Admin@123");
                    admin.firstName = "Platform";
                    admin.lastName = "Admin";
                    admin.role = UserRole.Admin;
                    store.addUser(admin);
                }
                adminSeeded = true;
            } catch (SQLException e) { e.printStackTrace(); }
        }
        
        Result register(String email, String password, String firstName, String lastName, UserRole role) {
            seedAdmin();
            try {
                if (email == null || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
                    return new Result(false, "Invalid email format.");
                if (store.findUserByEmail(email) != null)
                    return new Result(false, "Email already exists.");
                if (password == null || password.length() < 6)
                    return new Result(false, "Password must be at least 6 characters.");
                if (role == UserRole.Admin)
                    return new Result(false, "Cannot self-register as admin.");
                
                User user = new User();
                user.email = email.toLowerCase().trim();
                user.passwordHash = hashPassword(password);
                user.firstName = firstName;
                user.lastName = lastName;
                user.role = role != null ? role : UserRole.Student;
                store.addUser(user);
                return new Result(true, "Registration successful!", user);
            } catch (SQLException e) { return new Result(false, "Database error: " + e.getMessage()); }
        }
        
        Result login(String email, String password) {
            seedAdmin();
            try {
                User user = store.findUserByEmail(email);
                if (user == null) return new Result(false, "No account found with that email.");
                if (user.isBanned) return new Result(false, "Account banned.");
                if (!verifyPassword(password, user.passwordHash)) return new Result(false, "Wrong password.");
                currentUser = user;
                return new Result(true, "Welcome, " + user.getFullName() + "!", user);
            } catch (SQLException e) { return new Result(false, "Database error: " + e.getMessage()); }
        }
        
        User getCurrentUser() { return currentUser; }
        String logout() { String name = currentUser != null ? currentUser.getFullName() : "User"; currentUser = null; return "Goodbye, " + name + "!"; }
        
        Result toggleBan(String userId) {
            try {
                User user = store.findUserById(userId);
                if (user == null) return new Result(false, "User not found.");
                if (user.role == UserRole.Admin) return new Result(false, "Cannot ban admin.");
                user.isBanned = !user.isBanned;
                store.updateUser(user);
                return new Result(true, user.getFullName() + (user.isBanned ? " banned." : " unbanned."));
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result promoteUser(String userId, UserRole newRole) {
            try {
                User user = store.findUserById(userId);
                if (user == null) return new Result(false, "User not found.");
                user.role = newRole;
                store.updateUser(user);
                return new Result(true, user.getFullName() + " is now a " + newRole + ".");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result resetPassword(String userId, String newPassword) {
            try {
                User user = store.findUserById(userId);
                if (user == null) return new Result(false, "User not found.");
                if (newPassword.length() < 6) return new Result(false, "Password too short.");
                user.passwordHash = hashPassword(newPassword);
                store.updateUser(user);
                return new Result(true, "Password reset for " + user.getFullName());
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
    }
    
    static class CourseService {
        private DataStore store;
        CourseService(DataStore store) { this.store = store; }
        
        Result createCourse(String title, String description, double price, String category, String instructorId, String instructorName) {
            try {
                if (title == null || title.length() < 3) return new Result(false, "Title too short.");
                if (price < 0) return new Result(false, "Invalid price.");
                
                Course course = new Course();
                course.title = title; course.description = description; course.price = price;
                course.category = category; course.instructorId = instructorId; course.instructorName = instructorName;
                store.addCourse(course);
                return new Result(true, "Course created.", course);
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result addLesson(String courseId, String title, String content, int duration, String videoUrl, boolean isFreePreview) {
            try {
                Course course = store.findCourseById(courseId);
                if (course == null) return new Result(false, "Course not found.");
                
                Lesson lesson = new Lesson();
                lesson.courseId = courseId; lesson.title = title; lesson.content = content;
                lesson.duration = duration; lesson.videoUrl = videoUrl != null ? videoUrl : "";
                lesson.isFreePreview = isFreePreview; lesson.order = course.lessons.size() + 1;
                store.addLesson(lesson);
                return new Result(true, "Lesson added.", lesson);
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result removeLesson(String courseId, String lessonId) {
            try { store.removeLesson(lessonId); return new Result(true, "Lesson removed."); }
            catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result editCourse(String courseId, String title, String description, Double price, String category) {
            try {
                Course course = store.findCourseById(courseId);
                if (course == null) return new Result(false, "Course not found.");
                if (title != null && !title.isEmpty()) course.title = title;
                if (description != null && !description.isEmpty()) course.description = description;
                if (price != null) course.price = price;
                if (category != null) course.category = category;
                store.updateCourse(course);
                return new Result(true, "Course updated.");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result deleteCourse(String courseId, String userId, boolean isAdmin) {
            try {
                Course course = store.findCourseById(courseId);
                if (course == null) return new Result(false, "Course not found.");
                if (!isAdmin && !course.instructorId.equals(userId)) return new Result(false, "Not your course.");
                store.removeCourse(courseId);
                return new Result(true, "Course deleted.");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result submitForApproval(String courseId, String instructorId) {
            try {
                Course course = store.findCourseById(courseId);
                if (course == null) return new Result(false, "Course not found.");
                if (!course.instructorId.equals(instructorId)) return new Result(false, "Not your course.");
                if (course.lessons.isEmpty()) return new Result(false, "Add at least one lesson first.");
                if (course.status != CourseStatus.Draft && course.status != CourseStatus.Rejected)
                    return new Result(false, "Already " + course.status);
                course.status = CourseStatus.PendingApproval;
                store.updateCourse(course);
                return new Result(true, "Submitted for approval.");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result reviewCourse(String courseId, boolean approve) {
            try {
                Course course = store.findCourseById(courseId);
                if (course == null) return new Result(false, "Course not found.");
                course.status = approve ? CourseStatus.Approved : CourseStatus.Rejected;
                store.updateCourse(course);
                return new Result(true, "Course " + (approve ? "approved" : "rejected") + ".");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        List<Course> getPendingCourses() throws SQLException { return store.getPendingCourses(); }
        List<Course> getInstructorCourses(String id) throws SQLException { return store.findCoursesByInstructor(id); }
        List<Course> getApprovedCourses() throws SQLException { return store.getApprovedCourses(); }
        List<Course> getAllCourses() throws SQLException { return store.getAllCourses(); }
        Course getCourseById(String id) throws SQLException { return store.findCourseById(id); }
        List<Course> searchCourses(String q, String cat, Double minR, Double maxP, String sort) throws SQLException {
            return store.searchCourses(q, cat, minR, maxP, sort);
        }
        String[] getCategories() { return Arrays.stream(CourseCategory.values()).map(Enum::name).toArray(String[]::new); }
    }
    
    static class EnrollmentService {
        private DataStore store;
        EnrollmentService(DataStore store) { this.store = store; }
        
        Result enroll(String studentId, String courseId) {
            try {
                Course course = store.findCourseById(courseId);
                if (course == null) return new Result(false, "Course not found.");
                if (course.status != CourseStatus.Approved) return new Result(false, "Course not available.");
                if (course.instructorId.equals(studentId)) return new Result(false, "Can't enroll in own course.");
                if (store.findEnrollment(studentId, courseId) != null) return new Result(false, "Already enrolled.");
                
                Enrollment enrollment = new Enrollment();
                enrollment.studentId = studentId; enrollment.courseId = courseId; enrollment.courseTitle = course.title;
                store.addEnrollment(enrollment);
                course.totalEnrollments++;
                store.updateCourse(course);
                return new Result(true, "Enrolled in " + course.title, enrollment);
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result completeLesson(String studentId, String courseId, String lessonId) {
            try {
                Enrollment enrollment = store.findEnrollment(studentId, courseId);
                if (enrollment == null) return new Result(false, "Not enrolled.");
                Course course = store.findCourseById(courseId);
                if (course == null) return new Result(false, "Course not found.");
                
                Lesson lesson = course.lessons.stream().filter(l -> l.id.equals(lessonId)).findFirst().orElse(null);
                if (lesson == null) return new Result(false, "Lesson not found.");
                
                boolean wasDone = enrollment.isCompleted;
                enrollment.markLessonComplete(lessonId, course.lessons.size());
                store.addCompletedLesson(enrollment.id, lessonId);
                store.updateEnrollment(enrollment);
                
                if (enrollment.isCompleted && !wasDone) {
                    User student = store.findUserById(studentId);
                    Certificate cert = new Certificate();
                    cert.studentId = studentId;
                    cert.studentName = student != null ? student.getFullName() : "Unknown";
                    cert.courseId = course.id; cert.courseTitle = course.title; cert.instructorName = course.instructorName;
                    store.addCertificate(cert);
                    enrollment.certificateId = cert.id;
                    store.updateEnrollment(enrollment);
                    return new Result(true, "Course completed! Certificate earned!", cert);
                }
                return new Result(true, "Lesson completed. Progress: " + enrollment.progressPercent + "%");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result pauseEnrollment(String studentId, String courseId) {
            try {
                Enrollment e = store.findEnrollment(studentId, courseId);
                if (e == null) return new Result(false, "Not found.");
                e.isPaused = true; store.updateEnrollment(e);
                return new Result(true, "Paused.");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result resumeEnrollment(String studentId, String courseId) {
            try {
                Enrollment e = store.findEnrollment(studentId, courseId);
                if (e == null) return new Result(false, "Not found.");
                e.isPaused = false; store.updateEnrollment(e);
                return new Result(true, "Resumed.");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        List<Enrollment> getStudentEnrollments(String id) throws SQLException { return store.findEnrollmentsByStudent(id); }
        Enrollment getEnrollment(String sid, String cid) throws SQLException { return store.findEnrollment(sid, cid); }
        List<Certificate> getStudentCertificates(String id) throws SQLException { return store.findCertificatesByStudent(id); }
    }
    
    static class ReviewService {
        private DataStore store;
        private static final String[] SPAM = {"buy now", "click here", "free money", "http://", "https://", "www."};
        ReviewService(DataStore store) { this.store = store; }
        
        Result submitReview(String studentId, String studentName, String courseId, int rating, String comment) {
            try {
                Enrollment enrollment = store.findEnrollment(studentId, courseId);
                if (enrollment == null) return new Result(false, "Must be enrolled to review.");
                if (enrollment.progressPercent < 10) return new Result(false, "Complete at least 10% first.");
                if (store.findReviewByStudentAndCourse(studentId, courseId) != null) return new Result(false, "Already reviewed.");
                if (rating < 1 || rating > 5) return new Result(false, "Rating must be 1-5.");
                if (comment == null || comment.length() < 10) return new Result(false, "Review too short.");
                
                boolean isSpam = Arrays.stream(SPAM).anyMatch(comment.toLowerCase()::contains);
                Review review = new Review();
                review.studentId = studentId; review.studentName = studentName; review.courseId = courseId;
                review.rating = Math.min(5, Math.max(1, rating)); review.comment = comment;
                review.isVerified = true; review.isFlagged = isSpam;
                store.addReview(review);
                
                if (!isSpam) recalculateCourseRating(courseId);
                return new Result(true, isSpam ? "Review pending moderation." : "Review submitted!");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        void recalculateCourseRating(String courseId) throws SQLException {
            double avg = store.calculateCourseAverageRating(courseId);
            int count = store.getReviewCount(courseId);
            Course course = store.findCourseById(courseId);
            if (course != null) {
                course.averageRating = Math.round(avg * 100.0) / 100.0;
                course.totalRatings = count;
                store.updateCourse(course);
            }
        }
        
        List<Review> getCourseReviews(String id) throws SQLException { return store.findReviewsByCourse(id); }
        List<Review> getFlaggedReviews() throws SQLException { return store.getFlaggedReviews(); }
        
        Result approveReview(String reviewId) {
            try {
                List<Review> flagged = store.getFlaggedReviews();
                Review review = flagged.stream().filter(r -> r.id.equals(reviewId)).findFirst().orElse(null);
                if (review == null) return new Result(false, "Not found.");
                review.isFlagged = false; store.updateReview(review);
                recalculateCourseRating(review.courseId);
                return new Result(true, "Review approved.");
            } catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
        
        Result deleteReview(String id) {
            try { store.deleteReview(id); return new Result(true, "Review deleted."); }
            catch (SQLException e) { return new Result(false, "Error: " + e.getMessage()); }
        }
    }

    // Utility methods
    private static Scanner scanner = new Scanner(System.in);
    
    static String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) { String hex = Integer.toHexString(0xff & b); if (hex.length() == 1) sb.append('0'); sb.append(hex); }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) { throw new RuntimeException(e); }
    }
    
    static boolean verifyPassword(String password, String hash) { return hashPassword(password).equals(hash); }
    static String prompt(String msg) { System.out.print(msg); return scanner.nextLine().trim(); }
    
    static int promptNumber(String msg, int min, int max) {
        while (true) {
            try {
                System.out.print(msg);
                int val = Integer.parseInt(scanner.nextLine().trim());
                if (val >= min && val <= max) return val;
                System.out.println("Enter " + min + "-" + max);
            } catch (NumberFormatException e) { System.out.println("Invalid number."); }
        }
    }
    
    static double promptDouble(String msg, double min, double max) {
        while (true) {
            try {
                System.out.print(msg);
                double val = Double.parseDouble(scanner.nextLine().trim());
                if (val >= min && val <= max) return val;
                System.out.println("Enter " + min + "-" + max);
            } catch (NumberFormatException e) { System.out.println("Invalid number."); }
        }
    }
    
    static int promptChoice(String msg, String[] options) {
        System.out.println("\n" + msg);
        for (int i = 0; i < options.length; i++) System.out.println((i + 1) + ". " + options[i]);
        return promptNumber("> ", 1, options.length) - 1;
    }
    
    static boolean promptYesNo(String msg) {
        System.out.print(msg + " (y/n): ");
        String input = scanner.nextLine().trim().toLowerCase();
        return input.equals("y") || input.equals("yes");
    }
    
    static void pressEnter() { System.out.print("\nPress Enter..."); scanner.nextLine(); }
    static void showHeader(String title) { System.out.println("\n=== " + title + " ===\n"); }

    // Global services
    private static DataStore store;
    private static AuthService authService;
    private static CourseService courseService;
    private static EnrollmentService enrollmentService;
    private static ReviewService reviewService;

    public static void main(String[] args) {
        System.out.println("\nUdemy Clone - Learning Platform\n");
        
        store = new DataStore();
        if (!store.testConnection()) {
            System.err.println("Cannot connect to database.");
            System.err.println("Set RDS_HOSTNAME, RDS_USERNAME, RDS_PASSWORD environment variables.");
            System.exit(1);
        }
        
        authService = new AuthService(store);
        courseService = new CourseService(store);
        enrollmentService = new EnrollmentService(store);
        reviewService = new ReviewService(store);
        
        try { showMainMenu(); }
        finally { store.close(); scanner.close(); }
    }
    
    static void showMainMenu() {
        boolean running = true;
        while (running) {
            showHeader("MAIN MENU");
            int choice = promptChoice("Select option:", new String[]{"Login", "Register", "Exit"});
            switch (choice) {
                case 0 -> handleLogin();
                case 1 -> handleRegister();
                case 2 -> { running = false; System.out.println("\nGoodbye!\n"); }
            }
        }
    }
    
    static void handleLogin() {
        showHeader("LOGIN");
        String email = prompt("Email: ");
        String password = prompt("Password: ");
        
        Result result = authService.login(email, password);
        System.out.println("\n" + result.message);
        
        if (!result.success) { pressEnter(); return; }
        
        User user = (User) result.data;
        
        if (user.role == UserRole.Instructor) {
            System.out.println("\nYou can browse as Student or manage courses as Instructor.");
            int choice = promptChoice("Login as:", new String[]{"Instructor", "Student"});
            if (choice == 0) showInstructorMenu(user);
            else showStudentMenu(user);
        } else if (user.role == UserRole.Admin) {
            showAdminMenu(user);
        } else {
            showStudentMenu(user);
        }
        
        System.out.println("\n" + authService.logout());
        pressEnter();
    }
    
    static void handleRegister() {
        showHeader("REGISTER");
        int roleChoice = promptChoice("Register as:", new String[]{"Student", "Instructor"});
        UserRole role = roleChoice == 0 ? UserRole.Student : UserRole.Instructor;
        
        String firstName = prompt("First name: ");
        String lastName = prompt("Last name: ");
        String email = prompt("Email: ");
        String password = prompt("Password: ");
        String confirm = prompt("Confirm password: ");
        
        if (!password.equals(confirm)) { System.out.println("\nPasswords don't match."); pressEnter(); return; }
        
        Result result = authService.register(email, password, firstName, lastName, role);
        System.out.println("\n" + result.message);
        pressEnter();
    }

    // Student menu
    static void showStudentMenu(User user) {
        boolean running = true;
        while (running) {
            showHeader("STUDENT - " + user.firstName);
            int choice = promptChoice("What to do?", new String[]{"Browse Courses", "My Enrollments", "View Progress", "My Certificates", "Logout"});
            try {
                switch (choice) {
                    case 0 -> browseCourses(user);
                    case 1 -> viewEnrollments(user);
                    case 2 -> viewProgress(user);
                    case 3 -> viewCertificates(user);
                    case 4 -> running = false;
                }
            } catch (SQLException e) { System.out.println("Error: " + e.getMessage()); pressEnter(); }
        }
    }
    
    static void browseCourses(User user) throws SQLException {
        showHeader("BROWSE COURSES");
        
        String query = prompt("Search (or Enter to skip): ");
        if (query.isEmpty()) query = null;
        
        String category = null;
        if (promptYesNo("Filter by category?")) {
            String[] cats = courseService.getCategories();
            category = cats[promptChoice("Category:", cats)];
        }
        
        Double minRating = promptYesNo("Filter by min rating?") ? (double) promptNumber("Min rating (1-5): ", 1, 5) : null;
        Double maxPrice = promptYesNo("Filter by max price?") ? promptDouble("Max price: $", 0, 999999) : null;
        
        String[] sortOpts = {"popularity", "newest", "highest-rated", "price-low", "price-high"};
        String[] sortLabels = {"Popularity", "Newest", "Highest Rated", "Price Low-High", "Price High-Low"};
        String sortBy = sortOpts[promptChoice("Sort by:", sortLabels)];
        
        List<Course> results = courseService.searchCourses(query, category, minRating, maxPrice, sortBy);
        
        showHeader("RESULTS (" + results.size() + ")");
        if (results.isEmpty()) { System.out.println("No courses found."); pressEnter(); return; }
        
        for (int i = 0; i < results.size(); i++) {
            Course c = results.get(i);
            String rating = c.averageRating > 0 ? String.format("%.1f*", c.averageRating) : "N/A";
            System.out.printf("%d. %s - $%.2f - %s - %d students\n", i+1, c.title, c.price, rating, c.totalEnrollments);
        }
        
        if (promptYesNo("\nView course details?")) {
            int idx = promptNumber("Course #: ", 1, results.size()) - 1;
            viewCourseDetail(user, results.get(idx));
        }
    }
    
    static void viewCourseDetail(User user, Course course) throws SQLException {
        showHeader(course.title);
        System.out.println("Instructor: " + course.instructorName);
        System.out.println("Category: " + course.category);
        System.out.println("Price: $" + String.format("%.2f", course.price));
        System.out.println("Rating: " + (course.averageRating > 0 ? course.averageRating + " (" + course.totalRatings + " reviews)" : "No ratings"));
        System.out.println("Students: " + course.totalEnrollments);
        System.out.println("Lessons: " + course.lessons.size());
        System.out.println("\nDescription: " + course.description);
        
        System.out.println("\nLessons:");
        for (Lesson l : course.lessons) {
            String lock = l.isFreePreview ? "[FREE]" : "[LOCKED]";
            System.out.println("  " + l.order + ". " + lock + " " + l.title + " (" + l.duration + " min)");
        }
        
        List<Review> reviews = reviewService.getCourseReviews(course.id);
        if (!reviews.isEmpty()) {
            System.out.println("\nReviews:");
            for (int i = 0; i < Math.min(3, reviews.size()); i++) {
                Review r = reviews.get(i);
                System.out.println("  " + r.rating + "/5 by " + r.studentName + ": " + r.comment);
            }
        }
        
        int choice = promptChoice("Action:", new String[]{"Enroll", "Back"});
        if (choice == 0) {
            Result result = enrollmentService.enroll(user.id, course.id);
            System.out.println("\n" + result.message);
            pressEnter();
        }
    }
    
    static void viewEnrollments(User user) throws SQLException {
        showHeader("MY ENROLLMENTS");
        List<Enrollment> list = enrollmentService.getStudentEnrollments(user.id);
        
        if (list.isEmpty()) { System.out.println("No enrollments."); pressEnter(); return; }
        
        for (int i = 0; i < list.size(); i++) {
            Enrollment e = list.get(i);
            String status = e.isCompleted ? "Done" : e.isPaused ? "Paused" : "In Progress";
            System.out.printf("%d. %s - %d%% - %s\n", i+1, e.courseTitle, e.progressPercent, status);
        }
        
        int choice = promptChoice("Action:", new String[]{"Continue Learning", "Pause/Resume", "Leave Review", "Back"});
        
        if (choice == 0) {
            int idx = promptNumber("Course #: ", 1, list.size()) - 1;
            continueLearning(user, list.get(idx));
        } else if (choice == 1) {
            int idx = promptNumber("Course #: ", 1, list.size()) - 1;
            Enrollment e = list.get(idx);
            Result r = e.isPaused ? enrollmentService.resumeEnrollment(user.id, e.courseId) : enrollmentService.pauseEnrollment(user.id, e.courseId);
            System.out.println(r.message); pressEnter();
        } else if (choice == 2) {
            int idx = promptNumber("Course #: ", 1, list.size()) - 1;
            leaveReview(user, list.get(idx).courseId);
        }
    }
    
    static void continueLearning(User user, Enrollment enrollment) throws SQLException {
        Course course = courseService.getCourseById(enrollment.courseId);
        if (course == null) { System.out.println("Course not found."); pressEnter(); return; }
        
        showHeader("Learning: " + course.title);
        System.out.println("Progress: " + enrollment.progressPercent + "%\n");
        
        for (Lesson l : course.lessons) {
            String done = enrollment.completedLessonIds.contains(l.id) ? "[X]" : "[ ]";
            System.out.println(done + " " + l.order + ". " + l.title);
        }
        
        Lesson next = course.lessons.stream().filter(l -> !enrollment.completedLessonIds.contains(l.id)).findFirst().orElse(null);
        
        if (next != null) {
            System.out.println("\nNext: " + next.title);
            if (promptYesNo("Mark as complete?")) {
                Result r = enrollmentService.completeLesson(user.id, enrollment.courseId, next.id);
                System.out.println(r.message);
                if (r.data instanceof Certificate c) System.out.println(c.display());
            }
        } else {
            System.out.println("\nAll lessons completed!");
        }
        pressEnter();
    }
    
    static void leaveReview(User user, String courseId) {
        showHeader("LEAVE REVIEW");
        int rating = promptNumber("Rating (1-5): ", 1, 5);
        String comment = prompt("Your review: ");
        Result r = reviewService.submitReview(user.id, user.getFullName(), courseId, rating, comment);
        System.out.println("\n" + r.message);
        pressEnter();
    }
    
    static void viewProgress(User user) throws SQLException {
        showHeader("PROGRESS");
        List<Enrollment> list = enrollmentService.getStudentEnrollments(user.id);
        if (list.isEmpty()) { System.out.println("No enrollments."); pressEnter(); return; }
        
        for (int i = 0; i < list.size(); i++) System.out.println((i+1) + ". " + list.get(i).courseTitle);
        
        int idx = promptNumber("Select: ", 1, list.size()) - 1;
        Enrollment e = list.get(idx);
        Course course = courseService.getCourseById(e.courseId);
        
        if (course == null) { System.out.println("Course not found."); pressEnter(); return; }
        
        showHeader(course.title + " Progress");
        System.out.println("Lessons: " + e.completedLessonIds.size() + "/" + course.lessons.size());
        System.out.println("Progress: " + e.progressPercent + "%");
        System.out.println("Status: " + (e.isCompleted ? "Completed" : e.isPaused ? "Paused" : "In Progress"));
        
        System.out.println("\nLessons:");
        for (Lesson l : course.lessons) {
            String done = e.completedLessonIds.contains(l.id) ? "[X]" : "[ ]";
            System.out.println("  " + done + " " + l.title);
        }
        pressEnter();
    }
    
    static void viewCertificates(User user) throws SQLException {
        showHeader("MY CERTIFICATES");
        List<Certificate> certs = enrollmentService.getStudentCertificates(user.id);
        
        if (certs.isEmpty()) { System.out.println("No certificates yet. Complete a course!"); pressEnter(); return; }
        
        for (int i = 0; i < certs.size(); i++) {
            Certificate c = certs.get(i);
            System.out.println((i+1) + ". " + c.courseTitle + " - " + c.certificateNumber);
        }
        
        if (promptYesNo("\nView certificate?")) {
            int idx = promptNumber("Certificate #: ", 1, certs.size()) - 1;
            System.out.println(certs.get(idx).display());
        }
        pressEnter();
    }

    // Instructor menu
    static void showInstructorMenu(User user) {
        boolean running = true;
        while (running) {
            showHeader("INSTRUCTOR - " + user.getFullName());
            int choice = promptChoice("Action:", new String[]{"Create Course", "Manage Courses", "View Stats", "Logout"});
            try {
                switch (choice) {
                    case 0 -> createCourse(user);
                    case 1 -> manageCourses(user);
                    case 2 -> viewCourseStats(user);
                    case 3 -> running = false;
                }
            } catch (SQLException e) { System.out.println("Error: " + e.getMessage()); pressEnter(); }
        }
    }
    
    static void createCourse(User user) throws SQLException {
        showHeader("CREATE COURSE");
        String title = prompt("Title: ");
        String desc = prompt("Description: ");
        double price = promptDouble("Price: $", 0, 999999);
        String[] cats = courseService.getCategories();
        String category = cats[promptChoice("Category:", cats)];
        
        Result result = courseService.createCourse(title, desc, price, category, user.id, user.getFullName());
        System.out.println("\n" + result.message);
        
        if (result.success && result.data instanceof Course course) {
            if (promptYesNo("Add lessons now?")) addLessonsLoop(course.id);
            if (promptYesNo("Submit for approval?")) {
                Result r = courseService.submitForApproval(course.id, user.id);
                System.out.println(r.message);
            }
        }
        pressEnter();
    }
    
    static void addLessonsLoop(String courseId) {
        boolean adding = true;
        while (adding) {
            System.out.println("\n-- Add Lesson --");
            String title = prompt("Title: ");
            String content = prompt("Content: ");
            int duration = promptNumber("Duration (min): ", 1, 600);
            String video = prompt("Video URL (or Enter): ");
            boolean free = promptYesNo("Free preview?");
            
            Result r = courseService.addLesson(courseId, title, content, duration, video, free);
            System.out.println(r.message);
            adding = promptYesNo("Add another?");
        }
    }
    
    static void manageCourses(User user) throws SQLException {
        showHeader("MY COURSES");
        List<Course> courses = courseService.getInstructorCourses(user.id);
        
        if (courses.isEmpty()) { System.out.println("No courses created."); pressEnter(); return; }
        
        for (int i = 0; i < courses.size(); i++) {
            Course c = courses.get(i);
            System.out.printf("%d. %s - %s - %d lessons - $%.2f\n", i+1, c.title, c.status, c.lessons.size(), c.price);
        }
        
        int idx = promptNumber("\nSelect course: ", 1, courses.size()) - 1;
        Course course = courses.get(idx);
        
        int action = promptChoice("Action for " + course.title + ":", new String[]{"Edit", "Add Lessons", "Remove Lesson", "Submit for Approval", "Delete", "View Reviews", "Back"});
        
        switch (action) {
            case 0 -> editCourse(course);
            case 1 -> addLessonsLoop(course.id);
            case 2 -> removeLesson(course);
            case 3 -> { Result r = courseService.submitForApproval(course.id, user.id); System.out.println(r.message); pressEnter(); }
            case 4 -> { if (promptYesNo("Sure?")) { Result r = courseService.deleteCourse(course.id, user.id, false); System.out.println(r.message); } pressEnter(); }
            case 5 -> viewCourseReviews(course);
        }
    }
    
    static void editCourse(Course course) {
        showHeader("EDIT: " + course.title);
        System.out.println("(Press Enter to keep current)\n");
        
        String title = prompt("Title [" + course.title + "]: ");
        String desc = prompt("Description: ");
        String priceStr = prompt("Price [$" + course.price + "]: ");
        
        String newCat = null;
        if (promptYesNo("Change category?")) {
            String[] cats = courseService.getCategories();
            newCat = cats[promptChoice("Category:", cats)];
        }
        
        Result r = courseService.editCourse(course.id, 
            title.isEmpty() ? null : title,
            desc.isEmpty() ? null : desc,
            priceStr.isEmpty() ? null : Double.parseDouble(priceStr),
            newCat);
        System.out.println("\n" + r.message);
        pressEnter();
    }
    
    static void removeLesson(Course course) throws SQLException {
        if (course.lessons.isEmpty()) { System.out.println("No lessons."); pressEnter(); return; }
        
        System.out.println("\nLessons:");
        for (int i = 0; i < course.lessons.size(); i++) System.out.println((i+1) + ". " + course.lessons.get(i).title);
        
        int idx = promptNumber("Remove lesson #: ", 1, course.lessons.size()) - 1;
        Result r = courseService.removeLesson(course.id, course.lessons.get(idx).id);
        System.out.println(r.message);
        pressEnter();
    }
    
    static void viewCourseReviews(Course course) throws SQLException {
        showHeader("REVIEWS: " + course.title);
        List<Review> reviews = reviewService.getCourseReviews(course.id);
        
        if (reviews.isEmpty()) { System.out.println("No reviews."); pressEnter(); return; }
        
        for (Review r : reviews) System.out.println(r.rating + "/5 by " + r.studentName + ": " + r.comment + "\n");
        pressEnter();
    }
    
    static void viewCourseStats(User user) throws SQLException {
        showHeader("STATISTICS");
        List<Course> courses = courseService.getInstructorCourses(user.id);
        
        if (courses.isEmpty()) { System.out.println("No courses."); pressEnter(); return; }
        
        int totalStudents = 0; double totalRevenue = 0; int totalReviews = 0;
        for (Course c : courses) {
            totalStudents += c.totalEnrollments;
            totalRevenue += c.price * c.totalEnrollments;
            totalReviews += c.totalRatings;
        }
        
        System.out.println("Total Courses: " + courses.size());
        System.out.println("Total Students: " + totalStudents);
        System.out.println("Total Revenue: $" + String.format("%.2f", totalRevenue));
        System.out.println("Total Reviews: " + totalReviews);
        
        System.out.println("\nBy Course:");
        for (Course c : courses) {
            String rating = c.averageRating > 0 ? String.format("%.1f", c.averageRating) : "N/A";
            System.out.printf("  %s: %d students, $%.2f revenue, %s rating\n", c.title, c.totalEnrollments, c.price * c.totalEnrollments, rating);
        }
        pressEnter();
    }

    // Admin menu
    static void showAdminMenu(User user) {
        boolean running = true;
        while (running) {
            showHeader("ADMIN - " + user.getFullName());
            int choice = promptChoice("Action:", new String[]{"Analytics", "Manage Users", "Manage Courses", "Flagged Reviews", "Create Admin", "Logout"});
            try {
                switch (choice) {
                    case 0 -> viewAnalytics();
                    case 1 -> manageUsers();
                    case 2 -> adminManageCourses();
                    case 3 -> manageFlaggedReviews();
                    case 4 -> createAdmin();
                    case 5 -> running = false;
                }
            } catch (SQLException e) { System.out.println("Error: " + e.getMessage()); pressEnter(); }
        }
    }
    
    @SuppressWarnings("unchecked")
    static void viewAnalytics() throws SQLException {
        showHeader("ANALYTICS");
        Map<String, Object> stats = store.getAnalytics();
        
        Map<String, Integer> u = (Map<String, Integer>) stats.get("users");
        System.out.println("Users: " + u.get("total") + " (Students: " + u.get("students") + ", Instructors: " + u.get("instructors") + ", Admins: " + u.get("admins") + ", Banned: " + u.get("banned") + ")");
        
        Map<String, Integer> c = (Map<String, Integer>) stats.get("courses");
        System.out.println("Courses: " + c.get("total") + " (Approved: " + c.get("approved") + ", Pending: " + c.get("pending") + ", Draft: " + c.get("draft") + ")");
        
        Map<String, Integer> e = (Map<String, Integer>) stats.get("enrollments");
        System.out.println("Enrollments: " + e.get("total") + " (Active: " + e.get("active") + ", Completed: " + e.get("completed") + ")");
        
        Map<String, Integer> r = (Map<String, Integer>) stats.get("reviews");
        System.out.println("Reviews: " + r.get("total") + " (Flagged: " + r.get("flagged") + ")");
        System.out.println("Certificates: " + stats.get("certificates"));
        System.out.println("Revenue: $" + String.format("%.2f", (Double) stats.getOrDefault("revenue", 0.0)));
        
        pressEnter();
    }
    
    static void manageUsers() throws SQLException {
        showHeader("USER MANAGEMENT");
        
        UserRole[] filters = {null, UserRole.Student, UserRole.Instructor, UserRole.Admin};
        UserRole filter = filters[promptChoice("Filter:", new String[]{"All", "Students", "Instructors", "Admins"})];
        
        List<User> users = store.getAllUsers(filter);
        if (users.isEmpty()) { System.out.println("No users."); pressEnter(); return; }
        
        for (int i = 0; i < users.size(); i++) {
            User u = users.get(i);
            System.out.printf("%d. %s - %s - %s%s\n", i+1, u.getFullName(), u.email, u.role, u.isBanned ? " [BANNED]" : "");
        }
        
        int action = promptChoice("Action:", new String[]{"Ban/Unban", "Promote", "Reset Password", "Back"});
        
        if (action == 0) {
            int idx = promptNumber("User #: ", 1, users.size()) - 1;
            Result r = authService.toggleBan(users.get(idx).id);
            System.out.println(r.message); pressEnter();
        } else if (action == 1) {
            int idx = promptNumber("User #: ", 1, users.size()) - 1;
            UserRole[] roles = {UserRole.Student, UserRole.Instructor, UserRole.Admin};
            UserRole newRole = roles[promptChoice("New role:", new String[]{"Student", "Instructor", "Admin"})];
            Result r = authService.promoteUser(users.get(idx).id, newRole);
            System.out.println(r.message); pressEnter();
        } else if (action == 2) {
            int idx = promptNumber("User #: ", 1, users.size()) - 1;
            String pw = prompt("New password: ");
            Result r = authService.resetPassword(users.get(idx).id, pw);
            System.out.println(r.message); pressEnter();
        }
    }
    
    static void adminManageCourses() throws SQLException {
        showHeader("COURSE MANAGEMENT");
        
        boolean pending = promptChoice("View:", new String[]{"Pending", "All"}) == 0;
        List<Course> courses = pending ? courseService.getPendingCourses() : courseService.getAllCourses();
        
        if (courses.isEmpty()) { System.out.println(pending ? "No pending courses." : "No courses."); pressEnter(); return; }
        
        for (int i = 0; i < courses.size(); i++) {
            Course c = courses.get(i);
            System.out.printf("%d. %s by %s - %s - %d lessons\n", i+1, c.title, c.instructorName, c.status, c.lessons.size());
        }
        
        int action = promptChoice("Action:", new String[]{"Approve", "Reject", "Delete", "Back"});
        
        if (action == 0) {
            int idx = promptNumber("Course #: ", 1, courses.size()) - 1;
            Result r = courseService.reviewCourse(courses.get(idx).id, true);
            System.out.println(r.message); pressEnter();
        } else if (action == 1) {
            int idx = promptNumber("Course #: ", 1, courses.size()) - 1;
            Result r = courseService.reviewCourse(courses.get(idx).id, false);
            System.out.println(r.message); pressEnter();
        } else if (action == 2) {
            int idx = promptNumber("Course #: ", 1, courses.size()) - 1;
            if (promptYesNo("Sure?")) {
                Result r = courseService.deleteCourse(courses.get(idx).id, null, true);
                System.out.println(r.message);
            }
            pressEnter();
        }
    }
    
    static void manageFlaggedReviews() throws SQLException {
        showHeader("FLAGGED REVIEWS");
        List<Review> reviews = reviewService.getFlaggedReviews();
        
        if (reviews.isEmpty()) { System.out.println("No flagged reviews."); pressEnter(); return; }
        
        for (int i = 0; i < reviews.size(); i++) {
            Review r = reviews.get(i);
            System.out.println((i+1) + ". " + r.rating + "/5 by " + r.studentName + ": " + r.comment);
        }
        
        int action = promptChoice("Action:", new String[]{"Approve", "Delete", "Back"});
        
        if (action == 0) {
            int idx = promptNumber("Review #: ", 1, reviews.size()) - 1;
            Result r = reviewService.approveReview(reviews.get(idx).id);
            System.out.println(r.message); pressEnter();
        } else if (action == 1) {
            int idx = promptNumber("Review #: ", 1, reviews.size()) - 1;
            Result r = reviewService.deleteReview(reviews.get(idx).id);
            System.out.println(r.message); pressEnter();
        }
    }
    
    static void createAdmin() {
        showHeader("CREATE ADMIN");
        String firstName = prompt("First name: ");
        String lastName = prompt("Last name: ");
        String email = prompt("Email: ");
        String password = prompt("Password: ");
        
        try {
            User admin = new User();
            admin.email = email.toLowerCase().trim();
            admin.passwordHash = hashPassword(password);
            admin.firstName = firstName;
            admin.lastName = lastName;
            admin.role = UserRole.Admin;
            store.addUser(admin);
            System.out.println("\nAdmin created!");
        } catch (SQLException e) { System.out.println("Error: " + e.getMessage()); }
        pressEnter();
    }
}
