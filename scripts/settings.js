// ========================================
// SETTINGS MODULE
// ========================================

// ===== LOAD SETTINGS PAGE =====
function loadSettingsPage(context) {
    var userName = app.memory.user ? app.memory.user.name : '';
    var userEmail = app.memory.user ? app.memory.user.email : '';
    var userRole = app.memory.user ? app.memory.user.role : '';

    context.query('#settings-user-name').text(userName);
    context.query('#settings-user-email').text(userEmail);
    context.query('#settings-user-role').text(userRole ? (userRole.charAt(0).toUpperCase() + userRole.slice(1)) : '—');

    loadSettingsStats(context);
    loadPreferences(context);
}

// Fetches real counts from the database instead of reusing whatever
// happened to already be cached in app.memory from other pages (which was
// often empty/stale — e.g. showing 0 users even when accounts existed).
async function loadSettingsStats(context) {
    var staffResult = await app.php('api/get_staff.php', {});
    if (staffResult.ok) {
        var allUsers = staffResult.data.staff || [];
        var configuredStaff = allUsers.filter(function(s) { return s.department; }).length;
        context.query('#settings-total-users').text(allUsers.length);
        context.query('#settings-total-staff').text(configuredStaff);
        context.query('#about-total-users').text(allUsers.length);
    }

    var reportsResult = await app.php('api/get_reports.php', {});
    if (reportsResult.ok) {
        var reportCount = (reportsResult.data.reports || []).length;
        context.query('#settings-total-reports').text(reportCount);
        context.query('#about-total-reports').text(reportCount);
    }

    var ordersResult = await app.php('api/get_work_orders.php', {});
    if (ordersResult.ok) {
        var orderCount = (ordersResult.data.work_orders || []).length;
        context.query('#settings-total-orders').text(orderCount);
        context.query('#about-total-orders').text(orderCount);
    }
}

// ===== PREFERENCES =====
function loadPreferences(context) {
    var darkMode = localStorage.getItem('cmms_dark_mode') === 'true';
    setToggleChecked(context, '#dark-mode-toggle-input', darkMode);
    if (darkMode) applyTheme(true);

    var notifEnabled = localStorage.getItem('cmms_notifications') !== 'false';
    setToggleChecked(context, '#notif-toggle-input', notifEnabled);

    var compactMode = localStorage.getItem('cmms_compact_mode') === 'true';
    setToggleChecked(context, '#compact-toggle-input', compactMode);
    if (compactMode) applyCompactMode(true);

    var fontSize = localStorage.getItem('cmms_font_size') || '14';
    context.query('#font-size-value').text(fontSize + 'px');
    document.body.style.fontSize = fontSize + 'px';
}

function setToggleChecked(context, selector, checked) {
    var el = context.query(selector);
    if (el.exists) el.element.checked = checked;
}

// ===== TOGGLES =====
// Each toggle reads the checkbox's own (already-flipped-by-the-click) state
// rather than manually tracking an "active" class — the slider's animation
// is driven purely by the browser's native :checked CSS, so JS only needs
// to persist the preference and apply whatever real side effect it has.
function toggleDarkMode(context) {
    var input = context.query('#dark-mode-toggle-input');
    if (!input.exists) return;
    var isDark = input.element.checked;
    localStorage.setItem('cmms_dark_mode', isDark ? 'true' : 'false');
    applyTheme(isDark);
    showNotificationToast(context, 'Dark mode ' + (isDark ? 'enabled' : 'disabled'), isDark ? 'success' : 'info');
}

function toggleNotificationsPref(context) {
    var input = context.query('#notif-toggle-input');
    if (!input.exists) return;
    var enabled = input.element.checked;
    localStorage.setItem('cmms_notifications', enabled ? 'true' : 'false');

    if (!enabled) {
        var badge = document.getElementById('notification-badge');
        if (badge) badge.classList.add('hidden');
    } else {
        loadNotifications(domContext());
    }

    showNotificationToast(context, 'Notifications ' + (enabled ? 'enabled' : 'disabled'), enabled ? 'success' : 'info');
}

function toggleCompactMode(context) {
    var input = context.query('#compact-toggle-input');
    if (!input.exists) return;
    var isCompact = input.element.checked;
    localStorage.setItem('cmms_compact_mode', isCompact ? 'true' : 'false');
    applyCompactMode(isCompact);
    showNotificationToast(context, 'Compact mode ' + (isCompact ? 'enabled' : 'disabled'), isCompact ? 'success' : 'info');
}

function decreaseFontSize(context) {
    var currentSize = parseInt(localStorage.getItem('cmms_font_size') || '14');
    var newSize = Math.max(12, currentSize - 1);
    localStorage.setItem('cmms_font_size', String(newSize));
    context.query('#font-size-value').text(newSize + 'px');
    document.body.style.fontSize = newSize + 'px';
}

function increaseFontSize(context) {
    var currentSize = parseInt(localStorage.getItem('cmms_font_size') || '14');
    var newSize = Math.min(20, currentSize + 1);
    localStorage.setItem('cmms_font_size', String(newSize));
    context.query('#font-size-value').text(newSize + 'px');
    document.body.style.fontSize = newSize + 'px';
}

// ===== THEME FUNCTIONS =====
function applyTheme(isDark) {
    var body = document.body;
    var appElement = document.querySelector('app');
    var cards = document.querySelectorAll('.settings-card');

    if (isDark) {
        body.style.background = '#1a1a1a';
        body.style.color = '#e0e0e0';
        if (appElement) appElement.style.background = '#1a1a1a';
        cards.forEach(function(card) {
            card.style.background = '#2d2d2d';
            card.style.borderColor = '#3d3d3d';
        });
        document.querySelectorAll('.setting-label').forEach(function(l) { l.style.color = '#e0e0e0'; });
        document.querySelectorAll('.setting-value').forEach(function(v) { v.style.color = '#aaa'; });
        document.querySelectorAll('.settings-card .card-header h3').forEach(function(h) { h.style.color = '#e0e0e0'; });
        document.querySelectorAll('.card-subtitle').forEach(function(s) { s.style.color = '#888'; });
    } else {
        body.style.background = '';
        body.style.color = '';
        if (appElement) appElement.style.background = '';
        cards.forEach(function(card) {
            card.style.background = '';
            card.style.borderColor = '';
        });
        document.querySelectorAll('.setting-label').forEach(function(l) { l.style.color = ''; });
        document.querySelectorAll('.setting-value').forEach(function(v) { v.style.color = ''; });
        document.querySelectorAll('.settings-card .card-header h3').forEach(function(h) { h.style.color = ''; });
        document.querySelectorAll('.card-subtitle').forEach(function(s) { s.style.color = ''; });
    }
}

function applyCompactMode(isCompact) {
    var cards = document.querySelectorAll('.settings-card');
    var items = document.querySelectorAll('.setting-item');
    var headers = document.querySelectorAll('.settings-card .card-header');

    cards.forEach(function(card) { card.style.padding = isCompact ? '0' : ''; });
    items.forEach(function(item) { item.style.padding = isCompact ? '6px 12px' : ''; });
    headers.forEach(function(header) { header.style.padding = isCompact ? '10px 12px' : ''; });
}

// ========================================
// EXPOSE GLOBAL FUNCTIONS
// ========================================

window.loadSettingsPage = loadSettingsPage;
window.toggleDarkMode = toggleDarkMode;
window.toggleNotificationsPref = toggleNotificationsPref;
window.toggleCompactMode = toggleCompactMode;
window.decreaseFontSize = decreaseFontSize;
window.increaseFontSize = increaseFontSize;
window.applyTheme = applyTheme;
window.applyCompactMode = applyCompactMode;
