// ========================================
// CMMS - LOGIN MODULE
// Google Identity Services Integration
// ========================================

(function() {
    'use strict';

    // ===== CONFIGURATION =====
    var ALLOWED_DOMAINS = ['htu.edu.gh', 'htu.edu', 'gmail.com'];
    var GOOGLE_CLIENT_ID = '529373458425-t9gi7pv04at0tvup00h7udct980uru97.apps.googleusercontent.com';

    // ===== DOM HELPERS =====
    function $(id) {
        return document.getElementById(id);
    }

    // ===== INFO MODAL =====
    function showInfoModal(message, title) {
        var modalTitle = $('info-modal-title');
        var modalMessage = $('info-modal-message');
        var overlay = $('info-modal-overlay');
        
        if (modalTitle) modalTitle.textContent = title || 'Information';
        if (modalMessage) modalMessage.textContent = message || '';
        if (overlay) overlay.classList.add('active');
    }

    function hideInfoModal() {
        var overlay = $('info-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    // ===== LOGIN ERROR =====
    function showLoginError(message) {
        var el = $('login-error');
        if (!el) return;
        el.textContent = message;
        el.className = 'login-error visible';
    }

    function hideLoginError() {
        var el = $('login-error');
        if (!el) return;
        el.className = 'login-error hidden';
        el.textContent = '';
    }

    // ===== PASSWORD TOGGLE =====
    function togglePasswordVisibility() {
        var input = $('password');
        if (!input) return;
        
        var icon = document.querySelector('.toggle-password i');
        if (!icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    // ===== HANDLE REGULAR LOGIN =====
    function handleLogin(event) {
        event.preventDefault();
        hideLoginError();

        var emailInput = $('email');
        var passwordInput = $('password');
        var rememberCheck = $('remember-checkbox');

        var email = (emailInput ? emailInput.value : '').trim();
        var password = passwordInput ? passwordInput.value : '';
        var remember = rememberCheck ? rememberCheck.checked : false;

        // Validation
        if (!email) {
            showLoginError('Please enter your email address.');
            return;
        }
        
        if (email.indexOf('@') === -1) {
            showLoginError('Please enter a valid email address.');
            return;
        }

        // Note: unlike Google sign-in, password login isn't domain-restricted —
        // admin-provisioned staff accounts may use any email domain.

        if (!password) {
            showLoginError('Please enter your password.');
            return;
        }
        
        if (password.length < 6) {
            showLoginError('Password must be at least 6 characters.');
            return;
        }

        // Show loading state
        var btn = $('login-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        }

        // Send login request
        fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email, 
                password: password, 
                remember: remember 
            })
        })
        .then(function(res) { 
            return res.json(); 
        })
        .then(function(result) {
            // Reset button
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            }

            if (result && result.ok && result.data && result.data.user) {
                // Store user data
                var store = remember ? localStorage : sessionStorage;
                store.setItem('cmms_user', JSON.stringify(result.data.user));
                store.setItem('cmms_token', result.data.token);

                // Redirect to dashboard
                window.location.href = 'index.html';
            } else {
                var msg = (result && result.data) || 'Invalid email or password. Please try again.';
                showLoginError(typeof msg === 'string' ? msg : 'Invalid email or password. Please try again.');
            }
        })
        .catch(function(error) {
            console.error('Login error:', error);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            }
            showLoginError('Could not reach the server. Please try again.');
        });
    }

    // ===== HANDLE GOOGLE CREDENTIAL RESPONSE =====
    window.handleGoogleCredentialResponse = function(response) {
        console.log('Google response received:', response);
        
        var idToken = response.credential;
        
        if (!idToken) {
            showLoginError('No Google token received. Please try again.');
            return;
        }
        
        try {
            // Decode the JWT token
            var payload = JSON.parse(atob(idToken.split('.')[1]));
            var email = payload.email;
            var name = payload.name;
            var domain = email.split('@')[1];
            
            console.log('Google user:', { email, name, domain });
            
            // Check domain
            if (ALLOWED_DOMAINS.indexOf(domain) === -1) {
                showLoginError('Please use your institutional email (@htu.edu.gh).');
                return;
            }
            
            // Show loading state
            var btn = $('google-login-btn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
            }
            
            // Send to backend
            fetch('api/google-auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_token: idToken,
                    email: email,
                    name: name
                })
            })
            .then(function(res) { 
                return res.json(); 
            })
            .then(function(result) {
                // Reset button
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-google"></i> Login with HTU Email';
                }
                
                if (result && result.ok && result.data && result.data.user) {
                    // Store user data
                    localStorage.setItem('cmms_user', JSON.stringify(result.data.user));
                    localStorage.setItem('cmms_token', result.data.token);
                    
                    // Redirect to dashboard
                    window.location.href = 'index.html';
                } else {
                    var msg = (result && result.data) || 'Google login failed. Please try again.';
                    showLoginError(typeof msg === 'string' ? msg : 'Google login failed. Please try again.');
                }
            })
            .catch(function(error) {
                console.error('Google login error:', error);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-google"></i> Login with HTU Email';
                }
                showLoginError('Could not connect to server. Please try again.');
            });
            
        } catch (e) {
            console.error('Failed to decode Google token:', e);
            showLoginError('Invalid Google authentication. Please try again.');
        }
    };

    // ===== TRIGGER GOOGLE SIGN-IN =====
    function triggerGoogleSignIn() {
        console.log('Triggering Google Sign-In...');
        
        var btn = $('google-login-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Google...';
        }
        // Check if Google Identity Services is loaded
        if (typeof google === 'undefined' || typeof google.accounts === 'undefined') {
            console.log('Google Identity Services not loaded yet, waiting...');
            showLoginError('Google services are loading. Please try again in a moment.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-google"></i> Login with HTU Email';
            }
            return;
        }
        
        try {
            // Initialize Google Sign-In
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: window.handleGoogleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: true
            });
            
            // Show the One Tap prompt
            google.accounts.id.prompt(function(notification) {
                console.log('Google prompt notification:', notification);
                
                if (notification.isNotDisplayed()) {
                    console.log('Google prompt not displayed:', notification.getNotDisplayedReason());
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-google"></i> Login with HTU Email';
                    }
                    showLoginError('Unable to display Google Sign-In. Please try again.');
                }
                
                if (notification.isSkippedMoment()) {
                    console.log('Google prompt skipped:', notification.getSkippedReason());
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-google"></i> Login with HTU Email';
                    }
                }
                
                if (notification.isDismissedMoment()) {
                    console.log('Google prompt dismissed');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-google"></i> Login with HTU Email';
                    }
                }
            });
            
        } catch (error) {
            console.error('Google Sign-In error:', error);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-google"></i> Login with HTU Email';
            }
            showLoginError('Google Sign-In error: ' + (error.message || 'Please try again.'));
        }
    }

    // ===== WIRE UP EVENTS =====
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM loaded, setting up login page...');
        console.log('Google Client ID:', GOOGLE_CLIENT_ID);
        
        // Login form
        var loginForm = $('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        // Password toggle
        var toggleBtn = $('toggle-password-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', togglePasswordVisibility);
        }

        // Google login button
        var googleBtn = $('google-login-btn');
        if (googleBtn) {
            googleBtn.addEventListener('click', function(e) {
                e.preventDefault();
                triggerGoogleSignIn();
            });
        }

        // Forgot password link
        var forgotLink = $('forgot-password-link');
        if (forgotLink) {
            forgotLink.addEventListener('click', function(e) {
                e.preventDefault();
                showInfoModal(
                    '🔑 Forgot your password?\n\n' +
                    'Please contact your system administrator to reset your password.\n\n' +
                    '━━━━━━━━━━━━━━━━━━━━━\n' +
                    '📋 Test Credentials:\n' +
                    '━━━━━━━━━━━━━━━━━━━━━\n' +
                    '👑 Admin: makwilliam.k@gmail.com / password\n' +
                    '👔 Supervisor: sandra@cmms.dev / password\n' +
                    '🔧 Technician: peter@cmms.dev / password\n' +
                    '📝 Reporter: 0322080404@htu.edu.gh / password',
                    '🔑 Forgot Password?'
                );
            });
        }

        // Register link
        var registerLink = $('register-link');
        if (registerLink) {
            registerLink.addEventListener('click', function(e) {
                e.preventDefault();
                showInfoModal(
                    '📝 New Account Request\n\n' +
                    'New accounts can only be created by system administrators.\n\n' +
                    'For testing, use the existing test accounts:\n' +
                    '• david@cmms.dev (Admin) - password\n' +
                    '• sandra@cmms.dev (Supervisor) - password\n' +
                    '• peter@cmms.dev (Technician) - password\n' +
                    '• grace@cmms.dev (Reporter) - password',
                    '📝 Contact Administrator'
                );
            });
        }

        // Info modal close button
        var closeBtn = $('info-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', hideInfoModal);
        }

        // Info modal overlay
        var overlay = $('info-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) hideInfoModal();
            });
        }

        // Focus on email input
        var emailInput = $('email');
        if (emailInput) {
            emailInput.focus();
        }

        console.log('Login page ready!');
    });

})();