-- ============================================================
-- Udemy Clone — MySQL Schema
-- Run this file once to create the database and all tables.
--
--   mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS udemy_clone
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE udemy_clone;

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  role         ENUM('Student', 'Instructor', 'Admin') NOT NULL DEFAULT 'Student',
  is_banned    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Courses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  title             VARCHAR(255)  NOT NULL,
  description       TEXT,
  price             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  category          VARCHAR(50)   NOT NULL DEFAULT 'Other',
  instructor_id     VARCHAR(36)   NOT NULL,
  instructor_name   VARCHAR(200)  NOT NULL,
  status            ENUM('Draft', 'PendingApproval', 'Approved', 'Rejected') NOT NULL DEFAULT 'Draft',
  total_enrollments INT           NOT NULL DEFAULT 0,
  average_rating    DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  total_ratings     INT           NOT NULL DEFAULT 0,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Lessons (each belongs to a course) ──────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  course_id       VARCHAR(36)  NOT NULL,
  title           VARCHAR(255) NOT NULL,
  content         TEXT,
  duration        INT          NOT NULL DEFAULT 0,
  video_url       VARCHAR(500) DEFAULT '',
  lesson_order    INT          NOT NULL DEFAULT 0,
  is_free_preview TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Course Materials ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materials (
  id        VARCHAR(36)  NOT NULL PRIMARY KEY,
  course_id VARCHAR(36)  NOT NULL,
  type      ENUM('video', 'text', 'quiz') NOT NULL DEFAULT 'text',
  title     VARCHAR(255) NOT NULL,
  url       VARCHAR(500) DEFAULT '',
  content   TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Enrollments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id                   VARCHAR(36)  NOT NULL PRIMARY KEY,
  student_id           VARCHAR(36)  NOT NULL,
  course_id            VARCHAR(36)  NOT NULL,
  course_title         VARCHAR(255) NOT NULL,
  progress_percent     INT          NOT NULL DEFAULT 0,
  is_completed         TINYINT(1)   NOT NULL DEFAULT 0,
  is_paused            TINYINT(1)   NOT NULL DEFAULT 0,
  certificate_id       VARCHAR(36)  DEFAULT NULL,
  enrolled_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at         DATETIME     DEFAULT NULL,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_student_course (student_id, course_id)
) ENGINE=InnoDB;

-- ─── Completed Lessons (many-to-many between enrollment & lesson) ──
CREATE TABLE IF NOT EXISTS completed_lessons (
  enrollment_id VARCHAR(36) NOT NULL,
  lesson_id     VARCHAR(36) NOT NULL,
  completed_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enrollment_id, lesson_id),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id)     REFERENCES lessons(id)     ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Reviews ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  student_id   VARCHAR(36)  NOT NULL,
  student_name VARCHAR(200) NOT NULL,
  course_id    VARCHAR(36)  NOT NULL,
  rating       TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  is_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  is_flagged   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_student_course_review (student_id, course_id)
) ENGINE=InnoDB;

-- ─── Certificates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id                VARCHAR(36)  NOT NULL PRIMARY KEY,
  certificate_number VARCHAR(50)  NOT NULL UNIQUE,
  student_id        VARCHAR(36)  NOT NULL,
  student_name      VARCHAR(200) NOT NULL,
  course_id         VARCHAR(36)  NOT NULL,
  course_title      VARCHAR(255) NOT NULL,
  instructor_name   VARCHAR(200) NOT NULL,
  issued_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_student_course_cert (student_id, course_id)
) ENGINE=InnoDB;
