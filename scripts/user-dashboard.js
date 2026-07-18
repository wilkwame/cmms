// ========================================
// USER DASHBOARD MODULE (reporter role)
// ========================================

function loadUserHomePage(context) {
    var userName = app.memory.user ? app.memory.user.name : 'User';
    context.query('#uh-user-name').text(userName);

    context.render('#uh-reports-body', '<p class="loading-text">Loading your reports...</p>');

    app.php('api/get_reports.php', {}).then(function(result) {
        if (!result.ok) {
            context.render('#uh-reports-body', '<p class="empty-state"><i class="fas fa-triangle-exclamation"></i>Failed to load your reports.</p>');
            return;
        }

        var reports = result.data.reports || [];
        context.query('#uh-report-count').text(reports.length + (reports.length === 1 ? ' record' : ' records'));
        renderUserStats(context, reports);

        if (reports.length === 0) {
            context.render('#uh-reports-body', buildEmptyReportsState());
            return;
        }

        var html = '';
        for (var i = 0; i < reports.length; i++) {
            html += buildMyReportCard(reports[i]);
        }
        context.render('#uh-reports-body', html);
    });
}

function renderUserStats(context, reports) {
    var open = 0, inProgress = 0, resolved = 0;
    reports.forEach(function(r) {
        if (r.status === 'pending') open++;
        else if (r.status === 'approved') inProgress++;
        else if (r.status === 'rejected' || r.status === 'closed') resolved++;
    });

    var html =
        '<div class="uh-stat"><span class="uh-stat-count">' + reports.length + '</span><span class="uh-stat-label">Total</span></div>' +
        '<div class="uh-stat uh-stat-pending"><span class="uh-stat-count">' + open + '</span><span class="uh-stat-label">Awaiting Assignment</span></div>' +
        '<div class="uh-stat uh-stat-progress"><span class="uh-stat-count">' + inProgress + '</span><span class="uh-stat-label">Assigned</span></div>' +
        '<div class="uh-stat uh-stat-done"><span class="uh-stat-count">' + resolved + '</span><span class="uh-stat-label">Closed</span></div>';

    context.render('#uh-stats', html);
}

function buildEmptyReportsState() {
    return '<div class="empty-state uh-empty">' +
        '<i class="fas fa-clipboard-check"></i>' +
        '<p>You haven\'t submitted any reports yet.</p>' +
        '<button class="uh-empty-btn" action="goToReportIssue"><i class="fas fa-plus"></i> Report an issue</button>' +
        '</div>';
}

function buildMyReportCard(r) {
    var assignee = r.assigned_to
        ? '<span class="mrc-tag"><i class="fas fa-user-cog"></i> ' + escapeHtml(r.assigned_to) + '</span>'
        : '<span class="mrc-tag mrc-tag-muted"><i class="fas fa-hourglass-half"></i> Awaiting assignment</span>';

    return '<div class="mrc-card" action="openMyReportPopup: ' + r.id + '">' +
        '  <div class="mrc-top">' +
        '    <span class="mrc-ref">' + escapeHtml(r.reference) + '</span>' +
        '    <span class="' + getStatusClass(r.status) + '">' + statusLabel(r.status) + '</span>' +
        '  </div>' +
        '  <h4 class="mrc-issue">' + escapeHtml(r.issue) + '</h4>' +
        '  <div class="mrc-meta">' +
        assignee +
        '    <span class="mrc-tag"><i class="fas fa-calendar"></i> ' + formatDate(r.submitted_at) + '</span>' +
        '    <span class="' + getPriorityClass(r.priority) + '">' + priorityLabel(r.priority) + '</span>' +
        '  </div>' +
        '  <i class="fas fa-chevron-right mrc-chevron"></i>' +
        '</div>';
}

function goToReportIssue(context) {
    context.navigate('report-issue');
}

function openMyReportPopup(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;

    openPopup(context, '<div class="popup-content"><p class="loading-text">Loading report...</p></div>');

    app.php('api/get_report_timeline.php', { report_id: reportId }).then(function(result) {
        if (!result.ok) {
            openPopup(context, '<div class="popup-content"><p class="empty-state">Failed to load report.</p></div>');
            return;
        }
        openPopup(context, buildMyReportTimelinePopup(result.data));
    });
}

function buildMyReportTimelinePopup(data) {
    var report = data.report;
    var photos = data.photos || [];
    var timeline = data.timeline || [];

    var photosHtml = '';
    if (photos.length > 0) {
        photosHtml = '<div class="popup-field"><label><i class="fas fa-images"></i> Photos</label><div class="photo-previews">';
        photos.forEach(function(url) {
            photosHtml += '<div class="photo-thumb"><img src="' + url + '" alt="Report photo" /></div>';
        });
        photosHtml += '</div></div>';
    }

    var timelineHtml = '<div class="popup-field"><label><i class="fas fa-stream"></i> Progress</label><div class="timeline">';
    timeline.forEach(function(step) {
        timelineHtml += '<div class="timeline-step">' +
            '<div class="timeline-dot"></div>' +
            '<div class="timeline-body">' +
            '<div class="timeline-label">' + escapeHtml(step.label) + '</div>' +
            '<div class="timeline-time">' + formatDateTime(step.timestamp) + '</div>' +
            (step.note ? '<div class="timeline-note">' + escapeHtml(step.note) + '</div>' : '') +
            '</div></div>';
    });
    timelineHtml += '</div></div>';

    return '<div class="popup-content">' +
        '<div class="popup-header">' +
        '  <h3><i class="fas fa-file-alt"></i> ' + escapeHtml(report.reference) + '</h3>' +
        '  <button class="popup-close" action="closePopup"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="popup-body">' +
        '  <div class="popup-field"><label><i class="fas fa-exclamation-circle"></i> Issue</label><p>' + escapeHtml(report.issue) + '</p></div>' +
        '  <div class="popup-field"><label><i class="fas fa-align-left"></i> Description</label><p>' + escapeHtml(report.description || 'No description provided') + '</p></div>' +
        '  <div class="popup-row">' +
        '    <div class="popup-field"><label><i class="fas fa-tag"></i> Category</label><p>' + escapeHtml(report.category) + '</p></div>' +
        '    <div class="popup-field"><label><i class="fas fa-map-marker-alt"></i> Location</label><p>' + escapeHtml(report.location) + '</p></div>' +
        '  </div>' +
        '  <div class="popup-row">' +
        '    <div class="popup-field"><label><i class="fas fa-flag"></i> Priority</label><p><span class="' + getPriorityClass(report.priority) + '">' + priorityLabel(report.priority) + '</span></p></div>' +
        '    <div class="popup-field"><label><i class="fas fa-circle"></i> Status</label><p><span class="' + getStatusClass(report.status) + '">' + statusLabel(report.status) + '</span></p></div>' +
        '  </div>' +
        photosHtml +
        timelineHtml +
        '</div>' +
        '<div class="popup-footer">' +
        '  <button class="popup-btn secondary" action="closePopup"><i class="fas fa-times"></i> Close</button>' +
        '</div>' +
        '</div>';
}

window.loadUserHomePage = loadUserHomePage;
window.goToReportIssue = goToReportIssue;
window.openMyReportPopup = openMyReportPopup;
