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
            var statusClass = s.is_active == 1 ? 'status-badge active' : 'status-badge inactive';
            var statusLabel = s.is_active == 1 ? 'Active' : 'Inactive';
            var joinDate = s.joined_at ? formatDate(s.joined_at) : 'N/A';
            var role = s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : 'N/A';
            var dept = s.department || 'General';
            var ref = s.reference || ('S-' + String(s.id).padStart(3, '0'));
            
            html += '<div class="staff-row">';
            html += '  <span class="col-id">' + ref + '</span>';
            html += '  <span class="col-name">' + s.name + '</span>';
            html += '  <span class="col-role">' + role + '</span>';
            html += '  <span class="col-department">' + dept + '</span>';
            html += '  <span class="col-status"><span class="' + statusClass + '">' + statusLabel + '</span></span>';
            html += '  <span class="col-jobs">' + (s.active_jobs || 0) + '</span>';
            html += '  <span class="col-joined">' + joinDate + '</span>';
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

// ===== EXPOSE =====
window.loadStaffPage = loadStaffPage;
window.staffsPrev = staffsPrev;
window.staffsNext = staffsNext;
window.goToAddStaff = goToAddStaff;