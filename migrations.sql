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
