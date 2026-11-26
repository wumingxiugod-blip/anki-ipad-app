(function () {
  'use strict';

  var PROFILES_KEY = 'anki_ipad_profiles_v1';
  var ACTIVE_KEY = 'anki_ipad_active_profile_v1';

  function defaultProfiles() {
    return [{ id: 'default', name: '使用者 1', dbName: 'AnkiIpadDB' }];
  }

  function loadProfiles() {
    try {
      var raw = localStorage.getItem(PROFILES_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultProfiles();
  }

  function saveProfiles(list) {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function getActiveProfile() {
    var list = loadProfiles();
    var activeId = 'default';
    try {
      activeId = localStorage.getItem(ACTIVE_KEY) || 'default';
    } catch (e) {}
    var found = list.find(function (p) { return p.id === activeId; });
    return found || list[0];
  }

  function setActiveProfileId(id) {
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch (e) {}
  }

  // Expose active profile synchronously BEFORE Dexie initializes
  window.__ANKI_PROFILE__ = getActiveProfile();

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openProfilesModal() {
    var existing = document.getElementById('anki-profiles-modal-root');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'anki-profiles-modal-root';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.52);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;';

    function renderModal() {
      var list = loadProfiles();
      var active = getActiveProfile();
      var isDark = document.documentElement.classList.contains('dark');

      var bg = isDark ? '#242426' : '#ffffff';
      var bgAlt = isDark ? '#1c1c1e' : '#f5f5f7';
      var border = isDark ? '#3e3e42' : '#d4d4d4';
      var text = isDark ? '#f0f0f0' : '#1a1a1a';
      var muted = isDark ? '#9a9aa0' : '#666666';
      var accent = isDark ? '#4c9aff' : '#0066cc';

      var rowsHtml = list.map(function (p) {
        var isCur = p.id === active.id;
        return (
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid ' + border + ';background:' + (isCur ? (isDark ? '#2e3440' : '#edf4ff') : 'transparent') + ';">' +
            '<div style="display:flex;align-items:center;gap:8px;min-width:0;">' +
              '<span style="font-size:14px;font-weight:' + (isCur ? '600' : '400') + ';color:' + text + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(p.name) + '</span>' +
              (isCur ? '<span style="font-size:11px;padding:1px 6px;border-radius:4px;background:' + accent + ';color:#fff;flex-shrink:0;">使用中</span>' : '') +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
              (!isCur ? '<button type="button" data-prof-switch="' + esc(p.id) + '" style="padding:4px 10px;font-size:12px;border-radius:5px;border:none;background:' + accent + ';color:#fff;cursor:pointer;font-weight:500;">切換</button>' : '') +
              '<button type="button" data-prof-rename="' + esc(p.id) + '" style="padding:4px 8px;font-size:12px;border-radius:5px;border:1px solid ' + border + ';background:' + bg + ';color:' + text + ';cursor:pointer;">更名</button>' +
              (!isCur ? '<button type="button" data-prof-delete="' + esc(p.id) + '" style="padding:4px 8px;font-size:12px;border-radius:5px;border:1px solid ' + border + ';background:' + bg + ';color:#ef4444;cursor:pointer;">刪除</button>' : '') +
            '</div>' +
          '</div>'
        );
      }).join('');

      overlay.innerHTML =
        '<div style="width:100%;max-width:440px;background:' + bg + ';color:' + text + ';border:1px solid ' + border + ';border-radius:10px;box-shadow:0 16px 40px rgba(0,0,0,0.35);overflow:hidden;">' +
          '<div style="padding:12px 16px;background:' + bgAlt + ';border-bottom:1px solid ' + border + ';display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:14px;font-weight:600;">設定檔管理 (使用者)</span>' +
            '<button type="button" id="anki-prof-close" style="border:none;background:transparent;color:' + muted + ';font-size:16px;cursor:pointer;padding:2px 6px;">✕</button>' +
          '</div>' +
          '<div style="padding:14px 16px;">' +
            '<p style="margin:0 0 10px;font-size:12px;color:' + muted + ';">每位使用者皆有獨立的本地牌組資料庫與學習進度，互不干擾。</p>' +
            '<div style="border:1px solid ' + border + ';border-radius:6px;overflow:hidden;max-height:240px;overflow-y:auto;margin-bottom:14px;">' +
              rowsHtml +
            '</div>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="text" id="anki-prof-new-name" placeholder="輸入新使用者名稱（例如：使用者 2、生殖學）" style="flex:1;padding:6px 10px;font-size:13px;border-radius:5px;border:1px solid ' + border + ';background:' + bgAlt + ';color:' + text + ';outline:none;" />' +
              '<button type="button" id="anki-prof-add-btn" style="padding:6px 14px;font-size:13px;font-weight:600;border-radius:5px;border:none;background:' + accent + ';color:#fff;cursor:pointer;white-space:nowrap;">新增使用者</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var closeBtn = overlay.querySelector('#anki-prof-close');
      if (closeBtn) closeBtn.onclick = function () { overlay.remove(); };

      var addBtn = overlay.querySelector('#anki-prof-add-btn');
      var nameInp = overlay.querySelector('#anki-prof-new-name');
      function handleAdd() {
        var val = (nameInp.value || '').trim();
        if (!val) {
          nameInp.focus();
          return;
        }
        var curList = loadProfiles();
        var id = 'u_' + Date.now();
        curList.push({ id: id, name: val, dbName: 'AnkiIpadDB_' + id });
        saveProfiles(curList);
        renderModal();
      }
      if (addBtn) addBtn.onclick = handleAdd;
      if (nameInp) {
        nameInp.onkeydown = function (e) {
          if (e.key === 'Enter') handleAdd();
        };
      }

      overlay.querySelectorAll('[data-prof-switch]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-prof-switch');
          setActiveProfileId(id);
          window.location.reload();
        };
      });

      overlay.querySelectorAll('[data-prof-rename]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-prof-rename');
          var curList = loadProfiles();
          var target = curList.find(function (p) { return p.id === id; });
          if (!target) return;
          var nextName = window.prompt('請輸入新的使用者名稱：', target.name);
          if (nextName && nextName.trim()) {
            target.name = nextName.trim();
            saveProfiles(curList);
            if (target.id === getActiveProfile().id) {
              window.location.reload();
            } else {
              renderModal();
            }
          }
        };
      });

      overlay.querySelectorAll('[data-prof-delete]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-prof-delete');
          var curList = loadProfiles();
          var target = curList.find(function (p) { return p.id === id; });
          if (!target) return;
          if (!window.confirm('確定要刪除使用者「' + target.name + '」及其所有本地牌組與進度嗎？此動作無法復原。')) return;
          var nextList = curList.filter(function (p) { return p.id !== id; });
          saveProfiles(nextList);
          try {
            if (target.dbName && window.indexedDB) {
              window.indexedDB.deleteDatabase(target.dbName);
            }
          } catch (e) {}
          renderModal();
        };
      });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    renderModal();
    document.body.appendChild(overlay);
  }

  window.__ANKI_OPEN_PROFILES__ = openProfilesModal;

  // Global Ctrl+Shift+P shortcut (official Anki Switch Profile shortcut)
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      openProfilesModal();
    }
  });
})();
