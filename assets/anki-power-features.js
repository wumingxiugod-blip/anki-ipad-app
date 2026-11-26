(function () {
  'use strict';

  var DECK_OPTS_KEY = 'anki_ipad_deck_options_v1';

  var DEFAULT_DECK_OPTS = {
    newPerDay: 20,
    reviewsPerDay: 200,
    newIgnoreReviewLimit: false,
    learningSteps: '1m 10m',
    graduatingInterval: 1,
    easyInterval: 4,
    insertionOrder: 'sequential', // sequential | random
    relearningSteps: '10m',
    minInterval: 1,
    leechThreshold: 8,
    leechAction: 'tag', // tag | suspend
    newGatherOrder: 'deck',
    newReviewOrder: 'mix', // mix | new_first | review_first
    reviewSortOrder: 'due',
    fsrsEnabled: true,
    fsrsRetention: 90,
    maxInterval: 36500,
    buryNewSiblings: true,
    buryReviewSiblings: true,
    buryInterdaySiblings: false,
    maxAnswerSeconds: 60,
    showOnScreenTimer: false,
    stopTimerOnAnswer: true,
    dontPlayAudioAuto: false,
    skipQuestionReplay: false
  };

  var FLAGS = [
    { id: 0, name: '無旗標', color: 'transparent' },
    { id: 1, name: '紅色旗標', color: '#ef4444' },
    { id: 2, name: '橘色旗標', color: '#f97316' },
    { id: 3, name: '綠色旗標', color: '#22c55e' },
    { id: 4, name: '藍色旗標', color: '#3b82f6' },
    { id: 5, name: '粉紅旗標', color: '#ec4899' },
    { id: 6, name: '青色旗標', color: '#14b8a6' },
    { id: 7, name: '紫色旗標', color: '#a855f7' }
  ];

  function loadAllDeckOpts() {
    try {
      var raw = localStorage.getItem(DECK_OPTS_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }

  function getDeckOpts(deckId) {
    var all = loadAllDeckOpts();
    return Object.assign({}, DEFAULT_DECK_OPTS, all[String(deckId)] || all['default'] || {});
  }

  function saveDeckOpts(deckId, opts) {
    var all = loadAllDeckOpts();
    all[String(deckId || 'default')] = opts;
    try { localStorage.setItem(DECK_OPTS_KEY, JSON.stringify(all)); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function theme() {
    var isDark = document.documentElement.classList.contains('dark');
    return {
      isDark: isDark,
      bgWin: isDark ? '#2c2c2c' : '#f0f0f0',
      bgTitle: isDark ? '#242424' : '#e6e6e6',
      bgPanel: isDark ? '#323232' : '#ffffff',
      bgInput: isDark ? '#1e1e1e' : '#ffffff',
      bgBtn: isDark ? '#3c3c3c' : '#e8e8e8',
      border: isDark ? '#454545' : '#cccccc',
      text: isDark ? '#ececec' : '#1a1a1a',
      muted: isDark ? '#a8a8a8' : '#606060',
      accent: '#2f65d6'
    };
  }

  var toastTimer = null;
  function showToast(msg) {
    var el = document.getElementById('anki-pf-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'anki-pf-toast';
      el.style.cssText = 'position:fixed;bottom:76px;left:50%;transform:translateX(-50%);background:#1f2328;color:#fff;font-size:12px;padding:7px 14px;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.35);z-index:10050;transition:opacity 0.15s;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC",sans-serif;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.opacity = '0'; }, 2400);
  }

  function makeModal(id, title, maxWidth) {
    var old = document.getElementById(id);
    if (old) old.remove();
    var c = theme();
    var overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9996;background:rgba(0,0,0,0.58);display:flex;align-items:center;justify-content:center;padding:14px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    var win = document.createElement('div');
    win.style.cssText = 'width:100%;max-width:' + maxWidth + 'px;max-height:88vh;background:' + c.bgWin + ';color:' + c.text + ';border:1px solid ' + c.border + ';border-radius:8px;box-shadow:0 18px 48px rgba(0,0,0,0.45);display:flex;flex-direction:column;overflow:hidden;';
    win.innerHTML =
      '<div style="padding:9px 14px;border-bottom:1px solid ' + c.border + ';display:flex;align-items:center;justify-content:space-between;background:' + c.bgTitle + ';flex-shrink:0;">' +
        '<span style="font-size:13px;font-weight:600;">' + esc(title) + '</span>' +
        '<button type="button" data-close="1" style="border:none;background:transparent;color:' + c.muted + ';font-size:15px;cursor:pointer;padding:2px 6px;">✕</button>' +
      '</div>' +
      '<div data-body="1" style="padding:14px 16px;overflow-y:auto;flex:1;min-height:0;"></div>' +
      '<div data-foot="1" style="padding:10px 16px;border-top:1px solid ' + c.border + ';display:flex;justify-content:flex-end;gap:8px;background:' + c.bgTitle + ';flex-shrink:0;"></div>';
    win.querySelector('[data-close]').onclick = function () { overlay.remove(); };
    overlay.appendChild(win);
    document.body.appendChild(overlay);
    return { overlay: overlay, body: win.querySelector('[data-body]'), foot: win.querySelector('[data-foot]'), c: c };
  }

  // =========================================================================
  // 1. 牌組選項 (Official Deck Options: Daily Limits, New, Lapses, FSRS, Burying, Timers, Audio)
  // =========================================================================
  function openDeckOptionsDialog(deck) {
    var deckId = deck && deck.id ? deck.id : 'default';
    var deckName = deck && deck.name ? deck.name : '預設牌組';
    var opts = getDeckOpts(deckId);
    var m = makeModal('anki-deck-opts-dlg', '牌組選項 — ' + deckName, 680);
    var c = m.c;
    var inp = 'width:100%;padding:5px 9px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgInput + ';color:' + c.text + ';outline:none;';

    function sec(title, inner) {
      return '<fieldset style="border:1px solid ' + c.border + ';border-radius:6px;padding:10px 14px 12px;margin:0 0 12px;background:' + c.bgPanel + ';"><legend style="font-size:12px;font-weight:600;padding:0 6px;">' + title + '</legend>' + inner + '</fieldset>';
    }
    function row(lbl, ctrl) {
      return '<div style="display:grid;grid-template-columns:1fr 180px;align-items:center;gap:10px;margin:6px 0;font-size:13px;"><span>' + lbl + '</span>' + ctrl + '</div>';
    }
    function chk(id, lbl, val) {
      return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0;cursor:pointer;"><input type="checkbox" data-do-chk="' + id + '" ' + (val ? 'checked' : '') + ' style="accent-color:' + c.accent + ';" /><span>' + lbl + '</span></label>';
    }

    m.body.innerHTML =
      sec('每日上限 (Daily Limits)',
        row('每日新卡片上限', '<input type="number" min="0" max="9999" data-do-num="newPerDay" value="' + opts.newPerDay + '" style="' + inp + '" />') +
        row('每日複習上限', '<input type="number" min="0" max="9999" data-do-num="reviewsPerDay" value="' + opts.reviewsPerDay + '" style="' + inp + '" />') +
        chk('newIgnoreReviewLimit', '新卡片忽略每日複習上限', opts.newIgnoreReviewLimit)
      ) +
      sec('新卡片與遺忘 (New Cards & Lapses)',
        row('學習步驟 (Learning Steps)', '<input type="text" data-do-txt="learningSteps" value="' + esc(opts.learningSteps) + '" style="' + inp + '" />') +
        row('畢業間隔（天）', '<input type="number" min="1" data-do-num="graduatingInterval" value="' + opts.graduatingInterval + '" style="' + inp + '" />') +
        row('簡單間隔（天）', '<input type="number" min="1" data-do-num="easyInterval" value="' + opts.easyInterval + '" style="' + inp + '" />') +
        row('重新學習步驟 (Relearning)', '<input type="text" data-do-txt="relearningSteps" value="' + esc(opts.relearningSteps) + '" style="' + inp + '" />') +
        row('難卡門檻 (Leech 失誤次數)', '<input type="number" min="1" data-do-num="leechThreshold" value="' + opts.leechThreshold + '" style="' + inp + '" />') +
        row('難卡處理動作', '<select data-do-sel="leechAction" style="' + inp + '"><option value="tag" ' + (opts.leechAction === 'tag' ? 'selected' : '') + '>僅加上 leech 標籤</option><option value="suspend" ' + (opts.leechAction === 'suspend' ? 'selected' : '') + '>暫停卡片並標記</option></select>')
      ) +
      sec('FSRS 記憶演算法 (Free Spaced Repetition Scheduler)',
        chk('fsrsEnabled', '啟用 FSRS 演算法（建議搭配 <1d 學習步驟）', opts.fsrsEnabled) +
        row('目標記憶保留率 (Desired Retention %)', '<input type="number" min="70" max="97" data-do-num="fsrsRetention" value="' + opts.fsrsRetention + '" style="' + inp + '" />') +
        row('最大間隔（天）', '<input type="number" min="1" max="36500" data-do-num="maxInterval" value="' + opts.maxInterval + '" style="' + inp + '" />')
      ) +
      sec('顯示順序與擱置兄弟卡 (Display Order & Burying)',
        row('新卡片與複習順序', '<select data-do-sel="newReviewOrder" style="' + inp + '"><option value="mix" ' + (opts.newReviewOrder === 'mix' ? 'selected' : '') + '>與複習卡片混合</option><option value="new_first" ' + (opts.newReviewOrder === 'new_first' ? 'selected' : '') + '>先顯示新卡片</option><option value="review_first" ' + (opts.newReviewOrder === 'review_first' ? 'selected' : '') + '>先顯示複習卡片</option></select>') +
        chk('buryNewSiblings', '擱置同筆記的新卡片兄弟卡（直到隔日）', opts.buryNewSiblings) +
        chk('buryReviewSiblings', '擱置同筆記的複習兄弟卡（直到隔日）', opts.buryReviewSiblings) +
        chk('buryInterdaySiblings', '擱置跨日學習兄弟卡', opts.buryInterdaySiblings)
      ) +
      sec('計時器與音訊 (Timers & Audio)',
        row('最大作答記錄秒數', '<input type="number" min="10" max="600" data-do-num="maxAnswerSeconds" value="' + opts.maxAnswerSeconds + '" style="' + inp + '" />') +
        chk('showOnScreenTimer', '在複習畫面顯示即時作答計時器', opts.showOnScreenTimer) +
        chk('stopTimerOnAnswer', '顯示答案時停止畫面計時器', opts.stopTimerOnAnswer) +
        chk('dontPlayAudioAuto', '不自動播放音訊', opts.dontPlayAudioAuto)
      );

    m.foot.innerHTML =
      '<button type="button" id="do-cancel" style="padding:6px 16px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">取消</button>' +
      '<button type="button" id="do-save" style="padding:6px 18px;font-size:13px;font-weight:600;border-radius:5px;border:none;background:' + c.accent + ';color:#fff;cursor:pointer;">儲存選項</button>';

    m.foot.querySelector('#do-cancel').onclick = function () { m.overlay.remove(); };
    m.foot.querySelector('#do-save').onclick = function () {
      m.body.querySelectorAll('[data-do-num]').forEach(function (el) { opts[el.getAttribute('data-do-num')] = Number(el.value); });
      m.body.querySelectorAll('[data-do-txt]').forEach(function (el) { opts[el.getAttribute('data-do-txt')] = el.value.trim(); });
      m.body.querySelectorAll('[data-do-sel]').forEach(function (el) { opts[el.getAttribute('data-do-sel')] = el.value; });
      m.body.querySelectorAll('[data-do-chk]').forEach(function (el) { opts[el.getAttribute('data-do-chk')] = el.checked; });
      saveDeckOpts(deckId, opts);
      m.overlay.remove();
      showToast('已儲存「' + deckName + '」的牌組選項');
      updateTimerVisibility();
    };
  }

  // =========================================================================
  // 2. 自訂學習 (Official Custom Study 6-Mode Dialog)
  // =========================================================================
  function openCustomStudyDialog(deck) {
    var deckName = deck && deck.name ? deck.name : '';
    var m = makeModal('anki-custom-study-dlg', '自訂學習 — ' + (deckName || '全部牌組'), 540);
    var c = m.c;
    var numStyle = 'width:70px;padding:3px 6px;font-size:13px;border-radius:4px;border:1px solid ' + c.border + ';background:' + c.bgInput + ';color:' + c.text + ';margin:0 4px;';

    m.body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="radio" name="cs-mode" value="forgotten" checked style="accent-color:' + c.accent + ';" /><span>複習最近遺忘的卡片（過去 <input type="number" id="cs-forgot-days" value="1" min="1" max="30" style="' + numStyle + '" /> 天內按過「重來」）</span></label>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="radio" name="cs-mode" value="ahead" style="accent-color:' + c.accent + ';" /><span>提前複習（將未來 <input type="number" id="cs-ahead-days" value="2" min="1" max="30" style="' + numStyle + '" /> 天內到期卡片提前加入）</span></label>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="radio" name="cs-mode" value="preview_new" style="accent-color:' + c.accent + ';" /><span>預覽新卡片（取此牌組最多 <input type="number" id="cs-new-cnt" value="20" min="1" max="500" style="' + numStyle + '" /> 張新卡）</span></label>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="radio" name="cs-mode" value="cram_all" style="accent-color:' + c.accent + ';" /><span>考前衝刺（納入此牌組所有卡片，上限 <input type="number" id="cs-cram-cnt" value="100" min="1" max="2000" style="' + numStyle + '" /> 張）</span></label>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="radio" name="cs-mode" value="by_tag" style="accent-color:' + c.accent + ';" /><span>依標籤集中學習：<input type="text" id="cs-tag" placeholder="輸入標籤關鍵字" style="width:160px;padding:4px 8px;font-size:13px;border-radius:4px;border:1px solid ' + c.border + ';background:' + c.bgInput + ';color:' + c.text + ';" /></span></label>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="radio" name="cs-mode" value="flagged" style="accent-color:' + c.accent + ';" /><span>複習已加旗標或標示 (marked) 的重點卡片</span></label>' +
      '</div>';

    m.foot.innerHTML =
      '<button type="button" id="cs-cancel" style="padding:6px 16px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">取消</button>' +
      '<button type="button" id="cs-ok" style="padding:6px 18px;font-size:13px;font-weight:600;border-radius:5px;border:none;background:' + c.accent + ';color:#fff;cursor:pointer;">建立自訂學習階段</button>';

    m.foot.querySelector('#cs-cancel').onclick = function () { m.overlay.remove(); };
    m.foot.querySelector('#cs-ok').onclick = async function () {
      var db = window.__ANKI_DB__;
      if (!db) return;
      var mode = (m.body.querySelector('input[name="cs-mode"]:checked') || {}).value || 'cram_all';
      var allDecks = await db.decks.toArray();
      var targetIds = null;
      if (deck && deck.name) {
        var pref = deck.name + '::';
        targetIds = new Set(allDecks.filter(function (d) { return d.id === deck.id || String(d.name || '').startsWith(pref); }).map(function (d) { return d.id; }));
      }
      var cards = (await db.cards.toArray()).filter(function (cd) { return !targetIds || targetIds.has(cd.did); });
      var notes = await db.notes.toArray();
      var noteMap = new Map(notes.map(function (n) { return [n.id, n]; }));
      var picked = [];

      if (mode === 'forgotten') {
        var days = Math.max(1, Number(m.body.querySelector('#cs-forgot-days').value) || 1);
        var since = Date.now() - days * 86400 * 1000;
        var logs = await db.reviewLogs.toArray();
        var lapsedIds = new Set(logs.filter(function (l) { return l.rating === 1 && l.reviewedAt >= since; }).map(function (l) { return l.cardId; }));
        picked = cards.filter(function (cd) { return lapsedIds.has(cd.id) || (cd.lapses || 0) > 0; });
      } else if (mode === 'ahead') {
        picked = cards.filter(function (cd) { return cd.queue >= 0; });
      } else if (mode === 'preview_new') {
        var limN = Math.max(1, Number(m.body.querySelector('#cs-new-cnt').value) || 20);
        picked = cards.filter(function (cd) { return cd.queue === 0; }).slice(0, limN);
      } else if (mode === 'cram_all') {
        var limC = Math.max(1, Number(m.body.querySelector('#cs-cram-cnt').value) || 100);
        picked = cards.filter(function (cd) { return cd.queue !== -1; }).slice(0, limC);
      } else if (mode === 'by_tag') {
        var tv = (m.body.querySelector('#cs-tag').value || '').trim().toLowerCase();
        picked = cards.filter(function (cd) {
          var nt = noteMap.get(cd.nid);
          return nt && Array.isArray(nt.tags) && nt.tags.some(function (t) { return t.toLowerCase().includes(tv); });
        });
      } else if (mode === 'flagged') {
        picked = cards.filter(function (cd) {
          var nt = noteMap.get(cd.nid);
          var hasMark = nt && Array.isArray(nt.tags) && nt.tags.includes('marked');
          return (cd.flags && cd.flags > 0) || hasMark;
        });
      }

      if (picked.length === 0) {
        showToast('找不到符合此自訂學習條件的卡片');
        return;
      }

      var newId = Date.now();
      var title = '自訂學習階段 (' + (deckName ? deckName.split('::').pop() : '全部') + ')';
      var nowSec = Math.floor(Date.now() / 1000);
      var newDeck = { id: newId, name: title, description: 'Custom Study: ' + mode, createdAt: nowSec };
      var clones = picked.map(function (cd, i) { return Object.assign({}, cd, { id: newId + i + 1, did: newId, queue: 0, mod: nowSec }); });

      await db.transaction('rw', [db.decks, db.cards], async function () {
        await db.decks.put(newDeck);
        await db.cards.bulkPut(clones);
      });
      m.overlay.remove();
      showToast('已建立自訂學習階段（共 ' + clones.length + ' 張卡片）');
      setTimeout(function () { window.location.reload(); }, 400);
    };
  }

  // =========================================================================
  // 3. 卡片資訊 (Official Card Info Modal, shortcut: I)
  // =========================================================================
  async function openCardInfoDialog(card) {
    var db = window.__ANKI_DB__;
    if (!db || !card) { showToast('目前沒有正在複習的卡片'); return; }
    var freshCard = (await db.cards.get(card.id)) || card;
    var note = await db.notes.get(freshCard.nid);
    var deck = await db.decks.get(freshCard.did);
    var logs = (await db.reviewLogs.where('cardId').equals(freshCard.id).toArray()).sort(function (a, b) { return b.reviewedAt - a.reviewedAt; });

    var m = makeModal('anki-card-info-dlg', '卡片資訊 (Card Info)', 560);
    var c = m.c;
    var qLabel = { '-2': '已擱置 (Buried)', '-1': '已暫停 (Suspended)', '0': '新卡片 (New)', '1': '學習中 (Learning)', '2': '複習中 (Review)', '3': '跨日學習' }[String(freshCard.queue)] || String(freshCard.queue);
    var flagObj = FLAGS[freshCard.flags || 0] || FLAGS[0];
    var totalSec = Math.round(logs.reduce(function (s, l) { return s + (l.timeSpentMs || 0); }, 0) / 1000);
    var addedStr = new Date(freshCard.nid > 1e12 ? freshCard.nid : freshCard.id).toLocaleString('zh-TW');

    var logsHtml = logs.length === 0
      ? '<div style="padding:10px;color:' + c.muted + ';font-size:12px;">尚無複習紀錄</div>'
      : '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="border-bottom:1px solid ' + c.border + ';color:' + c.muted + ';"><th style="text-align:left;padding:4px 6px;">日期</th><th>評分</th><th>間隔</th><th>容易度</th><th>耗時</th></tr></thead><tbody>' +
        logs.slice(0, 20).map(function (l) {
          var rTxt = ['', '重來', '困難', '良好', '簡單'][l.rating] || l.rating;
          return '<tr style="border-bottom:1px solid ' + c.border + ';"><td style="padding:4px 6px;">' + new Date(l.reviewedAt).toLocaleString('zh-TW') + '</td><td style="text-align:center;">' + rTxt + '</td><td style="text-align:center;">' + (l.newIvl || 0) + ' 天</td><td style="text-align:center;">' + Math.round((l.newFactor || 2500) / 10) + '%</td><td style="text-align:center;">' + ((l.timeSpentMs || 0) / 1000).toFixed(1) + 's</td></tr>';
        }).join('') + '</tbody></table>';

    m.body.innerHTML =
      '<div style="display:grid;grid-template-columns:120px 1fr;row-gap:6px;column-gap:10px;font-size:13px;margin-bottom:14px;background:' + c.bgPanel + ';border:1px solid ' + c.border + ';border-radius:6px;padding:12px;">' +
        '<span style="color:' + c.muted + ';">牌組</span><span>' + esc(deck ? deck.name : freshCard.did) + '</span>' +
        '<span style="color:' + c.muted + ';">狀態</span><span>' + esc(qLabel) + '</span>' +
        '<span style="color:' + c.muted + ';">旗標</span><span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + flagObj.color + ';border:1px solid ' + c.border + ';margin-right:6px;"></span>' + esc(flagObj.name) + '</span>' +
        '<span style="color:' + c.muted + ';">間隔 / 容易度</span><span>' + (freshCard.ivl || 0) + ' 天 / ' + Math.round((freshCard.factor || 2500) / 10) + '%</span>' +
        '<span style="color:' + c.muted + ';">複習 / 遺忘次數</span><span>' + (freshCard.reps || 0) + ' 次 / ' + (freshCard.lapses || 0) + ' 次</span>' +
        '<span style="color:' + c.muted + ';">總花費時間</span><span>' + totalSec + ' 秒</span>' +
        '<span style="color:' + c.muted + ';">標籤</span><span>' + esc(note && note.tags ? note.tags.join(', ') || '（無）' : '（無）') + '</span>' +
        '<span style="color:' + c.muted + ';">建立時間</span><span>' + esc(addedStr) + '</span>' +
        '<span style="color:' + c.muted + ';">Card / Note ID</span><span style="font-family:monospace;font-size:12px;">' + freshCard.id + ' / ' + freshCard.nid + '</span>' +
      '</div>' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">最近複習紀錄</div>' +
      '<div style="background:' + c.bgPanel + ';border:1px solid ' + c.border + ';border-radius:6px;overflow:hidden;">' + logsHtml + '</div>';

    m.foot.innerHTML = '<button type="button" id="ci-ok" style="padding:6px 18px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">關閉</button>';
    m.foot.querySelector('#ci-ok').onclick = function () { m.overlay.remove(); };
  }

  // =========================================================================
  // 4. CARD ACTIONS: Flag (Ctrl+1..7), Mark (*), Bury (-/=), Suspend (@/!), Set Due Date (Ctrl+Shift+D), Forget (Ctrl+Alt+N)
  // =========================================================================
  async function setCardFlag(card, flagNum) {
    var db = window.__ANKI_DB__;
    if (!db || !card) return;
    var next = (card.flags === flagNum) ? 0 : flagNum;
    card.flags = next;
    await db.cards.update(card.id, { flags: next });
    renderFlagBadge(next);
    showToast(next === 0 ? '已清除卡片旗標' : '已標記為「' + FLAGS[next].name + '」');
  }

  async function toggleMarkNote(card) {
    var db = window.__ANKI_DB__;
    if (!db || !card) return;
    var note = await db.notes.get(card.nid);
    if (!note) return;
    var tags = Array.isArray(note.tags) ? note.tags.slice() : [];
    var idx = tags.indexOf('marked');
    if (idx >= 0) { tags.splice(idx, 1); showToast('已取消標示筆記'); }
    else { tags.push('marked'); showToast('已標示筆記（加入 marked 標籤）'); }
    await db.notes.update(note.id, { tags: tags });
  }

  async function buryCardOrNote(card, wholeNote, skipCb) {
    var db = window.__ANKI_DB__;
    if (!db || !card) return;
    if (wholeNote) {
      var siblings = await db.cards.where('nid').equals(card.nid).toArray();
      await Promise.all(siblings.map(function (c) { return db.cards.update(c.id, { queue: -2 }); }));
      showToast('已擱置此筆記的所有卡片（共 ' + siblings.length + ' 張）');
    } else {
      await db.cards.update(card.id, { queue: -2 });
      showToast('已擱置此卡片（今日不再出現）');
    }
    if (typeof skipCb === 'function') skipCb();
  }

  async function suspendCardOrNote(card, wholeNote, skipCb) {
    var db = window.__ANKI_DB__;
    if (!db || !card) return;
    if (wholeNote) {
      var siblings = await db.cards.where('nid').equals(card.nid).toArray();
      await Promise.all(siblings.map(function (c) { return db.cards.update(c.id, { queue: -1 }); }));
      showToast('已暫停此筆記的所有卡片（共 ' + siblings.length + ' 張）');
    } else {
      await db.cards.update(card.id, { queue: -1 });
      showToast('已暫停此卡片（可於工具選單或瀏覽器解除）');
    }
    if (typeof skipCb === 'function') skipCb();
  }

  async function setDueDatePrompt(card) {
    var db = window.__ANKI_DB__;
    if (!db || !card) return;
    var input = window.prompt('設定到期日（例如：0 = 今天、3 = 3天後、1-7 = 隨機1至7天後）：', '0');
    if (input == null) return;
    var days = 0;
    var range = input.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      var lo = Number(range[1]), hi = Number(range[2]);
      days = lo + Math.floor(Math.random() * (Math.max(lo, hi) - lo + 1));
    } else {
      days = Math.max(0, Number(input.trim()) || 0);
    }
    var dueTs = Math.floor(Date.now() / 1000) + days * 86400;
    await db.cards.update(card.id, { queue: 2, type: 2, ivl: Math.max(1, days), due: dueTs });
    showToast('已將到期日設為 ' + (days === 0 ? '今天' : days + ' 天後'));
  }

  async function forgetCard(card, reloadCb) {
    var db = window.__ANKI_DB__;
    if (!db || !card) return;
    if (!window.confirm('確定要將此卡片重設為「新卡片」（遺忘學習進度）嗎？')) return;
    await db.cards.update(card.id, { type: 0, queue: 0, ivl: 0, reps: 0, lapses: 0, factor: 2500, left: 0 });
    showToast('已將卡片重設為新卡片');
    if (typeof reloadCb === 'function') reloadCb();
  }

  // =========================================================================
  // 5. REVIEWER "更多 (More)" POPOVER MENU
  // =========================================================================
  function openMoreMenu(card, deck, skipCb, reloadCb, anchorEl) {
    var old = document.getElementById('anki-more-popover');
    if (old) { old.remove(); return; }
    var c = theme();
    var pop = document.createElement('div');
    pop.id = 'anki-more-popover';
    var rect = anchorEl ? anchorEl.getBoundingClientRect() : { right: window.innerWidth - 16, bottom: 56 };
    pop.style.cssText =
      'position:fixed;top:' + Math.min(window.innerHeight - 360, rect.bottom + 6) + 'px;right:' + Math.max(12, window.innerWidth - rect.right) + 'px;' +
      'z-index:9995;width:240px;background:' + c.bgPanel + ';color:' + c.text + ';border:1px solid ' + c.border + ';border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,0.35);padding:5px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC",sans-serif;';

    var flagDots = FLAGS.slice(1).map(function (f) {
      return '<button type="button" data-m-flag="' + f.id + '" title="' + f.name + ' (Ctrl+' + f.id + ')" style="width:20px;height:20px;border-radius:50%;background:' + f.color + ';border:' + (card && card.flags === f.id ? '2px solid #fff' : '1px solid rgba(0,0,0,0.2)') + ';cursor:pointer;"></button>';
    }).join('');

    function item(act, label, kbd) {
      return '<button type="button" data-m-act="' + act + '" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:6px 9px;border:none;background:transparent;color:' + c.text + ';border-radius:4px;cursor:pointer;text-align:left;"><span>' + label + '</span><span style="color:' + c.muted + ';font-size:11px;font-family:monospace;">' + kbd + '</span></button>';
    }

    pop.innerHTML =
      '<div style="padding:4px 8px 6px;border-bottom:1px solid ' + c.border + ';margin-bottom:4px;">' +
        '<div style="font-size:11px;color:' + c.muted + ';margin-bottom:5px;">旗標卡片 (Ctrl+1~7)</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' + flagDots +
          '<button type="button" data-m-flag="0" title="清除旗標" style="font-size:11px;border:1px solid ' + c.border + ';background:transparent;color:' + c.muted + ';border-radius:4px;padding:1px 5px;cursor:pointer;">無</button>' +
        '</div>' +
      '</div>' +
      item('mark', '標示筆記 (Mark)', '*') +
      item('bury-card', '擱置卡片 (Bury)', '-') +
      item('bury-note', '擱置筆記', '=') +
      item('suspend-card', '暫停卡片 (Suspend)', '@') +
      item('suspend-note', '暫停筆記', '!') +
      '<div style="height:1px;background:' + c.border + ';margin:4px 2px;"></div>' +
      item('info', '卡片資訊 (Card Info)', 'I') +
      item('due', '設定到期日...', 'Ctrl+Shift+D') +
      item('forget', '遺忘 / 重設卡片', 'Ctrl+Alt+N') +
      '<div style="height:1px;background:' + c.border + ';margin:4px 2px;"></div>' +
      item('opts', '牌組選項 (FSRS / 計時器)', 'O') +
      item('shortcuts', '快捷鍵總覽', '?');

    pop.querySelectorAll('[data-m-flag]').forEach(function (b) {
      b.onclick = function () { pop.remove(); setCardFlag(card, Number(b.getAttribute('data-m-flag'))); };
    });
    pop.querySelectorAll('[data-m-act]').forEach(function (b) {
      b.onmouseenter = function () { b.style.background = c.accent; b.style.color = '#fff'; };
      b.onmouseleave = function () { b.style.background = 'transparent'; b.style.color = c.text; };
      b.onclick = function () {
        var a = b.getAttribute('data-m-act');
        pop.remove();
        if (a === 'mark') toggleMarkNote(card);
        else if (a === 'bury-card') buryCardOrNote(card, false, skipCb);
        else if (a === 'bury-note') buryCardOrNote(card, true, skipCb);
        else if (a === 'suspend-card') suspendCardOrNote(card, false, skipCb);
        else if (a === 'suspend-note') suspendCardOrNote(card, true, skipCb);
        else if (a === 'info') openCardInfoDialog(card);
        else if (a === 'due') setDueDatePrompt(card);
        else if (a === 'forget') forgetCard(card, reloadCb);
        else if (a === 'opts') openDeckOptionsDialog(deck);
        else if (a === 'shortcuts') openShortcutsDialog();
      };
    });

    document.body.appendChild(pop);
    setTimeout(function () {
      function dismiss(ev) {
        if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', dismiss); }
      }
      document.addEventListener('mousedown', dismiss);
    }, 10);
  }

  // =========================================================================
  // 6. UNBURY ALL / SUSPENDED & FLAGGED MANAGER / SHORTCUTS CHEAT SHEET
  // =========================================================================
  async function unburyAllCards() {
    var db = window.__ANKI_DB__;
    if (!db) return;
    var buried = await db.cards.where('queue').equals(-2).toArray();
    if (buried.length === 0) { showToast('目前沒有已擱置的卡片'); return; }
    await Promise.all(buried.map(function (c) { return db.cards.update(c.id, { queue: c.reps > 0 ? 2 : 0 }); }));
    showToast('已解除 ' + buried.length + ' 張擱置卡片');
    setTimeout(function () { window.location.reload(); }, 400);
  }

  async function openSuspendedFlaggedDialog() {
    var db = window.__ANKI_DB__;
    if (!db) return;
    var cards = await db.cards.toArray();
    var notes = await db.notes.toArray();
    var noteMap = new Map(notes.map(function (n) { return [n.id, n]; }));
    var special = cards.filter(function (c) { return c.queue === -1 || c.queue === -2 || (c.flags && c.flags > 0); });

    var m = makeModal('anki-sf-dlg', '已暫停 / 已擱置 / 已旗標卡片 (' + special.length + ')', 640);
    var c = m.c;
    if (special.length === 0) {
      m.body.innerHTML = '<div style="padding:24px;text-align:center;color:' + c.muted + ';font-size:13px;">目前沒有已暫停、已擱置或加上旗標的卡片。</div>';
    } else {
      m.body.innerHTML = special.map(function (cd) {
        var nt = noteMap.get(cd.nid);
        var preview = nt && nt.flds ? String(nt.flds[0] || '').replace(/<[^>]+>/g, '').slice(0, 60) : 'Card #' + cd.id;
        var st = cd.queue === -1 ? '已暫停' : cd.queue === -2 ? '已擱置' : FLAGS[cd.flags || 0].name;
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-bottom:1px solid ' + c.border + ';font-size:13px;">' +
          '<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><strong>[' + esc(st) + ']</strong> ' + esc(preview) + '</div>' +
          '<button type="button" data-restore-cid="' + cd.id + '" style="padding:3px 10px;font-size:12px;border-radius:4px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;flex-shrink:0;">恢復正常</button>' +
        '</div>';
      }).join('');
      m.body.querySelectorAll('[data-restore-cid]').forEach(function (b) {
        b.onclick = async function () {
          var cid = Number(b.getAttribute('data-restore-cid'));
          var target = special.find(function (x) { return x.id === cid; });
          await db.cards.update(cid, { queue: target && target.reps > 0 ? 2 : 0, flags: 0 });
          b.parentElement.remove();
          showToast('已恢復卡片狀態');
        };
      });
    }
    m.foot.innerHTML = '<button type="button" id="sf-close" style="padding:6px 16px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">關閉</button>';
    m.foot.querySelector('#sf-close').onclick = function () { m.overlay.remove(); };
  }

  function openShortcutsDialog() {
    var m = makeModal('anki-shortcuts-dlg', 'Anki 快捷鍵總覽', 520);
    var c = m.c;
    var rows = [
      ['Space / Enter', '顯示答案 / 評分為「良好」'],
      ['1 / 2 / 3 / 4', '重來 / 困難 / 良好 / 簡單'],
      ['Ctrl + 1 ~ 7', '標記紅 / 橘 / 綠 / 藍 / 粉 / 青 / 紫旗標'],
      ['*', '標示 / 取消標示筆記 (marked)'],
      ['- / =', '擱置卡片 / 擱置整則筆記'],
      ['@ / !', '暫停卡片 / 暫停整則筆記'],
      ['I', '檢視卡片資訊 (Card Info)'],
      ['Ctrl + Shift + D', '設定到期日 (Set Due Date)'],
      ['Ctrl + Alt + N', '遺忘並重設為新卡片'],
      ['E / R / Z', '編輯卡片 / 重播語音 / 復原'],
      ['/ / F', '快速切換學習牌組 / 建立篩選牌組'],
      ['Ctrl + P', '開啟偏好設定（7 分頁）'],
      ['Ctrl + Shift + P', '切換 / 新增使用者設定檔'],
      ['Ctrl + Shift + N / A', '筆記類型 / 附加元件']
    ];
    m.body.innerHTML = '<div style="display:grid;grid-template-columns:155px 1fr;row-gap:7px;column-gap:12px;font-size:13px;">' +
      rows.map(function (r) {
        return '<code style="background:' + c.bgInput + ';border:1px solid ' + c.border + ';padding:2px 6px;border-radius:4px;font-size:12px;text-align:center;">' + esc(r[0]) + '</code><span>' + esc(r[1]) + '</span>';
      }).join('') + '</div>';
    m.foot.innerHTML = '<button type="button" id="sc-close" style="padding:6px 16px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">關閉</button>';
    m.foot.querySelector('#sc-close').onclick = function () { m.overlay.remove(); };
  }

  // =========================================================================
  // 7. LIVE FLAG BADGE & ON-SCREEN STOPWATCH TIMER
  // =========================================================================
  function renderFlagBadge(flagNum) {
    var el = document.getElementById('anki-live-flag-badge');
    if (!flagNum || flagNum <= 0) {
      if (el) el.remove();
      return;
    }
    var f = FLAGS[flagNum];
    if (!f) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'anki-live-flag-badge';
      el.style.cssText = 'position:fixed;top:58px;right:18px;z-index:45;display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.22);pointer-events:none;';
      document.body.appendChild(el);
    }
    el.style.background = f.color;
    el.textContent = '⚑ ' + f.name;
  }

  var timerSec = 0;
  var lastCardId = null;
  function updateTimerVisibility() {
    var ctx = window.__ANKI_REVIEW_CTX__;
    var el = document.getElementById('anki-live-timer');
    if (!ctx || !ctx.card) {
      if (el) el.remove();
      renderFlagBadge(0);
      lastCardId = null;
      return;
    }
    renderFlagBadge(ctx.card.flags || 0);
    var opts = getDeckOpts(ctx.deck && ctx.deck.id);
    if (!opts.showOnScreenTimer) {
      if (el) el.remove();
      return;
    }
    if (lastCardId !== ctx.card.id) {
      lastCardId = ctx.card.id;
      timerSec = 0;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'anki-live-timer';
      el.style.cssText = 'position:fixed;top:58px;left:18px;z-index:45;padding:3px 9px;border-radius:5px;font-size:12px;font-family:ui-monospace,Menlo,monospace;background:rgba(30,30,34,0.75);color:#e5e7eb;border:1px solid rgba(255,255,255,0.12);pointer-events:none;';
      document.body.appendChild(el);
    }
    var mm = String(Math.floor(timerSec / 60)).padStart(2, '0');
    var ss = String(timerSec % 60).padStart(2, '0');
    el.textContent = '⏱ ' + mm + ':' + ss;
  }

  setInterval(function () {
    var ctx = window.__ANKI_REVIEW_CTX__;
    if (!ctx || !ctx.card) { updateTimerVisibility(); return; }
    var opts = getDeckOpts(ctx.deck && ctx.deck.id);
    if (!opts.showOnScreenTimer) { updateTimerVisibility(); return; }
    if (!(opts.stopTimerOnAnswer && ctx.isAnswer)) {
      if (timerSec < (opts.maxAnswerSeconds || 60)) timerSec++;
    }
    updateTimerVisibility();
  }, 1000);

  // Global Reviewer & Power Shortcuts
  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;

    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      openShortcutsDialog();
      return;
    }

    var ctx = window.__ANKI_REVIEW_CTX__;
    if (!ctx || !ctx.card) return;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key >= '0' && e.key <= '7') {
      e.preventDefault();
      setCardFlag(ctx.card, Number(e.key));
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      setDueDatePrompt(ctx.card);
    } else if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'N' || e.key === 'n')) {
      e.preventDefault();
      forgetCard(ctx.card, ctx.reloadCard);
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === '*') { e.preventDefault(); toggleMarkNote(ctx.card); }
      else if (e.key === '-') { e.preventDefault(); buryCardOrNote(ctx.card, false, ctx.skipCard); }
      else if (e.key === '=') { e.preventDefault(); buryCardOrNote(ctx.card, true, ctx.skipCard); }
      else if (e.key === '@') { e.preventDefault(); suspendCardOrNote(ctx.card, false, ctx.skipCard); }
      else if (e.key === '!') { e.preventDefault(); suspendCardOrNote(ctx.card, true, ctx.skipCard); }
      else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); openCardInfoDialog(ctx.card); }
      else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); openDeckOptionsDialog(ctx.deck); }
    }
  });

  window.__ANKI_OPEN_DECK_OPTIONS__ = openDeckOptionsDialog;
  window.__ANKI_OPEN_CUSTOM_STUDY__ = openCustomStudyDialog;
  window.__ANKI_OPEN_MORE_MENU__ = openMoreMenu;
  window.__ANKI_OPEN_CARD_INFO__ = openCardInfoDialog;
  window.__ANKI_UNBURY_ALL__ = unburyAllCards;
  window.__ANKI_OPEN_SUSPENDED_FLAGGED__ = openSuspendedFlaggedDialog;
  window.__ANKI_OPEN_SHORTCUTS__ = openShortcutsDialog;
  window.__ANKI_SYNC_REVIEW_CTX__ = function (ctx) {
    window.__ANKI_REVIEW_CTX__ = ctx;
    updateTimerVisibility();
  };
})();
