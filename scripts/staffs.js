// ========================================
// STAFF MODULE
// ========================================

const STAFF_PAGE_SIZE = 10;

// ===== STATE =====
if (!app.memory.staff) {
    app.memory.staff = [];
}
if (!app.memory.filteredStaff) {
    app.memory.filteredStaff = [];
}
app.memory.staffPage = 0;

// ===== LOAD STAFF PAGE =====
function loadStaffPage(context) {
    context.render('#staffs-body', '<p class="loading-text">Loading staff...</p>');
    
    context.fetch('api/get_staff.php', { method: 'POST' }, function(result) {
        if (handleAuthFailure(result)) return;
        if (!result.ok) {
            context.render('#staffs-body', '<p class="empty-state">Failed to load staff. Please try again.</p>');
            return;
        }
        
        if (result.data && result.data.staff) {
            app.memory.staff = result.data.staff;
        } else {
            app.memory.staff = [];
        }
        
        applyStaffFilters(context);
    });
}

// ===== APPLY FILTERS =====
function applyStaffFilters(context) {
    var allStaff = app.memory.staff || [];
    
    var roleEl = context.query('#staff-filter-role');
    var departmentEl = context.query('#staff-filter-department');
    var statusEl = context.query('#staff-filter-status');
    var searchEl = context.query('#staff-search');
    
    var role = roleEl.exists ? roleEl.element.value : 'all';
    var department = departmentEl.exists ? departmentEl.element.value : 'all';
    var status = statusEl.exists ? statusEl.element.value : 'all';
    var search = searchEl.exists ? searchEl.element.value.toLowerCase().trim() : '';
    
    app.memory.filteredStaff = allStaff.filter(function(staff) {
        if (role !== 'all' && staff.role !== role) return false;
        if (department !== 'all' && (staff.department || 'general').toLowerCase() !== department.toLowerCase()) return false;
        if (status === 'active' && staff.is_active != 1) return false;
        if (status === 'inactive' && staff.is_active == 1) return false;
        if (search) {
            var haystack = (staff.name + ' ' + staff.role + ' ' + (staff.department || '')).toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
    
    app.memory.staffPage = 0;
    renderStaffSlice(context);
}

// ===== RENDER TABLE =====
function renderStaffSlice(context) {
    var filtered = app.memory.filteredStaff || [];
    var currentPage = app.memory.staffPage || 0;
    var start = currentPage * STAFF_PAGE_SIZE;
    var end = Math.min(start + STAFF_PAGE_SIZE, filtered.length);
    var slice = filtered.slice(start, end);
    var totalPages = Math.max(1, Math.ceil(filtered.length / STAFF_PAGE_SIZE));
    
    context.query('#staff-count').text(filtered.length + ' records');
    
    if (slice.length === 0) {
        context.render('#staffs-body', '<p class="empty-state">No staff found.</p>');
    } else {
        var html = '';
        for (var i = 0; i < slice.length; i++) {
            var s = slice[i];
            var configured = !!s.department;
            var statusClass = s.is_active == 1 ? 'status-badge active' : 'status-badge inactive';
            var statusLabel = configured ? (s.is_active == 1 ? 'Active' : 'Inactive') : 'Not configured';
            var joinDate = s.joined_at ? formatDate(s.joined_at) : '—';
            var role = s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : 'N/A';
            var dept = s.department || '—';
            var ref = s.reference || ('S-' + String(s.id).padStart(3, '0'));

            html += '<div class="staff-row">';
            html += '  <span class="col-id">' + ref + '</span>';
            html += '  <span class="col-name">' + escapeHtml(s.name) + '</span>';
            html += '  <span class="col-email">' + escapeHtml(s.email || '—') + '</span>';
            html += '  <span class="col-role">' + role + '</span>';
            html += '  <span class="col-department">' + escapeHtml(dept) + '</span>';
            html += '  <span class="col-status"><span class="' + statusClass + '">' + statusLabel + '</span></span>';
            html += '  <span class="col-jobs">' + (s.active_jobs || 0) + '</span>';
            html += '  <span class="col-joined">' + joinDate + '</span>';
            var isSelf = app.memory.user && app.memory.user.id === s.id;

            html += '  <span class="col-action">';
            html += '    <button class="btn-delete" action="openEditSkillsPopup: ' + s.id + '" title="' + (configured ? 'Edit skills' : 'Assign skills') + '" style="color:#237FEA;"><i class="fas fa-screwdriver-wrench"></i></button>';
            if (s.is_active == 1) {
                html += '    <button class="btn-delete" action="confirmDeactivateStaff: ' + s.id + '" title="Deactivate staff"><i class="fas fa-trash"></i></button>';
            }
            if (!isSelf) {
                html += '    <button class="btn-delete-permanent" action="confirmDeleteStaffPermanently: ' + s.id + '" title="Delete permanently"><i class="fas fa-user-xmark"></i></button>';
            }
            html += '  </span>';
            html += '</div>';
        }
        context.render('#staffs-body', html);
    }
    
    var prevBtn = context.query('#staffs-prev');
    var nextBtn = context.query('#staffs-next');
    var label = context.query('#staffs-page-label');
    
    if (prevBtn.exists) prevBtn.element.disabled = currentPage === 0;
    if (nextBtn.exists) nextBtn.element.disabled = currentPage >= totalPages - 1;
    if (label.exists) label.text('Page ' + (currentPage + 1) + ' of ' + totalPages);
}

// ===== PAGINATION =====
function staffsPrev(context) {
    if (app.memory.staffPage > 0) {
        app.memory.staffPage--;
        renderStaffSlice(context);
    }
}

function staffsNext(context) {
    var filtered = app.memory.filteredStaff || [];
    var totalPages = Math.ceil(filtered.length / STAFF_PAGE_SIZE);
    if (app.memory.staffPage < totalPages - 1) {
        app.memory.staffPage++;
        renderStaffSlice(context);
    }
}

// ===== NAVIGATION TO ADD STAFF =====
function goToAddStaff(context) {
    closeMobileMenu(context);
    context.navigate('add-staff');
}

// ===== DEACTIVATE STAFF =====
// Soft-delete: staff are deactivated rather than hard-deleted, since their
// id is referenced by report/work-order history (see deactivate_staff.php).
function confirmDeactivateStaff(arg, context) {
    var staffId = parseInt(arg);
    if (!staffId) return;

    requestConfirm(context, 'Deactivate this staff member? They will stop receiving new auto-assigned work, but their history is kept. Any work orders already assigned to them are not automatically reassigned.', 'Deactivate Staff', function() {
        deactivateStaffConfirmed(context, staffId);
    }, 'reject', 'fa-user-slash');
}

function deactivateStaffConfirmed(context, staffId) {
    context.fetch('api/deactivate_staff.php', { method: 'POST', body: { id: staffId } }, function(result) {
        if (!result.ok) {
            showNotificationToast(context, (result && result.data) || 'Failed to deactivate staff', 'error');
            return;
        }

        for (var i = 0; i < app.memory.staff.length; i++) {
            if (app.memory.staff[i].id === staffId) {
                app.memory.staff[i].is_active = 0;
                break;
            }
        }

        showNotificationToast(context, 'Staff member deactivated', 'success');
        applyStaffFilters(context);
    });
}

// ===== PERMANENTLY DELETE STAFF =====
// Actually removes the account from the database — unlike deactivate above,
// this cannot be undone. api/delete_staff.php refuses accounts that have
// any report/work-order history, so this only succeeds for accounts that
// never did anything (test/spam signups, mistaken creations).
function confirmDeleteStaffPermanently(arg, context) {
    var staffId = parseInt(arg);
    if (!staffId) return;

    requestConfirm(context, 'Permanently delete this account? This cannot be undone and removes it from the database entirely. Accounts with report or work order history cannot be deleted this way — deactivate those instead.', 'Delete Account Permanently', function() {
        context.fetch('api/delete_staff.php', { method: 'POST', body: { id: staffId } }, function(result) {
            if (!result.ok) {
                showNotificationToast(context, (result && result.data) || 'Failed to delete account', 'error');
                return;
            }

            app.memory.staff = (app.memory.staff || []).filter(function(s) { return s.id !== staffId; });
            showNotificationToast(context, 'Account permanently deleted', 'success');
            applyStaffFilters(context);
        });
    }, 'reject', 'fa-user-xmark');
}

// ===== ASSIGN / EDIT SKILLS =====
// Turns any registered user (including a plain reporter who signed up via
// Google) into assignable staff, or updates an existing staff member's
// skill set. See api/update_staff_skills.php.
var STAFF_CATEGORIES = [
    { id: 1, name: 'Electrical' },
    { id: 2, name: 'Plumbing' },
    { id: 3, name: 'Carpentry' },
    { id: 4, name: 'Roofing' },
    { id: 5, name: 'HVAC' },
    { id: 6, name: 'Civil' },
    { id: 7, name: 'General' }
];

function openEditSkillsPopup(arg, context) {
    var staffId = parseInt(arg);
    if (!staffId) return;

    var staff = (app.memory.staff || []).filter(function(s) { return s.id === staffId; })[0];
    if (!staff) return;

    var currentSkillIds = (staff.skill_ids || '').split(',').map(function(v) { return parseInt(v, 10); }).filter(Boolean);

    var skillOptions = STAFF_CATEGORIES.map(function(c) {
        var selected = currentSkillIds.indexOf(c.id) !== -1 ? ' selected' : '';
        return '<option value="' + c.id + '"' + selected + '>' + c.name + '</option>';
    }).join('');

    var deptOptions = STAFF_CATEGORIES.map(function(c) {
        var selected = staff.department === c.name ? ' selected' : '';
        return '<option value="' + c.name + '"' + selected + '>' + c.name + '</option>';
    }).join('');

    var ROLES = ['admin', 'supervisor', 'technician', 'reporter'];
    var isSelf = app.memory.user && app.memory.user.id === staffId;
    var roleOptions = ROLES.map(function(r) {
        var selected = staff.role === r ? ' selected' : '';
        var label = r.charAt(0).toUpperCase() + r.slice(1);
        return '<option value="' + r + '"' + selected + '>' + label + '</option>';
    }).join('');

    var selectStyle = 'width:100%;padding:8px 10px;border:1px solid #dfe3e8;border-radius:8px;font-size:13px;font-family:inherit;';

    openPopup(context,
        '<div class="popup-content">' +
        '  <div class="popup-header">' +
        '    <h3><i class="fas fa-screwdriver-wrench"></i> ' + escapeHtml(staff.name) + '</h3>' +
        '    <button class="popup-close" action="closePopup"><i class="fas fa-times"></i></button>' +
        '  </div>' +
        '  <div class="popup-body">' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-user-shield"></i> Role</label>' +
        '      <select id="edit-skills-role" style="' + selectStyle + '"' + (isSelf ? ' disabled' : '') + '>' +
        roleOptions +
        '      </select>' +
        (isSelf ? '      <p style="font-size:11px;color:#9aa1ac;margin-top:4px;">You can\'t change your own role here — ask another admin.</p>' : '') +
        '    </div>' +
        '    <p style="font-size:13px;color:#6b7280;margin-bottom:14px;">Giving this account skills makes it eligible for auto-assignment on matching reports — regardless of role.</p>' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-building"></i> Department</label>' +
        '      <select id="edit-skills-department" style="' + selectStyle + '">' +
        deptOptions +
        '      </select>' +
        '    </div>' +
        '    <div class="popup-field">' +
        '      <label><i class="fas fa-toolbox"></i> Skills (auto-assignment matches on these)</label>' +
        '      <select id="edit-skills-select" multiple style="' + selectStyle + 'min-height:110px;">' +
        skillOptions +
        '      </select>' +
        '    </div>' +
        '  </div>' +
        '  <div class="popup-footer">' +
        '    <button class="popup-btn secondary" action="closePopup">Cancel</button>' +
        '    <button class="popup-btn approve" action="saveStaffSkills: ' + staffId + '"><i class="fas fa-check"></i> Save</button>' +
        '  </div>' +
        '</div>'
    );
}

function saveStaffSkills(arg, context) {
    var staffId = parseInt(arg);
    var roleSelect = document.getElementById('edit-skills-role');
    var deptSelect = document.getElementById('edit-skills-department');
    var skillsSelect = document.getElementById('edit-skills-select');
    if (!staffId || !deptSelect || !skillsSelect) return;

    var skills = Array.prototype.map.call(skillsSelect.selectedOptions, function(o) { return parseInt(o.value, 10); });
    if (skills.length === 0) {
        alert('Select at least one skill.');
        return;
    }

    var payload = { user_id: staffId, department: deptSelect.value, skills: skills };
    if (roleSelect && !roleSelect.disabled) {
        payload.role = roleSelect.value;
    }

    context.fetch('api/update_staff_skills.php', {
        method: 'POST',
        body: payload
    }, function(result) {
        if (!result.ok) {
            showNotificationToast(context, (result && result.data) || 'Failed to update skills', 'error');
            return;
        }

        for (var i = 0; i < app.memory.staff.length; i++) {
            if (app.memory.staff[i].id === staffId) {
                app.memory.staff[i].role = result.data.role;
                app.memory.staff[i].department = result.data.department;
                app.memory.staff[i].specialisation = result.data.specialisation;
                app.memory.staff[i].skill_ids = result.data.skills.join(',');
                app.memory.staff[i].is_active = 1;
                break;
            }
        }

        closePopup(context);
        showNotificationToast(context, 'Staff updated', 'success');
        applyStaffFilters(context);
    });
}

// ===== EXPOSE =====
window.loadStaffPage = loadStaffPage;
window.staffsPrev = staffsPrev;
window.staffsNext = staffsNext;
window.goToAddStaff = goToAddStaff;
window.confirmDeactivateStaff = confirmDeactivateStaff;
window.confirmDeleteStaffPermanently = confirmDeleteStaffPermanently;
window.openEditSkillsPopup = openEditSkillsPopup;
window.saveStaffSkills = saveStaffSkills;