// ========================================
// WORK ORDERS MODULE
// ========================================

const WORK_ORDER_PAGE_SIZE = 10;

// ===== STATE =====
app.memory.workOrders = [];
app.memory.filteredWorkOrders = [];
app.memory.workOrdersPage = 0;

// ===== LOAD WORK ORDERS PAGE =====
async function loadWorkOrdersPage(context) {
    context.render('#workorders-body', '<p class="loading-text">Loading work orders...</p>');

    if (app.memory.workOrders.length === 0) {
        try {
            var result = await app.php('api/get_work_orders.php', {});
        } catch (error) {
            // An unguarded await that rejects (network error, non-JSON
            // response) would otherwise leave this stuck on "Loading work
            // orders..." forever with no feedback.
            console.error('Failed to load work orders:', error);
            context.render('#workorders-body', '<p class="empty-state">Failed to load work orders. Please try again.</p>');
            return;
        }
        if (handleAuthFailure(result)) return;
        if (!result.ok) {
            context.render('#workorders-body', '<p class="empty-state">Failed to load work orders.</p>');
            return;
        }
        app.memory.workOrders = result.data.work_orders || [];
    }

    applyWorkOrderFilters(context);
}

// ===== APPLY FILTERS =====
function applyWorkOrderFilters(context) {
    var allWorkOrders = app.memory.workOrders || [];
    
    var statusEl = context.query('#wo-filter-status');
    var priorityEl = context.query('#wo-filter-priority');
    var categoryEl = context.query('#wo-filter-category');
    var searchEl = context.query('#wo-search');
    
    var status = statusEl.exists ? statusEl.element.value : 'all';
    var priority = priorityEl.exists ? priorityEl.element.value : 'all';
    var category = categoryEl.exists ? categoryEl.element.value : 'all';
    var search = searchEl.exists ? searchEl.element.value.toLowerCase().trim() : '';
    
    app.memory.filteredWorkOrders = allWorkOrders.filter(function(wo) {
        // Status filter
        if (status !== 'all' && wo.status !== status) return false;
        
        // Priority filter
        if (priority !== 'all' && wo.priority !== priority) return false;
        
        // Category filter
        if (category !== 'all' && wo.category !== category) return false;
        
        // Search filter
        if (search) {
            var haystack = (wo.reference + ' ' + wo.issue + ' ' + (wo.assigned_to || '') + ' ' + wo.category).toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        
        return true;
    });
    
    app.memory.workOrdersPage = 0;
    renderWorkOrdersSlice(context);
}

// ===== RENDER TABLE =====
function renderWorkOrdersSlice(context) {
    var filtered = app.memory.filteredWorkOrders || [];
    var currentPage = app.memory.workOrdersPage || 0;
    var start = currentPage * WORK_ORDER_PAGE_SIZE;
    var end = Math.min(start + WORK_ORDER_PAGE_SIZE, filtered.length);
    var slice = filtered.slice(start, end);
    var totalPages = Math.max(1, Math.ceil(filtered.length / WORK_ORDER_PAGE_SIZE));
    
    // Update record count
    context.query('#wo-count').text(filtered.length + ' records');
    
    // Build rows
    if (slice.length === 0) {
        context.render('#workorders-body', '<p class="empty-state">No work orders found.</p>');
    } else {
        var html = '';
        for (var i = 0; i < slice.length; i++) {
            var wo = slice[i];
            var priorityClass = 'priority-badge ' + wo.priority;
            var statusClass = 'status-badge ' + wo.status;
            var dueDate = formatDate(wo.due_date);
            var assignedTo = wo.assigned_to || 'Unassigned';

            var role = app.memory.user ? app.memory.user.role : null;
            var isPrivileged = role === 'admin' || role === 'supervisor';
            var isOwner = !!(app.memory.user && wo.assigned_to_id === app.memory.user.id);

            html += '<div class="wo-row" action="openWorkOrderPopup: ' + wo.id + '">';
            html += '  <span class="col-id">' + wo.reference + '</span>';
            html += '  <span class="col-issue">' + wo.issue + '</span>';
            html += '  <span class="col-worker">' + assignedTo + '</span>';
            html += '  <span class="col-category">' + wo.category + '</span>';
            html += '  <span class="col-location">' + (wo.location || '-') + '</span>';
            html += '  <span class="col-priority"><span class="' + priorityClass + '">' + wo.priority + '</span></span>';
            html += '  <span class="col-status"><span class="' + statusClass + '">' + statusLabel(wo.status) + '</span></span>';
            html += '  <span class="col-date">' + dueDate + '</span>';
            html += '  <span class="col-action">';
            if (wo.status === 'in_progress' && isOwner) {
                // The technician's own action: upload photo evidence.
                html += '    <button class="btn-complete-task" action="openCompleteWorkOrderPopup: ' + wo.id + '" title="Upload photo and complete"><i class="fas fa-camera"></i> Complete Task</button>';
            } else if (isPrivileged) {
                // Admin/supervisor's at-a-glance read on whether the
                // technician has actually finished yet, and a quick way to
                // approve without opening the detail popup first.
                if (wo.status === 'pending_review') {
                    html += '    <button class="btn-complete-task" action="approveWorkOrderCompletion: ' + wo.id + '" title="Review photo and approve"><i class="fas fa-check-double"></i> Approve</button>';
                } else if (wo.status === 'completed') {
                    html += '    <span class="wo-action-label wo-action-completed"><i class="fas fa-check-circle"></i> Completed</span>';
                } else if (wo.status === 'cancelled') {
                    html += '    <span class="wo-action-label wo-action-cancelled"><i class="fas fa-ban"></i> Cancelled</span>';
                } else {
                    html += '    <span class="wo-action-label wo-action-waiting"><i class="fas fa-hourglass-half"></i> Waiting for worker\'s response</span>';
                }
            }
            html += '  </span>';
            html += '</div>';
        }
        context.render('#workorders-body', html);
    }
    
    // Update pagination
    var prevBtn = context.query('#workorders-prev');
    var nextBtn = context.query('#workorders-next');
    var label = context.query('#workorders-page-label');
    
    if (prevBtn.exists) prevBtn.element.disabled = currentPage === 0;
    if (nextBtn.exists) nextBtn.element.disabled = currentPage >= totalPages - 1;
    if (label.exists) label.text('Page ' + (currentPage + 1) + ' of ' + totalPages);
}

// ===== PAGINATION =====
function workOrdersPrev(context) {
    if (app.memory.workOrdersPage > 0) {
        app.memory.workOrdersPage--;
        renderWorkOrdersSlice(context);
    }
}

function workOrdersNext(context) {
    var filtered = app.memory.filteredWorkOrders || [];
    var totalPages = Math.ceil(filtered.length / WORK_ORDER_PAGE_SIZE);
    if (app.memory.workOrdersPage < totalPages - 1) {
        app.memory.workOrdersPage++;
        renderWorkOrdersSlice(context);
    }
}

// ===== NAVIGATION =====
// Work orders are always created from an approved report (report_id is a
// required FK on work_orders — see schema.sql), so there's no standalone
// "blank" work order form. This sends the admin to Reports, where approving
// a pending report auto-creates its work order.
function goToNewWorkOrder(context) {
    closeMobileMenu(context);
    showNotificationToast(context, 'Work orders are created by approving a pending report', 'warning');
    context.navigate('reports');
}

// Note: openWorkOrderPopup/buildWorkOrderDetailPopup live in app.js — this
// file used to shadow them with a toast-only placeholder since it loads
// after app.js, silently disabling the real popup.

// ===== EXPOSE GLOBAL FUNCTIONS =====
window.loadWorkOrdersPage = loadWorkOrdersPage;
window.workOrdersPrev = workOrdersPrev;
window.workOrdersNext = workOrdersNext;
window.goToNewWorkOrder = goToNewWorkOrder;