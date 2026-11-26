(function () {
  'use strict';

  var FLAGS = [
    { id: 0, name: '無', color: 'transparent' },
    { id: 1, name: '紅', color: '#ef4444' },
    { id: 2, name: '橘', color: '#f97316' },
    { id: 3, name: '綠', color: '#22c55e' },
    { id: 4, name: '藍', color: '#3b82f6' },
    { id: 5, name: '粉', color: '#ec4899' },
    { id: 6, name: '青', color: '#14b8a6' },
    { id: 7, name: '紫', color: '#a855f7' }
  ];

  function theme() {
    var isDark = document.documentElement.classList.contains('dark');
    return {
      bg: isDark ? '#2a2a2c' : '#ffffff',
      bgInput: isDark ? '#1e1e1e' : '#ffffff',
      bgBtn: isDark ? '#3c3c3c' : '#e8e8e8',
      border: isDark ? '#454545' : '#cccccc',
      text: isDark ? '#ececec' : '#1a1a1a',
      muted: isDark ? '#a0a0a6' : '#666666',
      accent: '#2f65d6'
    };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg) {
    var el = document.getElementById('anki-pf-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'anki-pf-toast';
      el.style.cssText = 'position:fixed;bottom:76px;left:50%;transform:translateX(-50%);background:#1f2328;color:#fff;font-size:12px;padding:7px 14px;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.35);z-index:10050;transition:opacity 0.15s;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC",sans-serif;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = '0'; }, 2400);
  }

  function openFindReplaceModal(ctx) {
    var old = document.getElementById('anki-fr-modal');
    if (old) old.remove();
    var c = theme();
    var ov = document.createElement('div');
    ov.id = 'anki-fr-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC",sans-serif;';
    var inp = 'width:100%;padding:6px 9px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgInput + ';color:' + c.text + ';outline:none;';
    ov.innerHTML =
      '<div style="width:100%;max-width:440px;background:' + c.bg + ';color:' + c.text + ';border:1px solid ' + c.border + ';border-radius:8px;box-shadow:0 16px 40px rgba(0,0,0,0.4);overflow:hidden;">' +
        '<div style="padding:10px 14px;border-bottom:1px solid ' + c.border + ';font-size:13px;font-weight:600;display:flex;justify-content:space-between;"><span>尋找與取代 (目前篩選結果共 ' + (ctx.rows ? ctx.rows.length : 0) + ' 張)</span><button type="button" id="fr-x" style="border:none;background:transparent;color:' + c.muted + ';cursor:pointer;">✕</button></div>' +
        '<div style="padding:14px;display:flex;flex-direction:column;gap:10px;font-size:13px;">' +
          '<div><div style="margin-bottom:4px;font-size:12px;color:' + c.muted + ';">尋找文字：</div><input id="fr-find" type="text" style="' + inp + '" /></div>' +
          '<div><div style="margin-bottom:4px;font-size:12px;color:' + c.muted + ';">取代為：</div><input id="fr-rep" type="text" style="' + inp + '" /></div>' +
        '</div>' +
        '<div style="padding:10px 14px;border-top:1px solid ' + c.border + ';display:flex;justify-content:flex-end;gap:8px;">' +
          '<button type="button" id="fr-cancel" style="padding:5px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">取消</button>' +
          '<button type="button" id="fr-go" style="padding:5px 16px;font-size:13px;font-weight:600;border-radius:5px;border:none;background:' + c.accent + ';color:#fff;cursor:pointer;">全部取代</button>' +
        '</div>' +
      '</div>';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
    ov.querySelector('#fr-x').onclick = function () { ov.remove(); };
    ov.querySelector('#fr-cancel').onclick = function () { ov.remove(); };
    ov.querySelector('#fr-go').onclick = async function () {
      var db = window.__ANKI_DB__;
      var findStr = ov.querySelector('#fr-find').value;
      var repStr = ov.querySelector('#fr-rep').value;
      if (!db || !findStr) return;
      var noteIds = Array.from(new Set((ctx.rows || []).map(function (r) { return r.note.id; })));
      var updated = 0;
      for (var i = 0; i < noteIds.length; i++) {
        var nt = await db.notes.get(noteIds[i]);
        if (!nt || !Array.isArray(nt.flds)) continue;
        var changed = false;
        var nextFlds = nt.flds.map(function (f) {
          if (String(f).includes(findStr)) { changed = true; return String(f).split(findStr).join(repStr); }
          return f;
        });
        if (changed) {
          await db.notes.update(nt.id, { flds: nextFlds });
          updated++;
        }
      }
      ov.remove();
      toast('已於 ' + updated + ' 則筆記中完成取代');
      if (ctx.reload) ctx.reload();
    };
    setTimeout(function () { ov.querySelector('#fr-find').focus(); }, 20);
  }

  function openChangeDeckModal(ctx) {
    if (!ctx.selected) { toast('請先選取一張卡片'); return; }
    var old = document.getElementById('anki-cd-modal');
    if (old) old.remove();
    var c = theme();
    var decks = (ctx.allDecks || []).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh-Hant'); });
    var ov = document.createElement('div');
    ov.id = 'anki-cd-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC",sans-serif;';
    ov.innerHTML =
      '<div style="width:100%;max-width:420px;background:' + c.bg + ';color:' + c.text + ';border:1px solid ' + c.border + ';border-radius:8px;box-shadow:0 16px 40px rgba(0,0,0,0.4);overflow:hidden;">' +
        '<div style="padding:10px 14px;border-bottom:1px solid ' + c.border + ';font-size:13px;font-weight:600;">更改牌組 (Ctrl+D)</div>' +
        '<div style="padding:14px;">' +
          '<select id="cd-sel" style="width:100%;padding:7px 10px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgInput + ';color:' + c.text + ';">' +
            decks.map(function (d) { return '<option value="' + d.id + '" ' + (d.id === ctx.selected.card.did ? 'selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div style="padding:10px 14px;border-top:1px solid ' + c.border + ';display:flex;justify-content:flex-end;gap:8px;">' +
          '<button type="button" id="cd-cancel" style="padding:5px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">取消</button>' +
          '<button type="button" id="cd-ok" style="padding:5px 16px;font-size:13px;font-weight:600;border-radius:5px;border:none;background:' + c.accent + ';color:#fff;cursor:pointer;">移動卡片</button>' +
        '</div>' +
      '</div>';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
    ov.querySelector('#cd-cancel').onclick = function () { ov.remove(); };
    ov.querySelector('#cd-ok').onclick = async function () {
      var db = window.__ANKI_DB__;
      var did = Number(ov.querySelector('#cd-sel').value);
      if (db && did) {
        await db.cards.update(ctx.selected.card.id, { did: did });
        toast('已將卡片移動至目標牌組');
        if (ctx.reload) ctx.reload();
      }
      ov.remove();
    };
  }

  function openBrowserMenu(menuId, ctx, anchorEl) {
    var old = document.getElementById('anki-browser-dropdown');
    if (old) {
      var same = old.getAttribute('data-menu-id') === menuId;
      old.remove();
      if (same) return;
    }

    var c = theme();
    var rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: 20, bottom: 48 };
    var pop = document.createElement('div');
    pop.id = 'anki-browser-dropdown';
    pop.setAttribute('data-menu-id', menuId);
    pop.style.cssText =
      'position:fixed;top:' + (rect.bottom + 4) + 'px;left:' + Math.min(window.innerWidth - 245, Math.max(8, rect.left)) + 'px;' +
      'z-index:10005;width:236px;background:' + c.bg + ';color:' + c.text + ';border:1px solid ' + c.border + ';border-radius:6px;box-shadow:0 12px 30px rgba(0,0,0,0.38);padding:4px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC",sans-serif;';

    function addItem(label, kbd, onClick) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'width:100%;display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:none;background:transparent;color:' + c.text + ';border-radius:4px;cursor:pointer;text-align:left;';
      btn.innerHTML = '<span>' + esc(label) + '</span>' + (kbd ? '<span style="color:' + c.muted + ';font-size:11px;font-family:monospace;">' + esc(kbd) + '</span>' : '');
      btn.onmouseenter = function () { btn.style.background = c.accent; btn.style.color = '#fff'; };
      btn.onmouseleave = function () { btn.style.background = 'transparent'; btn.style.color = c.text; };
      btn.onclick = function () { pop.remove(); onClick(); };
      pop.appendChild(btn);
    }
    function addSep() {
      var d = document.createElement('div');
      d.style.cssText = 'height:1px;background:' + c.border + ';margin:4px 2px;';
      pop.appendChild(d);
    }

    var db = window.__ANKI_DB__;
    var sel = ctx.selected;
    var rows = ctx.rows || [];

    if (menuId === 'edit') {
      addItem('復原更新筆記', 'Ctrl+Z', function () { toast('已記錄最近編輯狀態'); });
      addSep();
      addItem('選取第一張卡片', 'Home', function () { if (rows[0] && ctx.selectRow) ctx.selectRow(rows[0].card.id); });
      addItem('選取最後一張卡片', 'End', function () { if (rows.length && ctx.selectRow) ctx.selectRow(rows[rows.length - 1].card.id); });
      addSep();
      addItem('建立篩選牌組...', 'Ctrl+G', function () { window.__ANKI_OPEN_FILTERED_DECK__ && window.__ANKI_OPEN_FILTERED_DECK__(); });
    } else if (menuId === 'view') {
      addItem('預覽卡片...', 'Ctrl+Shift+P', function () { openPreviewDialog(ctx); });
      addSep();
      addItem('切換卡片/筆記', 'Ctrl+Alt+T', function () { ctx.toggleMode && ctx.toggleMode(); });
      addItem('切換全螢幕顯示(F)', 'F11', function () {
        document.fullscreenElement ? document.exitFullscreen().catch(function () {}) : document.documentElement.requestFullscreen().catch(function () {});
      });
      addItem('切換側邊欄', '', function () { document.documentElement.classList.toggle('anki-browser-hide-sidebar'); });
      addSep();
      addItem('放大編輯器(I)', '', function () {
        var cur = parseFloat(document.body.style.zoom || '1') || 1;
        document.body.style.zoom = String(Math.min(1.5, Math.round((cur + 0.1) * 10) / 10));
      });
      addItem('縮小編輯器(O)', '', function () {
        var cur = parseFloat(document.body.style.zoom || '1') || 1;
        document.body.style.zoom = String(Math.max(0.7, Math.round((cur - 0.1) * 10) / 10));
      });
      addItem('重置縮放(R)', 'Ctrl+0', function () { document.body.style.zoom = '1'; });
    } else if (menuId === 'notes') {
      addItem('建立複本...', 'Ctrl+Alt+E', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        var now = Date.now();
        var newNote = Object.assign({}, sel.note, { id: now, guid: 'dup_' + now, mod: Math.floor(now / 1000) });
        var newCard = Object.assign({}, sel.card, { id: now + 1, nid: now, type: 0, queue: 0, ivl: 0, reps: 0, lapses: 0, mod: Math.floor(now / 1000) });
        await db.transaction('rw', [db.notes, db.cards], async function () {
          await db.notes.put(newNote);
          await db.cards.put(newCard);
        });
        toast('已建立筆記複本');
        ctx.reload && ctx.reload();
      });
      addSep();
      addItem('加入標籤...', 'Ctrl+Shift+A', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        var inp = window.prompt('請輸入要加入的標籤（多個標籤以空格分隔）：');
        if (!inp || !inp.trim()) return;
        var addTags = inp.trim().split(/\s+/);
        var next = Array.from(new Set((sel.note.tags || []).concat(addTags)));
        await db.notes.update(sel.note.id, { tags: next });
        toast('已加入標籤：' + addTags.join(', '));
        ctx.reload && ctx.reload();
      });
      addItem('移除標籤...', 'Ctrl+Alt+Shift+A', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        var inp = window.prompt('請輸入要移除的標籤名稱：', (sel.note.tags || []).join(' '));
        if (!inp || !inp.trim()) return;
        var rm = new Set(inp.trim().split(/\s+/));
        var next = (sel.note.tags || []).filter(function (t) { return !rm.has(t); });
        await db.notes.update(sel.note.id, { tags: next });
        toast('已移除指定標籤');
        ctx.reload && ctx.reload();
      });
      addItem('切換標記 (marked)', 'Ctrl+K', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        var tags = (sel.note.tags || []).slice();
        var idx = tags.indexOf('marked');
        if (idx >= 0) { tags.splice(idx, 1); toast('已取消標記'); }
        else { tags.push('marked'); toast('已標記此筆記'); }
        await db.notes.update(sel.note.id, { tags: tags });
        ctx.reload && ctx.reload();
      });
      addSep();
      addItem('尋找重複項目(D)', '', async function () {
        if (!db) return;
        var all = await db.notes.toArray();
        var seen = new Map(), dups = [];
        all.forEach(function (n) {
          var k = String((n.flds && n.flds[0]) || '').trim();
          if (!k) return;
          if (seen.has(k)) dups.push(k);
          else seen.set(k, n.id);
        });
        if (dups.length === 0) toast('太棒了！目前沒有重複的首欄筆記');
        else {
          toast('找到 ' + dups.length + ' 筆重複首欄，已自動填入搜尋列');
          ctx.setSearch && ctx.setSearch(dups[0].replace(/<[^>]+>/g, '').slice(0, 40));
        }
      });
      addItem('尋找與取代(P)', 'Ctrl+Alt+F', function () { openFindReplaceModal(ctx); });
      addItem('管理筆記類型', '', function () {
        window.__ANKI_OPEN_NOTETYPES__ ? window.__ANKI_OPEN_NOTETYPES__(ctx.openModels) : (ctx.openModels && ctx.openModels());
      });
      addSep();
      addItem('刪除筆記', 'Ctrl+Del', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        if (!window.confirm('確定要刪除此筆記及其所有卡片嗎？')) return;
        var relCards = await db.cards.where('nid').equals(sel.note.id).toArray();
        await db.transaction('rw', [db.notes, db.cards], async function () {
          await db.notes.delete(sel.note.id);
          await db.cards.bulkDelete(relCards.map(function (x) { return x.id; }));
        });
        toast('已刪除筆記');
        ctx.reload && ctx.reload();
      });
    } else if (menuId === 'cards') {
      addItem('更改牌組...', 'Ctrl+D', function () { openChangeDeckModal(ctx); });
      addItem('設定到期日(D)', 'Ctrl+Shift+D', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        var v = window.prompt('設定幾天後到期（0 = 今天）：', '0');
        if (v == null) return;
        var d = Math.max(0, Number(v) || 0);
        await db.cards.update(sel.card.id, { queue: 2, type: 2, ivl: Math.max(1, d), due: Math.floor(Date.now() / 1000) + d * 86400 });
        toast('已更新到期日');
        ctx.reload && ctx.reload();
      });
      addItem('重置(R)...', 'Ctrl+Alt+N', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        if (!window.confirm('確定要將此卡片重置為新卡片嗎？')) return;
        await db.cards.update(sel.card.id, { type: 0, queue: 0, ivl: 0, reps: 0, lapses: 0, factor: 2500, left: 0 });
        toast('已重置卡片');
        ctx.reload && ctx.reload();
      });
      addSep();
      addItem('切換擱置 (暫停)', 'Ctrl+J', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        var nextQ = sel.card.queue === -1 ? (sel.card.reps > 0 ? 2 : 0) : -1;
        await db.cards.update(sel.card.id, { queue: nextQ });
        toast(nextQ === -1 ? '已暫停卡片' : '已取消暫停');
        ctx.reload && ctx.reload();
      });
      addItem('切換推遲 (Bury)', 'Ctrl+Shift+J', async function () {
        if (!db || !sel) { toast('請先選取一張卡片'); return; }
        var nextQ = sel.card.queue === -2 ? (sel.card.reps > 0 ? 2 : 0) : -2;
        await db.cards.update(sel.card.id, { queue: nextQ });
        toast(nextQ === -2 ? '已推遲卡片至隔日' : '已解除推遲');
        ctx.reload && ctx.reload();
      });
      addSep();
      var flagRow = document.createElement('div');
      flagRow.style.cssText = 'padding:5px 8px;display:flex;align-items:center;justify-content:space-between;gap:4px;';
      FLAGS.forEach(function (f) {
        var b = document.createElement('button');
        b.type = 'button';
        b.title = f.name + '旗標';
        b.style.cssText = f.id === 0
          ? 'font-size:11px;padding:1px 5px;border:1px solid ' + c.border + ';border-radius:4px;background:transparent;color:' + c.muted + ';cursor:pointer;'
          : 'width:18px;height:18px;border-radius:50%;background:' + f.color + ';border:1px solid rgba(0,0,0,0.2);cursor:pointer;';
        if (f.id === 0) b.textContent = '無';
        b.onclick = async function () {
          pop.remove();
          if (!db || !sel) { toast('請先選取一張卡片'); return; }
          await db.cards.update(sel.card.id, { flags: f.id });
          toast(f.id === 0 ? '已清除旗標' : '已設定' + f.name + '色旗標');
          ctx.reload && ctx.reload();
        };
        flagRow.appendChild(b);
      });
      pop.appendChild(flagRow);
      addSep();
      addItem('卡片資訊(I)', 'Ctrl+Shift+I', function () {
        if (!sel) { toast('請先選取一張卡片'); return; }
        window.__ANKI_OPEN_CARD_INFO__ && window.__ANKI_OPEN_CARD_INFO__(sel.card);
      });
    } else if (menuId === 'go') {
      addItem('尋找(F)', 'Ctrl+F', function () {
        var el = document.querySelector('input[placeholder*="搜尋"]');
        if (el) el.focus();
      });
      addItem('側邊欄篩選器(T)', 'Ctrl+Shift+F', function () {
        var el = document.querySelector('input[placeholder*="側邊欄"]');
        if (el) el.focus();
      });
      addSep();
      addItem('第一張卡片', 'Home', function () { if (rows[0] && ctx.selectRow) ctx.selectRow(rows[0].card.id); });
      addItem('上一張卡片(P)', 'Ctrl+P', function () {
        if (!rows.length || !ctx.selectRow) return;
        var idx = sel ? rows.findIndex(function (r) { return r.card.id === sel.card.id; }) : 0;
        ctx.selectRow(rows[Math.max(0, idx - 1)].card.id);
      });
      addItem('下一張卡片(N)', 'Ctrl+N', function () {
        if (!rows.length || !ctx.selectRow) return;
        var idx = sel ? rows.findIndex(function (r) { return r.card.id === sel.card.id; }) : -1;
        ctx.selectRow(rows[Math.min(rows.length - 1, idx + 1)].card.id);
      });
      addItem('最後一張卡片', 'End', function () { if (rows.length && ctx.selectRow) ctx.selectRow(rows[rows.length - 1].card.id); });
    } else if (menuId === 'help') {
      addItem('使用手冊(G)', 'F1', function () { window.open('https://docs.ankiweb.net/browsing.html', '_blank', 'noopener'); });
    }

    document.body.appendChild(pop);
    setTimeout(function () {
      function dismiss(ev) {
        if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', dismiss); }
      }
      document.addEventListener('mousedown', dismiss);
    }, 10);
  }

  window.__ANKI_OPEN_BROWSER_MENU__ = openBrowserMenu;

  // =========================================================================
  // OFFICIAL BROWSER PREVIEW WINDOW (預覽: 重播音訊 / 僅背面 / < / >)
  // =========================================================================
  async function openPreviewDialog(ctx) {
    var rows = ctx && ctx.rows ? ctx.rows : [];
    if (!rows.length) { toast('目前沒有可預覽的卡片'); return; }
    var renderFn = window.__ANKI_RENDER_CARD__;
    if (!renderFn) { toast('卡片渲染器尚未就緒'); return; }

    var old = document.getElementById('anki-preview-modal');
    if (old) old.remove();

    var idx = ctx.selected ? rows.findIndex(function (r) { return r.card.id === ctx.selected.card.id; }) : 0;
    if (idx < 0) idx = 0;
    var backOnly = false;
    var side = 'front'; // 'front' | 'back'

    var c = theme();
    var ov = document.createElement('div');
    ov.id = 'anki-preview-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,0.62);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;';

    var win = document.createElement('div');
    win.style.cssText = 'width:100%;max-width:860px;height:82vh;background:' + (document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc') + ';color:' + c.text + ';border:1px solid ' + c.border + ';border-radius:8px;box-shadow:0 20px 52px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;';

    win.innerHTML =
      '<div style="padding:8px 14px;background:' + (document.documentElement.classList.contains('dark') ? '#242424' : '#e6e6e6') + ';border-bottom:1px solid ' + c.border + ';display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
        '<span id="pv-title" style="font-size:13px;font-weight:600;">預覽</span>' +
        '<button type="button" id="pv-x" style="border:none;background:transparent;color:' + c.muted + ';font-size:15px;cursor:pointer;padding:2px 6px;">✕</button>' +
      '</div>' +
      '<div id="pv-stage" style="flex:1;min-height:0;overflow-y:auto;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;-webkit-overflow-scrolling:touch;"></div>' +
      '<div style="padding:8px 14px;background:' + (document.documentElement.classList.contains('dark') ? '#262626' : '#ebebeb') + ';border-top:1px solid ' + c.border + ';display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;">' +
        '<span id="pv-pos" style="font-size:12px;color:' + c.muted + ';"></span>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '<button type="button" id="pv-audio" style="padding:5px 14px;font-size:12px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">重播音訊</button>' +
          '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:' + c.text + ';cursor:pointer;user-select:none;margin:0 4px;"><input type="checkbox" id="pv-backonly" style="accent-color:' + c.accent + ';" /><span>僅背面</span></label>' +
          '<button type="button" id="pv-prev" style="min-width:56px;padding:5px 12px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">&lt;</button>' +
          '<button type="button" id="pv-next" style="min-width:56px;padding:5px 12px;font-size:13px;border-radius:5px;border:1.5px solid ' + c.accent + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">&gt;</button>' +
        '</div>' +
      '</div>';

    ov.appendChild(win);
    document.body.appendChild(ov);

    async function renderCard() {
      var row = rows[idx];
      if (!row) return;
      var isAns = backOnly || side === 'back';
      var isDark = document.documentElement.classList.contains('dark');
      win.querySelector('#pv-title').textContent = '預覽 — ' + (isAns ? '背面' : '正面');
      win.querySelector('#pv-pos').textContent = (idx + 1) + ' / ' + rows.length + ' · ' + (row.deck ? row.deck.name : '');

      var rendered = await renderFn({
        model: row.model,
        note: row.note,
        cardOrd: row.card.ord || 0,
        isAnswer: isAns
      });

      var stage = win.querySelector('#pv-stage');
      stage.innerHTML =
        '<style>' + (rendered.css || '') + ' .anki-preview-card .io-inner img{margin:0!important;border-radius:0!important;max-width:100%!important;max-height:58vh!important;width:auto!important;height:auto!important;}</style>' +
        '<div class="card anki-preview-card ' + (isDark ? 'nightMode night_mode' : '') + '" style="width:100%;max-width:820px;margin:auto 0;background:transparent;">' +
          rendered.html +
        '</div>';

      // Execute embedded card scripts (MCQ / Grid / Order)
      stage.querySelectorAll('script').forEach(function (sc) {
        var ns = document.createElement('script');
        for (var i = 0; i < sc.attributes.length; i++) {
          ns.setAttribute(sc.attributes[i].name, sc.attributes[i].value);
        }
        ns.textContent = sc.textContent;
        try { sc.parentNode && sc.parentNode.replaceChild(ns, sc); } catch (e) {}
      });

      if (ctx.selectRow) ctx.selectRow(row.card.id);
    }

    function goNext() {
      if (!backOnly && side === 'front') {
        side = 'back';
      } else if (idx < rows.length - 1) {
        idx++;
        side = backOnly ? 'back' : 'front';
      } else {
        toast('已到達最後一張卡片');
        return;
      }
      renderCard();
    }

    function goPrev() {
      if (!backOnly && side === 'back') {
        side = 'front';
      } else if (idx > 0) {
        idx--;
        side = 'back';
      } else {
        toast('已到達第一張卡片');
        return;
      }
      renderCard();
    }

    function onKey(e) {
      if (!document.getElementById('anki-preview-modal')) { window.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowRight' || e.code === 'Space') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    }
    function close() {
      window.removeEventListener('keydown', onKey);
      ov.remove();
    }

    window.addEventListener('keydown', onKey);
    ov.onclick = function (e) { if (e.target === ov) close(); };
    win.querySelector('#pv-x').onclick = close;
    win.querySelector('#pv-next').onclick = goNext;
    win.querySelector('#pv-prev').onclick = goPrev;
    win.querySelector('#pv-backonly').onchange = function (e) {
      backOnly = e.target.checked;
      side = backOnly ? 'back' : 'front';
      renderCard();
    };
    win.querySelector('#pv-audio').onclick = function () {
      var btn = win.querySelector('.anki-sound-play-btn') || win.querySelector('.anki-tts-play-btn');
      if (btn) btn.click();
      else toast('此卡片沒有音訊');
    };

    renderCard();
  }

  window.__ANKI_OPEN_PREVIEW__ = openPreviewDialog;
})();
