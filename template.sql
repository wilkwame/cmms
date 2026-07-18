-- CMMS Population Template
-- Run this after schema.sql to seed the database with test data.
-- Covers: users, staff_profiles, locations, reports, work_orders,
--         work_order_activity, notifications.

-- Users (1 admin, 2 supervisors, 6 technicians, 4 reporters)

INSERT IGNORE INTO users (name, email, password, role) VALUES
    ('David Okonkwo',   'david@cmms.dev',    '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',      'admin'),
    ('Mawuko Kwame',      '0322080404@htu.edu.gh',   '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',     'supervisor'),
    ('James Adeyemi',   'james@cmms.dev',    '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',     'supervisor'),
    ('Peter Griffin',   'makwilliam.k@gmail.com',    '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',      'technician'),
    ('Michael Hardy',   'michael@cmms.dev',  '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',      'technician'),
    ('Samuel Ike',      'samuel@cmms.dev',   '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',      'technician'),
    ('James Cole',      'jcole@cmms.dev',    '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',      'technician'),
    ('Amaka Nwosu',     'amaka@cmms.dev',    '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',      'technician'),
    ('Tunde Bello',     'tunde@cmms.dev',    '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',      'technician'),
    ('Grace Obi',       'grace@cmms.dev',    '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',  'reporter'),
    ('Chukwudi Nnaji',  'chukwudi@cmms.dev', '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',  'reporter'),
    ('Fatima Aliyu',    'fatima@cmms.dev',   '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',  'reporter'),
    ('Emeka Okafor',    'emeka@cmms.dev',    '$2y$10$CAzGRnTdAjBb/snTCIZqmekHSSL4Z.AUcTl0H7BVrJDBAXOTzis8i',  'reporter');


-- Staff profiles (all technicians + supervisors)

INSERT IGNORE INTO staff_profiles (user_id, department, specialisation, joined_at, is_active) VALUES
    (2,  'Maintenance',  'General Supervision',   '2021-03-15', 1),
    (3,  'Maintenance',  'Electrical Supervision', '2020-07-01', 1),
    (4,  'Electrical',   'Wiring & Circuits',      '2022-01-10', 1),
    (5,  'Civil',        'Roofing & Waterproofing','2021-09-05', 1),
    (6,  'Plumbing',     'Drainage & Pipework',    '2023-02-20', 1),
    (7,  'Carpentry',    'Doors & Fixtures',       '2022-06-14', 1),
    (8,  'HVAC',         'Air Conditioning',       '2023-08-01', 1),
    (9,  'Electrical',   'Lighting Systems',       '2024-01-15', 1);


-- Locations

INSERT IGNORE INTO locations (name, description) VALUES
    ('Block A',          'Administrative block, ground floor'),
    ('Block B',          'Lecture rooms 101 to 120'),
    ('Block C',          'Laboratories and research wing'),
    ('Main Auditorium',  'Central hall with 800-seat capacity'),
    ('Staff Quarters',   'Residential area for resident staff'),
    ('Library',          'Three-storey central library'),
    ('Sports Complex',   'Indoor gym and outdoor courts'),
    ('Car Park',         'Multi-level car parking facility'),
    ('Canteen',          'Main cafeteria and kitchen area'),
    ('Generator House',  'Power plant and utility room');


-- Reports (30 entries spread across categories, locations, priorities, statuses)
-- categories: 1=Electrical 2=Plumbing 3=Carpentry 4=Roofing 5=HVAC 6=Civil 7=General
-- submitted_by: reporters are users 10-13, supervisors are 2-3

INSERT IGNORE INTO reports
    (reference, issue, description, category_id, location_id, submitted_by, priority, status, submitted_at)
VALUES
    ('RPT-0001', 'Wiring fault in corridor',        'Exposed wiring along east corridor wall.',                   1, 1,  10, 'high',   'approved', '2026-04-01 08:15:00'),
    ('RPT-0002', 'Roof leakage during rain',         'Water seeping through ceiling tiles in room 112.',           4, 2,  11, 'urgent', 'approved', '2026-04-03 09:30:00'),
    ('RPT-0003', 'AC unit not cooling',              'HVAC unit in staff room B14 blows warm air.',                5, 5,  12, 'medium', 'approved', '2026-04-05 10:00:00'),
    ('RPT-0004', 'Broken entrance door',             'Main entrance door hinge completely snapped.',               3, 1,  13, 'high',   'approved', '2026-04-06 11:20:00'),
    ('RPT-0005', 'Blocked floor drain',              'Water pooling in lab corridor due to blocked drain.',        2, 3,  10, 'low',    'approved', '2026-04-07 14:00:00'),
    ('RPT-0006', 'Flickering lights in auditorium',  'Stage lights intermittently flicker during events.',        1, 4,  11, 'high',   'pending',  '2026-04-10 08:45:00'),
    ('RPT-0007', 'Burst pipe in kitchen',            'Pipe under canteen sink burst and flooded the floor.',      2, 9,  12, 'urgent', 'approved', '2026-04-11 07:00:00'),
    ('RPT-0008', 'Cracked ceiling panel',            'Large crack visible in block B lecture room ceiling.',      6, 2,  13, 'medium', 'approved', '2026-04-12 09:10:00'),
    ('RPT-0009', 'Faulty generator switch',          'Generator fails to auto-start during power cuts.',          1, 10, 10, 'urgent', 'approved', '2026-04-14 06:30:00'),
    ('RPT-0010', 'Gym treadmill broken',             'Two treadmills in the sports complex are non-functional.',  7, 7,  11, 'low',    'pending',  '2026-04-15 13:00:00'),
    ('RPT-0011', 'Water heater failure',             'Hot water unavailable in staff quarters bathrooms.',        2, 5,  12, 'medium', 'approved', '2026-04-16 08:00:00'),
    ('RPT-0012', 'Window frame rot',                 'Wooden window frames in library second floor rotting.',     3, 6,  13, 'low',    'pending',  '2026-04-17 10:30:00'),
    ('RPT-0013', 'Sewage smell in restroom',         'Strong sewage odour from block A male restroom.',           2, 1,  10, 'high',   'approved', '2026-04-18 11:00:00'),
    ('RPT-0014', 'Broken car park barrier',          'Automated barrier at car park entrance stuck open.',        7, 8,  11, 'medium', 'rejected', '2026-04-19 12:00:00'),
    ('RPT-0015', 'Roof gutter blocked',              'Overflowing gutters causing wall dampness in block C.',     4, 3,  12, 'high',   'approved', '2026-04-20 09:00:00'),
    ('RPT-0016', 'Power trip in lab',                'Circuit breaker trips whenever lab equipment is turned on.',1, 3,  13, 'urgent', 'approved', '2026-04-21 08:00:00'),
    ('RPT-0017', 'Ceiling fan wobbling',             'Fan in lecture room 105 wobbles dangerously.',              1, 2,  10, 'medium', 'pending',  '2026-04-22 10:00:00'),
    ('RPT-0018', 'Broken toilet cistern',            'Cistern in block B restroom does not refill.',              2, 2,  11, 'low',    'approved', '2026-04-23 09:30:00'),
    ('RPT-0019', 'Leaking roof flashing',            'Metal flashing around auditorium roof detached.',           4, 4,  12, 'high',   'approved', '2026-04-24 07:45:00'),
    ('RPT-0020', 'Fire exit door jammed',            'Emergency exit on block A second floor will not open.',     3, 1,  13, 'urgent', 'approved', '2026-04-25 08:30:00'),
    ('RPT-0021', 'AC dripping water',                'HVAC unit in library reading room drips onto desks.',       5, 6,  10, 'medium', 'pending',  '2026-04-26 11:00:00'),
    ('RPT-0022', 'Pothole in car park',              'Large pothole near bay 12 causing vehicle damage risk.',    6, 8,  11, 'low',    'pending',  '2026-04-27 14:30:00'),
    ('RPT-0023', 'Canteen exhaust fan failed',       'Kitchen exhaust fan stopped working, smoke buildup.',       5, 9,  12, 'high',   'approved', '2026-04-28 09:00:00'),
    ('RPT-0024', 'Staircase handrail loose',         'Handrail on block C staircase is not secure.',              3, 3,  13, 'medium', 'approved', '2026-04-29 10:45:00'),
    ('RPT-0025', 'External light not working',       'Parking area floodlight off for over two weeks.',           1, 8,  10, 'low',    'approved', '2026-04-30 13:00:00'),
    ('RPT-0026', 'Paint peeling off walls',          'Paint peeling in corridor of block A near admin office.',   7, 1,  11, 'low',    'pending',  '2026-05-01 09:00:00'),
    ('RPT-0027', 'Roof vent broken',                 'Roof ventilation unit missing cover, exposing interior.',   4, 4,  12, 'medium', 'approved', '2026-05-02 08:15:00'),
    ('RPT-0028', 'Plumbing leak under sink',         'Slow leak under canteen food prep sink.',                   2, 9,  13, 'medium', 'approved', '2026-05-03 07:30:00'),
    ('RPT-0029', 'Intercom system fault',            'Intercom between security post and admin is dead.',         1, 1,  10, 'medium', 'pending',  '2026-05-04 11:00:00'),
    ('RPT-0030', 'Generator fuel gauge broken',      'Fuel gauge on backup generator shows incorrect reading.',   1, 10, 11, 'high',   'approved', '2026-05-05 06:00:00');


-- Work orders (one per approved report, referencing real report IDs)
-- assigned_by: supervisors (2 and 3), assigned_to: technicians (4-9)
-- Some are unassigned (assigned_to NULL), one cancelled, several overdue

INSERT IGNORE INTO work_orders
    (reference, report_id, assigned_to, assigned_by, priority, status, due_date, started_at, completed_at, notes, created_at)
VALUES
    ('WO-0001', 1,  4, 2, 'high',   'completed',  '2026-04-10', '2026-04-02 08:00:00', '2026-04-09 15:30:00', 'Wiring replaced and insulated.',          '2026-04-01 14:00:00'),
    ('WO-0002', 2,  5, 3, 'urgent', 'completed',  '2026-04-08', '2026-04-04 07:30:00', '2026-04-07 16:00:00', 'Roof tiles resealed and tested.',         '2026-04-03 11:00:00'),
    ('WO-0003', 3,  8, 2, 'medium', 'in_progress','2026-06-25', '2026-04-06 09:00:00', NULL,                   'Refrigerant recharge scheduled.',         '2026-04-05 12:00:00'),
    ('WO-0004', 4,  7, 3, 'high',   'completed',  '2026-04-12', '2026-04-07 08:30:00', '2026-04-11 14:00:00', 'Hinge replaced. Door rehung and tested.', '2026-04-06 13:00:00'),
    ('WO-0005', 5,  6, 2, 'low',    'completed',  '2026-04-15', '2026-04-08 10:00:00', '2026-04-13 12:00:00', 'Drain cleared with high-pressure jet.',   '2026-04-07 15:00:00'),
    ('WO-0006', 7,  6, 3, 'urgent', 'completed',  '2026-04-13', '2026-04-11 07:30:00', '2026-04-12 11:00:00', 'Burst section replaced. Floor dried.',    '2026-04-11 09:00:00'),
    ('WO-0007', 8,  5, 2, 'medium', 'completed',  '2026-04-20', '2026-04-13 08:00:00', '2026-04-18 15:00:00', 'Ceiling panel patched and painted.',      '2026-04-12 10:00:00'),
    ('WO-0008', 9,  4, 3, 'urgent', 'completed',  '2026-04-16', '2026-04-14 07:00:00', '2026-04-15 13:00:00', 'Auto-start relay replaced and tested.',   '2026-04-14 08:00:00'),
    ('WO-0009', 11, 6, 2, 'medium', 'completed',  '2026-04-22', '2026-04-17 09:00:00', '2026-04-21 14:00:00', 'Heating element replaced.',               '2026-04-16 10:00:00'),
    ('WO-0010', 13, 6, 3, 'high',   'completed',  '2026-04-24', '2026-04-19 08:00:00', '2026-04-23 12:00:00', 'Drain rodded and deodorised.',            '2026-04-18 12:00:00'),
    ('WO-0011', 15, 5, 2, 'high',   'overdue',    '2026-05-05', '2026-04-21 08:00:00', NULL,                   'Gutter partially cleared. Full job pending.','2026-04-20 10:00:00'),
    ('WO-0012', 16, 4, 3, 'urgent', 'completed',  '2026-04-25', '2026-04-22 07:30:00', '2026-04-24 15:00:00', 'Faulty breaker replaced. Load balanced.', '2026-04-21 09:00:00'),
    ('WO-0013', 18, 6, 2, 'low',    'completed',  '2026-05-01', '2026-04-24 09:00:00', '2026-04-29 14:00:00', 'Cistern ballcock valve replaced.',        '2026-04-23 10:00:00'),
    ('WO-0014', 19, 5, 3, 'high',   'overdue',    '2026-05-01', '2026-04-25 07:30:00', NULL,                   'Flashing partly resealed. Full fix pending.','2026-04-24 09:00:00'),
    ('WO-0015', 20, 7, 2, 'urgent', 'completed',  '2026-04-28', '2026-04-25 08:00:00', '2026-04-27 16:00:00', 'Door mechanism replaced. Exit tested.',   '2026-04-25 10:00:00'),
    ('WO-0016', 23, 8, 3, 'high',   'in_progress','2026-06-20', '2026-04-29 09:00:00', NULL,                   'Fan motor on order. Temporary vent in place.','2026-04-28 10:00:00'),
    ('WO-0017', 24, 7, 2, 'medium', 'completed',  '2026-05-06', '2026-04-30 08:30:00', '2026-05-05 13:00:00', 'Handrail re-bolted and load-tested.',     '2026-04-29 11:00:00'),
    ('WO-0018', 25, 4, 3, 'low',    'completed',  '2026-05-10', '2026-05-01 09:00:00', '2026-05-08 15:00:00', 'Floodlight bulb and driver replaced.',    '2026-04-30 12:00:00'),
    ('WO-0019', 27, 5, 2, 'medium', 'pending',    '2026-06-30', NULL,                   NULL,                   NULL,                                      '2026-05-02 09:00:00'),
    ('WO-0020', 28, 6, 3, 'medium', 'in_progress','2026-06-22', '2026-05-04 08:00:00', NULL,                   'Pipe connector replaced. Monitoring.',    '2026-05-03 08:00:00'),
    ('WO-0021', 30, 9, 2, 'high',   'overdue',    '2026-05-12', '2026-05-06 07:00:00', NULL,                   'Gauge removal attempted. Part unavailable.','2026-05-05 08:00:00'),
    ('WO-0022', 1,  NULL, 2, 'low', 'cancelled',  '2026-05-20', NULL,                   NULL,                   'Duplicate order raised in error.',        '2026-05-06 10:00:00');


-- Work order activity log

INSERT IGNORE INTO work_order_activity (work_order_id, actor_id, activity_type, previous_value, new_value, note) VALUES
    (1,  4, 'start',         NULL,          NULL,          'Started site inspection.'),
    (1,  4, 'complete',      'in_progress', 'completed',   'Wiring replaced. Job closed.'),
    (2,  5, 'start',         NULL,          NULL,          'Materials collected from store.'),
    (2,  5, 'complete',      'in_progress', 'completed',   'Roof sealed. Passed inspection.'),
    (3,  8, 'start',         NULL,          NULL,          'Initial diagnostics run.'),
    (4,  7, 'start',         NULL,          NULL,          'Old hinge removed.'),
    (4,  7, 'complete',      'in_progress', 'completed',   'Door operational.'),
    (5,  6, 'start',         NULL,          NULL,          'Equipment requisitioned.'),
    (5,  6, 'complete',      'in_progress', 'completed',   'Drain fully cleared.'),
    (6,  6, 'start',         NULL,          NULL,          'Emergency response activated.'),
    (6,  6, 'complete',      'in_progress', 'completed',   'Pipe section replaced.'),
    (8,  4, 'start',         NULL,          NULL,          'Generator isolated for repair.'),
    (8,  4, 'complete',      'in_progress', 'completed',   'Auto-start confirmed working.'),
    (11, 5, 'start',         NULL,          NULL,          'Partial gutter cleared.'),
    (11, 2, 'status_change', 'in_progress', 'overdue',     'Missed due date. Chasing parts.'),
    (12, 4, 'start',         NULL,          NULL,          'Panel isolated before work.'),
    (12, 4, 'complete',      'in_progress', 'completed',   'Circuit balanced and tested.'),
    (14, 5, 'start',         NULL,          NULL,          'Scaffold set up.'),
    (14, 3, 'status_change', 'in_progress', 'overdue',     'Sealant delivery delayed.'),
    (21, 9, 'start',         NULL,          NULL,          'Gauge removed for inspection.'),
    (21, 3, 'status_change', 'in_progress', 'overdue',     'Replacement part not in stock.'),
    (22, 2, 'status_change', 'pending',     'cancelled',   'Duplicate. Original WO-0001 covers this.');


-- Notifications

INSERT IGNORE INTO notifications (recipient_id, title, body, is_read) VALUES
    (4,  'New Work Order Assigned',     'WO-0001 has been assigned to you. Due 10 Apr 2026.',              1),
    (5,  'New Work Order Assigned',     'WO-0002 has been assigned to you. Due 08 Apr 2026.',              1),
    (8,  'New Work Order Assigned',     'WO-0003 has been assigned to you. Due 25 Jun 2026.',              0),
    (5,  'Work Order Overdue',          'WO-0011 (Roof gutter blocked) is past its due date.',             0),
    (5,  'Work Order Overdue',          'WO-0014 (Leaking roof flashing) is past its due date.',           0),
    (9,  'Work Order Overdue',          'WO-0021 (Generator fuel gauge broken) is past its due date.',     0),
    (2,  'Report Submitted',            'RPT-0029 (Intercom system fault) is awaiting your review.',       0),
    (3,  'Report Submitted',            'RPT-0006 (Flickering lights in auditorium) awaits review.',       0),
    (1,  'Overdue Work Orders Alert',   'There are 3 overdue work orders requiring supervisor attention.', 0),
    (10, 'Report Status Update',        'Your report RPT-0001 has been approved and a work order raised.', 1),
    (11, 'Report Status Update',        'Your report RPT-0002 has been approved and a work order raised.', 1),
    (12, 'Report Status Update',        'Your report RPT-0014 has been rejected.',                        0),
    (6,  'New Work Order Assigned',     'WO-0006 has been assigned to you. Due 13 Apr 2026.',              1),
    (7,  'New Work Order Assigned',     'WO-0015 has been assigned to you. Due 28 Apr 2026.',              1);