// ========================================
// ADD STAFF MODULE - Clean Version
// ========================================

// ===== LOAD ADD STAFF PAGE =====
function loadAddStaffPage(context) {
    // Auto-fill joined date
    var today = new Date().toISOString().split('T')[0];
    var dateInput = context.query('#joined-date');
    if (dateInput.exists && !dateInput.element.value) {
        dateInput.element.value = today;
    }
    
    // Reset form status
    var status = context.query('#form-status');
    if (status.exists) {
        status.text('All fields marked with * are required');
        status.element.style.color = '#999';
    }
    
    // Reset submit button
    var submitBtn = context.query('#submit-btn');
    if (submitBtn.exists) {
        submitBtn.element.disabled = false;
        submitBtn.html('<i class="fas fa-save"></i> Add Staff');
    }
}

// ===== SUBMIT NEW STAFF =====
function submitNewStaff(context) {
    // Prevent default form submission
    if (context.event) {
        context.event.preventDefault();
    }
    
    // Get form values using Clera's context.values
    var name = context.values.name ? context.values.name.trim() : '';
    var email = context.values.email ? context.values.email.trim() : '';
    var password = context.values.password || '';
    var confirmPassword = context.values.confirm_password || '';
    var role = context.values.role || '';
    var department = context.values.department || '';
    var joinedAt = context.values.joined_at || '';
    var isActive = context.values.is_active || '1';

    var skillsGroup = context.query('#staff-skills');
    var skills = [];
    if (skillsGroup.exists) {
        Array.prototype.forEach.call(skillsGroup.element.querySelectorAll('input[type="checkbox"]:checked'), function(cb) {
            skills.push(parseInt(cb.value, 10));
        });
    }

    // Validation
    var errors = [];

    if (!name) errors.push('Full name is required');
    if (!email) errors.push('Email is required');
    if (email && !email.includes('@')) errors.push('Please enter a valid email address');
    if (!password) errors.push('Password is required');
    if (password && password.length < 6) errors.push('Password must be at least 6 characters');
    if (password !== confirmPassword) errors.push('Passwords do not match');
    if (!role) errors.push('Please select a role');
    if (!department) errors.push('Please select a department');
    if (skills.length === 0) errors.push('Please select at least one skill');

    // Show errors if any. #form-status is a persistent inline status line;
    // showErrorPopup is the app's proven, always-visible feedback path — used
    // as well so a missing/renamed status element never means a silent
    // no-op click, which is exactly what happened before this was added.
    if (errors.length > 0) {
        var status = context.query('#form-status');
        if (status.exists) {
            status.text('⚠️ ' + errors.join(' • '));
            status.element.style.color = '#ff3b30';
        }
        showErrorPopup(errors.join(' • '), 'Check the form');
        return;
    }

    // Build payload
    var payload = {
        name: name,
        email: email,
        password: password,
        role: role,
        department: department,
        skills: skills,
        joined_at: joinedAt || null,
        is_active: parseInt(isActive)
    };
    
    // Show loading state
    var submitBtn = context.query('#submit-btn');
    if (submitBtn.exists) {
        submitBtn.element.disabled = true;
        submitBtn.html('<i class="fas fa-spinner fa-spin"></i> Adding...');
    }
    
    var statusEl = context.query('#form-status');
    if (statusEl.exists) {
        statusEl.text('⏳ Adding staff...');
        statusEl.element.style.color = '#237FEA';
    }
    
    // Use context.fetch - Clera's built-in fetch
    context.fetch('api/insert_staff.php', {
        method: 'POST',
        body: payload  // context.fetch auto-stringifies objects
    }, function(result) {
        // Reset button
        if (submitBtn.exists) {
            submitBtn.element.disabled = false;
            submitBtn.html('<i class="fas fa-save"></i> Add Staff');
        }
        
        if (result && result.ok) {
            // Success
            if (statusEl.exists) {
                statusEl.text('✅ Staff added successfully!');
                statusEl.element.style.color = '#34c759';
            }
            
            // Clear form
            var form = context.query('#staff-form');
            if (form.exists) {
                form.element.reset();
                // Reset joined date
                var dateInput = context.query('#joined-date');
                if (dateInput.exists) {
                    var today = new Date().toISOString().split('T')[0];
                    dateInput.element.value = today;
                }
            }
            
            // Show confirmation popup
            showSuccessPopup(
                'Staff member has been added successfully!',
                'Staff Added!',
                function() {
                    context.navigate('staffs');
                }
            );
            
        } else {
            // Error
            var errorMsg = (result && result.data) || 'Failed to add staff. Please try again.';
            if (statusEl.exists) {
                statusEl.text('❌ ' + errorMsg);
                statusEl.element.style.color = '#ff3b30';
            }
            
            showErrorPopup(
                errorMsg,
                'Failed to Add Staff',
                function() {
                    var firstInput = context.query('input[name="name"]');
                    if (firstInput.exists) {
                        firstInput.element.focus();
                    }
                }
            );
        }
    });
}

// ===== GO BACK TO STAFF =====
function goToStaff(context) {
    closeMobileMenu(context);
    context.navigate('staffs');
}

// ========================================
// EXPOSE - ONCE ONLY
// ========================================

window.loadAddStaffPage = loadAddStaffPage;
window.submitNewStaff = submitNewStaff;
window.goToStaff = goToStaff;