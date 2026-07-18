<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_auth.php';

// Expected POST body: { "report_id": int }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(false, 405, 'Method not allowed');
}

$user = requireLogin();

$body     = json_decode(file_get_contents('php://input'), true);
$reportId = (int) ($body['report_id'] ?? 0);

if ($reportId <= 0) {
    sendJson(false, 400, 'report_id is required');
}

try {
    $db = connectToDatabase();

    $reportStmt = $db->prepare('
        SELECT r.id, r.reference, r.issue, r.description, r.priority, r.status,
               r.submitted_by, r.submitted_at,
               c.name AS category, l.name AS location
        FROM reports r
        JOIN categories c ON c.id = r.category_id
        JOIN locations  l ON l.id = r.location_id
        WHERE r.id = :id
    ');
    $reportStmt->execute([':id' => $reportId]);
    $report = $reportStmt->fetch();

    if (!$report) {
        sendJson(false, 404, 'Report not found');
    }

    if ($user['role'] === 'reporter' && (int) $report['submitted_by'] !== $user['id']) {
        sendJson(false, 403, 'You do not have permission to view this report');
    }

    $photosStmt = $db->prepare('SELECT url FROM report_photos WHERE report_id = :id ORDER BY id ASC');
    $photosStmt->execute([':id' => $reportId]);
    $photos = array_column($photosStmt->fetchAll(), 'url');

    $timeline = [[
        'event'     => 'submitted',
        'label'     => 'Submitted',
        'timestamp' => $report['submitted_at'],
        'note'      => null,
    ]];

    $woStmt = $db->prepare('
        SELECT wo.id, wo.reference, wo.status, wo.created_at, wo.started_at, wo.completed_at, wo.due_date,
               u.name AS assigned_to
        FROM work_orders wo
        LEFT JOIN users u ON u.id = wo.assigned_to
        WHERE wo.report_id = :report_id AND wo.status != "cancelled"
        ORDER BY wo.id DESC
        LIMIT 1
    ');
    $woStmt->execute([':report_id' => $reportId]);
    $workOrder = $woStmt->fetch();

    if ($workOrder) {
        $timeline[] = [
            'event'     => 'assigned',
            'label'     => 'Assigned to ' . ($workOrder['assigned_to'] ?: 'a technician'),
            'timestamp' => $workOrder['created_at'],
            'note'      => null,
        ];

        $activityStmt = $db->prepare('
            SELECT woa.activity_type, woa.previous_value, woa.new_value, woa.note, woa.created_at,
                   u.name AS actor
            FROM work_order_activity woa
            JOIN users u ON u.id = woa.actor_id
            WHERE woa.work_order_id = :wo_id
            ORDER BY woa.created_at ASC
        ');
        $activityStmt->execute([':wo_id' => $workOrder['id']]);

        foreach ($activityStmt->fetchAll() as $a) {
            $timeline[] = [
                'event'     => $a['activity_type'],
                'label'     => ucfirst(str_replace('_', ' ', $a['activity_type'])) . ' — ' . $a['actor'],
                'timestamp' => $a['created_at'],
                'note'      => $a['note'],
            ];
        }
    }

    sendJson(true, 200, [
        'report'     => $report,
        'photos'     => $photos,
        'work_order' => $workOrder ?: null,
        'timeline'   => $timeline,
    ]);

} catch (PDOException $e) {
    sendJson(false, 500, 'Database error: ' . $e->getMessage());
}
