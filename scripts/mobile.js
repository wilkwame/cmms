// ========================================
// CMMS - Mobile-Specific JavaScript
// ========================================

function isMobile() {
    return app.layout() === 'mobile';
}

function initMobile(context) {
    if (!isMobile()) return;
    
    // Add touch feedback
    setupTouchFeedback(context);
    
    // Setup pull to refresh
    setupPullToRefresh(context);
}

function setupTouchFeedback(context) {
    const elements = document.querySelectorAll('button, .clickable, .tab, .card, .report-row, .orders-row');
    
    elements.forEach(el => {
        el.addEventListener('touchstart', function() {
            this.style.transition = 'transform 0.1s';
            this.style.transform = 'scale(0.97)';
        }, { passive: true });
        
        el.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        }, { passive: true });
    });
}

function setupPullToRefresh(context) {
    const section = document.querySelector('section');
    if (!section) return;
    
    let startY = 0;
    let isPulling = false;
    let pullDistance = 0;
    const threshold = 80;
    
    // Create indicator
    const indicator = document.createElement('div');
    indicator.className = 'pull-indicator';
    indicator.textContent = '↓ Pull to refresh';
    section.prepend(indicator);
    
    section.addEventListener('touchstart', function(e) {
        if (this.scrollTop <= 0) {
            startY = e.touches[0].clientY;
            isPulling = true;
        }
    }, { passive: true });
    
    section.addEventListener('touchmove', function(e) {
        if (!isPulling) return;
        
        const delta = e.touches[0].clientY - startY;
        if (delta > 0 && this.scrollTop <= 0) {
            pullDistance = Math.min(delta, threshold);
            indicator.style.display = 'block';
            indicator.style.transform = `translateY(${pullDistance - threshold}px)`;
            
            if (pullDistance > threshold) {
                indicator.textContent = '🔄 Release to refresh';
            } else {
                indicator.textContent = '↓ Pull to refresh';
            }
        }
    }, { passive: true });
    
    section.addEventListener('touchend', function(e) {
        if (isPulling && pullDistance > threshold) {
            indicator.textContent = '⏳ Refreshing...';
            
            // Refresh current page
            const page = app.currentPage();
            if (page === 'home') {
                loadHomePage(context);
            } else if (page === 'reports') {
                loadReportsPage(context);
            } else if (page === 'workorders') {
                loadWorkOrdersPage(context);
            } else if (page === 'staffs') {
                loadStaffPage(context);
            }
            
            setTimeout(() => {
                indicator.style.display = 'none';
                indicator.style.transform = '';
            }, 1500);
        } else {
            indicator.style.display = 'none';
            indicator.style.transform = '';
        }
        
        isPulling = false;
        pullDistance = 0;
    }, { passive: true });
}

// Expose
window.isMobile = isMobile;
window.initMobile = initMobile;