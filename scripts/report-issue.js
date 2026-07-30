// ========================================
// REPORT ISSUE MODULE (reporter role)
// ========================================

var MAX_PHOTOS = 5;
var MAX_PHOTO_BYTES = 5 * 1024 * 1024;
var ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

app.memory.reportIssuePhotos = app.memory.reportIssuePhotos || [];

var LOCATIONS_CACHE_KEY = 'cmms_locations_cache';
var DEPARTMENTS_CACHE_KEY = 'cmms_departments_cache';

// app.memory.riLocations holds the full, unfiltered list fetched once per
// page visit; app.memory.riSelectedLocationId is the id of whatever the
// reporter actually picked from the search results (cleared whenever they
// switch to the free-text "Other" location instead).
function renderDepartmentOptions(departmentSelect, departments) {
    var html = '<option value="">All departments</option>';
    departments.forEach(function(d) {
        html += '<option value="' + d.id + '">' + escapeHtml(d.name) + '</option>';
    });
    html += '<option value="other">Other (not listed)</option>';
    departmentSelect.html(html);
}

function getCachedDepartments() {
    try {
        var raw = localStorage.getItem(DEPARTMENTS_CACHE_KEY);
        var parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
}

function cacheDepartments(departments) {
    try {
        localStorage.setItem(DEPARTMENTS_CACHE_KEY, JSON.stringify(departments));
    } catch (e) {
        // Cache is a nice-to-have, not required for the online path.
    }
}

// Filters app.memory.riLocations by the selected department (if any) and by
// whatever the reporter has typed so far, then renders the results dropdown
// — always with a trailing "Other" entry so a location that isn't listed is
// never a dead end.
function renderLocationResults(context) {
    var results = context.query('#ri-location-results');
    if (!results.exists) return;

    var searchEl = context.query('#ri-location-search');
    var deptEl = context.query('#ri-department');
    var term = (searchEl.exists ? searchEl.element.value : '').trim().toLowerCase();
    var deptValue = deptEl.exists ? deptEl.element.value : '';

    var locations = app.memory.riLocations || [];
    var filtered = locations.filter(function(loc) {
        if (deptValue && deptValue !== 'other' && String(loc.department_id) !== String(deptValue)) return false;
        if (term && loc.name.toLowerCase().indexOf(term) === -1) return false;
        return true;
    });

    var html = '';
    if (filtered.length === 0 && term) {
        html += '<div class="location-result-empty">No matching location</div>';
    }
    filtered.slice(0, 30).forEach(function(loc) {
        html += '<div class="location-result-item" action="selectReportIssueLocation: ' + loc.id + '">' +
            escapeHtml(loc.name) +
            (loc.department_name ? '<span class="location-result-dept">' + escapeHtml(loc.department_name) + '</span>' : '') +
            '</div>';
    });
    html += '<div class="location-result-item location-result-other" action="selectReportIssueLocation: other"><i class="fas fa-plus"></i> Other — add a new location</div>';

    results.html(html);
    results.element.classList.remove('hidden');
}

function selectReportIssueLocation(arg, context) {
    var customWrap = context.query('#ri-location-custom-wrap');
    var searchEl = context.query('#ri-location-search');
    var results = context.query('#ri-location-results');

    if (arg === 'other') {
        app.memory.riSelectedLocationId = null;
        if (searchEl.exists) searchEl.element.value = '';
        if (customWrap.exists) customWrap.element.classList.remove('hidden');
        var customInput = document.getElementById('ri-location-custom');
        if (customInput) customInput.focus();
    } else {
        var id = parseInt(arg, 10);
        var loc = (app.memory.riLocations || []).filter(function(l) { return l.id === id; })[0];
        app.memory.riSelectedLocationId = id;
        if (searchEl.exists) searchEl.element.value = loc ? loc.name : '';
        if (customWrap.exists) customWrap.element.classList.add('hidden');
    }

    if (results.exists) results.element.classList.add('hidden');
}

function getCachedLocations() {
    try {
        var raw = localStorage.getItem(LOCATIONS_CACHE_KEY);
        var parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
}

function cacheLocations(locations) {
    try {
        localStorage.setItem(LOCATIONS_CACHE_KEY, JSON.stringify(locations));
    } catch (e) {
        // Storage full/unavailable — the cache is a nice-to-have, not
        // required for the live (online) path to keep working.
    }
}

function loadReportIssuePage(context) {
    app.memory.riSelectedLocationId = null;

    var searchEl = context.query('#ri-location-search');
    if (searchEl.exists) {
        // Offline: skip the network call entirely (it would just hang until
        // it times out) and go straight to whatever was cached from the last
        // successful load — locations rarely change, so a slightly stale
        // list still lets the reporter search and pick one instead of being
        // blocked on a required field they can't fill in.
        if (!navigator.onLine) {
            app.memory.riLocations = getCachedLocations() || [];
        } else {
            app.php('api/get_locations.php', {}).then(function(result) {
                if (handleAuthFailure(result)) return;
                if (result.ok && Array.isArray(result.data)) {
                    cacheLocations(result.data);
                    app.memory.riLocations = result.data;
                } else {
                    app.memory.riLocations = getCachedLocations() || [];
                }
            }).catch(function() {
                app.memory.riLocations = getCachedLocations() || [];
            });
        }
    }

    var deptEl = context.query('#ri-department');
    if (deptEl.exists) {
        if (!navigator.onLine) {
            renderDepartmentOptions(deptEl, getCachedDepartments() || []);
        } else {
            app.php('api/get_departments.php', {}).then(function(result) {
                if (result.ok && Array.isArray(result.data)) {
                    cacheDepartments(result.data);
                    renderDepartmentOptions(deptEl, result.data);
                } else {
                    renderDepartmentOptions(deptEl, getCachedDepartments() || []);
                }
            }).catch(function() {
                renderDepartmentOptions(deptEl, getCachedDepartments() || []);
            });
        }
    }

    wireReportIssueLocationSearch(context);
    wireReportIssueDropzone(context);
    renderReportIssuePhotoPreviews(context);
}

function wireReportIssueLocationSearch(context) {
    var searchEl = context.query('#ri-location-search');
    var deptEl = context.query('#ri-department');
    var results = context.query('#ri-location-results');
    var customWrap = context.query('#ri-location-custom-wrap');
    if (!searchEl.exists) return;

    // onshow fires on every visit to this page — avoid stacking listeners.
    if (searchEl.element.dataset.wired === '1') return;
    searchEl.element.dataset.wired = '1';

    searchEl.element.addEventListener('focus', function() {
        renderLocationResults(context);
    });
    searchEl.element.addEventListener('input', function() {
        app.memory.riSelectedLocationId = null;
        renderLocationResults(context);
    });

    if (deptEl.exists) {
        deptEl.element.addEventListener('change', function() {
            // Switching department invalidates whatever was already picked
            // (it may no longer be in the narrowed-down list).
            app.memory.riSelectedLocationId = null;

            if (deptEl.element.value === 'other') {
                // Their department isn't listed, so their location almost
                // certainly isn't either — jump straight to the free-text
                // field instead of making them also find and click "Other"
                // a second time inside the location search results.
                selectReportIssueLocation('other', context);
                return;
            }

            if (customWrap.exists) customWrap.element.classList.add('hidden');
            if (searchEl.element.value) renderLocationResults(context);
        });
    }

    // Click-outside closes the results dropdown without discarding whatever
    // was already selected — same "confirm on blur" pattern as any other
    // native search/autocomplete control.
    document.addEventListener('click', function(e) {
        if (!results.exists) return;
        var combobox = searchEl.element.closest('.location-combobox');
        if (combobox && !combobox.contains(e.target)) {
            results.element.classList.add('hidden');
        }
    });
}

function wireReportIssueDropzone(context) {
    var dropzone = context.query('#ri-dropzone');
    var input = context.query('#ri-photo-input');
    var cameraBtn = context.query('#ri-camera-btn');
    var cameraInput = context.query('#ri-camera-input');
    var galleryBtn = context.query('#ri-gallery-btn');
    if (!dropzone.exists || !input.exists) return;

    // onshow fires on every visit to this page — avoid stacking listeners.
    if (dropzone.element.dataset.wired === '1') return;
    dropzone.element.dataset.wired = '1';

    if (galleryBtn.exists) {
        galleryBtn.element.addEventListener('click', function() {
            input.element.click();
        });
    }

    if (cameraBtn.exists && cameraInput.exists) {
        cameraBtn.element.addEventListener('click', function() {
            cameraInput.element.click();
        });
        cameraInput.element.addEventListener('change', function() {
            handleReportIssuePhotoFiles(context, cameraInput.element.files);
            cameraInput.element.value = '';
        });
    }

    dropzone.element.addEventListener('click', function() {
        input.element.click();
    });

    dropzone.element.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropzone.element.classList.add('dragover');
    });

    dropzone.element.addEventListener('dragleave', function() {
        dropzone.element.classList.remove('dragover');
    });

    dropzone.element.addEventListener('drop', function(e) {
        e.preventDefault();
        dropzone.element.classList.remove('dragover');
        handleReportIssuePhotoFiles(context, e.dataTransfer.files);
    });

    input.element.addEventListener('change', function() {
        handleReportIssuePhotoFiles(context, input.element.files);
        input.element.value = '';
    });
}

async function handleReportIssuePhotoFiles(context, fileList) {
    var banner = context.query('#report-issue-banner');
    var files = Array.prototype.slice.call(fileList || []);

    for (var i = 0; i < files.length; i++) {
        var file = files[i];

        if (app.memory.reportIssuePhotos.length >= MAX_PHOTOS) {
            showReportIssueBanner(banner, 'You can attach up to ' + MAX_PHOTOS + ' photos.', 'error');
            break;
        }
        if (ALLOWED_PHOTO_TYPES.indexOf(file.type) === -1) {
            showReportIssueBanner(banner, file.name + ' is not a supported image type.', 'error');
            continue;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            showReportIssueBanner(banner, file.name + ' is larger than 5MB.', 'error');
            continue;
        }

        var compressed = file;
        if (typeof imageCompression === 'function') {
            try {
                compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1920 });
            } catch (e) {
                compressed = file; // fall back to the original if compression fails
            }
        }

        app.memory.reportIssuePhotos.push(compressed);
    }

    renderReportIssuePhotoPreviews(context);
}

function renderReportIssuePhotoPreviews(context) {
    var container = context.query('#ri-photo-previews');
    if (!container.exists) return;

    var photos = app.memory.reportIssuePhotos;
    var html = '';
    for (var i = 0; i < photos.length; i++) {
        html += '<div class="photo-thumb">' +
            '<img src="' + URL.createObjectURL(photos[i]) + '" alt="Photo preview" />' +
            '<button type="button" class="photo-thumb-remove" action="removeReportIssuePhoto: ' + i + '"><i class="fas fa-times"></i></button>' +
            '</div>';
    }
    container.html(html);
}

function removeReportIssuePhoto(arg, context) {
    var index = parseInt(arg);
    if (isNaN(index)) return;
    app.memory.reportIssuePhotos.splice(index, 1);
    renderReportIssuePhotoPreviews(context);
}

function clearReportIssueForm(context) {
    context.query('#ri-issue').element.value = '';
    context.query('#ri-description').element.value = '';
    context.query('#ri-category').element.value = '';
    context.query('#ri-priority').element.value = 'medium';

    var deptEl = context.query('#ri-department');
    if (deptEl.exists) deptEl.element.value = '';
    var searchEl = context.query('#ri-location-search');
    if (searchEl.exists) searchEl.element.value = '';
    var customInput = document.getElementById('ri-location-custom');
    if (customInput) customInput.value = '';
    var customWrap = context.query('#ri-location-custom-wrap');
    if (customWrap.exists) customWrap.element.classList.add('hidden');
    var results = context.query('#ri-location-results');
    if (results.exists) results.element.classList.add('hidden');
    app.memory.riSelectedLocationId = null;

    app.memory.reportIssuePhotos = [];
    renderReportIssuePhotoPreviews(context);

    var banner = context.query('#report-issue-banner');
    banner.element.className = 'status-banner hidden';
}

function showReportIssueBanner(bannerQuery, message, type) {
    if (!bannerQuery.exists) return;
    bannerQuery.text(message);
    bannerQuery.element.className = 'status-banner ' + type;
}

async function submitReportIssue(context) {
    var banner = context.query('#report-issue-banner');

    var issue = context.query('#ri-issue').element.value.trim();
    var description = context.query('#ri-description').element.value.trim();
    var categoryId = context.query('#ri-category').element.value;
    var priority = context.query('#ri-priority').element.value;
    var locationId = app.memory.riSelectedLocationId;
    var customLocationEl = document.getElementById('ri-location-custom');
    var customLocationName = customLocationEl ? customLocationEl.value.trim() : '';
    var deptEl = context.query('#ri-department');
    var deptValue = deptEl.exists ? deptEl.element.value : '';

    if (!issue) return showReportIssueBanner(banner, 'Title is required.', 'error');
    if (!categoryId) return showReportIssueBanner(banner, 'Category is required.', 'error');
    if (!locationId && !customLocationName) return showReportIssueBanner(banner, 'Location is required — search for one or add it under "Other."', 'error');

    var reportPayload = {
        issue: issue,
        description: description,
        category_id: parseInt(categoryId, 10),
        priority: priority
    };
    if (locationId) {
        reportPayload.location_id = locationId;
    } else {
        reportPayload.location_name = customLocationName;
        if (deptValue && deptValue !== 'other') {
            reportPayload.department_id = parseInt(deptValue, 10);
        }
    }
    var photos = app.memory.reportIssuePhotos;

    var submitBtn = context.query('#ri-submit-btn');
    submitBtn.element.disabled = true;
    submitBtn.html('<i class="fas fa-spinner fa-spin"></i> Submitting...');

    // Offline: skip the network attempt entirely (avoids a slow timeout)
    // and queue locally straight away — the report is still "sent" from
    // the reporter's point of view, just held until connectivity returns.
    if (!navigator.onLine) {
        await queueReportOffline(context, reportPayload, photos);
        submitBtn.element.disabled = false;
        submitBtn.html('<i class="fas fa-paper-plane"></i> Submit Ticket');
        return;
    }

    try {
        var response = await fetch('api/insert_report.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportPayload)
        });
        var result = await response.json();

        if (handleAuthFailure(result)) return;
        if (!result.ok) {
            showReportIssueBanner(banner, 'Failed to submit ticket: ' + (result.data || 'Unknown error'), 'error');
            return;
        }

        var reportId = result.data.id;

        if (photos.length > 0) {
            try {
                var formData = new FormData();
                formData.append('report_id', reportId);
                photos.forEach(function(photo, i) {
                    formData.append('photos[]', photo, photo.name || ('photo-' + i + '.jpg'));
                });
                await fetch('api/upload_report_photos.php', { method: 'POST', body: formData });
            } catch (e) {
                // Best-effort: even if the photo upload fails, the report
                // itself was created successfully — still finalize below so
                // it doesn't sit unassigned forever over a photo hiccup.
            }
        }

        // Only now — after any photos are attached — trigger auto-assignment
        // and notify the assigned technician, so the email/in-app alert can
        // actually include the photos if the reporter added any.
        try {
            await fetch('api/finalize_report.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report_id: reportId })
            });
        } catch (e) {
            // Best-effort: if this fails, the report stays "pending" and an
            // admin can still approve it manually from the Reports page.
        }

        clearReportIssueForm(context);
        showSuccessPopup(
            'Ticket ' + result.data.reference + ' submitted. We\'ll match it to the right staff member automatically.',
            'Ticket Submitted!',
            function() { context.navigate('user-home'); }
        );
    } catch (e) {
        // A network error here (not navigator.onLine being false, but the
        // actual request failing — flaky connection, DNS hiccup, etc.) gets
        // the same offline-safe fallback rather than just losing the report.
        await queueReportOffline(context, reportPayload, photos);
    } finally {
        submitBtn.element.disabled = false;
        submitBtn.html('<i class="fas fa-paper-plane"></i> Submit Ticket');
    }
}

async function queueReportOffline(context, reportPayload, photos) {
    try {
        await offlineQueueAdd(reportPayload, photos);
        clearReportIssueForm(context);
        showSuccessPopup(
            'You\'re offline, so this ticket is saved on your device. It\'ll be sent and matched to staff automatically the moment you\'re back online.',
            'Saved — Will Send When Online',
            function() { context.navigate('user-home'); }
        );
    } catch (e) {
        console.error('Failed to queue report offline:', e);
        var banner = context.query('#report-issue-banner');
        showReportIssueBanner(banner, 'Could not save this ticket, even offline. Please try again.', 'error');
    }
}

window.loadReportIssuePage = loadReportIssuePage;
window.removeReportIssuePhoto = removeReportIssuePhoto;
window.clearReportIssueForm = clearReportIssueForm;
window.submitReportIssue = submitReportIssue;
window.selectReportIssueLocation = selectReportIssueLocation;
