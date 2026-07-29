-- Incremental migration for an existing `cmms` database (already created via
-- schema.sql + template.sql). Safe to run once against a live DB.
-- Run: mysql -u root cmms < migrations.sql

USE cmms;

-- Profile picture support (2026-07-19)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL AFTER role', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS report_photos (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_id   INT UNSIGNED NOT NULL,
    url         VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_photo_report FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS staff_skills (
    staff_user_id   INT UNSIGNED NOT NULL,
    category_id     INT UNSIGNED NOT NULL,

    PRIMARY KEY (staff_user_id, category_id),
    CONSTRAINT fk_skill_user     FOREIGN KEY (staff_user_id) REFERENCES users(id),
    CONSTRAINT fk_skill_category FOREIGN KEY (category_id)   REFERENCES categories(id)
);

-- Backfill: staff_profiles.department already lines up with categories.name
-- (Electrical, Plumbing, Carpentry, Roofing, HVAC, Civil, General) in the
-- seeded data, unlike the free-text `specialisation` column which never
-- matched category names — that's why auto-assignment was silently always
-- falling back to pure lowest-workload matching regardless of category.
INSERT IGNORE INTO staff_skills (staff_user_id, category_id)
SELECT sp.user_id, c.id
FROM staff_profiles sp
JOIN categories c ON c.name = sp.department
WHERE sp.is_active = 1;

-- Completion evidence photos (2026-07-23): a technician attaches at least
-- one photo when marking a work order complete, so admins can see proof of
-- the finished repair from the work order detail popup.
CREATE TABLE IF NOT EXISTS work_order_photos (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_order_id  INT UNSIGNED NOT NULL,
    url            VARCHAR(255) NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_wo_photo_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- Technician-submitted work now goes to "pending_review" instead of
-- straight to "completed" — an admin/supervisor approves it from there
-- (2026-07-23). Purely additive: existing rows/statuses are untouched.
ALTER TABLE work_orders MODIFY COLUMN status
    ENUM('pending','in_progress','pending_review','completed','overdue','cancelled')
    NOT NULL DEFAULT 'pending';

-- "Other" category (2026-07-24): a catch-all for reporters whose issue
-- doesn't fit any of the seeded categories.
INSERT IGNORE INTO categories (name) VALUES ('Other');

-- Global audit trail (2026-07-24): who did what, when, across the whole
-- system (logins, report/work order lifecycle, staff management). No FKs —
-- an entity/user being deleted is itself an event this table must record,
-- so actor/entity identity is snapshotted as text rather than joined live.
CREATE TABLE IF NOT EXISTS audit_log (
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

-- Optional reporter feedback once a ticket is closed (2026-07-25): a 1-5
-- star rating plus an optional comment. UNIQUE on report_id — one feedback
-- submission per ticket, matching the "optional, one-shot" UX rather than
-- an editable/ongoing thread.
CREATE TABLE IF NOT EXISTS report_feedback (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_id   INT UNSIGNED NOT NULL UNIQUE,
    rating      TINYINT UNSIGNED NOT NULL,
    comment     TEXT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_feedback_report FOREIGN KEY (report_id) REFERENCES reports(id),
    CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5)
);

-- Organizational departments (2026-07-25) — distinct from `categories`
-- (the maintenance trade a ticket needs: Electrical, Plumbing...) and from
-- staff_profiles.department (free-text mirror of a staff member's trade).
-- This is the academic/organizational unit a location belongs to, e.g.
-- "Computer Science", used to scope what a departmental supervisor can see
-- and act on. Seeded with a starting set; admin can add more later the same
-- way categories are extended.
CREATE TABLE IF NOT EXISTS departments (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO departments (name) VALUES
    ('Computer Science'),
    ('Engineering'),
    ('Fashion');

-- A ticket's department is derived from its location, not chosen directly
-- by the reporter — so the FK lives on locations. NULL for now on existing
-- locations until an admin assigns each one to a department.
SET @loc_dept_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'locations' AND COLUMN_NAME = 'department_id');
SET @sql = IF(@loc_dept_exists = 0,
    'ALTER TABLE locations ADD COLUMN department_id INT UNSIGNED NULL AFTER name, ADD CONSTRAINT fk_location_department FOREIGN KEY (department_id) REFERENCES departments(id)',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- A staff member's home department (supervisor or technician) — separate
-- from their trade skill(s) in staff_skills. A departmental supervisor's
-- reassignment pool is technicians who match BOTH this department and the
-- ticket's required trade.
SET @staff_dept_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_profiles' AND COLUMN_NAME = 'department_id');
SET @sql = IF(@staff_dept_exists = 0,
    'ALTER TABLE staff_profiles ADD COLUMN department_id INT UNSIGNED NULL AFTER department, ADD CONSTRAINT fk_staff_department FOREIGN KEY (department_id) REFERENCES departments(id)',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
