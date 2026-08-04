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
    loadDepartmentLocations(context);
}

// ===== DEPARTMENTS: assign each location to a department =====
async function loadDepartmentLocations(context) {
    var list = context.query('#dept-locations-list');
    if (!list.exists) return;

    try {
        var results = await Promise.all([
            app.php('api/get_locations.php', {}),
            app.php('api/get_departments.php', {})
        ]);
        var locationsResult = results[0];
        var departmentsResult = results[1];

        if (!locationsResult.ok || !Array.isArray(locationsResult.data)) {
            list.html('<p class="empty-state">Failed to load locations.</p>');
            return;
        }
        var locations = locationsResult.data;
        var departments = (departmentsResult.ok && Array.isArray(departmentsResult.data)) ? departmentsResult.data : [];

        if (locations.length === 0) {
            list.html('<p class="empty-state">No locations yet.</p>');
            return;
        }

        var html = locations.map(function(loc) {
            var options = '<option value="">— Unassigned —</option>' + departments.map(function(d) {
                var selected = String(loc.department_id) === String(d.id) ? ' selected' : '';
                return '<option value="' + d.id + '"' + selected + '>' + d.name + '</option>';
            }).join('');

            return '<div class="setting-item">' +
                '  <div class="setting-info">' +
                '    <span class="setting-label"><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(loc.name) +
                '      <button type="button" class="location-edit-btn" title="Rename location" data-loc-name="' + escapeHtml(loc.name) + '" action="openRenameLocationPopup: ' + loc.id + '"><i class="fas fa-pen"></i></button>' +
                '    </span>' +
                '  </div>' +
                '  <select class="dept-location-select" onchange="saveLocationDepartment: ' + loc.id + '">' + options + '</select>' +
                '</div>';
        }).join('');

        list.html(html);
    } catch (error) {
        console.error('Failed to load department/location data:', error);
        list.html('<p class="empty-state">Failed to load locations.</p>');
    }
}

// ===== ADD LOCATION (Administrator) =====
async function openAddLocationPopup(context) {
    var departments = [];
    try {
        var result = await app.php('api/get_departments.php', {});
        if (result.ok && Array.isArray(result.data)) departments = result.data;
    } catch (error) {
        // Non-fatal — the popup still opens, just with only "— Unassigned —"
        // available; the admin can assign a department afterward from the
        // location list below instead.
    }

    var options = '<option value="">— Unassigned —</option>' + departments.map(function(d) {
        return '<option value="' + d.id + '">' + escapeHtml(d.name) + '</option>';
    }).join('');

    openPopup(context,
        '<div class="popup-content">' +
        '  <div class="popup-header">' +
        '    <h3><i class="fas fa-map-marker-alt"></i> Add Location</h3>' +
        '    <button class="popup-close" action="closePopup"><i class="fas fa-times"></i></button>' +
        '  </div>' +
        '  <div class="popup-body">' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-signature"></i> Location Name</label>' +
        '      <input type="text" id="new-location-name" placeholder="e.g. Block D, Science Annex" style="width:100%;padding:8px 10px;border:1px solid #dfe3e8;border-radius:8px;font-size:13px;font-family:inherit;" />' +
        '    </div>' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-building"></i> Department</label>' +
        '      <select id="new-location-department" style="width:100%;padding:8px 10px;border:1px solid #dfe3e8;border-radius:8px;font-size:13px;font-family:inherit;">' + options + '</select>' +
        '    </div>' +
        '  </div>' +
        '  <div class="popup-footer">' +
        '    <button class="popup-btn secondary" action="closePopup">Cancel</button>' +
        '    <button class="popup-btn approve" action="submitNewLocation"><i class="fas fa-check"></i> Add</button>' +
        '  </div>' +
        '</div>'
    );

    var nameInput = document.getElementById('new-location-name');
    if (nameInput) nameInput.focus();
}

function submitNewLocation(context) {
    var nameInput = document.getElementById('new-location-name');
    var deptSelect = document.getElementById('new-location-department');
    var name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        showNotificationToast(context, 'Enter a location name.', 'error');
        return;
    }

    context.fetch('api/create_location.php', {
        method: 'POST',
        body: {
            name: name,
            department_id: (deptSelect && deptSelect.value) ? parseInt(deptSelect.value, 10) : null
        }
    }, function(result) {
        if (!result.ok) {
            showNotificationToast(context, (result && result.data) || 'Failed to add location', 'error');
            return;
        }
        closePopup(context);
        showNotificationToast(context, 'Location added', 'success');
        loadDepartmentLocations(context);
    });
}

// ===== COLLAPSIBLE SETTINGS CARDS =====
function toggleSettingsCard(context) {
    var header = context.event ? context.event.target.closest('.card-header') : null;
    var card = header ? header.closest('.settings-card') : null;
    if (!card) return;
    card.classList.toggle('collapsed');
}

// ===== RENAME LOCATION (Administrator) =====
function openRenameLocationPopup(arg, context) {
    var locationId = parseInt(arg, 10);
    if (!locationId) return;

    var btn = context.event ? context.event.target.closest('.location-edit-btn') : null;
    var currentName = btn ? (btn.dataset.locName || '') : '';

    openPopup(context,
        '<div class="popup-content">' +
        '  <div class="popup-header">' +
        '    <h3><i class="fas fa-pen"></i> Rename Location</h3>' +
        '    <button class="popup-close" action="closePopup"><i class="fas fa-times"></i></button>' +
        '  </div>' +
        '  <div class="popup-body">' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-signature"></i> Location Name</label>' +
        '      <input type="text" id="rename-location-name" value="' + escapeHtml(currentName) + '" style="width:100%;padding:8px 10px;border:1px solid #dfe3e8;border-radius:8px;font-size:13px;font-family:inherit;" />' +
        '    </div>' +
        '  </div>' +
        '  <div class="popup-footer">' +
        '    <button class="popup-btn secondary" action="closePopup">Cancel</button>' +
        '    <button class="popup-btn approve" action="submitRenameLocation: ' + locationId + '"><i class="fas fa-check"></i> Save</button>' +
        '  </div>' +
        '</div>'
    );

    var nameInput = document.getElementById('rename-location-name');
    if (nameInput) { nameInput.focus(); nameInput.select(); }
}

function submitRenameLocation(arg, context) {
    var locationId = parseInt(arg, 10);
    var nameInput = document.getElementById('rename-location-name');
    var name = nameInput ? nameInput.value.trim() : '';

    if (!locationId || !name) {
        showNotificationToast(context, 'Enter a location name.', 'error');
        return;
    }

    context.fetch('api/rename_location.php', {
        method: 'POST',
        body: { location_id: locationId, name: name }
    }, function(result) {
        if (!result.ok) {
            showNotificationToast(context, (result && result.data) || 'Failed to rename location', 'error');
            return;
        }
        closePopup(context);
        showNotificationToast(context, 'Location renamed', 'success');
        loadDepartmentLocations(context);
    });
}

function saveLocationDepartment(arg, context) {
    var locationId = parseInt(arg, 10);
    var select = context.event ? context.event.target : null;
    if (!locationId || !select) return;

    var departmentId = select.value ? parseInt(select.value, 10) : null;

    context.fetch('api/update_location_department.php', {
        method: 'POST',
        body: { location_id: locationId, department_id: departmentId }
    }, function(result) {
        if (!result.ok) {
            showNotificationToast(context, (result && result.data) || 'Failed to update department', 'error');
            return;
        }
        showNotificationToast(context, 'Department updated', 'success');
    });
}

// Fetches real counts from the database instead of reusing whatever
// happened to already be cached in app.memory from other pages (which was
// often empty/stale — e.g. showing 0 users even when accounts existed).
async function loadSettingsStats(context) {
    try {
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
    } catch (error) {
        console.error('Failed to load settings stats:', error);
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
// A single attribute drives the whole theme (see style/dark-mode.css) —
// replaces the old approach of manually inline-styling a hand-picked list
// of Settings-page elements, which never covered any other page in the app
// and needed a fresh entry here for every new component that ever wanted
// dark-mode support.
function applyTheme(isDark) {
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
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
window.toggleSettingsCard = toggleSettingsCard;
window.loadDepartmentLocations = loadDepartmentLocations;
window.saveLocationDepartment = saveLocationDepartment;
window.openAddLocationPopup = openAddLocationPopup;
window.submitNewLocation = submitNewLocation;
window.openRenameLocationPopup = openRenameLocationPopup;
window.submitRenameLocation = submitRenameLocation;
window.toggleDarkMode = toggleDarkMode;
window.toggleNotificationsPref = toggleNotificationsPref;
window.toggleCompactMode = toggleCompactMode;
window.decreaseFontSize = decreaseFontSize;
window.increaseFontSize = increaseFontSize;
window.applyTheme = applyTheme;
window.applyCompactMode = applyCompactMode;
