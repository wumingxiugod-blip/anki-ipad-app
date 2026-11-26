(function () {
  'use strict';

  var ADDONS_KEY = 'anki_ipad_addons_v1';

  var DEFAULT_ADDONS = [
    {
      id: 'zstd-decoder',
      name: 'Zstandard (.anki21b) 解壓核心',
      enabled: true,
      desc: '支援現代 Anki 2.1.50+ 壓縮格式 (.anki21b) 與媒體索引解壓。',
      url: 'https://docs.ankiweb.net/'
    },
    {
      id: 'smart-apkg-merge',
      name: 'APKG 智慧比對與合併更新',
      enabled: true,
      desc: '匯入新版 .apkg 時依 GUID 與首欄自動比對更新，保留既有 SM-2 進度。',
      url: 'https://docs.ankiweb.net/importing/packaged-decks.html'
    },
    {
      id: 'io-align',
      name: '圖片遮蔽 (Image Occlusion) 對位引擎',
      enabled: true,
      desc: '自動修正翻面捲動與 .io-inner 百分比遮蔽框對位。',
      url: 'https://docs.ankiweb.net/editing.html#image-occlusion'
    },
    {
      id: 'web-speech-tts',
      name: 'Web Speech TTS 語音朗讀',
      enabled: true,
      desc: '使用瀏覽器內建語音合成朗讀卡片內容。',
      url: 'https://docs.ankiweb.net/templates/fields.html#text-to-speech-for-individual-fields'
    }
  ];

  function loadAddons() {
    try {
      var raw = localStorage.getItem(ADDONS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_ADDONS.map(function (a) { return Object.assign({}, a); });
  }

  function saveAddons(list) {
    try {
      localStorage.setItem(ADDONS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getThemeColors() {
    var isDark = document.documentElement.classList.contains('dark');
    return {
      isDark: isDark,
      bgWin: isDark ? '#2c2c2c' : '#f0f0f0',
      bgTitle: isDark ? '#242424' : '#e6e6e6',
      bgList: isDark ? '#1e1e1e' : '#ffffff',
      bgBtn: isDark ? '#3c3c3c' : '#e8e8e8',
      bgSel: isDark ? '#5a7796' : '#cce0ff',
      border: isDark ? '#454545' : '#cccccc',
      text: isDark ? '#ececec' : '#1a1a1a',
      muted: isDark ? '#a8a8a8' : '#606060',
      accent: '#2f65d6'
    };
  }

  function makeModalShell(id, title, maxWidth) {
    var old = document.getElementById(id);
    if (old) old.remove();
    var c = getThemeColors();
    var overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,0.58);display:flex;align-items:center;justify-content:center;padding:14px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    var win = document.createElement('div');
    win.style.cssText =
      'width:100%;max-width:' + maxWidth + 'px;max-height:86vh;background:' + c.bgWin + ';color:' + c.text + ';border:1px solid ' + c.border + ';border-radius:8px;box-shadow:0 18px 48px rgba(0,0,0,0.45);display:flex;flex-direction:column;overflow:hidden;';
    win.innerHTML =
      '<div style="padding:9px 14px;border-bottom:1px solid ' + c.border + ';display:flex;align-items:center;justify-content:space-between;background:' + c.bgTitle + ';flex-shrink:0;">' +
        '<span style="font-size:13px;font-weight:600;">' + esc(title) + '</span>' +
        '<button type="button" data-dlg-close="1" style="border:none;background:transparent;color:' + c.muted + ';font-size:15px;cursor:pointer;padding:2px 6px;">✕</button>' +
      '</div>' +
      '<div data-dlg-body="1" style="padding:14px;display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;"></div>';
    win.querySelector('[data-dlg-close]').onclick = function () { overlay.remove(); };
    overlay.appendChild(win);
    document.body.appendChild(overlay);
    return { overlay: overlay, body: win.querySelector('[data-dlg-body]'), c: c };
  }

  function btnStyle(c, primary) {
    return (
      'width:100%;padding:6px 12px;font-size:13px;border-radius:5px;cursor:pointer;text-align:center;' +
      'background:' + c.bgBtn + ';color:' + c.text + ';' +
      'border:' + (primary ? '1.5px solid ' + c.accent : '1px solid ' + c.border) + ';'
    );
  }

  // =========================================================================
  // 1. 檢查媒體檔 (Check Media — Real IndexedDB Audit + Delete Unused)
  // =========================================================================
  async function openCheckMediaDialog() {
    var shell = makeModalShell('anki-check-media-dlg', '檢查媒體檔', 680);
    var c = shell.c;
    shell.body.innerHTML = '<div style="padding:24px;text-align:center;color:' + c.muted + ';font-size:13px;">正在掃描本機筆記與媒體資料庫...</div>';

    var db = window.__ANKI_DB__;
    if (!db) {
      shell.body.innerHTML = '<div style="padding:24px;text-align:center;color:#ef4444;font-size:13px;">無法存取本機資料庫</div>';
      return;
    }

    async function runAudit() {
      var notes = await db.notes.toArray();
      var mediaList = await db.media.toArray();
      var mediaNames = new Set(mediaList.map(function (m) { return m.name; }));
      var referenced = new Set();

      var imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
      var sndRe = /\[sound:([^\]]+)\]/gi;

      notes.forEach(function (nt) {
        var joined = Array.isArray(nt.flds) ? nt.flds.join(' ') : '';
        var m;
        while ((m = imgRe.exec(joined)) !== null) {
          var src = m[1].trim();
          if (!/^https?:|^data:|^blob:/i.test(src)) {
            try { src = decodeURIComponent(src); } catch (e) {}
            referenced.add(src.replace(/^[./\\]+/, ''));
          }
        }
        while ((m = sndRe.exec(joined)) !== null) {
          referenced.add(m[1].trim());
        }
      });

      var missing = [];
      referenced.forEach(function (name) {
        if (!mediaNames.has(name)) missing.push(name);
      });
      missing.sort();

      var unused = [];
      mediaList.forEach(function (item) {
        if (!referenced.has(item.name)) unused.push(item.name);
      });
      unused.sort();

      var lines = [
        '遺失檔案數：' + missing.length,
        '未使用檔案數：' + unused.length,
        ''
      ];
      if (missing.length > 0) {
        lines.push('下列檔案被卡片引用但不存在於媒體資料庫：');
        missing.forEach(function (f) { lines.push('遺失：' + f); });
        lines.push('');
      }
      if (unused.length > 0) {
        lines.push('媒體資料夾中的這些檔案未被卡片使用：');
        unused.forEach(function (f) { lines.push('未使用：' + f); });
      } else if (missing.length === 0) {
        lines.push('所有本地媒體檔（共 ' + mediaList.length + ' 個）皆正常對應且無多餘檔案。');
      }

      shell.body.innerHTML =
        '<div style="flex:1;min-height:260px;max-height:58vh;overflow-y:auto;background:' + c.bgList + ';border:1px solid ' + c.border + ';border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.65;white-space:pre-wrap;word-break:break-all;font-family:var(--anki-mono,monospace);">' +
          esc(lines.join('\n')) +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;flex-shrink:0;">' +
          '<button type="button" id="cm-view-btn" style="padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">檢視統計</button>' +
          '<button type="button" id="cm-del-btn" ' + (unused.length === 0 ? 'disabled' : '') + ' style="padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + (unused.length === 0 ? c.muted : c.text) + ';cursor:' + (unused.length === 0 ? 'not-allowed' : 'pointer') + ';opacity:' + (unused.length === 0 ? '0.6' : '1') + ';">刪除未使用檔案 (' + unused.length + ')</button>' +
        '</div>';

      shell.body.querySelector('#cm-view-btn').onclick = function () {
        window.alert('目前媒體資料庫共有 ' + mediaList.length + ' 個檔案，其中 ' + (mediaList.length - unused.length) + ' 個使用中、' + unused.length + ' 個未使用、' + missing.length + ' 個遺失。');
      };

      var delBtn = shell.body.querySelector('#cm-del-btn');
      if (delBtn && unused.length > 0) {
        delBtn.onclick = async function () {
          if (!window.confirm('確定要刪除 ' + unused.length + ' 個未使用的媒體檔案以釋放空間嗎？')) return;
          await db.media.bulkDelete(unused);
          await runAudit();
        };
      }
    }

    try {
      await runAudit();
    } catch (err) {
      shell.body.innerHTML = '<div style="padding:20px;color:#ef4444;font-size:13px;">掃描失敗：' + esc(err.message || err) + '</div>';
    }
  }

  // =========================================================================
  // 2. 附加元件 (Add-ons Manager, Ctrl+Shift+A)
  // =========================================================================
  function openAddonsDialog() {
    var shell = makeModalShell('anki-addons-dlg', '附加元件', 680);
    var c = shell.c;
    var addons = loadAddons();
    var selectedId = addons[0] ? addons[0].id : null;

    function render() {
      var sel = addons.find(function (a) { return a.id === selectedId; }) || addons[0] || null;
      if (sel) selectedId = sel.id;

      var listHtml = addons.map(function (a) {
        var isSel = sel && sel.id === a.id;
        return (
          '<div data-addon-id="' + esc(a.id) + '" style="padding:6px 10px;font-size:13px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;' +
            'background:' + (isSel ? c.bgSel : 'transparent') + ';color:' + (a.enabled ? c.text : c.muted) + ';' +
            (a.enabled ? '' : 'text-decoration:line-through;') + '">' +
            '<span>' + esc(a.name) + '</span>' +
            '<span style="font-size:11px;opacity:0.8;">' + (a.enabled ? '已啟用' : '已停用') + '</span>' +
          '</div>'
        );
      }).join('');

      shell.body.innerHTML =
        '<div style="font-size:12px;color:' + c.muted + ';margin-bottom:8px;">更動將在 Anki 重新啟動後生效。</div>' +
        '<div style="display:grid;grid-template-columns:1fr 148px;gap:12px;flex:1;min-height:320px;">' +
          '<div style="background:' + c.bgList + ';border:1px solid ' + c.border + ';border-radius:6px;overflow-y:auto;">' +
            (listHtml || '<div style="padding:16px;color:' + c.muted + ';font-size:12px;">尚無附加元件</div>') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;justify-content:space-between;gap:12px;">' +
            '<div style="display:flex;flex-direction:column;gap:7px;">' +
              '<button type="button" id="ad-get" style="' + btnStyle(c, true) + '">取得附加元件...</button>' +
              '<button type="button" id="ad-install" style="' + btnStyle(c, false) + '">從檔案安裝...</button>' +
              '<button type="button" id="ad-update" style="' + btnStyle(c, false) + '">檢查更新</button>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:7px;">' +
              '<button type="button" id="ad-page" style="' + btnStyle(c, false) + '">檢視附加元件頁面</button>' +
              '<button type="button" id="ad-cfg" style="' + btnStyle(c, false) + '">設定</button>' +
              '<button type="button" id="ad-toggle" style="' + btnStyle(c, false) + '">啟用/停用</button>' +
              '<button type="button" id="ad-del" style="' + btnStyle(c, false) + '">刪除</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      shell.body.querySelectorAll('[data-addon-id]').forEach(function (el) {
        el.onclick = function () {
          selectedId = el.getAttribute('data-addon-id');
          render();
        };
      });

      shell.body.querySelector('#ad-get').onclick = function () {
        window.open('https://ankiweb.net/shared/addons', '_blank', 'noopener');
      };
      shell.body.querySelector('#ad-install').onclick = function () {
        window.alert('網頁版不支援直接執行 Python 桌面外掛 (.ankiaddon)，核心擴充功能已內建於清單中。');
      };
      shell.body.querySelector('#ad-update').onclick = function () {
        window.alert('所有內建擴充模組皆為最新版本。');
      };
      shell.body.querySelector('#ad-page').onclick = function () {
        if (sel && sel.url) window.open(sel.url, '_blank', 'noopener');
      };
      shell.body.querySelector('#ad-cfg').onclick = function () {
        if (sel) window.alert(sel.name + '\n\n' + sel.desc);
      };
      shell.body.querySelector('#ad-toggle').onclick = function () {
        if (!sel) return;
        sel.enabled = !sel.enabled;
        saveAddons(addons);
        render();
      };
      shell.body.querySelector('#ad-del').onclick = function () {
        if (!sel) return;
        if (!window.confirm('確定要移除「' + sel.name + '」嗎？')) return;
        addons = addons.filter(function (a) { return a.id !== sel.id; });
        saveAddons(addons);
        selectedId = addons[0] ? addons[0].id : null;
        render();
      };
    }

    render();
  }

  // =========================================================================
  // 3. 筆記類型 (Official Note Types Dialog, Ctrl+Shift+N)
  // =========================================================================
  async function openNoteTypesDialog(openFullEditorCb) {
    var shell = makeModalShell('anki-notetypes-dlg', '筆記類型', 540);
    var c = shell.c;
    var db = window.__ANKI_DB__;
    if (!db) {
      if (openFullEditorCb) { shell.overlay.remove(); openFullEditorCb(); }
      return;
    }

    var selectedMid = null;

    async function render() {
      var models = await db.models.toArray();
      var notes = await db.notes.toArray();
      var countByMid = new Map();
      notes.forEach(function (n) {
        countByMid.set(n.mid, (countByMid.get(n.mid) || 0) + 1);
      });
      models.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant'); });

      var sel = models.find(function (m) { return m.id === selectedMid; }) || models[0] || null;
      if (sel) selectedMid = sel.id;

      var listHtml = models.map(function (m) {
        var isSel = sel && sel.id === m.id;
        var cnt = countByMid.get(m.id) || 0;
        return (
          '<div data-nt-id="' + m.id + '" style="padding:5px 10px;font-size:13px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
            'background:' + (isSel ? c.bgSel : 'transparent') + ';color:' + c.text + ';">' +
            esc(m.name) + ' [' + cnt + ' 則筆記]' +
          '</div>'
        );
      }).join('');

      shell.body.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 122px;gap:12px;flex:1;min-height:280px;">' +
          '<div style="background:' + c.bgList + ';border:1px solid ' + c.border + ';border-radius:6px;overflow:auto;">' +
            (listHtml || '<div style="padding:16px;color:' + c.muted + ';font-size:12px;">尚無筆記類型</div>') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:7px;">' +
            '<button type="button" id="nt-add" style="' + btnStyle(c, true) + '">新增</button>' +
            '<button type="button" id="nt-rename" style="' + btnStyle(c, false) + '">重新命名</button>' +
            '<button type="button" id="nt-del" style="' + btnStyle(c, false) + '">刪除</button>' +
            '<button type="button" id="nt-fields" style="' + btnStyle(c, false) + '">欄位</button>' +
            '<button type="button" id="nt-cards" style="' + btnStyle(c, false) + '">卡片</button>' +
            '<button type="button" id="nt-opts" style="' + btnStyle(c, false) + '">選項</button>' +
            '<button type="button" id="nt-close" style="' + btnStyle(c, false) + '">關閉</button>' +
            '<button type="button" id="nt-help" style="' + btnStyle(c, false) + '">說明</button>' +
          '</div>' +
        '</div>';

      shell.body.querySelectorAll('[data-nt-id]').forEach(function (el) {
        el.onclick = function () {
          selectedMid = Number(el.getAttribute('data-nt-id'));
          render();
        };
      });

      function openEditor() {
        shell.overlay.remove();
        if (typeof openFullEditorCb === 'function') openFullEditorCb();
      }

      shell.body.querySelector('#nt-add').onclick = openEditor;
      shell.body.querySelector('#nt-fields').onclick = openEditor;
      shell.body.querySelector('#nt-cards').onclick = openEditor;
      shell.body.querySelector('#nt-opts').onclick = function () {
        if (sel) window.alert('筆記類型：' + sel.name + '\n欄位數：' + ((sel.flds || []).length) + '\n卡片樣板數：' + ((sel.tmpls || []).length));
      };
      shell.body.querySelector('#nt-rename').onclick = async function () {
        if (!sel) return;
        var next = window.prompt('請輸入新的筆記類型名稱：', sel.name);
        if (next && next.trim()) {
          sel.name = next.trim();
          await db.models.put(sel);
          await render();
        }
      };
      shell.body.querySelector('#nt-del').onclick = async function () {
        if (!sel) return;
        var cnt = countByMid.get(sel.id) || 0;
        if (cnt > 0) {
          window.alert('無法刪除「' + sel.name + '」：目前仍有 ' + cnt + ' 則筆記使用中。');
          return;
        }
        if (!window.confirm('確定要刪除筆記類型「' + sel.name + '」嗎？')) return;
        await db.models.delete(sel.id);
        selectedMid = null;
        await render();
      };
      shell.body.querySelector('#nt-close').onclick = function () { shell.overlay.remove(); };
      shell.body.querySelector('#nt-help').onclick = function () {
        window.open('https://docs.ankiweb.net/getting-started.html#note-types', '_blank', 'noopener');
      };
    }

    await render();
  }

  window.__ANKI_OPEN_CHECK_MEDIA__ = openCheckMediaDialog;
  window.__ANKI_OPEN_ADDONS__ = openAddonsDialog;
  window.__ANKI_OPEN_NOTETYPES__ = openNoteTypesDialog;

  // Global Ctrl+Shift+A shortcut (official Anki Add-ons shortcut)
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      openAddonsDialog();
    }
  });

  // =========================================================================
  // 4. 學習牌組 (Study Deck Quick Switcher, shortcut: /)
  // =========================================================================
  async function openStudyDeckDialog(startStudyCb) {
    var shell = makeModalShell('anki-study-deck-dlg', '學習牌組', 520);
    var c = shell.c;
    var db = window.__ANKI_DB__;
    if (!db) { shell.overlay.remove(); return; }

    var decks = await db.decks.toArray();
    decks.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant'); });
    var query = '';
    var selectedIdx = 0;

    function getFiltered() {
      var q = query.trim().toLowerCase();
      if (!q) return decks;
      return decks.filter(function (d) { return String(d.name || '').toLowerCase().includes(q); });
    }

    function launchSelected() {
      var list = getFiltered();
      var chosen = list[selectedIdx] || list[0];
      if (!chosen) return;
      shell.overlay.remove();
      var fn = typeof startStudyCb === 'function' ? startStudyCb : window.__ANKI_START_STUDY__;
      if (typeof fn === 'function') fn(chosen);
    }

    function renderList() {
      var list = getFiltered();
      if (selectedIdx >= list.length) selectedIdx = Math.max(0, list.length - 1);
      var listEl = shell.body.querySelector('#sd-list');
      if (!listEl) return;
      listEl.innerHTML = list.length === 0
        ? '<div style="padding:18px;text-align:center;color:' + c.muted + ';font-size:13px;">找不到符合條件的牌組</div>'
        : list.map(function (d, idx) {
            var isSel = idx === selectedIdx;
            return '<div data-sd-idx="' + idx + '" style="padding:6px 10px;font-size:13px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:' + (isSel ? c.bgSel : 'transparent') + ';color:' + c.text + ';">' + esc(d.name) + '</div>';
          }).join('');
      listEl.querySelectorAll('[data-sd-idx]').forEach(function (el) {
        el.onclick = function () {
          selectedIdx = Number(el.getAttribute('data-sd-idx'));
          renderList();
        };
        el.ondblclick = function () {
          selectedIdx = Number(el.getAttribute('data-sd-idx'));
          launchSelected();
        };
      });
    }

    shell.body.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
        '<label for="sd-filter" style="font-size:13px;white-space:nowrap;">篩選器：</label>' +
        '<input type="text" id="sd-filter" placeholder="輸入牌組名稱關鍵字..." style="flex:1;padding:6px 10px;font-size:13px;border-radius:5px;border:1.5px solid ' + c.accent + ';background:' + c.bgList + ';color:' + c.text + ';outline:none;" />' +
      '</div>' +
      '<div id="sd-list" style="flex:1;min-height:260px;max-height:50vh;overflow:auto;background:' + c.bgList + ';border:1px solid ' + c.border + ';border-radius:6px;margin-bottom:12px;"></div>' +
      '<div style="display:flex;justify-content:center;gap:8px;">' +
        '<button type="button" id="sd-go" style="min-width:86px;padding:6px 14px;font-size:13px;border-radius:5px;border:1.5px solid ' + c.accent + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">學習</button>' +
        '<button type="button" id="sd-add" style="min-width:86px;padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">新增</button>' +
        '<button type="button" id="sd-cancel" style="min-width:86px;padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">取消</button>' +
        '<button type="button" id="sd-help" style="min-width:86px;padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">說明</button>' +
      '</div>';

    var inp = shell.body.querySelector('#sd-filter');
    inp.oninput = function (e) {
      query = e.target.value;
      selectedIdx = 0;
      renderList();
    };
    inp.onkeydown = function (e) {
      var list = getFiltered();
      if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min(list.length - 1, selectedIdx + 1); renderList(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(0, selectedIdx - 1); renderList(); }
      else if (e.key === 'Enter') { e.preventDefault(); launchSelected(); }
      else if (e.key === 'Escape') { shell.overlay.remove(); }
    };
    shell.body.querySelector('#sd-go').onclick = launchSelected;
    shell.body.querySelector('#sd-add').onclick = async function () {
      var nm = window.prompt('請輸入新牌組名稱（可用 :: 建立子層級）：');
      if (nm && nm.trim()) {
        await db.decks.put({ id: Date.now(), name: nm.trim(), description: '', createdAt: Math.floor(Date.now() / 1000) });
        window.location.reload();
      }
    };
    shell.body.querySelector('#sd-cancel').onclick = function () { shell.overlay.remove(); };
    shell.body.querySelector('#sd-help').onclick = function () { window.open('https://docs.ankiweb.net/studying.html', '_blank', 'noopener'); };

    renderList();
    setTimeout(function () { inp.focus(); }, 30);
  }

  // =========================================================================
  // 5. 建立篩選牌組 (Filtered Deck Options, shortcut: F)
  // =========================================================================
  async function openFilteredDeckDialog() {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var defaultName = 'Filtered Deck ' + hh + ':' + mm;
    var shell = makeModalShell('anki-filtered-deck-dlg', '「' + defaultName + '」的選項', 580);
    var c = shell.c;
    var db = window.__ANKI_DB__;
    if (!db) { shell.overlay.remove(); return; }

    var inputStyle = 'width:100%;padding:6px 9px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgList + ';color:' + c.text + ';outline:none;';

    shell.body.innerHTML =
      '<div style="overflow-y:auto;flex:1;min-height:0;">' +
        '<fieldset style="border:1px solid ' + c.border + ';border-radius:6px;padding:12px 14px;margin:0 0 12px;">' +
          '<legend style="font-size:12px;font-weight:600;padding:0 6px;">牌組</legend>' +
          '<div style="display:grid;grid-template-columns:56px 1fr;align-items:center;gap:8px;font-size:13px;">' +
            '<span>名稱：</span>' +
            '<input type="text" id="fd-name" value="' + esc(defaultName) + '" style="' + inputStyle + '" />' +
          '</div>' +
        '</fieldset>' +
        '<fieldset style="border:1px solid ' + c.border + ';border-radius:6px;padding:12px 14px;margin:0 0 12px;">' +
          '<legend style="font-size:12px;font-weight:600;padding:0 6px;">篩選器</legend>' +
          '<div style="display:grid;grid-template-columns:56px 1fr;align-items:center;gap:8px;font-size:13px;margin-bottom:10px;">' +
            '<span>搜尋</span>' +
            '<input type="text" id="fd-query" value="is:due" placeholder="例如：deck:生殖學 is:due 或 tag:ch15" style="' + inputStyle + ';border:1.5px solid ' + c.accent + ';" />' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;">' +
            '<span>上限為</span>' +
            '<input type="number" id="fd-limit" min="1" max="9999" value="100" style="width:90px;padding:5px 8px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgList + ';color:' + c.text + ';" />' +
            '<span>張卡片，選取方式：</span>' +
            '<select id="fd-order" style="flex:1;min-width:140px;padding:5px 8px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgList + ';color:' + c.text + ';">' +
              '<option value="random">隨機</option>' +
              '<option value="oldest">最久未複習</option>' +
              '<option value="added">最新加入</option>' +
              '<option value="lapses">失誤次數最多</option>' +
            '</select>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset style="border:1px solid ' + c.border + ';border-radius:6px;padding:12px 14px;margin:0 0 12px;">' +
          '<legend style="font-size:12px;font-weight:600;padding:0 6px;">選項</legend>' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0;cursor:pointer;"><input type="checkbox" id="fd-resched" checked style="accent-color:' + c.accent + ';" /><span>依在此牌組做出的回答重新排程卡片</span></label>' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0;cursor:pointer;"><input type="checkbox" id="fd-second" style="accent-color:' + c.accent + ';" /><span>啟用次要篩選器</span></label>' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0;cursor:pointer;"><input type="checkbox" id="fd-empty" style="accent-color:' + c.accent + ';" /><span>空白時仍建立/更新此牌組</span></label>' +
        '</fieldset>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;flex-shrink:0;">' +
        '<button type="button" id="fd-build" style="min-width:80px;padding:6px 14px;font-size:13px;border-radius:5px;border:1.5px solid ' + c.accent + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">建立</button>' +
        '<button type="button" id="fd-cancel" style="min-width:80px;padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">取消</button>' +
        '<button type="button" id="fd-help" style="min-width:80px;padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">說明</button>' +
      '</div>';

    shell.body.querySelector('#fd-cancel').onclick = function () { shell.overlay.remove(); };
    shell.body.querySelector('#fd-help').onclick = function () { window.open('https://docs.ankiweb.net/filtered-decks.html', '_blank', 'noopener'); };
    shell.body.querySelector('#fd-build').onclick = async function () {
      var name = (shell.body.querySelector('#fd-name').value || defaultName).trim();
      var qStr = (shell.body.querySelector('#fd-query').value || '').trim();
      var limit = Math.max(1, Number(shell.body.querySelector('#fd-limit').value) || 100);
      var order = shell.body.querySelector('#fd-order').value;
      var allowEmpty = shell.body.querySelector('#fd-empty').checked;

      var allDecks = await db.decks.toArray();
      var allNotes = await db.notes.toArray();
      var allCards = await db.cards.toArray();
      var deckMap = new Map(allDecks.map(function (d) { return [d.id, String(d.name || '')]; }));
      var noteMap = new Map(allNotes.map(function (n) { return [n.id, n]; }));

      // Parse quoted and space-separated tokens
      var tokens = (qStr.match(/"[^"]+"|\S+/g) || []).map(function (t) { return t.replace(/^"|"$/g, ''); });

      var matched = allCards.filter(function (cd) {
        var dName = (deckMap.get(cd.did) || '').toLowerCase();
        var nt = noteMap.get(cd.nid);
        var text = nt ? ((nt.flds || []).join(' ') + ' ' + (nt.tags || []).join(' ')).toLowerCase() : '';
        var tags = nt && Array.isArray(nt.tags) ? nt.tags.map(function (x) { return x.toLowerCase(); }) : [];

        return tokens.every(function (tok) {
          var low = tok.toLowerCase();
          if (low.startsWith('deck:')) {
            var dv = low.slice(5).trim();
            return dName.includes(dv);
          }
          if (low.startsWith('tag:')) {
            var tv = low.slice(4).trim();
            return tags.some(function (t) { return t.includes(tv); });
          }
          if (low === 'is:new') return cd.queue === 0;
          if (low === 'is:learn') return cd.queue === 1 || cd.queue === 3;
          if (low === 'is:due' || low === 'is:review') return cd.queue === 2 || cd.queue === 1 || cd.queue === 0;
          return text.includes(low) || dName.includes(low);
        });
      });

      if (matched.length === 0 && !allowEmpty) {
        window.alert('找不到符合搜尋條件「' + qStr + '」的卡片。');
        return;
      }

      if (order === 'random') {
        for (var i = matched.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = matched[i]; matched[i] = matched[j]; matched[j] = tmp;
        }
      } else if (order === 'added') {
        matched.sort(function (a, b) { return b.id - a.id; });
      } else if (order === 'lapses') {
        matched.sort(function (a, b) { return (b.lapses || 0) - (a.lapses || 0); });
      } else {
        matched.sort(function (a, b) { return (a.due || 0) - (b.due || 0); });
      }

      var picked = matched.slice(0, limit);
      var newDeckId = Date.now();
      var newDeck = { id: newDeckId, name: name, description: '篩選牌組：' + qStr, createdAt: Math.floor(Date.now() / 1000) };
      var nowTs = Math.floor(Date.now() / 1000);
      var clonedCards = picked.map(function (cd, idx) {
        return Object.assign({}, cd, { id: newDeckId + idx + 1, did: newDeckId, mod: nowTs });
      });

      await db.transaction('rw', [db.decks, db.cards], async function () {
        await db.decks.put(newDeck);
        if (clonedCards.length > 0) await db.cards.bulkPut(clonedCards);
      });

      shell.overlay.remove();
      window.alert('已建立篩選牌組「' + name + '」（共納入 ' + clonedCards.length + ' 張卡片）。');
      window.location.reload();
    };
  }

  window.__ANKI_OPEN_STUDY_DECK__ = openStudyDeckDialog;
  window.__ANKI_OPEN_FILTERED_DECK__ = openFilteredDeckDialog;

  // Global '/' (Study Deck) and 'F' (Create Filtered Deck) shortcuts when not typing
  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      openStudyDeckDialog();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      openFilteredDeckDialog();
    }
  });
})();
