// ========================================
// CMMS - Core Application Logic
// ========================================

// ===== GLOBAL STATE (defaults; checkAuth() below fills in user/token if a session exists) =====
app.memory = {
    reports: [],
    filteredReports: [],
    staffWorkload: [],
    dashboardStats: null,
    notifications: [],
    user: null,
    token: null,
    reportsPage: 0,
    staffPage: 0,
    currentReportId: null,
    currentWorkOrderId: null
};


// Initialize staff array if not exists
if (!app.memory.staff) {
    app.memory.staff = [];
}
if (!app.memory.filteredStaff) {
    app.memory.filteredStaff = [];
}


const REPORT_PAGE_SIZE = 10;

// ===== CHECK LOGIN STATUS =====
function checkAuth() {
    // Check localStorage first
    var storedUser = localStorage.getItem('cmms_user');
    var storedToken = localStorage.getItem('cmms_token');

    if (storedUser && storedToken) {
        try {
            app.memory.user = JSON.parse(storedUser);
            app.memory.token = storedToken;
            return true;
        } catch (e) {
            return false;
        }
    }

    // Check session storage
    var sessionUser = sessionStorage.getItem('cmms_user');
    var sessionToken = sessionStorage.getItem('cmms_token');

    if (sessionUser && sessionToken) {
        try {
            app.memory.user = JSON.parse(sessionUser);
            app.memory.token = sessionToken;
            return true;
        } catch (e) {
            return false;
        }
    }

    return false;
}

// ===== APP CONFIGURATION =====
// This document only ever loads for an authenticated user — the inline guard
// script at the top of index.html's <head> redirects to login.html before
// this even runs otherwise. So we always boot straight to the dashboard.
checkAuth();

// ===== ROLE-BASED NAV VISIBILITY =====
// Server-side endpoints are the real enforcement (api/_auth.php); this only
// hides nav entries the current role can't use, and keeps reporters on
// their own landing page instead of the staff/admin dashboard.
function applyRoleVisibility() {
    var role = app.memory.user ? app.memory.user.role : null;

    // Applies to <tab> nav entries and any other element opting in via
    // data-roles (e.g. the Staff Workload dashboard panel, which shouldn't
    // render for anyone but admin — staff directory visibility is admin-only).
    document.querySelectorAll('[data-roles]').forEach(function(el) {
        var allowed = el.getAttribute('data-roles').split(',');
        el.style.display = (role && allowed.indexOf(role) !== -1) ? '' : 'none';
    });

    var roleLabel = document.getElementById('sidebar-user-role');
    if (roleLabel && role) {
        roleLabel.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    }
}

// Runs at boot (not just inside loadHomePage, which never fires for
// reporters since their landing page is user-home) so the sidebar shows
// the real name for every role, not the "User" placeholder.
function renderSidebarUserName() {
    var el = document.getElementById('sidebar-user-name');
    if (!el || !app.memory.user || !app.memory.user.name) return;
    el.textContent = app.memory.user.name.trim().split(/\s+/)[0];
}

// ===== PROFILE PHOTO =====
// Updates every avatar_img/avatar_icon pair on the page (sidebar + any
// decorative header widgets) — not just one — so a photo upload or fresh
// boot reflects everywhere at once. Inline styles are used alongside the
// CSS class toggle so this still works correctly even if a browser is
// holding a stale cached copy of main.css.
function renderSidebarAvatar() {
    var url = app.memory.user ? app.memory.user.avatar_url : null;

    document.querySelectorAll('.avatar-img').forEach(function(img) {
        if (url) {
            img.src = url;
            img.classList.remove('hidden');
            img.style.display = '';
        } else {
            img.classList.add('hidden');
            img.style.display = 'none';
        }
    });

    document.querySelectorAll('.avatar-icon').forEach(function(icon) {
        if (url) {
            icon.classList.add('hidden');
            icon.style.display = 'none';
        } else {
            icon.classList.remove('hidden');
            icon.style.display = '';
        }
    });
}

function triggerAvatarUpload() {
    var input = document.getElementById('avatar-file-input');
    if (input) input.click();
}

function wireAvatarUpload() {
    var input = document.getElementById('avatar-file-input');
    if (!input || input.dataset.wired === '1') return;
    input.dataset.wired = '1';

    input.addEventListener('change', async function() {
        var file = input.files && input.files[0];
        input.value = '';
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert('Please choose a JPEG, PNG or WEBP image.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Photo must be under 2MB.');
            return;
        }

        var formData = new FormData();
        formData.append('avatar', file);

        try {
            var response = await fetch('api/upload_avatar.php', { method: 'POST', body: formData });
            var result = await response.json();

            if (!result.ok) {
                alert('Failed to upload photo: ' + (result.data || 'Unknown error'));
                return;
            }

            app.memory.user.avatar_url = result.data.avatar_url;
            var store = localStorage.getItem('cmms_user') ? localStorage : sessionStorage;
            store.setItem('cmms_user', JSON.stringify(app.memory.user));
            renderSidebarAvatar();
        } catch (e) {
            alert('Network error while uploading photo.');
        }
    });
}

applyRoleVisibility();
startNotificationPolling();
renderSidebarAvatar();
wireAvatarUpload();
renderSidebarUserName();

app.config({
    persistPage: true,
    accessibility: true,
    dev: true,
});

app.start({
    initial: app.memory.user && app.memory.user.role === 'reporter' ? 'user-home' : 'home',
    dev: true,
    php: {
        // Deliberately empty: the app can be deployed at the domain root or
        // under a subdirectory (e.g. XAMPP's /CMMS/), so every call site uses
        // a path relative to the current page ("api/x.php", never "/api/x.php")
        // and lets the browser resolve it correctly either way.
        baseUrl: "",
        timeout: 10000
    }
});

// ===== LOGOUT =====
// Defensive on purpose: logout is too important to risk breaking silently
// if the popup system has an issue we haven't caught. If the styled popup
// doesn't actually appear for any reason, fall back to a plain confirm()
// that always works, rather than leaving the user stuck with no way out.
function logoutUser(context) {
    closeMobileMenu(context);

    try {
        openPopup(context,
            '<div class="popup-content">' +
            '  <div class="popup-header">' +
            '    <h3><i class="fas fa-sign-out-alt"></i> Log out?</h3>' +
            '    <button class="popup-close" action="closePopup"><i class="fas fa-times"></i></button>' +
            '  </div>' +
            '  <div class="popup-body">' +
            '    <p>Are you sure you want to log out of your account?</p>' +
            '  </div>' +
            '  <div class="popup-footer">' +
            '    <button class="popup-btn secondary" action="closePopup">Cancel</button>' +
            '    <button class="popup-btn reject" action="performLogout"><i class="fas fa-sign-out-alt"></i> Log Out</button>' +
            '  </div>' +
            '</div>'
        );

        var overlay = document.getElementById('popup-overlay');
        if (!overlay || !overlay.classList.contains('active')) {
            throw new Error('Popup did not open');
        }
    } catch (e) {
        console.error('Logout popup failed, falling back to confirm():', e);
        if (confirm('Are you sure you want to log out?')) {
            performLogout();
        }
    }
}

// Real navigation to the standalone login page, not an in-app page switch.
function performLogout() {
    localStorage.removeItem('cmms_user');
    localStorage.removeItem('cmms_token');
    sessionStorage.removeItem('cmms_user');
    sessionStorage.removeItem('cmms_token');
    localStorage.removeItem('CLERA_ACTIVE_PAGE');

    window.location.href = 'login.html';
}

// If the server says the session is gone (expired, or the account was
// deleted/deactivated after this browser tab logged in), stop showing a
// generic "failed to load" and send the user back to login instead.
function handleAuthFailure(result) {
    if (result && result.status === 401) {
        localStorage.removeItem('cmms_user');
        localStorage.removeItem('cmms_token');
        sessionStorage.removeItem('cmms_user');
        sessionStorage.removeItem('cmms_token');
        localStorage.removeItem('CLERA_ACTIVE_PAGE');
        window.location.href = 'login.html';
        return true;
    }
    return false;
}

// ===== EXPOSE AUTH FUNCTIONS =====
window.checkAuth = checkAuth;
window.performLogout = performLogout;
window.handleAuthFailure = handleAuthFailure;
window.triggerAvatarUpload = triggerAvatarUpload;
window.logoutUser = logoutUser;

// ========================================
// UTILITY FUNCTIONS
// ========================================

function formatDate(rawTimestamp) {
    if (!rawTimestamp) return '-';
    try {
        var date = new Date(rawTimestamp);
        var day = String(date.getDate()).padStart(2, '0');
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var year = date.getFullYear();
        return day + '-' + month + '-' + year;
    } catch (e) {
        return rawTimestamp;
    }
}

function formatDateTime(rawTimestamp) {
    if (!rawTimestamp) return '-';
    try {
        var date = new Date(rawTimestamp);
        var day = String(date.getDate()).padStart(2, '0');
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var year = date.getFullYear();
        var hours = String(date.getHours()).padStart(2, '0');
        var minutes = String(date.getMinutes()).padStart(2, '0');
        return day + '-' + month + '-' + year + ' ' + hours + ':' + minutes;
    } catch (e) {
        return rawTimestamp;
    }
}

function formatTime(rawTimestamp) {
    if (!rawTimestamp) return '';
    try {
        var date = new Date(rawTimestamp);
        var hours = String(date.getHours()).padStart(2, '0');
        var minutes = String(date.getMinutes()).padStart(2, '0');
        return hours + ':' + minutes;
    } catch (e) {
        return '';
    }
}

function getCurrentDate() {
    var now = new Date();
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return now.toLocaleDateString('en-US', options);
}

function getTimeOfDay() {
    var hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

function getGreeting() {
    var timeOfDay = getTimeOfDay();
    var greetings = {
        morning: 'Good morning',
        afternoon: 'Good afternoon',
        evening: 'Good evening'
    };
    return greetings[timeOfDay] || 'Hello';
}

function statusLabel(status) {
    var map = {
        pending: 'Pending',
        approved: 'Approved',
        rejected: 'Rejected',
        in_progress: 'In Progress',
        completed: 'Completed',
        overdue: 'Overdue',
        cancelled: 'Cancelled'
    };
    return map[status] || status;
}

function priorityLabel(priority) {
    var map = {
        urgent: 'Urgent',
        high: 'High',
        medium: 'Medium',
        low: 'Low'
    };
    return map[priority] || priority;
}

function getTimeAgo(timestamp) {
    var now = Date.now();
    var diff = now - timestamp;

    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + 'm ago';

    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';

    var days = Math.floor(hours / 24);
    if (days < 7) return days + 'd ago';

    return Math.floor(days / 7) + 'w ago';
}

function getStatusClass(status) {
    var map = {
        pending: 'status-badge pending',
        approved: 'status-badge approved',
        rejected: 'status-badge rejected',
        in_progress: 'status-badge in_progress',
        completed: 'status-badge completed',
        overdue: 'status-badge overdue',
        cancelled: 'status-badge cancelled'
    };
    return map[status] || '';
}

function getPriorityClass(priority) {
    var map = {
        urgent: 'priority-badge urgent',
        high: 'priority-badge high',
        medium: 'priority-badge medium',
        low: 'priority-badge low'
    };
    return map[priority] || '';
}

// Escapes free-text user input (report issue/description, notes) before
// it's concatenated into innerHTML.
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

function getStaffStatusClass(isActive) {
    return isActive == 1 ? 'status-badge active' : 'status-badge inactive';
}

function getStaffStatusLabel(isActive) {
    return isActive == 1 ? 'Active' : 'Inactive';
}

// The notifications table's `type` column is always "report" (see
// get_notifications.php), so icon variety is derived from the title text
// instead — every title in this app is one of a known fixed set.
function getNotificationIcon(title) {
    var t = (title || '').toLowerCase();
    if (t.indexOf('assigned') !== -1) return { icon: 'fa-user-cog', tone: 'assigned' };
    if (t.indexOf('submitted') !== -1) return { icon: 'fa-paper-plane', tone: 'submitted' };
    if (t.indexOf('reject') !== -1 || t.indexOf('overdue') !== -1) return { icon: 'fa-triangle-exclamation', tone: 'alert' };
    if (t.indexOf('resolved') !== -1 || t.indexOf('completed') !== -1 || t.indexOf('approved') !== -1) return { icon: 'fa-circle-check', tone: 'success' };
    if (t.indexOf('created') !== -1) return { icon: 'fa-clipboard-list', tone: 'submitted' };
    return { icon: 'fa-bell', tone: 'default' };
}

// ========================================
// MOBILE MENU FUNCTIONS
// ========================================

function toggleMobileMenu(context) {
    var nav = document.getElementById('left-nav');
    var overlay = document.getElementById('mobile-overlay');

    if (nav) {
        nav.classList.toggle('open');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

function closeMobileMenu(context) {
    var nav = document.getElementById('left-nav');
    var overlay = document.getElementById('mobile-overlay');

    if (nav) {
        nav.classList.remove('open');
    }
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// ========================================
// NOTIFICATION FUNCTIONS
// ========================================

function toggleNotifications(context) {
    var popup = context.query('#notification-popup');
    if (!popup.exists) return;

    if (popup.element.classList.contains('active')) {
        popup.element.classList.remove('active');
        return;
    }

    if (!app.memory.notifications || app.memory.notifications.length === 0) {
        loadNotifications(context);
    } else {
        renderNotifications(context);
    }

    popup.element.classList.add('active');
}

function loadNotifications(context) {
    var list = context.query('#notification-list');
    if (list.exists && (!app.memory.notifications || app.memory.notifications.length === 0)) {
        list.html('<div class="notification-item">Loading notifications...</div>');
    }

    app.php('api/get_notifications.php', {}).then(function(data) {
        if (data.ok && data.data && data.data.notifications) {
            app.memory.notifications = data.data.notifications;
        } else {
            app.memory.notifications = [];
        }
        renderNotifications(context);
        updateNotificationBadge(context);
    });
}

// Minimal context-like shim for use outside a page's onshow lifecycle
// (e.g. background polling), matching the subset of context.query()'s
// interface that loadNotifications()/renderNotifications() rely on.
function domContext() {
    return {
        query: function(selector) {
            var element = document.querySelector(selector);
            return {
                exists: !!element,
                element: element,
                text: function(value) { if (element) element.textContent = value; },
                html: function(value) { if (element) element.innerHTML = value; }
            };
        }
    };
}

// Polls for new notifications every 30s so the bell badge stays current
// without the user having to open the panel. Respects the Settings page's
// Notifications toggle (localStorage.cmms_notifications).
function startNotificationPolling() {
    if (app.memory.notificationPollStarted) return;
    app.memory.notificationPollStarted = true;
    setInterval(function() {
        if (localStorage.getItem('cmms_notifications') === 'false') return;
        loadNotifications(domContext());
    }, 30000);
}

function renderNotifications(context) {
    var list = context.query('#notification-list');
    if (!list.exists) return;

    var notifs = app.memory.notifications || [];

    if (notifs.length === 0) {
        list.html('<div class="empty-notifications"><i class="fas fa-bell-slash"></i>No notifications</div>');
        return;
    }

    var html = '';
    for (var i = 0; i < notifs.length; i++) {
        var n = notifs[i];
        var unreadClass = n.read ? '' : 'unread';
        var timeAgo = getTimeAgo(n.time);
        var iconInfo = getNotificationIcon(n.title);

        html += '<div class="notification-item ' + unreadClass + '" action="markNotificationRead: ' + n.id + '">';
        html += '  <div class="notif-icon notif-icon-' + iconInfo.tone + '"><i class="fas ' + iconInfo.icon + '"></i></div>';
        html += '  <div class="notif-content">';
        html += '    <div class="notif-title">' + escapeHtml(n.title) + '</div>';
        html += '    <div class="notif-body">' + escapeHtml(n.body) + '</div>';
        html += '    <div class="notif-time">' + timeAgo + '</div>';
        html += '  </div>';
        html += '</div>';
    }

    list.html(html);
}

// Notifications don't carry a specific report/work-order id (see
// get_notifications.php), so clicking one marks it read and takes the
// user to the page where they'd actually find it, based on their role.
function notificationTargetPage() {
    var role = app.memory.user ? app.memory.user.role : null;
    if (role === 'reporter') return 'user-home';
    if (role === 'technician') return 'workorders';
    return 'reports';
}

function markNotificationRead(context) {
    var notifId = parseInt(context.arg);
    if (!notifId) return;

    for (var i = 0; i < app.memory.notifications.length; i++) {
        if (app.memory.notifications[i].id === notifId) {
            app.memory.notifications[i].read = true;
            break;
        }
    }

    renderNotifications(context);
    updateNotificationBadge(context);
    context.fetch('api/mark_notification_read.php', { method: 'POST', body: { id: notifId } }, function() {});

    var popup = context.query('#notification-popup');
    if (popup.exists) popup.element.classList.remove('active');
    closeMobileMenu(context);
    context.navigate(notificationTargetPage());
}

function markAllNotificationsRead(context) {
    for (var i = 0; i < app.memory.notifications.length; i++) {
        app.memory.notifications[i].read = true;
    }

    renderNotifications(context);
    updateNotificationBadge(context);
    context.fetch('api/mark_notification_read.php', { method: 'POST', body: {} }, function() {});
    showNotificationToast(context, 'All notifications marked as read', 'success');
}

function updateNotificationBadge(context) {
    var badge = context.query('#notification-badge');
    if (!badge.exists) return;

    var unreadCount = 0;
    var notifs = app.memory.notifications || [];
    for (var i = 0; i < notifs.length; i++) {
        if (!notifs[i].read) unreadCount++;
    }

    if (unreadCount > 0) {
        badge.text(unreadCount);
        badge.element.classList.remove('hidden');
    } else {
        badge.element.classList.add('hidden');
    }
}

function showNotificationToast(context, message, type) {
    var toast = context.query('#notification-popup');
    if (toast.exists) {
        toast.text(message);
        toast.element.className = 'notification-toast ' + (type || 'success');
        toast.element.style.display = 'block';
        var borderColor = type === 'error' ? '#ff3b30' : type === 'warning' ? '#ff9500' : '#34c759';
        toast.element.style.borderLeft = '4px solid ' + borderColor;

        context.timeout(function() {
            toast.element.style.display = 'none';
        }, 3000);
    }
}

// ========================================
// POPUP FUNCTIONS
// ========================================

function openPopup(context, html) {
    var overlay = context.query('#popup-overlay');
    var dialog = context.query('#popup-dialog');

    if (!overlay.exists || !dialog.exists) return;

    dialog.html(html);
    overlay.element.classList.add('active');
}

function closePopup(context) {
    var overlay = context.query('#popup-overlay');
    var dialog = context.query('#popup-dialog');

    if (!overlay.exists || !dialog.exists) return;

    overlay.element.classList.remove('active');
    dialog.html('');
}

// ========================================
// REPORT POPUP FUNCTIONS
// ========================================

function openReportPopup(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;

    var report = null;
    var reports = app.memory.reports || [];
    for (var i = 0; i < reports.length; i++) {
        if (reports[i].id === reportId) {
            report = reports[i];
            break;
        }
    }

    if (!report) {
        showNotificationToast(context, 'Report not found', 'error');
        return;
    }

    var html = buildReportDetailPopup(report);
    openPopup(context, html);
}

function buildReportDetailPopup(report) {
    var date = formatDateTime(report.submitted_at);
    var priorityClass = getPriorityClass(report.priority);
    var statusClass = getStatusClass(report.status);
    var photosHtml = buildPhotosHtml(report);

    return '<div class="popup-content">' +
        '<div class="popup-header">' +
        '  <h3><i class="fas fa-file-alt"></i> ' + report.reference + '</h3>' +
        '  <button class="popup-close" action="closePopup"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="popup-body">' +
        '  <div class="popup-field">' +
        '    <label><i class="fas fa-exclamation-circle"></i> Issue</label>' +
        '    <p>' + report.issue + '</p>' +
        '  </div>' +
        '  <div class="popup-field">' +
        '    <label><i class="fas fa-align-left"></i> Description</label>' +
        '    <p>' + (report.description || 'No description provided') + '</p>' +
        '  </div>' +
        '  <div class="popup-row">' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-tag"></i> Category</label>' +
        '      <p>' + report.category + '</p>' +
        '    </div>' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-map-marker-alt"></i> Location</label>' +
        '      <p>' + report.location + '</p>' +
        '    </div>' +
        '  </div>' +
        '  <div class="popup-row">' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-flag"></i> Priority</label>' +
        '      <p><span class="' + priorityClass + '">' + report.priority + '</span></p>' +
        '    </div>' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-circle"></i> Status</label>' +
        '      <p><span class="' + statusClass + '">' + statusLabel(report.status) + '</span></p>' +
        '    </div>' +
        '  </div>' +
        '  <div class="popup-field">' +
        '    <label><i class="fas fa-calendar-alt"></i> Submitted</label>' +
        '    <p>' + date + '</p>' +
        '  </div>' +
        photosHtml +
        '</div>' +
        '<div class="popup-footer">' +
        '  <button class="popup-btn secondary" action="closePopup"><i class="fas fa-times"></i> Close</button>' +
        (report.status === 'pending' ?
            '<button class="popup-btn approve" action="approveReportFromPopup: ' + report.id + '"><i class="fas fa-check"></i> Approve</button>' +
            '<button class="popup-btn reject" action="rejectReportFromPopup: ' + report.id + '"><i class="fas fa-times"></i> Reject</button>' : '') +
        '</div>' +
        '</div>';
}

function approveReportFromPopup(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;
    closePopup(context);
    quickApproveReport(context);
}

function rejectReportFromPopup(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;
    closePopup(context);
    openRejectPopup(context);
}

// ========================================
// WORK ORDER POPUP FUNCTIONS
// ========================================

function openWorkOrderPopup(context) {
    var orderId = parseInt(context.arg);
    if (!orderId) return;

    var order = null;
    var orders = app.memory.workOrders || [];
    for (var i = 0; i < orders.length; i++) {
        if (orders[i].id === orderId) {
            order = orders[i];
            break;
        }
    }

    if (!order) {
        showNotificationToast(context, 'Work order not found', 'error');
        return;
    }

    var html = buildWorkOrderDetailPopup(order);
    openPopup(context, html);
}

function buildPhotosHtml(item) {
    if (!item.photo_urls) return '';
    var urls = item.photo_urls.split(',').filter(Boolean);
    if (urls.length === 0) return '';

    var thumbs = urls.map(function(url) {
        return '<a href="' + encodeURI(url) + '" target="_blank" rel="noopener" style="display:inline-block;margin:0 8px 8px 0;">' +
            '<img src="' + encodeURI(url) + '" alt="Report photo" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid #dfe3e8;" />' +
            '</a>';
    }).join('');

    return '<div class="popup-field">' +
        '  <label><i class="fas fa-camera"></i> Photos</label>' +
        '  <div>' + thumbs + '</div>' +
        '</div>';
}

function buildWorkOrderDetailPopup(order, reassignPanelHtml) {
    var dueDate = formatDate(order.due_date);
    var priorityClass = getPriorityClass(order.priority);
    var statusClass = getStatusClass(order.status);
    var assignedTo = order.assigned_to || 'Unassigned';
    var photosHtml = buildPhotosHtml(order);

    var role = app.memory.user ? app.memory.user.role : null;
    var isAdmin = role === 'admin';
    var isPrivileged = role === 'admin' || role === 'supervisor';
    var isOwner = !!(app.memory.user && order.assigned_to_id === app.memory.user.id);
    var isTerminal = ['completed', 'cancelled'].indexOf(order.status) !== -1;
    // Reassigning requires the staff roster, which is admin-only visibility
    // (see get_staff.php) — so only admin gets the Reassign button.
    var canReassign = !isTerminal && isAdmin;
    var canDelete = isPrivileged;
    // A technician can move their own work order through start/complete/
    // cancel; admin/supervisor can do the same on any work order.
    var canManageStatus = !isTerminal && (isOwner || isPrivileged);

    var statusButtonsHtml = '';
    if (canManageStatus) {
        if (order.status === 'pending') {
            statusButtonsHtml += '<button class="popup-btn reassign" action="startWorkOrder: ' + order.id + '"><i class="fas fa-play"></i> Start Work</button>';
        }
        if (order.status === 'in_progress') {
            statusButtonsHtml += '<button class="popup-btn approve" action="completeWorkOrder: ' + order.id + '"><i class="fas fa-check"></i> Mark Complete</button>';
        }
        statusButtonsHtml += '<button class="popup-btn reject" action="cancelWorkOrderStatus: ' + order.id + '"><i class="fas fa-ban"></i> Cancel Work</button>';
    }

    return '<div class="popup-content">' +
        '<div class="popup-header">' +
        '  <h3><i class="fas fa-tools"></i> ' + escapeHtml(order.reference) + '</h3>' +
        '  <button class="popup-close" action="closePopup"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="popup-body">' +
        '  <div class="popup-field">' +
        '    <label><i class="fas fa-exclamation-circle"></i> Issue</label>' +
        '    <p>' + escapeHtml(order.issue) + '</p>' +
        '  </div>' +
        '  <div class="popup-field">' +
        '    <label><i class="fas fa-align-left"></i> Description</label>' +
        '    <p>' + escapeHtml(order.description || 'No description provided') + '</p>' +
        '  </div>' +
        '  <div class="popup-row">' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-tag"></i> Category</label>' +
        '      <p>' + escapeHtml(order.category) + '</p>' +
        '    </div>' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-map-marker-alt"></i> Location</label>' +
        '      <p>' + escapeHtml(order.location || '-') + '</p>' +
        '    </div>' +
        '  </div>' +
        '  <div class="popup-row">' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-user"></i> Assigned To</label>' +
        '      <p>' + escapeHtml(assignedTo) + '</p>' +
        '    </div>' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-calendar-alt"></i> Due Date</label>' +
        '      <p>' + dueDate + '</p>' +
        '    </div>' +
        '  </div>' +
        '  <div class="popup-row">' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-flag"></i> Priority</label>' +
        '      <p><span class="' + priorityClass + '">' + order.priority + '</span></p>' +
        '    </div>' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-circle"></i> Status</label>' +
        '      <p><span class="' + statusClass + '">' + statusLabel(order.status) + '</span></p>' +
        '    </div>' +
        '  </div>' +
        photosHtml +
        (reassignPanelHtml || '') +
        '</div>' +
        '<div class="popup-footer">' +
        '  <button class="popup-btn secondary" action="closePopup"><i class="fas fa-times"></i> Close</button>' +
        statusButtonsHtml +
        (canReassign ? '<button class="popup-btn reassign" action="toggleReassignPanel: ' + order.id + '"><i class="fas fa-people-arrows"></i> Reassign</button>' : '') +
        (canDelete ? '  <button class="popup-btn reject" action="confirmDeleteWorkOrder: ' + order.id + '"><i class="fas fa-trash"></i> Delete</button>' : '') +
        '</div>' +
        '</div>';
}

// ===== WORK ORDER STATUS ACTIONS (technician-owned, or admin/supervisor) =====
function doUpdateWorkOrderStatus(context, orderId, newStatus, confirmMsg) {
    if (!orderId) return;
    if (confirmMsg && !confirm(confirmMsg)) return;

    context.fetch('api/update_work_order_status.php', {
        method: 'POST',
        body: { work_order_id: orderId, status: newStatus }
    }, function(result) {
        if (!result.ok) {
            showNotificationToast(context, (result && result.data) || 'Failed to update work order', 'error');
            return;
        }

        for (var i = 0; i < (app.memory.workOrders || []).length; i++) {
            if (app.memory.workOrders[i].id === orderId) {
                app.memory.workOrders[i] = result.data;
                break;
            }
        }

        closePopup(context);
        showNotificationToast(context, 'Work order marked ' + statusLabel(newStatus).toLowerCase(), 'success');
        if (typeof renderWorkOrdersSlice === 'function') renderWorkOrdersSlice(context);
    });
}

function startWorkOrder(context) {
    doUpdateWorkOrderStatus(context, parseInt(context.arg, 10), 'in_progress');
}

function completeWorkOrder(context) {
    doUpdateWorkOrderStatus(context, parseInt(context.arg, 10), 'completed', 'Mark this work order as complete?');
}

function cancelWorkOrderStatus(context) {
    doUpdateWorkOrderStatus(context, parseInt(context.arg, 10), 'cancelled', 'Cancel this work order? This cannot be undone.');
}

// ===== REASSIGN WORK ORDER =====
function toggleReassignPanel(context) {
    var orderId = parseInt(context.arg);
    if (!orderId) return;

    var order = (app.memory.workOrders || []).filter(function(o) { return o.id === orderId; })[0];
    if (!order) return;

    var existingPanel = document.getElementById('reassign-panel');
    if (existingPanel) {
        // Toggle off: re-render without the panel.
        openPopup(context, buildWorkOrderDetailPopup(order));
        return;
    }

    openPopup(context, buildWorkOrderDetailPopup(order, '<div class="popup-field" id="reassign-panel"><label><i class="fas fa-people-arrows"></i> Reassign to</label><p class="loading-text">Loading staff...</p></div>'));

    app.php('api/get_staff.php', {}).then(function(result) {
        var panel = document.getElementById('reassign-panel');
        if (!panel) return;

        if (!result.ok) {
            panel.innerHTML = '<label><i class="fas fa-people-arrows"></i> Reassign to</label><p class="empty-state">Failed to load staff.</p>';
            return;
        }

        var eligible = (result.data.staff || []).filter(function(s) {
            return s.is_active == 1 && s.role !== 'admin';
        });

        var options = eligible.map(function(s) {
            var selected = s.name === order.assigned_to ? ' selected' : '';
            return '<option value="' + s.id + '"' + selected + '>' + escapeHtml(s.name) + ' (' + s.active_jobs + ' active — ' + escapeHtml(s.department || 'General') + ')</option>';
        }).join('');

        panel.innerHTML =
            '<label><i class="fas fa-people-arrows"></i> Reassign to</label>' +
            '<div class="reassign-controls">' +
            '  <select id="reassign-select">' + (options || '<option>No active staff available</option>') + '</select>' +
            '  <button class="popup-btn approve" action="confirmReassign: ' + order.id + '"><i class="fas fa-check"></i> Confirm</button>' +
            '</div>';
    });
}

function confirmReassign(context) {
    var orderId = parseInt(context.arg);
    var select = document.getElementById('reassign-select');
    if (!orderId || !select || !select.value) return;

    var newAssignee = parseInt(select.value, 10);

    context.fetch('api/reassign_work_order.php', {
        method: 'POST',
        body: { work_order_id: orderId, assigned_to: newAssignee }
    }, function(result) {
        if (!result.ok) {
            showNotificationToast(context, (result && result.data) || 'Failed to reassign', 'error');
            return;
        }

        for (var i = 0; i < app.memory.workOrders.length; i++) {
            if (app.memory.workOrders[i].id === orderId) {
                app.memory.workOrders[i] = result.data;
                break;
            }
        }

        closePopup(context);
        showNotificationToast(context, 'Reassigned to ' + result.data.assigned_to, 'success');
        if (typeof renderWorkOrdersSlice === 'function') renderWorkOrdersSlice(context);
    });
}

function confirmDeleteWorkOrder(context) {
    var orderId = parseInt(context.arg);
    if (!orderId) return;
    if (!confirm('Delete this work order? This cannot be undone.')) return;

    context.fetch('api/delete_work_order.php', { method: 'POST', body: { id: orderId } }, function(result) {
        if (!result.ok) {
            showNotificationToast(context, (result && result.data) || 'Failed to delete work order', 'error');
            return;
        }

        app.memory.workOrders = (app.memory.workOrders || []).filter(function(o) { return o.id !== orderId; });
        app.memory.filteredWorkOrders = (app.memory.filteredWorkOrders || []).filter(function(o) { return o.id !== orderId; });

        closePopup(context);
        showNotificationToast(context, 'Work order deleted', 'success');
        if (typeof renderWorkOrdersSlice === 'function') renderWorkOrdersSlice(context);
    });
}

// ========================================
// DASHBOARD - HOME PAGE
// ========================================

async function loadHomePage(context) {
    context.query('#current-date').text(getCurrentDate());

    var greeting = getGreeting();
    var userName = app.memory.user ? app.memory.user.name : 'User';
    context.query('.greeting').text(greeting + ', ' + userName);
    context.query('#sidebar-user-name').text(userName);
    context.query('#user-name').text(userName);

    context.render('#dashboard-reports-body', '<p class="loading-text">Loading reports...</p>');
    context.render('#dashboard-workload-body', '<p class="loading-text">Loading staff...</p>');
    context.render('#dashboard-workorders-body', '<p class="loading-text">Loading work orders...</p>');

    await Promise.all([
        loadDashboardStats(context),
        loadDashboardReports(context),
        loadDashboardStaff(context),
        loadDashboardWorkOrders(context)
    ]);

    updateNotificationBadge(context);
}

async function loadDashboardStats(context) {
    var sampleStats = {
        kpi: { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 },
        chart: { completed: 0, in_progress: 0, overdue: 0 }
    };

    try {
        var result = await app.php('api/get_dashboard_stats.php', {});
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        updateDashboardStatsUI(context, sampleStats);
        return;
    }

    if (!result.ok) {
        updateDashboardStatsUI(context, sampleStats);
        return;
    }

    updateDashboardStatsUI(context, result.data);
}

function updateDashboardStatsUI(context, data) {
    var kpi = data.kpi;
    context.query('#kpi-total').text(kpi.total || 0);
    context.query('#kpi-pending').text(kpi.pending || 0);
    context.query('#kpi-in-progress').text(kpi.in_progress || 0);
    context.query('#kpi-completed').text(kpi.completed || 0);
    context.query('#kpi-overdue').text(kpi.overdue || 0);

    var chart = data.chart;
    var total = (chart.completed || 0) + (chart.in_progress || 0) + (chart.overdue || 0) || 1;

    var completedPct = Math.round(((chart.completed || 0) / total) * 100);
    var progressPct = Math.round(((chart.in_progress || 0) / total) * 100);
    var overduePct = 100 - completedPct - progressPct;

    context.query('#chart-bar-completed').element.style.width = Math.max(completedPct, 4) + '%';
    context.query('#chart-bar-progress').element.style.width = Math.max(progressPct, 4) + '%';
    context.query('#chart-bar-overdue').element.style.width = Math.max(overduePct, 4) + '%';
}

async function loadDashboardReports(context) {
    try {
        var result = await app.php('api/get_reports.php', {});
    } catch (error) {
        console.error('Failed to load dashboard reports:', error);
        context.render('#dashboard-reports-body', '<p class="loading-text">Failed to load reports</p>');
        return;
    }
    if (handleAuthFailure(result)) return;
    if (!result.ok) {
        context.render('#dashboard-reports-body', '<p class="loading-text">Failed to load reports</p>');
        return;
    }

    app.memory.reports = result.data.reports || [];
    var reports = app.memory.reports.slice(0, 5);

    if (reports.length === 0) {
        context.render('#dashboard-reports-body', '<p class="loading-text">No pending reports</p>');
        return;
    }

    var html = buildDashboardReportRows(reports);
    context.render('#dashboard-reports-body', html);
}

function buildDashboardReportRows(reports) {
    var html = '';
    for (var i = 0; i < reports.length; i++) {
        var r = reports[i];
        var priorityClass = getPriorityClass(r.priority);
        var date = formatDate(r.submitted_at);

        html += '<div class="report-row" action="openReportPopup: ' + r.id + '">';
        html += '  <span class="col-id">' + (r.reference || r.id) + '</span>';
        html += '  <span class="col-issue">' + r.issue + '</span>';
        html += '  <span class="col-category">' + r.category + '</span>';
        html += '  <span class="col-location">' + r.location + '</span>';
        html += '  <span class="col-date">' + date + '</span>';
        html += '  <span class="col-action">';
        html += '    <button class="btn-approve" action="quickApproveReport: ' + r.id + '">✓</button>';
        html += '    <button class="btn-reject" action="openRejectPopup: ' + r.id + '">✗</button>';
        html += '  </span>';
        html += '</div>';
    }
    return html;
}

async function loadDashboardStaff(context) {
    // Staff directory visibility is admin-only (see get_staff_workload.php)
    // and the panel itself is hidden for other roles — skip the call
    // entirely rather than firing a request that's guaranteed to 403.
    if (!app.memory.user || app.memory.user.role !== 'admin') {
        return;
    }

    try {
        var result = await app.php('api/get_staff_workload.php', {});
    } catch (error) {
        console.error('Failed to load staff workload:', error);
        context.render('#dashboard-workload-body', '<p class="loading-text">Failed to load staff</p>');
        return;
    }
    if (!result.ok) {
        context.render('#dashboard-workload-body', '<p class="loading-text">Failed to load staff</p>');
        return;
    }

    app.memory.staffWorkload = result.data.staff || [];
    var staff = app.memory.staffWorkload.slice(0, 5);

    if (staff.length === 0) {
        context.render('#dashboard-workload-body', '<p class="loading-text">No staff data</p>');
        return;
    }

    var html = '';
    for (var i = 0; i < staff.length; i++) {
        var s = staff[i];
        var loadClass = 'load-' + s.load_level.toLowerCase();
        html += '<div class="workload-row">';
        html += '  <span class="col-staff">' + s.name + '</span>';
        html += '  <span class="col-jobs">' + s.active_jobs + '</span>';
        html += '  <span class="col-load"><span class="' + loadClass + '">' + s.load_level + '</span></span>';
        html += '</div>';
    }

    context.render('#dashboard-workload-body', html);
}

async function loadDashboardWorkOrders(context) {
    try {
        var result = await app.php('api/get_work_orders.php', {});
    } catch (error) {
        console.error('Failed to load dashboard work orders:', error);
        context.render('#dashboard-workorders-body', '<p class="loading-text">Failed to load work orders</p>');
        return;
    }
    if (!result.ok) {
        context.render('#dashboard-workorders-body', '<p class="loading-text">Failed to load work orders</p>');
        return;
    }

    app.memory.workOrders = result.data.work_orders || [];
    var orders = app.memory.workOrders.slice(0, 5);

    if (orders.length === 0) {
        context.render('#dashboard-workorders-body', '<p class="loading-text">No work orders</p>');
        return;
    }

    var html = '';
    for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        var priorityClass = getPriorityClass(o.priority);
        var statusClass = getStatusClass(o.status);
        var date = formatDate(o.due_date);
        var assignedTo = o.assigned_to || 'Unassigned';

        html += '<div class="orders-row" action="openWorkOrderPopup: ' + o.id + '">';
        html += '  <span class="col-id">' + o.reference + '</span>';
        html += '  <span class="col-issue">' + o.issue + '</span>';
        html += '  <span class="col-worker">' + assignedTo + '</span>';
        html += '  <span class="col-category">' + o.category + '</span>';
        html += '  <span class="col-location">' + (o.location || '-') + '</span>';
        html += '  <span class="col-priority"><span class="' + priorityClass + '">' + o.priority + '</span></span>';
        html += '  <span class="col-status"><span class="' + statusClass + '">' + statusLabel(o.status) + '</span></span>';
        html += '  <span class="col-date">' + date + '</span>';
        html += '</div>';
    }

    context.render('#dashboard-workorders-body', html);
}

// ========================================
// REPORT ACTIONS (Approve / Reject)
// ========================================

function quickApproveReport(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;

    if (!confirm('Approve this report and create a work order?')) return;

    // create_work_order.php only marks the report "approved" once it finds
    // a staff member with a matching skill and actually creates the work
    // order — calling it directly (instead of flipping status first) means
    // a report with no skill match just stays "pending" and visible in the
    // queue, instead of vanishing into an orphaned "approved" limbo state.
    context.fetch('api/create_work_order.php', {
        method: 'POST',
        body: { report_id: reportId }
    }, function(woData) {
        if (woData.ok) {
            showNotificationToast(context, 'Report approved and work order created!', 'success');
            refreshAllData(context);
        } else {
            showNotificationToast(context, (woData && woData.data) || 'No matching staff available — report stays pending', 'error');
        }
    });
}

function openRejectPopup(context) {
    var reportId = parseInt(context.arg);
    if (!reportId) return;

    if (!confirm('Reject this report? This action cannot be undone.')) return;

    context.fetch('api/update_report_status.php', {
        method: 'POST',
        body: { id: reportId, status: 'rejected' }
    }, function(data) {
        if (data.ok) {
            showNotificationToast(context, 'Report rejected', 'success');
            context.fetch('api/delete_report.php', {
                method: 'POST',
                body: { id: reportId }
            }, function(deleteData) {
                refreshAllData(context);
            });
        } else {
            showNotificationToast(context, 'Failed to reject report', 'error');
        }
    });
}

function refreshAllData(context) {
    app.memory.reports = [];
    app.memory.workOrders = [];
    app.memory.staffWorkload = [];
    app.memory.dashboardStats = null;
    app.memory.filteredReports = [];
    app.memory.filteredWorkOrders = [];
    app.memory.filteredStaff = [];

    var currentPage = app.currentPage();
    if (currentPage === 'home') {
        loadHomePage(context);
    } else if (currentPage === 'reports') {
        loadReportsPage(context);
    } else if (currentPage === 'workorders') {
        loadWorkOrdersPage(context);
    } else if (currentPage === 'staffs') {
        loadStaffPage(context);
    }
}

// ========================================
// NAVIGATION FUNCTIONS
// ========================================

function goToReports(context) {
    closeMobileMenu(context);
    context.navigate('reports');
}

function goToWorkOrders(context) {
    closeMobileMenu(context);
    context.navigate('workorders');
}

function goToStaff(context) {
    closeMobileMenu(context);
    context.navigate('staffs');
}

function goToNewReport(context) {
    closeMobileMenu(context);
    context.navigate('report-issue');
}

function goToSettings(context) {
    closeMobileMenu(context);
    context.navigate('settings');
}

// Note: logout lives in the single logoutUser()/performLogout() pair above —
// this used to be a second, broken copy that showed a "Logged out" toast
// without ever actually clearing the session or leaving the page.

// ========================================
// CONFIRMATION POPUP FUNCTIONS
// ========================================

function showConfirmation(options) {
    var overlay = document.getElementById('confirmation-overlay');
    var popup = document.getElementById('confirmation-popup');
    var title = document.getElementById('confirmation-title');
    var message = document.getElementById('confirmation-message');
    var btn = document.getElementById('confirmation-btn');

    if (!overlay || !popup) return;

    // Set content
    var type = options.type || 'success';
    var iconMap = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    // Update content
    var iconEl = popup.querySelector('.confirmation-icon i');
    if (iconEl) {
        iconEl.className = 'fas ' + (iconMap[type] || 'fa-check-circle');
    }

    // Set classes
    popup.className = ''; // Reset
    popup.classList.add(type);

    // Set text
    if (title) title.textContent = options.title || 'Success!';
    if (message) message.textContent = options.message || 'Operation completed successfully.';
    if (btn) {
        btn.textContent = options.buttonText || 'Done';
        btn.className = 'confirmation-btn';
        if (options.buttonClass) {
            btn.classList.add(options.buttonClass);
        }
    }

    // Set button action
    if (btn) {
        btn.onclick = function() {
            closeConfirmation();
            if (options.onConfirm && typeof options.onConfirm === 'function') {
                options.onConfirm();
            }
        };
    }

    // Show with animation
    overlay.classList.add('active');

    // Confetti effect for success
    if (type === 'success' && options.confetti !== false) {
        createConfetti();
    }

    // Auto close after delay
    if (options.autoClose && options.delay) {
        setTimeout(function() {
            closeConfirmation();
            if (options.onAutoClose && typeof options.onAutoClose === 'function') {
                options.onAutoClose();
            }
        }, options.delay);
    }
}

function closeConfirmation() {
    var overlay = document.getElementById('confirmation-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }

    // Remove confetti
    var container = document.querySelector('.confetti-container');
    if (container) {
        container.remove();
    }
}

function createConfetti() {
    var container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    var colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6fb7', '#a66cff', '#ff9f43', '#00d2d3'];

    for (var i = 0; i < 60; i++) {
        var piece = document.createElement('div');
        piece.className = 'confetti-piece';
        var color = colors[Math.floor(Math.random() * colors.length)];
        var size = 6 + Math.random() * 8;
        var left = Math.random() * 100;
        var duration = 1.5 + Math.random() * 2;
        var delay = Math.random() * 0.8;
        var shape = Math.random() > 0.5 ? '50%' : '2px';

        piece.style.cssText = `
            left: ${left}%;
            width: ${size}px;
            height: ${size * (0.6 + Math.random() * 0.8)}px;
            background: ${color};
            border-radius: ${shape};
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
        `;

        container.appendChild(piece);
    }

    // Remove confetti after animation
    setTimeout(function() {
        if (container) {
            container.remove();
        }
    }, 4000);
}

// ===== SHORTCUT FUNCTIONS =====

function showSuccessPopup(message, title, callback) {
    showConfirmation({
        type: 'success',
        title: title || 'Success!',
        message: message || 'Operation completed successfully.',
        buttonText: 'Done',
        onConfirm: callback || null,
        confetti: true,
        autoClose: true,
        delay: 3000
    });
}

function showErrorPopup(message, title, callback) {
    showConfirmation({
        type: 'error',
        title: title || 'Error!',
        message: message || 'Something went wrong. Please try again.',
        buttonText: 'Try Again',
        onConfirm: callback || null,
        confetti: false,
        autoClose: false
    });
}

function showWarningPopup(message, title, callback) {
    showConfirmation({
        type: 'warning',
        title: title || 'Warning!',
        message: message || 'Are you sure you want to proceed?',
        buttonText: 'Confirm',
        buttonClass: 'danger',
        onConfirm: callback || null,
        confetti: false,
        autoClose: false
    });
}

function showInfoPopup(message, title, callback) {
    showConfirmation({
        type: 'info',
        title: title || 'Information',
        message: message || 'Please review the details below.',
        buttonText: 'Got it',
        onConfirm: callback || null,
        confetti: false,
        autoClose: true,
        delay: 3000
    });
}

// ========================================
// EXPOSE GLOBAL FUNCTIONS
// ========================================

window.loadHomePage = loadHomePage;
window.goToReports = goToReports;
window.goToWorkOrders = goToWorkOrders;
window.goToStaff = goToStaff;
window.goToNewReport = goToNewReport;
window.goToSettings = goToSettings;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.toggleNotifications = toggleNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.openPopup = openPopup;
window.closePopup = closePopup;
window.openReportPopup = openReportPopup;
window.openWorkOrderPopup = openWorkOrderPopup;
window.toggleReassignPanel = toggleReassignPanel;
window.confirmReassign = confirmReassign;
window.confirmDeleteWorkOrder = confirmDeleteWorkOrder;
window.startWorkOrder = startWorkOrder;
window.completeWorkOrder = completeWorkOrder;
window.cancelWorkOrderStatus = cancelWorkOrderStatus;
window.quickApproveReport = quickApproveReport;
window.openRejectPopup = openRejectPopup;
window.approveReportFromPopup = approveReportFromPopup;
window.rejectReportFromPopup = rejectReportFromPopup;
window.showConfirmation = showConfirmation;
window.closeConfirmation = closeConfirmation;
window.showSuccessPopup = showSuccessPopup;
window.showErrorPopup = showErrorPopup;
window.showWarningPopup = showWarningPopup;
window.showInfoPopup = showInfoPopup;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;
window.getCurrentDate = getCurrentDate;
window.getGreeting = getGreeting;
window.statusLabel = statusLabel;
window.priorityLabel = priorityLabel;
window.getStatusClass = getStatusClass;
window.getPriorityClass = getPriorityClass;
window.showNotificationToast = showNotificationToast;
window.updateNotificationBadge = updateNotificationBadge;
window.refreshAllData = refreshAllData;