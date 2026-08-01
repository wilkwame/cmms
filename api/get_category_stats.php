<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

requireRole(['admin']);

try {
    $db = connectToDatabase();

    // Only counts tickets an admin actually acted on (approved or, once
    // resolved, closed) and work orders that reached "completed" — a
    // ticket still sitting "pending" or turned down as "rejected" isn't
    // real completed work, so it shouldn't inflate this chart. The join
    // condition (not a WHERE clause) is what keeps a category/department
    // with zero qualifying tickets still showing up at 0 rather than
    // disappearing from the chart entirely.
    $categoryStmt = $db->query('
        SELECT c.id, c.name,
               COUNT(DISTINCT r.id)  AS report_count,
               COUNT(DISTINCT wo.id) AS work_order_count
        FROM categories c
        LEFT JOIN reports r ON r.category_id = c.id AND r.status IN ("approved", "closed")
        LEFT JOIN work_orders wo ON wo.report_id = r.id AND wo.status = "completed"
        GROUP BY c.id, c.name
        ORDER BY report_count DESC
    ');
    $categories = $categoryStmt->fetchAll();

    // Same filtering, broken down by department instead of trade/category —
    // answers "which department has the most tickets" (a location with no
    // department assigned falls outside every department's count here,
    // same departmental-scoping default used everywhere else in the app).
    $departmentStmt = $db->query('
        SELECT d.id, d.name,
               COUNT(DISTINCT r.id)  AS report_count,
               COUNT(DISTINCT wo.id) AS work_order_count
        FROM departments d
        LEFT JOIN locations l ON l.department_id = d.id
        LEFT JOIN reports r ON r.location_id = l.id AND r.status IN ("approved", "closed")
        LEFT JOIN work_orders wo ON wo.report_id = r.id AND wo.status = "completed"
        GROUP BY d.id, d.name
        ORDER BY report_count DESC
    ');
    $departments = $departmentStmt->fetchAll();

    // Same filtering again, broken down by the specific location instead
    // of department/category — answers "which physical areas on campus
    // actually have the most reported issues," per the project review
    // ask for a location-level view (no campus map image available, so
    // this is the list/breakdown form of that instead).
    $locationStmt = $db->query('
        SELECT l.id, l.name,
               COUNT(DISTINCT r.id)  AS report_count,
               COUNT(DISTINCT wo.id) AS work_order_count
        FROM locations l
        LEFT JOIN reports r ON r.location_id = l.id AND r.status IN ("approved", "closed")
        LEFT JOIN work_orders wo ON wo.report_id = r.id AND wo.status = "completed"
        GROUP BY l.id, l.name
        ORDER BY report_count DESC
    ');
    $locations = $locationStmt->fetchAll();

    foreach ($categories as &$row) {
        $row['report_count'] = (int) $row['report_count'];
        $row['work_order_count'] = (int) $row['work_order_count'];
    }
    unset($row);

    foreach ($departments as &$row) {
        $row['report_count'] = (int) $row['report_count'];
        $row['work_order_count'] = (int) $row['work_order_count'];
    }
    unset($row);

    foreach ($locations as &$row) {
        $row['report_count'] = (int) $row['report_count'];
        $row['work_order_count'] = (int) $row['work_order_count'];
    }
    unset($row);

    sendJson(true, 200, [
        'categories'  => $categories,
        'departments' => $departments,
        'locations'   => $locations,
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
