// ========================================
// CATEGORY STATS MODULE
// ========================================

function loadCategoryStatsPage(context) {
    context.render('#category-bars-body', '<p class="loading-text">Loading category stats...</p>');

    app.php('api/get_category_stats.php', {})
        .then(function(result) {
            if (handleAuthFailure(result)) return;
            if (!result.ok) {
                context.render('#category-bars-body', '<p class="empty-state">Failed to load category stats.</p>');
                return;
            }
            renderCategoryStats(context, result.data.categories || []);
        })
        .catch(function(error) {
            console.error('Failed to load category stats:', error);
            context.render('#category-bars-body', '<p class="empty-state">Failed to load category stats. Please try again.</p>');
        });
}

function renderCategoryStats(context, categories) {
    var totalReports = 0;
    var totalWorkOrders = 0;
    var maxReports = 0;

    categories.forEach(function(c) {
        totalReports += c.report_count;
        totalWorkOrders += c.work_order_count;
        if (c.report_count > maxReports) maxReports = c.report_count;
    });

    context.query('#cs-kpi-total-reports').text(totalReports);
    context.query('#cs-kpi-total-work-orders').text(totalWorkOrders);
    context.query('#cs-kpi-top-category').text(categories.length && categories[0].report_count > 0 ? categories[0].name : '—');

    if (categories.length === 0) {
        context.render('#category-bars-body', '<p class="empty-state">No categories found.</p>');
        return;
    }

    var html = '';
    for (var i = 0; i < categories.length; i++) {
        var c = categories[i];
        var pct = maxReports > 0 ? Math.round((c.report_count / maxReports) * 100) : 0;
        html += '<div class="category-bar-row">';
        html += '  <span class="category-bar-label">' + escapeHtml(c.name) + '</span>';
        html += '  <span class="category-bar-track"><span class="category-bar-fill" style="width:' + (c.report_count > 0 ? Math.max(pct, 3) : 0) + '%"></span></span>';
        html += '  <span class="category-bar-meta"><strong>' + c.report_count + '</strong> reports &middot; ' + c.work_order_count + ' work orders</span>';
        html += '</div>';
    }
    context.render('#category-bars-body', html);
}

// ===== EXPOSE =====
window.loadCategoryStatsPage = loadCategoryStatsPage;
