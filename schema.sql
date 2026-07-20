-- CMMS Database Schema
-- Computerised Maintenance Management System


-- Users and authentication

CREATE TABLE users (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('admin', 'supervisor', 'technician', 'reporter') NOT NULL DEFAULT 'reporter',
    avatar_url  VARCHAR(255),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- Facilities and locations reports can be tied to

CREATE TABLE locations (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Maintenance categories (Electrical, Plumbing, HVAC, etc.)

CREATE TABLE categories (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Fault/maintenance reports submitted by users or staff

CREATE TABLE reports (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference       VARCHAR(20) NOT NULL UNIQUE,
    issue           VARCHAR(200) NOT NULL,
    description     TEXT,
    category_id     INT UNSIGNED NOT NULL,
    location_id     INT UNSIGNED NOT NULL,
    submitted_by    INT UNSIGNED NOT NULL,
    priority        ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    status          ENUM('pending', 'approved', 'rejected', 'closed') NOT NULL DEFAULT 'pending',
    submitted_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_report_category   FOREIGN KEY (category_id)  REFERENCES categories(id),
    CONSTRAINT fk_report_location   FOREIGN KEY (location_id)  REFERENCES locations(id),
    CONSTRAINT fk_report_submitter  FOREIGN KEY (submitted_by) REFERENCES users(id)
);


-- Photos attached to a report (up to 5, enforced at the API layer)

CREATE TABLE report_photos (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_id   INT UNSIGNED NOT NULL,
    url         VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_photo_report FOREIGN KEY (report_id) REFERENCES reports(id)
);


-- Work orders created from approved reports

CREATE TABLE work_orders (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference       VARCHAR(20) NOT NULL UNIQUE,
    report_id       INT UNSIGNED NOT NULL,
    assigned_to     INT UNSIGNED,
    assigned_by     INT UNSIGNED NOT NULL,
    priority        ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    status          ENUM('pending', 'in_progress', 'completed', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
    due_date        DATE NOT NULL,
    started_at      TIMESTAMP NULL,
    completed_at    TIMESTAMP NULL,
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_wo_report      FOREIGN KEY (report_id)    REFERENCES reports(id),
    CONSTRAINT fk_wo_assigned_to FOREIGN KEY (assigned_to)  REFERENCES users(id),
    CONSTRAINT fk_wo_assigned_by FOREIGN KEY (assigned_by)  REFERENCES users(id)
);


-- Activity log on work orders (status changes, comments, updates)

CREATE TABLE work_order_activity (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_order_id   INT UNSIGNED NOT NULL,
    actor_id        INT UNSIGNED NOT NULL,
    activity_type   ENUM('status_change', 'reassign', 'comment', 'start', 'complete') NOT NULL,
    previous_value  VARCHAR(100),
    new_value       VARCHAR(100),
    note            TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_activity_wo    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    CONSTRAINT fk_activity_actor FOREIGN KEY (actor_id)      REFERENCES users(id)
);


-- Staff profiles (extends users for technician-specific data)

CREATE TABLE staff_profiles (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL UNIQUE,
    department      VARCHAR(80),
    specialisation  VARCHAR(80),
    joined_at       DATE,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,

    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id)
);


-- Skills held by a staff member (many-to-many against categories).
-- This is what auto-assignment matches on; staff_profiles.specialisation
-- is kept only as a free-text display field for back-compat.

CREATE TABLE staff_skills (
    staff_user_id   INT UNSIGNED NOT NULL,
    category_id     INT UNSIGNED NOT NULL,

    PRIMARY KEY (staff_user_id, category_id),
    CONSTRAINT fk_skill_user     FOREIGN KEY (staff_user_id) REFERENCES users(id),
    CONSTRAINT fk_skill_category FOREIGN KEY (category_id)   REFERENCES categories(id)
);


-- Notifications for users

CREATE TABLE notifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipient_id    INT UNSIGNED NOT NULL,
    title           VARCHAR(150) NOT NULL,
    body            TEXT,
    is_read         TINYINT(1) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_recipient FOREIGN KEY (recipient_id) REFERENCES users(id)
);


-- Seed: default categories

INSERT INTO categories (name) VALUES
    ('Electrical'),
    ('Plumbing'),
    ('Carpentry'),
    ('Roofing'),
    ('HVAC'),
    ('Civil'),
    ('General');
