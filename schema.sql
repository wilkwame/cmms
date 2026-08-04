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


-- Organizational departments — distinct from `categories` (the maintenance
-- trade a ticket needs) and from staff_profiles.department (a free-text
-- mirror of a staff member's trade). This is the academic/organizational
-- unit a location belongs to, e.g. "Computer Science" — used to scope what
-- a departmental supervisor can see and act on.

CREATE TABLE departments (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Facilities and locations reports can be tied to. A ticket's department is
-- derived from its location (department_id), not chosen directly by the
-- reporter.

CREATE TABLE locations (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    department_id INT UNSIGNED NULL,
    description   TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_location_department FOREIGN KEY (department_id) REFERENCES departments(id)
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


-- Optional reporter feedback once a ticket is closed: a 1-5 star rating
-- plus an optional comment. UNIQUE on report_id — one feedback submission
-- per ticket, matching the "optional, one-shot" UX rather than an
-- editable/ongoing thread.

CREATE TABLE report_feedback (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_id   INT UNSIGNED NOT NULL UNIQUE,
    rating      TINYINT UNSIGNED NOT NULL,
    comment     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_feedback_report FOREIGN KEY (report_id) REFERENCES reports(id),
    CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5)
);


-- Work orders created from approved reports

CREATE TABLE work_orders (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference       VARCHAR(20) NOT NULL UNIQUE,
    report_id       INT UNSIGNED NOT NULL,
    assigned_to     INT UNSIGNED,
    assigned_by     INT UNSIGNED NOT NULL,
    priority        ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    status          ENUM('pending', 'in_progress', 'pending_review', 'completed', 'overdue', 'cancelled', 'on_hold') NOT NULL DEFAULT 'pending',
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


-- Completion evidence photos: a technician attaches at least one when
-- marking a work order complete.

CREATE TABLE work_order_photos (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_order_id  INT UNSIGNED NOT NULL,
    url            VARCHAR(255) NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_wo_photo_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);


-- Activity log on work orders (status changes, comments, updates)

-- Global audit trail: who did what, when, across the whole system. No FKs
-- on purpose — an entity/user being deleted is itself an event this table
-- must keep a record of, so actor/entity identity is snapshotted as text
-- rather than joined live.
CREATE TABLE audit_log (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id         INT UNSIGNED NULL,
    actor_name       VARCHAR(100) NOT NULL,
    actor_role       VARCHAR(20) NULL,
    action           VARCHAR(50) NOT NULL,
    entity_type      VARCHAR(30) NULL,
    entity_id        INT UNSIGNED NULL,
    entity_reference VARCHAR(50) NULL,
    description      TEXT NOT NULL,
    ip_address       VARCHAR(45) NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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


-- Staff profiles (extends users for technician-specific data).
-- `department` (free text, e.g. "Electrical") mirrors the staff member's
-- trade for display — back-compat only, staff_skills is what auto-
-- assignment actually matches on. `department_id` is a different thing
-- entirely: their home *organizational* department (Computer Science,
-- Engineering...), used to scope a departmental supervisor's reassignment
-- pool to technicians who match both that department and the needed trade.

CREATE TABLE staff_profiles (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL UNIQUE,
    department      VARCHAR(80),
    department_id   INT UNSIGNED NULL,
    specialisation  VARCHAR(80),
    joined_at       DATE,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,

    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_staff_department FOREIGN KEY (department_id) REFERENCES departments(id)
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
    ('General'),
    ('Other');


-- Seed: starting departments — admin can add more later the same way
-- categories are extended.

INSERT INTO departments (name) VALUES
    ('Computer Science'),
    ('Engineering'),
    ('Fashion');
