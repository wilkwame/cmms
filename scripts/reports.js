// ========================================
// REPORTS MODULE
// ========================================

// REPORT_PAGE_SIZE is declared once in app.js — classic <script> tags on the
// same page share one top-level scope, so a second `const` here with the
// same name threw "Identifier 'REPORT_PAGE_SIZE' has already been declared"
// on every load, which is a fatal SyntaxError: it aborted this entire file
// before any of its functions (quickApproveReport, openRejectPopup, etc.)
// could be defined. That's why Approve/Reject looked broken no matter what
// the actual approve/reject logic did — the file crashed before that logic
// ever ran.

// ===== STATE =====
app.memory.reports = [];
app.memory.filteredReports = [];
app.memory.reportsPage = 0;

// ===== LOAD REPORTS PAGE =====
function loadReportsPage(context) {
    context.render('#reports-body', '<p class="loading-text">Loading reports...</p>');

    if (app.memory.reports.length === 0) {
        app.php('api/get_reports.php', {})
            .then(function(result) {
                if (handleAuthFailure(result)) return;
                if (!result.ok) {
                    context.render('#reports-body', '<p class="empty-state">Failed to load reports.</p>');
                    return;
                }
                app.memory.reports = result.data.reports || [];
                applyReportFilters(context);
            })
            .catch(function(error) {
                // Without this, a request that rejects (network error, or a
                // response body that isn't valid JSON) leaves the page stuck
                // on "Loading reports..." forever with no visible feedback.
                console.error('Failed to load reports:', error);
                context.render('#reports-body', '<p class="empty-state">Failed to load reports. Please try again.</p>');
            });
    } else {
        applyReportFilters(context);
    }
}

// ===== APPLY FILTERS =====
function applyReportFilters(context) {
    var allReports = app.memory.reports || [];
    
    var priorityEl = context.query('#report-filter-priority');
    var categoryEl = context.query('#report-filter-category');
    var searchEl = context.query('#report-search');
    
    var priority = priorityEl.exists ? priorityEl.element.value : 'all';
    var category = categoryEl.exists ? categoryEl.element.value : 'all';
    var search = searchEl.exists ? searchEl.element.value.toLowerCase().trim() : '';
    
    app.memory.filteredReports = allReports.filter(function(report) {
        if (priority !== 'all' && report.priority !== priority) return false;
        if (category !== 'all' && report.category !== category) return false;
        if (search) {
            var haystack = (report.reference + ' ' + report.issue + ' ' + report.category + ' ' + report.location).toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
    
    app.memory.reportsPage = 0;
    renderReportsSlice(context);
}

// ===== RENDER TABLE =====
function renderReportsSlice(context) {
    var filtered = app.memory.filteredReports || [];
    var currentPage = app.memory.reportsPage || 0;
    var start = currentPage * REPORT_PAGE_SIZE;
    var end = Math.min(start + REPORT_PAGE_SIZE, filtered.length);
    var slice = filtered.slice(start, end);
    var totalPages = Math.max(1, Math.ceil(filtered.length / REPORT_PAGE_SIZE));
    
    context.query('#report-count').text(filtered.length + ' records');
    
    if (slice.length === 0) {
        context.render('#reports-body', '<p class="empty-state">No reports found.</p>');
    } else {
        var html = '';
        for (var i = 0; i < slice.length; i++) {
            var r = slice[i];
            var priorityClass = 'priority-badge ' + r.priority;
            var date = formatDate(r.submitted_at);
            
            html += '<div class="report-row" action="openReportPopup: ' + r.id + '">';
            html += '  <span class="col-id">' + r.reference + '</span>';
            html += '  <span class="col-issue">' + r.issue + '</span>';
            html += '  <span class="col-category">' + r.category + '</span>';
            html += '  <span class="col-location">' + r.location + '</span>';
            html += '  <span class="col-priority"><span class="' + priorityClass + '">' + r.priority + '</span></span>';
            html += '  <span class="col-date">' + date + '</span>';
            html += '  <span class="col-action">';
            html += '    <div class="action-buttons">';
            html += '      <button class="btn-approve" action="quickApproveReport: ' + r.id + '" title="Approve">✓</button>';
            html += '      <button class="btn-reject" action="openRejectPopup: ' + r.id + '" title="Reject">✗</button>';
            html += '      <button class="btn-delete" action="confirmDeleteReportRow: ' + r.id + '" title="Delete"><i class="fas fa-trash"></i></button>';
            html += '    </div>';
            html += '  </span>';
            html += '</div>';
        }
        context.render('#reports-body', html);
    }
    
    var prevBtn = context.query('#reports-prev');
    var nextBtn = context.query('#reports-next');
    var label = context.query('#reports-page-label');
    
    if (prevBtn.exists) prevBtn.element.disabled = currentPage === 0;
    if (nextBtn.exists) nextBtn.element.disabled = currentPage >= totalPages - 1;
    if (label.exists) label.text('Page ' + (currentPage + 1) + ' of ' + totalPages);
}

// ===== PAGINATION =====
function reportsPrev(context) {
    if (app.memory.reportsPage > 0) {
        app.memory.reportsPage--;
        renderReportsSlice(context);
    }
}

function reportsNext(context) {
    var filtered = app.memory.filteredReports || [];
    var totalPages = Math.ceil(filtered.length / REPORT_PAGE_SIZE);
    if (app.memory.reportsPage < totalPages - 1) {
        app.memory.reportsPage++;
        renderReportsSlice(context);
    }
}

// ===== REPORT ACTIONS =====
function quickApproveReport(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;

    // requestConfirm/runPendingConfirm live in app.js — a popup-based
    // confirm is used instead of window.confirm() because Chrome silently
    // auto-suppresses confirm() after a page has shown a few in a session,
    // which made Approve/Reject look like dead buttons with no feedback.
    requestConfirm(context, 'Approve this report and create a work order?', 'Approve Report', function() {
        // create_work_order.php only marks the report "approved" once it
        // finds a staff member with a matching skill and actually creates
        // the work order — calling it directly (instead of flipping status
        // first) means a report with no skill match just stays "pending"
        // and visible in the queue, instead of vanishing into an orphaned
        // "approved" limbo state.
        app.php('api/create_work_order.php', { report_id: reportId })
            .then(function(woData) {
                if (woData.ok) {
                    showNotificationToast(context, 'Report approved and work order created!', 'success');
                    refreshAllData(context);
                } else {
                    showNotificationToast(context, (woData && woData.data) || 'No matching staff available — report stays pending', 'error');
                }
            });
    }, 'approve', 'fa-check');
}

function openRejectPopup(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;

    requestConfirm(context, 'Reject this report? This cannot be undone.', 'Reject Report', function() {
        app.php('api/update_report_status.php', { id: reportId, status: 'rejected' })
            .then(function(data) {
                if (data.ok) {
                    showNotificationToast(context, 'Report rejected', 'success');
                    app.php('api/delete_report.php', { id: reportId })
                        .then(function() {
                            refreshAllData(context);
                        });
                } else {
                    showNotificationToast(context, 'Failed to reject report', 'error');
                }
            });
    }, 'reject', 'fa-xmark');
}

// Note: openReportPopup/buildReportDetailPopup and goToNewReport live in
// app.js — this file used to shadow both with dead placeholders (a toast
// and a link to a page that doesn't exist) since it loads after app.js.

function confirmDeleteReportRow(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;

    requestConfirm(context, 'Delete this report? This cannot be undone.', 'Delete Report', function() {
        app.php('api/delete_report.php', { id: reportId }).then(function(result) {
            if (!result.ok) {
                showNotificationToast(context, (result && result.data) || 'Failed to delete report', 'error');
                return;
            }
            showNotificationToast(context, 'Report deleted', 'success');
            refreshAllData(context);
        });
    }, 'reject', 'fa-trash');
}

// ===== EXPOSE =====
window.loadReportsPage = loadReportsPage;
window.reportsPrev = reportsPrev;
window.reportsNext = reportsNext;
window.quickApproveReport = quickApproveReport;
window.openRejectPopup = openRejectPopup;
window.confirmDeleteReportRow = confirmDeleteReportRow;