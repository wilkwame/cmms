-- Incremental migration for an existing `cmms` database (already created via
-- schema.sql + template.sql). Safe to run once against a live DB.
-- Run: mysql -u root cmms < migrations.sql

USE cmms;

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
