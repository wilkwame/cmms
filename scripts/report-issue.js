// ========================================
// REPORT ISSUE MODULE (reporter role)
// ========================================

var MAX_PHOTOS = 5;
var MAX_PHOTO_BYTES = 5 * 1024 * 1024;
var ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

app.memory.reportIssuePhotos = app.memory.reportIssuePhotos || [];

function loadReportIssuePage(context) {
    var locationSelect = context.query('#ri-location');
    if (locationSelect.exists) {
        app.php('api/get_locations.php', {}).then(function(result) {
            if (handleAuthFailure(result)) return;
            if (!result.ok || !Array.isArray(result.data)) {
                locationSelect.html('<option value="">Failed to load locations</option>');
                return;
            }
            var html = '<option value="">Select location</option>';
            result.data.forEach(function(loc) {
                html += '<option value="' + loc.id + '">' + loc.name + '</option>';
            });
            locationSelect.html(html);
        });
    }

    wireReportIssueDropzone(context);
    renderReportIssuePhotoPreviews(context);
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

function removeReportIssuePhoto(context) {
    var index = parseInt(context.arg);
    if (isNaN(index)) return;
    app.memory.reportIssuePhotos.splice(index, 1);
    renderReportIssuePhotoPreviews(context);
}

function clearReportIssueForm(context) {
    context.query('#ri-issue').element.value = '';
    context.query('#ri-description').element.value = '';
    context.query('#ri-category').element.value = '';
    context.query('#ri-priority').element.value = 'medium';
    context.query('#ri-location').element.value = '';
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
    var locationId = context.query('#ri-location').element.value;

    if (!issue) return showReportIssueBanner(banner, 'Title is required.', 'error');
    if (!categoryId) return showReportIssueBanner(banner, 'Category is required.', 'error');
    if (!locationId) return showReportIssueBanner(banner, 'Location is required.', 'error');

    var reportPayload = {
        issue: issue,
        description: description,
        category_id: parseInt(categoryId, 10),
        location_id: parseInt(locationId, 10),
        priority: priority
    };
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
        submitBtn.html('<i class="fas fa-paper-plane"></i> Submit Report');
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
            showReportIssueBanner(banner, 'Failed to submit report: ' + (result.data || 'Unknown error'), 'error');
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
            'Report ' + result.data.reference + ' submitted. We\'ll match it to the right staff member automatically.',
            'Report Submitted!',
            function() { context.navigate('user-home'); }
        );
    } catch (e) {
        // A network error here (not navigator.onLine being false, but the
        // actual request failing — flaky connection, DNS hiccup, etc.) gets
        // the same offline-safe fallback rather than just losing the report.
        await queueReportOffline(context, reportPayload, photos);
    } finally {
        submitBtn.element.disabled = false;
        submitBtn.html('<i class="fas fa-paper-plane"></i> Submit Report');
    }
}

async function queueReportOffline(context, reportPayload, photos) {
    try {
        await offlineQueueAdd(reportPayload, photos);
        clearReportIssueForm(context);
        showSuccessPopup(
            'You\'re offline, so this report is saved on your device. It\'ll be sent and matched to staff automatically the moment you\'re back online.',
            'Saved — Will Send When Online',
            function() { context.navigate('user-home'); }
        );
    } catch (e) {
        console.error('Failed to queue report offline:', e);
        var banner = context.query('#report-issue-banner');
        showReportIssueBanner(banner, 'Could not save this report, even offline. Please try again.', 'error');
    }
}

window.loadReportIssuePage = loadReportIssuePage;
window.removeReportIssuePhoto = removeReportIssuePhoto;
window.clearReportIssueForm = clearReportIssueForm;
window.submitReportIssue = submitReportIssue;
