<?php
// api/_autoassign.php — skill-based staff matching + work order creation,
// shared between the manual "Approve" flow (create_work_order.php) and
// automatic assignment on report submission (insert_report.php).

// Picks the least-loaded active staff member whose skills include the given
// category. Falls back to the least-loaded active staff member overall if
// nobody has a matching skill. Eligibility is purely "has an active staff
// profile" — not gated by login role — since any registered account (even
// one that signed up as a plain reporter) becomes assignable staff the
// moment an admin gives it a skill set via update_staff_skills.php. Only
// admins are excluded, as a system role rather than a staff one.
function pickBestStaffForCategory(PDO $db, int $categoryId): ?int {
    $matchStmt = $db->prepare('
        SELECT u.id, COUNT(wo.id) AS active_jobs
        FROM users u
        JOIN staff_profiles sp ON sp.user_id = u.id
        JOIN staff_skills ss   ON ss.staff_user_id = u.id AND ss.category_id = :category_id
        LEFT JOIN work_orders wo
            ON wo.assigned_to = u.id
            AND wo.status IN ("pending", "in_progress", "overdue")
        WHERE u.role != "admin"
          AND sp.is_active = 1
        GROUP BY u.id
        ORDER BY active_jobs ASC
        LIMIT 1
    ');
    $matchStmt->execute([':category_id' => $categoryId]);
    $match = $matchStmt->fetch();
    if ($match) {
        return (int) $match['id'];
    }

    $fallbackStmt = $db->query('
        SELECT u.id, COUNT(wo.id) AS active_jobs
        FROM users u
        JOIN staff_profiles sp ON sp.user_id = u.id
        LEFT JOIN work_orders wo
            ON wo.assigned_to = u.id
            AND wo.status IN ("pending", "in_progress", "overdue")
        WHERE u.role != "admin"
          AND sp.is_active = 1
        GROUP BY u.id
        ORDER BY active_jobs ASC
        LIMIT 1
    ');
    $fallback = $fallbackStmt->fetch();
    return $fallback ? (int) $fallback['id'] : null;
}

// Creates a work order for a report, auto-picking staff unless $forcedAssignee
// is given. Sets the report's status to "approved" on success. Returns the
// full work order row (joined with report/category/location/assignee), or
// null if no report_id was resolvable, or if there is no staff to assign to
// at all (rather than leave an unassigned work order dangling).
function createWorkOrderForReport(PDO $db, int $reportId, int $assignedByUserId, ?int $forcedAssignee = null): ?array {
    $reportStmt = $db->prepare('
        SELECT r.id, r.priority, r.category_id
        FROM reports r
        WHERE r.id = :id
    ');
    $reportStmt->execute([':id' => $reportId]);
    $report = $reportStmt->fetch();
    if (!$report) {
        return null;
    }

    $assignedTo = $forcedAssignee ?: pickBestStaffForCategory($db, (int) $report['category_id']);
    if (!$assignedTo) {
        return null;
    }

    $lastRefStmt = $db->query('SELECT reference FROM work_orders ORDER BY id DESC LIMIT 1');
    $lastRef     = $lastRefStmt->fetchColumn();
    $nextNumber  = $lastRef ? ((int) substr($lastRef, 3)) + 1 : 1;
    $reference   = 'WO-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    $dueDate     = date('Y-m-d', strtotime('+7 days'));

    $stmt = $db->prepare('
        INSERT INTO work_orders
            (reference, report_id, assigned_to, assigned_by, priority, status, due_date)
        VALUES
            (:reference, :report_id, :assigned_to, :assigned_by, :priority, "pending", :due_date)
    ');
    $stmt->execute([
        ':reference'   => $reference,
        ':report_id'   => $reportId,
        ':assigned_to' => $assignedTo,
        ':assigned_by' => $assignedByUserId,
        ':priority'    => $report['priority'],
        ':due_date'    => $dueDate,
    ]);

    $newId = (int) $db->lastInsertId();

    $db->prepare('UPDATE reports SET status = "approved" WHERE id = :id')
        ->execute([':id' => $reportId]);

    $fetchStmt = $db->prepare('
        SELECT
            wo.id, wo.reference, wo.priority, wo.status, wo.due_date,
            wo.assigned_to AS assigned_to_id,
            r.issue, r.description,
            c.name AS category,
            l.name AS location,
            u.name AS assigned_to
        FROM work_orders wo
        JOIN reports r ON r.id = wo.report_id
        JOIN categories c ON c.id = r.category_id
        JOIN locations l  ON l.id = r.location_id
        LEFT JOIN users u ON u.id = wo.assigned_to
        WHERE wo.id = :id
    ');
    $fetchStmt->execute([':id' => $newId]);
    return $fetchStmt->fetch() ?: null;
}
