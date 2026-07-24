<?php

// Global audit trail. $actor is a currentUser()/requireLogin()-shaped array
// (or null for a system-initiated event). No FK to audit_log, so a failed
// insert must never take down the mutation it's logging — callers wrap
// this in their own try/catch alongside the rest of the request.
function logActivity(
    PDO $db,
    ?array $actor,
    string $action,
    ?string $entityType,
    ?int $entityId,
    ?string $entityReference,
    string $description
): void {
    $db->prepare('
        INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_reference, description, ip_address)
        VALUES (:actor_id, :actor_name, :actor_role, :action, :entity_type, :entity_id, :entity_reference, :description, :ip_address)
    ')->execute([
        ':actor_id'         => $actor['id'] ?? null,
        ':actor_name'       => $actor['name'] ?? 'System',
        ':actor_role'       => $actor['role'] ?? null,
        ':action'           => $action,
        ':entity_type'      => $entityType,
        ':entity_id'        => $entityId,
        ':entity_reference' => $entityReference,
        ':description'      => $description,
        ':ip_address'       => $_SERVER['REMOTE_ADDR'] ?? null,
    ]);
}
