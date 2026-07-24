// ========================================
// SYSTEM LOGS MODULE
// ========================================

var LOG_PAGE_SIZE = 15;

app.memory.logs = [];
app.memory.filteredLogs = [];
app.memory.logsPage = 0;

function formatLogTime(isoString) {
    if (!isoString) return '';
    var d = new Date(isoString.replace(' ', 'T'));
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function actionBadgeClass(action) {
    if (action.indexOf('deleted') !== -1 || action.indexOf('rejected') !== -1 || action === 'logout') {
        return 'action-badge action-delete';
    }
    if (action.indexOf('created') !== -1 || action === 'login') {
        return 'action-badge action-create';
    }
    return 'action-badge';
}

function loadLogsPage(context) {
    context.render('#logs-body', '<p class="loading-text">Loading logs...</p>');

    app.php('api/get_audit_log.php', {})
        .then(function(result) {
            if (handleAuthFailure(result)) return;
            if (!result.ok) {
                context.render('#logs-body', '<p class="empty-state">Failed to load logs.</p>');
                return;
            }
            app.memory.logs = result.data.logs || [];
            populateLogActionFilter(context);
            applyLogFilters(context);
        })
        .catch(function(error) {
            console.error('Failed to load logs:', error);
            context.render('#logs-body', '<p class="empty-state">Failed to load logs. Please try again.</p>');
        });
}

function populateLogActionFilter(context) {
    var select = context.query('#log-filter-action');
    if (!select.exists) return;

    var actions = [];
    app.memory.logs.forEach(function(log) {
        if (actions.indexOf(log.action) === -1) actions.push(log.action);
    });
    actions.sort();

    var html = '<option value="all">All</option>';
    for (var i = 0; i < actions.length; i++) {
        html += '<option value="' + actions[i] + '">' + actions[i] + '</option>';
    }
    select.element.innerHTML = html;
}

function applyLogFilters(context) {
    var allLogs = app.memory.logs || [];

    var actionEl = context.query('#log-filter-action');
    var fromEl = context.query('#log-filter-from');
    var toEl = context.query('#log-filter-to');
    var searchEl = context.query('#log-search');

    var action = actionEl.exists ? actionEl.element.value : 'all';
    var from = fromEl.exists ? fromEl.element.value : '';
    var to = toEl.exists ? toEl.element.value : '';
    var search = searchEl.exists ? searchEl.element.value.toLowerCase().trim() : '';

    app.memory.filteredLogs = allLogs.filter(function(log) {
        if (action !== 'all' && log.action !== action) return false;
        var logDate = (log.created_at || '').slice(0, 10);
        if (from && logDate < from) return false;
        if (to && logDate > to) return false;
        if (search) {
            var haystack = (
                (log.actor_name || '') + ' ' +
                (log.entity_reference || '') + ' ' +
                (log.entity_type || '') + ' ' +
                (log.description || '')
            ).toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    app.memory.logsPage = 0;
    renderLogsSlice(context);
}

function renderLogsSlice(context) {
    var filtered = app.memory.filteredLogs || [];
    var currentPage = app.memory.logsPage || 0;
    var start = currentPage * LOG_PAGE_SIZE;
    var end = Math.min(start + LOG_PAGE_SIZE, filtered.length);
    var slice = filtered.slice(start, end);
    var totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));

    context.query('#log-count').text(filtered.length + ' records');

    if (slice.length === 0) {
        context.render('#logs-body', '<p class="empty-state">No log entries found.</p>');
    } else {
        var html = '';
        for (var i = 0; i < slice.length; i++) {
            var log = slice[i];
            var entity = log.entity_reference || (log.entity_type ? (log.entity_type + ' #' + log.entity_id) : '—');
            html += '<div class="log-row">';
            html += '  <span class="col-time">' + formatLogTime(log.created_at) + '</span>';
            html += '  <span class="col-actor">' + escapeHtml(log.actor_name) + '</span>';
            html += '  <span class="col-role">' + (log.actor_role ? '<span class="role-badge">' + escapeHtml(log.actor_role) + '</span>' : '') + '</span>';
            html += '  <span class="col-action"><span class="' + actionBadgeClass(log.action) + '">' + escapeHtml(log.action) + '</span></span>';
            html += '  <span class="col-entity">' + escapeHtml(entity) + '</span>';
            html += '  <span class="col-description">' + escapeHtml(log.description) + '</span>';
            html += '</div>';
        }
        context.render('#logs-body', html);
    }

    var prevBtn = context.query('#logs-prev');
    var nextBtn = context.query('#logs-next');
    if (prevBtn.exists) prevBtn.element.disabled = currentPage <= 0;
    if (nextBtn.exists) nextBtn.element.disabled = currentPage >= totalPages - 1;

    context.query('#logs-page-label').text('Page ' + (currentPage + 1) + ' of ' + totalPages);
}

function logsPrev(context) {
    if (app.memory.logsPage > 0) {
        app.memory.logsPage -= 1;
        renderLogsSlice(context);
    }
}

function logsNext(context) {
    var filtered = app.memory.filteredLogs || [];
    var totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
    if (app.memory.logsPage < totalPages - 1) {
        app.memory.logsPage += 1;
        renderLogsSlice(context);
    }
}

// ===== EXPOSE =====
window.loadLogsPage = loadLogsPage;
window.applyLogFilters = applyLogFilters;
window.logsPrev = logsPrev;
window.logsNext = logsNext;
