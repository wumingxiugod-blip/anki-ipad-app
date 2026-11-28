(function () {
  'use strict';

  var GDRIVE_CFG_KEY = 'anki_ipad_gdrive_cfg_v1';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var FOLDER_NAME = 'Anki-PWA-Sync';

  // =========================================================================
  // PURE SMART TWO-WAY MERGE ENGINE (Testable in Node.js)
  // =========================================================================
  function mergeByNewerMod(localArr, remoteArr, keyField) {
    var map = new Map();
    (localArr || []).forEach(function (item) {
      map.set(String(item[keyField]), item);
    });
    (remoteArr || []).forEach(function (rItem) {
      var k = String(rItem[keyField]);
      var lItem = map.get(k);
      if (!lItem) {
        map.set(k, rItem);
      } else {
        var lMod = Number(lItem.mod || lItem.lastStudiedAt || lItem.createdAt || 0);
        var rMod = Number(rItem.mod || rItem.lastStudiedAt || rItem.createdAt || 0);
        if (rMod > lMod) {
          map.set(k, rItem);
        }
      }
    });
    return Array.from(map.values());
  }

  function mergeCardsSmart(localCards, remoteCards) {
    var map = new Map();
    (localCards || []).forEach(function (c) { map.set(String(c.id), c); });
    (remoteCards || []).forEach(function (rc) {
      var k = String(rc.id);
      var lc = map.get(k);
      if (!lc) {
        map.set(k, rc);
      } else {
        var lMod = Number(lc.mod || 0), rMod = Number(rc.mod || 0);
        var lReps = Number(lc.reps || 0), rReps = Number(rc.reps || 0);
        // Newer mod wins; if tied, higher reps wins so study progress is never lost
        if (rMod > lMod || (rMod === lMod && rReps > lReps)) {
          map.set(k, rc);
        }
      }
    });
    return Array.from(map.values());
  }

  function mergeReviewLogs(localLogs, remoteLogs) {
    var seen = new Set();
    var out = [];
    (localLogs || []).concat(remoteLogs || []).forEach(function (l) {
      var key = String(l.cardId) + '_' + String(l.reviewedAt);
      if (!seen.has(key)) {
        seen.add(key);
        var copy = Object.assign({}, l);
        delete copy.id; // let IndexedDB auto-increment cleanly
        out.push(copy);
      }
    });
    out.sort(function (a, b) { return (a.reviewedAt || 0) - (b.reviewedAt || 0); });
    return out;
  }

  function mergeSyncSnapshots(localSnap, remoteSnap) {
    if (!remoteSnap) return localSnap;
    if (!localSnap) return remoteSnap;
    return {
      version: 1,
      profileId: localSnap.profileId || remoteSnap.profileId || 'default',
      updatedAt: Date.now(),
      decks: mergeByNewerMod(localSnap.decks, remoteSnap.decks, 'id'),
      models: mergeByNewerMod(localSnap.models, remoteSnap.models, 'id'),
      notes: mergeByNewerMod(localSnap.notes, remoteSnap.notes, 'id'),
      cards: mergeCardsSmart(localSnap.cards, remoteSnap.cards),
      reviewLogs: mergeReviewLogs(localSnap.reviewLogs, remoteSnap.reviewLogs),
      fsrsState: Object.assign({}, remoteSnap.fsrsState || {}, localSnap.fsrsState || {})
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mergeSyncSnapshots: mergeSyncSnapshots };
    return;
  }

  // =========================================================================
  // BROWSER GOOGLE DRIVE OAUTH 2.0 + DRIVE API v3 CLIENT
  // =========================================================================
  var accessToken = null;
  var tokenExpiresAt = 0;

  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(GDRIVE_CFG_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveCfg(cfg) {
    try { localStorage.setItem(GDRIVE_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  function loadGsiScript() {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('無法載入 Google 登入元件 (gsi/client)，請檢查網路連線')); };
      document.head.appendChild(s);
    });
  }

  async function requestAccessToken(clientId) {
    if (accessToken && Date.now() < tokenExpiresAt - 60000) return accessToken;
    await loadGsiScript();
    return new Promise(function (resolve, reject) {
      try {
        var client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: function (resp) {
            if (resp.error) {
              reject(new Error('Google 授權失敗：' + resp.error));
            } else {
              accessToken = resp.access_token;
              tokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3500) * 1000;
              resolve(accessToken);
            }
          }
        });
        client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  }

  async function driveFetch(url, options) {
    var opts = Object.assign({}, options || {});
    opts.headers = Object.assign({ Authorization: 'Bearer ' + accessToken }, opts.headers || {});
    var res = await fetch(url, opts);
    if (!res.ok) {
      var txt = await res.text().catch(function () { return ''; });
      throw new Error('Google Drive API 錯誤 (' + res.status + '): ' + txt.slice(0, 180));
    }
    return res;
  }

  async function ensureSyncFolder() {
    var q = encodeURIComponent("name='" + FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    var r = await driveFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)');
    var data = await r.json();
    if (data.files && data.files.length > 0) return data.files[0].id;

    var cr = await driveFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
    });
    var folder = await cr.json();
    return folder.id;
  }

  async function findFileInFolder(folderId, fileName) {
    var q = encodeURIComponent("name='" + fileName.replace(/'/g, "\\'") + "' and '" + folderId + "' in parents and trashed=false");
    var r = await driveFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name,modifiedTime)');
    var data = await r.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  async function uploadFile(folderId, existingFileId, fileName, blobOrString, mimeType) {
    var metadata = existingFileId ? { name: fileName } : { name: fileName, parents: [folderId] };
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    var payload = blobOrString instanceof Blob ? blobOrString : new Blob([blobOrString], { type: mimeType || 'application/json' });
    form.append('file', payload);

    var url = existingFileId
      ? 'https://www.googleapis.com/upload/drive/v3/files/' + existingFileId + '?uploadType=multipart'
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    var res = await driveFetch(url, { method: existingFileId ? 'PATCH' : 'POST', body: form });
    return await res.json();
  }

  async function exportLocalSnapshot() {
    var db = window.__ANKI_DB__;
    var prof = window.__ANKI_PROFILE__ || { id: 'default', name: '使用者 1' };
    var fsrsState = {};
    try { fsrsState = JSON.parse(localStorage.getItem('anki_ipad_fsrs_state_v1') || '{}') || {}; } catch (e) {}
    return {
      version: 1,
      profileId: prof.id,
      profileName: prof.name,
      updatedAt: Date.now(),
      decks: await db.decks.toArray(),
      models: await db.models.toArray(),
      notes: await db.notes.toArray(),
      cards: await db.cards.toArray(),
      reviewLogs: await db.reviewLogs.toArray(),
      fsrsState: fsrsState
    };
  }

  async function applySnapshotToLocal(snap) {
    var db = window.__ANKI_DB__;
    await db.transaction('rw', [db.decks, db.models, db.notes, db.cards, db.reviewLogs], async function () {
      await db.decks.clear();
      await db.models.clear();
      await db.notes.clear();
      await db.cards.clear();
      await db.reviewLogs.clear();
      if (snap.decks && snap.decks.length) await db.decks.bulkPut(snap.decks);
      if (snap.models && snap.models.length) await db.models.bulkPut(snap.models);
      if (snap.notes && snap.notes.length) await db.notes.bulkPut(snap.notes);
      if (snap.cards && snap.cards.length) await db.cards.bulkPut(snap.cards);
      if (snap.reviewLogs && snap.reviewLogs.length) await db.reviewLogs.bulkPut(snap.reviewLogs);
    });
    if (snap.fsrsState) {
      try { localStorage.setItem('anki_ipad_fsrs_state_v1', JSON.stringify(snap.fsrsState)); } catch (e) {}
    }
  }

  async function syncMediaIncremental(folderId, mode, onStatus) {
    var db = window.__ANKI_DB__;
    var localMedia = await db.media.toArray();
    var q = encodeURIComponent("'" + folderId + "' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'");
    var r = await driveFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&pageSize=1000&fields=files(id,name,mimeType)');
    var data = await r.json();
    var remoteFiles = (data.files || []).filter(function (f) { return f.name.startsWith('media__'); });
    var remoteByName = new Map(remoteFiles.map(function (f) { return [f.name.slice(7), f]; }));
    var localByName = new Map(localMedia.map(function (m) { return [m.name, m]; }));

    var uploaded = 0, downloaded = 0;
    if (mode !== 'download') {
      for (var i = 0; i < localMedia.length; i++) {
        var m = localMedia[i];
        if (!remoteByName.has(m.name) && m.blob) {
          onStatus('正在上傳媒體 (' + (uploaded + 1) + ')：' + m.name);
          await uploadFile(folderId, null, 'media__' + m.name, m.blob, m.mimeType || 'application/octet-stream');
          uploaded++;
        }
      }
    }
    if (mode !== 'upload') {
      var entries = Array.from(remoteByName.entries());
      for (var j = 0; j < entries.length; j++) {
        var name = entries[j][0], file = entries[j][1];
        if (!localByName.has(name)) {
          onStatus('正在下載媒體 (' + (downloaded + 1) + ')：' + name);
          var dl = await driveFetch('https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media');
          var blob = await dl.blob();
          await db.media.put({ name: name, blob: blob, mimeType: blob.type || file.mimeType || 'application/octet-stream' });
          downloaded++;
        }
      }
    }
    return { uploaded: uploaded, downloaded: downloaded };
  }

  async function runGoogleDriveSync(mode, clientId, includeMedia, onStatus) {
    onStatus('正在連線至你的 Google 帳號...');
    await requestAccessToken(clientId);

    onStatus('正在定位 Google 雲端硬碟同步資料夾 (' + FOLDER_NAME + ')...');
    var folderId = await ensureSyncFolder();
    var prof = window.__ANKI_PROFILE__ || { id: 'default' };
    var dbFileName = 'anki_db_' + prof.id + '.json';
    var remoteMeta = await findFileInFolder(folderId, dbFileName);

    var localSnap = await exportLocalSnapshot();
    var remoteSnap = null;
    if (remoteMeta && mode !== 'upload') {
      onStatus('正在從 Google 雲端讀取最新資料庫快照...');
      var dl = await driveFetch('https://www.googleapis.com/drive/v3/files/' + remoteMeta.id + '?alt=media');
      remoteSnap = await dl.json();
    }

    var finalSnap;
    if (mode === 'upload') {
      finalSnap = localSnap;
      onStatus('正在上傳本機牌組與進度至 Google 雲端...');
      await uploadFile(folderId, remoteMeta ? remoteMeta.id : null, dbFileName, JSON.stringify(finalSnap), 'application/json');
    } else if (mode === 'download') {
      if (!remoteSnap) throw new Error('Google 雲端資料夾中尚未找到此設定檔的備份檔');
      finalSnap = remoteSnap;
      onStatus('正在將雲端資料寫入本機...');
      await applySnapshotToLocal(finalSnap);
    } else {
      onStatus('正在進行雙向智慧合併（保留最新複習進度）...');
      finalSnap = mergeSyncSnapshots(localSnap, remoteSnap);
      await applySnapshotToLocal(finalSnap);
      onStatus('正在將合併結果寫回 Google 雲端...');
      await uploadFile(folderId, remoteMeta ? remoteMeta.id : null, dbFileName, JSON.stringify(finalSnap), 'application/json');
    }

    var mediaRes = { uploaded: 0, downloaded: 0 };
    if (includeMedia) {
      mediaRes = await syncMediaIncremental(folderId, mode, onStatus);
    }

    var cfg = loadCfg();
    cfg.clientId = clientId;
    cfg.lastSyncAt = Date.now();
    saveCfg(cfg);

    return {
      decks: finalSnap.decks.length,
      notes: finalSnap.notes.length,
      cards: finalSnap.cards.length,
      mediaUploaded: mediaRes.uploaded,
      mediaDownloaded: mediaRes.downloaded
    };
  }

  // =========================================================================
  // GOOGLE DRIVE SYNC MODAL UI
  // =========================================================================
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function openGoogleDriveSyncModal(openLocalImportCb) {
    var old = document.getElementById('anki-gdrive-sync-modal');
    if (old) old.remove();

    var isDark = document.documentElement.classList.contains('dark');
    var bgWin = isDark ? '#2c2c2c' : '#f0f0f0';
    var bgTitle = isDark ? '#242424' : '#e6e6e6';
    var bgPanel = isDark ? '#323232' : '#ffffff';
    var bgInput = isDark ? '#1e1e1e' : '#ffffff';
    var bgBtn = isDark ? '#3c3c3c' : '#e8e8e8';
    var border = isDark ? '#454545' : '#cccccc';
    var text = isDark ? '#ececec' : '#1a1a1a';
    var muted = isDark ? '#a8a8a8' : '#606060';
    var accent = '#2f65d6';

    var cfg = loadCfg();
    var prof = window.__ANKI_PROFILE__ || { id: 'default', name: '使用者 1' };
    var lastSyncStr = cfg.lastSyncAt ? new Date(cfg.lastSyncAt).toLocaleString('zh-TW') : '尚未同步';
    var origin = window.location.origin;

    var ov = document.createElement('div');
    ov.id = 'anki-gdrive-sync-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10025;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    var win = document.createElement('div');
    win.style.cssText = 'width:100%;max-width:580px;max-height:88vh;background:' + bgWin + ';color:' + text + ';border:1px solid ' + border + ';border-radius:8px;box-shadow:0 18px 48px rgba(0,0,0,0.45);display:flex;flex-direction:column;overflow:hidden;';

    win.innerHTML =
      '<div style="padding:10px 14px;background:' + bgTitle + ';border-bottom:1px solid ' + border + ';display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
        '<span style="font-size:13px;font-weight:600;">Google 雲端硬碟個人同步 — ' + esc(prof.name) + '</span>' +
        '<button type="button" id="gd-x" style="border:none;background:transparent;color:' + muted + ';font-size:15px;cursor:pointer;padding:2px 6px;">✕</button>' +
      '</div>' +
      '<div style="padding:14px 16px;overflow-y:auto;flex:1;min-height:0;font-size:13px;">' +
        '<div style="background:' + bgPanel + ';border:1px solid ' + border + ';border-radius:6px;padding:12px 14px;margin-bottom:12px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
            '<strong>連線設定（每位使用者各自同步到自己的 Google Drive）</strong>' +
            '<span style="font-size:11px;color:' + muted + ';">上次同步：' + esc(lastSyncStr) + '</span>' +
          '</div>' +
          '<label style="display:block;font-size:12px;color:' + muted + ';margin-bottom:4px;">Google OAuth 用戶端 ID (Web Client ID)</label>' +
          '<input type="text" id="gd-client-id" placeholder="例如：1234567890-xxxx.apps.googleusercontent.com" value="' + esc(cfg.clientId || '') + '" style="width:100%;padding:6px 10px;font-size:12px;border-radius:5px;border:1px solid ' + border + ';background:' + bgInput + ';color:' + text + ';outline:none;margin-bottom:8px;" />' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;">' +
            '<input type="checkbox" id="gd-media" checked style="accent-color:' + accent + ';" />' +
            '<span>同步圖片與音訊媒體檔（增量同步：只上傳/下載缺漏檔案）</span>' +
          '</label>' +
          '<details style="margin-top:8px;font-size:12px;color:' + muted + ';">' +
            '<summary style="cursor:pointer;color:' + accent + ';">第一次使用？3 步驟免費取得自己的 Google Client ID</summary>' +
            '<ol style="margin:6px 0 0 18px;padding:0;line-height:1.6;">' +
              '<li>前往 Google Cloud Console 建立免費專案並啟用 <strong>Google Drive API</strong>。</li>' +
              '<li>在「憑證 → 建立憑證 → OAuth 用戶端 ID（網頁應用程式）」的「已授權的 JavaScript 來源」填入：<code>' + esc(origin) + '</code>。</li>' +
              '<li>將產生的 Client ID 貼回上方欄位即可，資料會存在你自己雲端的 <code>' + FOLDER_NAME + '</code> 資料夾，不經由任何第三方伺服器。</li>' +
            '</ol>' +
          '</details>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px;">' +
          '<button type="button" data-gd-mode="merge" style="padding:9px 12px;font-size:13px;font-weight:600;border-radius:6px;border:none;background:' + accent + ';color:#fff;cursor:pointer;">🔄 智慧雙向同步</button>' +
          '<button type="button" data-gd-mode="upload" style="padding:9px 12px;font-size:12px;border-radius:6px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';cursor:pointer;">⬆️ 上傳覆蓋雲端</button>' +
          '<button type="button" data-gd-mode="download" style="padding:9px 12px;font-size:12px;border-radius:6px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';cursor:pointer;">⬇️ 下載覆蓋本機</button>' +
        '</div>' +

        '<div id="gd-status" style="padding:10px 12px;border-radius:6px;background:' + bgPanel + ';border:1px solid ' + border + ';font-size:12px;color:' + muted + ';min-height:40px;">選擇上方同步模式以開始，或使用下方本機快照備份。</div>' +
      '</div>' +
      '<div style="padding:10px 16px;background:' + bgTitle + ';border-top:1px solid ' + border + ';display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;">' +
        '<div style="display:flex;gap:6px;">' +
          '<button type="button" id="gd-export-json" style="padding:5px 12px;font-size:12px;border-radius:5px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';cursor:pointer;">下載 JSON 同步包</button>' +
          '<button type="button" id="gd-import-apkg" style="padding:5px 12px;font-size:12px;border-radius:5px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';cursor:pointer;">匯入本機 .apkg</button>' +
        '</div>' +
        '<button type="button" id="gd-close" style="padding:5px 16px;font-size:13px;border-radius:5px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';cursor:pointer;">關閉</button>' +
      '</div>';

    ov.appendChild(win);
    document.body.appendChild(ov);

    var statusEl = win.querySelector('#gd-status');
    function setStatus(msg, isErr) {
      statusEl.style.color = isErr ? '#ef4444' : text;
      statusEl.textContent = msg;
    }

    win.querySelector('#gd-x').onclick = function () { ov.remove(); };
    win.querySelector('#gd-close').onclick = function () { ov.remove(); };
    win.querySelector('#gd-import-apkg').onclick = function () {
      ov.remove();
      if (typeof openLocalImportCb === 'function') openLocalImportCb();
    };
    win.querySelector('#gd-export-json').onclick = async function () {
      var snap = await exportLocalSnapshot();
      var blob = new Blob([JSON.stringify(snap)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'anki_sync_' + prof.id + '_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setStatus('已下載本機 JSON 同步快照（不含圖片媒體，可手動存至任何雲端）。');
    };

    win.querySelectorAll('[data-gd-mode]').forEach(function (btn) {
      btn.onclick = async function () {
        var cid = (win.querySelector('#gd-client-id').value || '').trim();
        if (!cid) {
          setStatus('請先填入 Google OAuth Web Client ID（可展開上方 3 步驟說明取得）。', true);
          win.querySelector('#gd-client-id').focus();
          return;
        }
        var incMedia = win.querySelector('#gd-media').checked;
        var mode = btn.getAttribute('data-gd-mode');
        try {
          var res = await runGoogleDriveSync(mode, cid, incMedia, function (m) { setStatus(m, false); });
          setStatus('✅ 同步完成！共 ' + res.decks + ' 個牌組、' + res.notes + ' 則筆記、' + res.cards + ' 張卡片（媒體上傳 ' + res.mediaUploaded + ' / 下載 ' + res.mediaDownloaded + '）。即將重新整理...', false);
          setTimeout(function () { window.location.reload(); }, 1200);
        } catch (err) {
          setStatus('❌ ' + (err && err.message ? err.message : String(err)), true);
        }
      };
    });
  }

  window.__ANKI_OPEN_GDRIVE_SYNC__ = openGoogleDriveSyncModal;
})();
