// ========================================
// OFFLINE REPORT QUEUE
// Lets a reporter submit while offline; the report is held locally
// (IndexedDB, since it needs to store photo Blobs — localStorage can't)
// and automatically sent for real the moment connectivity returns.
// ========================================

var OFFLINE_DB_NAME = 'cmms_offline';
var OFFLINE_DB_VERSION = 1;
var OFFLINE_STORE = 'pending_reports';

function openOfflineDb() {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
        request.onupgradeneeded = function() {
            var db = request.result;
            if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
                db.createObjectStore(OFFLINE_STORE, { keyPath: 'localId', autoIncrement: true });
            }
        };
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function() { reject(request.error); };
    });
}

// report: { issue, description, category_id, location_id, priority }
// photos: array of File/Blob objects (already compressed by the caller)
function offlineQueueAdd(report, photos) {
    return openOfflineDb().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(OFFLINE_STORE, 'readwrite');
            var store = tx.objectStore(OFFLINE_STORE);
            var record = {
                report: report,
                photos: photos || [],
                createdAt: Date.now()
            };
            var request = store.add(record);
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error); };
        });
    });
}

function offlineQueueGetAll() {
    return openOfflineDb().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(OFFLINE_STORE, 'readonly');
            var request = tx.objectStore(OFFLINE_STORE).getAll();
            request.onsuccess = function() { resolve(request.result || []); };
            request.onerror = function() { reject(request.error); };
        });
    });
}

function offlineQueueRemove(localId) {
    return openOfflineDb().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(OFFLINE_STORE, 'readwrite');
            var request = tx.objectStore(OFFLINE_STORE).delete(localId);
            request.onsuccess = function() { resolve(); };
            request.onerror = function() { reject(request.error); };
        });
    });
}

function offlineQueueCount() {
    return offlineQueueGetAll().then(function(items) { return items.length; });
}

// Sends one queued item through the real submit pipeline (same three-step
// flow as a live submission: insert -> upload photos -> finalize).
async function syncOneOfflineReport(item) {
    var response = await fetch('api/insert_report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.report)
    });
    var result = await response.json();
    if (!result.ok) {
        throw new Error(typeof result.data === 'string' ? result.data : 'Failed to sync');
    }

    var reportId = result.data.id;

    if (item.photos && item.photos.length > 0) {
        try {
            var formData = new FormData();
            formData.append('report_id', reportId);
            item.photos.forEach(function(photo, i) {
                formData.append('photos[]', photo, photo.name || ('photo-' + i + '.jpg'));
            });
            await fetch('api/upload_report_photos.php', { method: 'POST', body: formData });
        } catch (e) {
            // Best-effort, same as the live submit path.
        }
    }

    try {
        await fetch('api/finalize_report.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report_id: reportId })
        });
    } catch (e) {
        // Best-effort, same as the live submit path.
    }

    return result.data;
}

var offlineSyncInProgress = false;

// Flushes every queued report, one at a time (so a single failure doesn't
// abort the rest). Safe to call repeatedly — re-entrant calls are ignored
// while a sync is already running.
async function offlineQueueSync() {
    if (offlineSyncInProgress) return;
    if (!navigator.onLine) return;

    var items;
    try {
        items = await offlineQueueGetAll();
    } catch (e) {
        return;
    }
    if (items.length === 0) return;

    offlineSyncInProgress = true;
    var synced = 0;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        try {
            var saved = await syncOneOfflineReport(item);
            await offlineQueueRemove(item.localId);
            synced++;
            if (typeof onOfflineReportSynced === 'function') {
                onOfflineReportSynced(saved);
            }
        } catch (e) {
            console.error('Failed to sync offline report:', e);
            // Leave it queued — will retry on the next sync trigger.
        }
    }

    offlineSyncInProgress = false;

    if (synced > 0 && typeof updateOfflineIndicator === 'function') {
        updateOfflineIndicator();
    }
}

window.addEventListener('online', function() {
    offlineQueueSync();
});

window.offlineQueueAdd = offlineQueueAdd;
window.offlineQueueGetAll = offlineQueueGetAll;
window.offlineQueueRemove = offlineQueueRemove;
window.offlineQueueCount = offlineQueueCount;
window.offlineQueueSync = offlineQueueSync;
