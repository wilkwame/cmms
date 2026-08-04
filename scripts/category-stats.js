// ========================================
// CATEGORY STATS MODULE
// ========================================

// Distinct hue per item (cycled if there are ever more items than colors) so
// bars read apart from each other at a glance, not just by width.
var CATEGORY_COLORS = ['#237FEA', '#7c3aed', '#14b8a6', '#f59e0b', '#ec4899', '#22c55e', '#06b6d4', '#64748b'];

function loadCategoryStatsPage(context) {
    context.render('#category-bars-body', '<p class="loading-text">Loading category stats...</p>');

    app.php('api/get_category_stats.php', {})
        .then(function(result) {
            if (handleAuthFailure(result)) return;
            if (!result.ok) {
                context.render('#category-bars-body', '<p class="empty-state">Failed to load category stats.</p>');
                return;
            }
            // Both breakdowns are fetched together and cached — switching
            // views (see switchCategoryStatsView) just re-renders from what's
            // already here, no extra round trip.
            app.memory.categoryStatsData = {
                category: result.data.categories || [],
                department: result.data.departments || [],
                location: result.data.locations || []
            };
            renderCategoryStats(context);
        })
        .catch(function(error) {
            console.error('Failed to load category stats:', error);
            context.render('#category-bars-body', '<p class="empty-state">Failed to load category stats. Please try again.</p>');
        });

    loadStaffPerformance(context);
}

var CATEGORY_STATS_VIEWS = {
    category:   { btn: 'cs-view-category',   title: 'Tickets by Category',   plural: 'Categories', empty: 'categories' },
    department: { btn: 'cs-view-department', title: 'Tickets by Department', plural: 'Departments', empty: 'departments' },
    location:   { btn: 'cs-view-location',   title: 'Tickets by Location',   plural: 'Locations',   empty: 'locations' }
};

function switchCategoryStatsView(arg, context) {
    if (!CATEGORY_STATS_VIEWS[arg]) return;
    app.memory.categoryStatsView = arg;

    Object.keys(CATEGORY_STATS_VIEWS).forEach(function(key) {
        var btn = document.getElementById(CATEGORY_STATS_VIEWS[key].btn);
        if (btn) btn.classList.toggle('active', key === arg);
    });

    renderCategoryStats(context);
}

function renderCategoryStats(context) {
    var view = app.memory.categoryStatsView || 'category';
    var meta = CATEGORY_STATS_VIEWS[view] || CATEGORY_STATS_VIEWS.category;
    var data = app.memory.categoryStatsData || { category: [], department: [], location: [] };
    var items = data[view] || [];

    var titleEl = document.getElementById('cs-chart-title');
    if (titleEl) titleEl.textContent = meta.title;
    var subEl = document.getElementById('cs-panel-sub');
    if (subEl) {
        subEl.textContent = meta.plural + ' sorted by ticket volume, highest first — approved and closed tickets only';
    }

    var totalReports = 0;
    var totalWorkOrders = 0;
    var maxReports = 0;

    items.forEach(function(item) {
        totalReports += item.report_count;
        totalWorkOrders += item.work_order_count;
        if (item.report_count > maxReports) maxReports = item.report_count;
    });

    context.query('#cs-kpi-total-reports').text(totalReports);
    context.query('#cs-kpi-total-work-orders').text(totalWorkOrders);
    context.query('#cs-kpi-top-category').text(items.length && items[0].report_count > 0 ? items[0].name : '—');

    // Cached for downloadCategoryChart, which redraws this exact data onto a
    // canvas — kept in memory instead of re-fetching so the downloaded image
    // always matches whatever view is on screen right now.
    app.memory.categoryStatsCurrent = items;
    app.memory.categoryStatsCurrentTitle = meta.title;

    if (items.length === 0) {
        context.render('#category-bars-body', '<p class="empty-state">No ' + meta.empty + ' found.</p>');
        return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
        var c = items[i];
        var hasReports = c.report_count > 0;
        var pct = maxReports > 0 ? Math.round((c.report_count / maxReports) * 100) : 0;
        var fillWidth = hasReports ? Math.max(pct, 4) : 0;
        var color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];

        html += '<div class="category-bar-row">';
        html += '  <span class="category-bar-label">' + escapeHtml(c.name) + '</span>';
        html += '  <span class="category-bar-track"><span class="category-bar-fill' + (hasReports ? '' : ' is-zero') + '" style="width:' + fillWidth + '%;background:' + color + '"></span></span>';
        html += '  <span class="category-bar-meta"><strong>' + c.report_count + '</strong> ticket' + (c.report_count === 1 ? '' : 's') +
            '<span class="meta-divider">&middot;</span>' + c.work_order_count + ' work order' + (c.work_order_count === 1 ? '' : 's') + '</span>';
        html += '</div>';
    }
    context.render('#category-bars-body', html);
}

// ===== STAFF PERFORMANCE (item 8: date-ranged, exportable) =====
function loadStaffPerformance(context, startDate, endDate) {
    context.render('#staff-perf-body', '<p class="loading-text">Loading staff performance...</p>');

    app.php('api/get_staff_performance.php', { start_date: startDate || null, end_date: endDate || null })
        .then(function(result) {
            if (handleAuthFailure(result)) return;
            if (!result.ok) {
                context.render('#staff-perf-body', '<p class="empty-state">Failed to load staff performance.</p>');
                return;
            }
            app.memory.staffPerfData = result.data.staff || [];
            app.memory.staffPerfRange = { start: result.data.start_date, end: result.data.end_date };
            renderStaffPerformance(context);
        })
        .catch(function(error) {
            console.error('Failed to load staff performance:', error);
            context.render('#staff-perf-body', '<p class="empty-state">Failed to load staff performance. Please try again.</p>');
        });
}

function applyStaffPerfFilter(context) {
    var startEl = document.getElementById('sp-start-date');
    var endEl = document.getElementById('sp-end-date');
    var start = startEl && startEl.value ? startEl.value : null;
    var end = endEl && endEl.value ? endEl.value : null;

    if (start && end && start > end) {
        showNotificationToast(context, '"From" date must be before "To" date.', 'error');
        return;
    }

    loadStaffPerformance(context, start, end);
}

function clearStaffPerfFilter(context) {
    var startEl = document.getElementById('sp-start-date');
    var endEl = document.getElementById('sp-end-date');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    loadStaffPerformance(context);
}

// mins -> "2h 15m" / "45m" / "—" (no completed jobs to average yet).
function formatDurationMinutes(mins) {
    if (mins === null || mins === undefined) return '—';
    var hours = Math.floor(mins / 60);
    var rest = mins % 60;
    if (hours === 0) return rest + 'm';
    return hours + 'h' + (rest > 0 ? ' ' + rest + 'm' : '');
}

function renderStaffPerformance(context) {
    var items = app.memory.staffPerfData || [];
    var range = app.memory.staffPerfRange || { start: null, end: null };

    var subEl = document.getElementById('sp-panel-sub');
    if (subEl) {
        var rangeText = (range.start && range.end) ? (range.start + ' to ' + range.end)
            : range.start ? ('from ' + range.start)
            : range.end ? ('through ' + range.end)
            : 'All time';
        subEl.textContent = rangeText + ' — completed jobs, active jobs, and average time to complete';
    }

    if (items.length === 0) {
        context.render('#staff-perf-body', '<p class="empty-state">No technicians found.</p>');
        return;
    }

    var maxCompleted = 0;
    items.forEach(function(item) { if (item.completed_jobs > maxCompleted) maxCompleted = item.completed_jobs; });

    var html = '';
    for (var i = 0; i < items.length; i++) {
        var s = items[i];
        var hasCompleted = s.completed_jobs > 0;
        var pct = maxCompleted > 0 ? Math.round((s.completed_jobs / maxCompleted) * 100) : 0;
        var fillWidth = hasCompleted ? Math.max(pct, 4) : 0;
        var color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];

        html += '<div class="staff-perf-row">';
        html += '  <span class="staff-perf-label"><span class="staff-perf-name">' + escapeHtml(s.name) + '</span>' +
            (s.department_name ? '<span class="staff-perf-dept">' + escapeHtml(s.department_name) + '</span>' : '') + '</span>';
        html += '  <span class="staff-perf-track"><span class="staff-perf-fill' + (hasCompleted ? '' : ' is-zero') + '" style="width:' + fillWidth + '%;background:' + color + '"></span></span>';
        html += '  <span class="staff-perf-meta"><strong>' + s.completed_jobs + '</strong> completed' +
            '<span class="meta-divider">&middot;</span>' + s.active_jobs + ' active' +
            '<span class="meta-divider">&middot;</span>avg ' + formatDurationMinutes(s.avg_completion_minutes) + '</span>';
        html += '</div>';
    }
    context.render('#staff-perf-body', html);
}

function downloadStaffPerfChart(arg, context) {
    var format = (arg === 'pdf') ? 'pdf' : 'png';
    var items = app.memory.staffPerfData || [];
    if (items.length === 0) {
        showNotificationToast(context, 'Nothing to download yet', 'error');
        return;
    }

    var range = app.memory.staffPerfRange || { start: null, end: null };
    var subtitle = (range.start && range.end) ? (range.start + ' to ' + range.end)
        : range.start ? ('From ' + range.start)
        : range.end ? ('Through ' + range.end)
        : 'All time';

    var canvas = buildCategoryChartCanvas(items, 'Staff Performance', {
        valueKey: 'completed_jobs',
        subtitle: subtitle,
        metaText: function(item) {
            return item.completed_jobs + ' completed · ' + item.active_jobs + ' active · avg ' + formatDurationMinutes(item.avg_completion_minutes);
        }
    });
    var fileStem = 'staff-performance-' + new Date().toISOString().slice(0, 10);

    if (format === 'png') {
        canvas.toBlob(function(blob) {
            if (!blob) {
                showNotificationToast(context, 'Failed to generate image', 'error');
                return;
            }
            downloadBlob(blob, fileStem + '.png');
        }, 'image/png');
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        showNotificationToast(context, 'PDF export is unavailable right now — try the PNG download instead.', 'error');
        return;
    }
    var imgData = canvas.toDataURL('image/png');
    var pxToPt = 72 / 96;
    var logicalWidth = canvas.width / 2;
    var logicalHeight = canvas.height / 2;
    var pdfWidth = logicalWidth * pxToPt;
    var pdfHeight = logicalHeight * pxToPt;

    var pdf = new window.jspdf.jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [pdfWidth, pdfHeight]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(fileStem + '.pdf');
}

// ===== DOWNLOAD CHART (PNG or PDF) =====
// Redraws the current view's bars onto an offscreen canvas (rather than
// screenshotting the DOM, which would need an extra library) and saves it
// either as a PNG image directly, or embedded into a one-page PDF via jsPDF.
function downloadCategoryChart(arg, context) {
    var format = (arg === 'pdf') ? 'pdf' : 'png';
    var items = app.memory.categoryStatsCurrent || [];
    if (items.length === 0) {
        showNotificationToast(context, 'Nothing to download yet', 'error');
        return;
    }

    var title = app.memory.categoryStatsCurrentTitle || 'Tickets by Category';
    var canvas = buildCategoryChartCanvas(items, title);
    var fileStem = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + new Date().toISOString().slice(0, 10);

    if (format === 'png') {
        canvas.toBlob(function(blob) {
            if (!blob) {
                showNotificationToast(context, 'Failed to generate image', 'error');
                return;
            }
            downloadBlob(blob, fileStem + '.png');
        }, 'image/png');
        return;
    }

    // PDF: embed the same canvas as a single image on one page.
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showNotificationToast(context, 'PDF export is unavailable right now — try the PNG download instead.', 'error');
        return;
    }
    var imgData = canvas.toDataURL('image/png');
    var pxToPt = 72 / 96; // CSS pixels -> PDF points, at the standard 96dpi
    // canvas is drawn at 2x scale (see buildCategoryChartCanvas) — convert
    // back to its logical CSS size before converting to PDF points.
    var logicalWidth = canvas.width / 2;
    var logicalHeight = canvas.height / 2;
    var pdfWidth = logicalWidth * pxToPt;
    var pdfHeight = logicalHeight * pxToPt;

    var pdf = new window.jspdf.jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [pdfWidth, pdfHeight]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(fileStem + '.pdf');
}

function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// options: { subtitle, valueKey (default 'report_count'), metaText(item) ->
// string }. Staff Performance reuses this same drawer with its own value
// field and meta formatter instead of duplicating the whole layout.
function buildCategoryChartCanvas(items, title, options) {
    options = options || {};
    var valueKey = options.valueKey || 'report_count';
    var subtitle = options.subtitle || 'Sorted by ticket volume, highest first';
    var metaText = options.metaText || function(item) {
        return item.report_count + ' ticket' + (item.report_count === 1 ? '' : 's');
    };

    var maxValue = 0;
    items.forEach(function(item) { if (item[valueKey] > maxValue) maxValue = item[valueKey]; });

    var scale = 2; // draw at 2x for a crisp download on high-DPI screens
    var width = 820;
    var rowHeight = 52;
    var headerHeight = 74;
    var footerHeight = 30;
    var height = headerHeight + items.length * rowHeight + footerHeight;

    var canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillText(title, 24, 32);
    ctx.fillStyle = '#9aa1ac';
    ctx.font = '400 12px Arial, sans-serif';
    ctx.fillText(subtitle + ' · exported ' + formatDate(new Date()), 24, 52);

    var labelW = 130;
    var metaW = 190;
    var trackX = 24 + labelW;
    var trackW = width - 24 - labelW - metaW - 24;

    for (var i = 0; i < items.length; i++) {
        var c = items[i];
        var y = headerHeight + i * rowHeight;
        var trackY = y + rowHeight / 2 - 7;
        var value = c[valueKey] || 0;
        var hasValue = value > 0;
        var pct = maxValue > 0 ? Math.max(value / maxValue, hasValue ? 0.04 : 0) : 0;
        var color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];

        // Label
        ctx.fillStyle = '#333333';
        ctx.font = '600 13px Arial, sans-serif';
        ctx.fillText(truncateForCanvas(ctx, c.name, labelW - 10), 24, y + rowHeight / 2 + 4);

        // Track
        ctx.fillStyle = '#e8f1fd';
        roundRect(trackX, trackY, trackW, 14, 7);
        ctx.fill();

        // Fill
        if (hasValue) {
            ctx.fillStyle = color;
            roundRect(trackX, trackY, Math.max(trackW * pct, 14), 14, 7);
            ctx.fill();
        }

        // Meta text (right-aligned)
        ctx.textAlign = 'right';
        ctx.fillStyle = color;
        ctx.font = '700 13px Arial, sans-serif';
        ctx.fillText(truncateForCanvas(ctx, metaText(c), metaW - 10), width - 24, y + rowHeight / 2 + 4);
        ctx.textAlign = 'left';
    }

    return canvas;
}

function truncateForCanvas(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var truncated = text;
    while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
}

// ===== EXPOSE =====
window.loadCategoryStatsPage = loadCategoryStatsPage;
window.switchCategoryStatsView = switchCategoryStatsView;
window.downloadCategoryChart = downloadCategoryChart;
window.applyStaffPerfFilter = applyStaffPerfFilter;
window.clearStaffPerfFilter = clearStaffPerfFilter;
window.downloadStaffPerfChart = downloadStaffPerfChart;
