<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireLogin();

try {
    $db = connectToDatabase();
    $stmt = $db->query('
        SELECT l.id, l.name, l.department_id, d.name AS department_name
        FROM locations l
        LEFT JOIN departments d ON d.id = l.department_id
        ORDER BY l.name ASC
    ');
    $locations = $stmt->fetchAll();
    sendJson(true, 200, $locations);
} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
