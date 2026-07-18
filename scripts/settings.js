// ========================================
// SETTINGS MODULE
// ========================================

// ===== LOAD SETTINGS PAGE =====
function loadSettingsPage(context) {
    // Update user info in settings
    var userName = app.memory.user ? app.memory.user.name : 'John Doe';
    var userEmail = app.memory.user ? app.memory.user.email : 'john@cmms.dev';
    
    context.query('#settings-user-name').text(userName);
    context.query('#settings-user-email').text(userEmail);
    context.query('#settings-user-role').text('Administrator');
    
    // Set environment
    context.query('#settings-environment').text('Development');
    
    // Set last login
    var now = new Date();
    var dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    var timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    context.query('#settings-last-login').text(dateStr + ', ' + timeStr);
    
    // Set system stats
    // (use staffWorkload instead):
var totalUsers = app.memory.staffWorkload ? app.memory.staffWorkload.length : 0;
    context.query('#settings-total-users').text(totalUsers || 0);
    context.query('#settings-total-reports').text(app.memory.reports ? app.memory.reports.length : 0);
    context.query('#settings-total-orders').text(app.memory.workOrders ? app.memory.workOrders.length : 0);
    
    // About section stats
    context.query('#about-total-users').text(totalUsers || 0);
    context.query('#about-total-reports').text(app.memory.reports ? app.memory.reports.length : 0);
    context.query('#about-total-orders').text(app.memory.workOrders ? app.memory.workOrders.length : 0);
    
    // Load saved preferences
    loadPreferences(context);
}

// ===== PREFERENCES =====
function loadPreferences(context) {
    // Dark mode
    var darkMode = localStorage.getItem('cmms_dark_mode') === 'true';
    var darkToggle = context.query('#dark-mode-toggle');
    if (darkToggle.exists) {
        if (darkMode) {
            darkToggle.element.classList.add('active');
        } else {
            darkToggle.element.classList.remove('active');
        }
        if (darkMode) {
            applyTheme(true);
        }
    }
    
    // Notifications
    var notifEnabled = localStorage.getItem('cmms_notifications') !== 'false';
    var notifToggle = context.query('#notif-toggle');
    if (notifToggle.exists) {
        if (notifEnabled) {
            notifToggle.element.classList.add('active');
        } else {
            notifToggle.element.classList.remove('active');
        }
    }
    
    // Auto-assign
    var autoAssign = localStorage.getItem('cmms_auto_assign') === 'true';
    var autoToggle = context.query('#auto-assign-toggle');
    if (autoToggle.exists) {
        if (autoAssign) {
            autoToggle.element.classList.add('active');
        } else {
            autoToggle.element.classList.remove('active');
        }
    }
    
    // Email reports
    var emailReports = localStorage.getItem('cmms_email_reports') !== 'false';
    var emailToggle = context.query('#email-reports-toggle');
    if (emailToggle.exists) {
        if (emailReports) {
            emailToggle.element.classList.add('active');
        } else {
            emailToggle.element.classList.remove('active');
        }
    }
    
    // Compact mode
    var compactMode = localStorage.getItem('cmms_compact_mode') === 'true';
    var compactToggle = context.query('#compact-toggle');
    if (compactToggle.exists) {
        if (compactMode) {
            compactToggle.element.classList.add('active');
        } else {
            compactToggle.element.classList.remove('active');
        }
        if (compactMode) {
            applyCompactMode(true);
        }
    }
    
    // Font size
    var fontSize = localStorage.getItem('cmms_font_size') || '14';
    context.query('#font-size-value').text(fontSize + 'px');
    document.body.style.fontSize = fontSize + 'px';
    
    // Language
    var language = localStorage.getItem('cmms_language') || 'en';
    var langSelect = context.query('#language-select');
    if (langSelect.exists) {
        langSelect.element.value = language;
    }
}

// ===== NOTIFICATION TOGGLE FUNCTIONS =====
function toggleDarkMode(context) {
    var toggle = context.query('#dark-mode-toggle');
    if (!toggle.exists) return;
    
    var isActive = toggle.element.classList.contains('active');
    if (isActive) {
        toggle.element.classList.remove('active');
        localStorage.setItem('cmms_dark_mode', 'false');
        applyTheme(false);
        showNotificationToast(context, 'Dark mode disabled', 'info');
    } else {
        toggle.element.classList.add('active');
        localStorage.setItem('cmms_dark_mode', 'true');
        applyTheme(true);
        showNotificationToast(context, 'Dark mode enabled', 'success');
    }
}

function toggleNotificationsPref(context) {
    var toggle = context.query('#notif-toggle');
    if (!toggle.exists) return;
    
    var isActive = toggle.element.classList.contains('active');
    if (isActive) {
        toggle.element.classList.remove('active');
        localStorage.setItem('cmms_notifications', 'false');
        showNotificationToast(context, 'Notifications disabled', 'info');
    } else {
        toggle.element.classList.add('active');
        localStorage.setItem('cmms_notifications', 'true');
        showNotificationToast(context, 'Notifications enabled', 'success');
    }
}

function toggleAutoAssign(context) {
    var toggle = context.query('#auto-assign-toggle');
    if (!toggle.exists) return;
    
    var isActive = toggle.element.classList.contains('active');
    if (isActive) {
        toggle.element.classList.remove('active');
        localStorage.setItem('cmms_auto_assign', 'false');
        showNotificationToast(context, 'Auto-assign disabled', 'info');
    } else {
        toggle.element.classList.add('active');
        localStorage.setItem('cmms_auto_assign', 'true');
        showNotificationToast(context, 'Auto-assign enabled', 'success');
    }
}

function toggleEmailReports(context) {
    var toggle = context.query('#email-reports-toggle');
    if (!toggle.exists) return;
    
    var isActive = toggle.element.classList.contains('active');
    if (isActive) {
        toggle.element.classList.remove('active');
        localStorage.setItem('cmms_email_reports', 'false');
        showNotificationToast(context, 'Email reports disabled', 'info');
    } else {
        toggle.element.classList.add('active');
        localStorage.setItem('cmms_email_reports', 'true');
        showNotificationToast(context, 'Email reports enabled', 'success');
    }
}

function toggleCompactMode(context) {
    var toggle = context.query('#compact-toggle');
    if (!toggle.exists) return;
    
    var isActive = toggle.element.classList.contains('active');
    if (isActive) {
        toggle.element.classList.remove('active');
        localStorage.setItem('cmms_compact_mode', 'false');
        applyCompactMode(false);
        showNotificationToast(context, 'Compact mode disabled', 'info');
    } else {
        toggle.element.classList.add('active');
        localStorage.setItem('cmms_compact_mode', 'true');
        applyCompactMode(true);
        showNotificationToast(context, 'Compact mode enabled', 'success');
    }
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

function changeLanguage(context) {
    var select = context.query('#language-select');
    if (!select.exists) return;
    var language = select.element.value;
    localStorage.setItem('cmms_language', language);
    showNotificationToast(context, 'Language changed to ' + language, 'success');
}

function refreshSettings(context) {
    loadPreferences(context);
    showNotificationToast(context, 'Settings refreshed', 'success');
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
        
        var labels = document.querySelectorAll('.setting-label');
        labels.forEach(function(label) {
            label.style.color = '#e0e0e0';
        });
        
        var values = document.querySelectorAll('.setting-value');
        values.forEach(function(value) {
            value.style.color = '#aaa';
        });
        
        var headers = document.querySelectorAll('.settings-card .card-header h3');
        headers.forEach(function(header) {
            header.style.color = '#e0e0e0';
        });
        
        var subtitles = document.querySelectorAll('.card-subtitle');
        subtitles.forEach(function(subtitle) {
            subtitle.style.color = '#888';
        });
        
    } else {
        body.style.background = '';
        body.style.color = '';
        if (appElement) appElement.style.background = '';
        
        cards.forEach(function(card) {
            card.style.background = '';
            card.style.borderColor = '';
        });
        
        var labels = document.querySelectorAll('.setting-label');
        labels.forEach(function(label) {
            label.style.color = '';
        });
        
        var values = document.querySelectorAll('.setting-value');
        values.forEach(function(value) {
            value.style.color = '';
        });
        
        var headers = document.querySelectorAll('.settings-card .card-header h3');
        headers.forEach(function(header) {
            header.style.color = '';
        });
        
        var subtitles = document.querySelectorAll('.card-subtitle');
        subtitles.forEach(function(subtitle) {
            subtitle.style.color = '';
        });
    }
}

function applyCompactMode(isCompact) {
    var cards = document.querySelectorAll('.settings-card');
    if (isCompact) {
        cards.forEach(function(card) {
            card.style.padding = '0';
        });
        var items = document.querySelectorAll('.setting-item');
        items.forEach(function(item) {
            item.style.padding = '6px 12px';
        });
        var headers = document.querySelectorAll('.settings-card .card-header');
        headers.forEach(function(header) {
            header.style.padding = '10px 12px';
        });
    } else {
        cards.forEach(function(card) {
            card.style.padding = '';
        });
        var items = document.querySelectorAll('.setting-item');
        items.forEach(function(item) {
            item.style.padding = '';
        });
        var headers = document.querySelectorAll('.settings-card .card-header');
        headers.forEach(function(header) {
            header.style.padding = '';
        });
    }
}

// ===== SETTINGS ACTIONS =====
function editProfile(context) {
    showNotificationToast(context, 'Edit profile feature coming soon', 'info');
}

function editEmail(context) {
    showNotificationToast(context, 'Edit email feature coming soon', 'info');
}

function clearAllData(context) {
    if (confirm('⚠️ Are you sure you want to clear all data? This action cannot be undone.')) {
        localStorage.clear();
        showNotificationToast(context, 'All data cleared successfully', 'success');
        setTimeout(function() {
            window.location.reload();
        }, 1000);
    }
}

function deactivateAccount(context) {
    if (confirm('⚠️ Are you sure you want to deactivate your account?')) {
        showNotificationToast(context, 'Account deactivated', 'info');
    }
}

// ========================================
// EXPOSE GLOBAL FUNCTIONS
// ========================================

window.loadSettingsPage = loadSettingsPage;
window.editProfile = editProfile;
window.editEmail = editEmail;
window.clearAllData = clearAllData;
window.deactivateAccount = deactivateAccount;
window.toggleDarkMode = toggleDarkMode;
window.toggleNotificationsPref = toggleNotificationsPref;
window.toggleAutoAssign = toggleAutoAssign;
window.toggleEmailReports = toggleEmailReports;
window.toggleCompactMode = toggleCompactMode;
window.decreaseFontSize = decreaseFontSize;
window.increaseFontSize = increaseFontSize;
window.changeLanguage = changeLanguage;
window.refreshSettings = refreshSettings;
window.applyTheme = applyTheme;
window.applyCompactMode = applyCompactMode;