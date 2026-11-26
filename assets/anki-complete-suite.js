(function () {
  'use strict';

  // =========================================================================
  // 1. REAL FSRS-5 SCHEDULER (Free Spaced Repetition Scheduler)
  // =========================================================================
  var FSRS_STATE_KEY = 'anki_ipad_fsrs_state_v1';
  var DECK_OPTS_KEY = 'anki_ipad_deck_options_v1';
  var W = [
    0.40255, 1.18385, 3.173, 15.69105,
    7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395,
    0.11, 0.29605, 2.2698, 0.2315,
    2.9898, 0.51655, 0.6621
  ];
  var FACTOR = 19 / 81;
  var DECAY = -0.5;

  function loadFsrsMap() {
    try { return JSON.parse(localStorage.getItem(FSRS_STATE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveFsrsMap(map) {
    try { localStorage.setItem(FSRS_STATE_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function getDeckOptions(did) {
    try {
      var all = JSON.parse(localStorage.getItem(DECK_OPTS_KEY) || '{}') || {};
      var o = all[String(did)] || all['default'] || {};
      return {
        fsrsEnabled: o.fsrsEnabled !== false,
        fsrsRetention: Math.max(70, Math.min(97, Number(o.fsrsRetention) || 90)) / 100,
        maxInterval: Math.max(1, Number(o.maxInterval) || 36500)
      };
    } catch (e) {
      return { fsrsEnabled: true, fsrsRetention: 0.9, maxInterval: 36500 };
    }
  }

  function clampD(d) { return Math.max(1, Math.min(10, d)); }
  function initD(g) { return clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1); }
  function initS(g) { return Math.max(0.1, W[g - 1]); }
  function retrievability(elapsedDays, s) {
    if (s <= 0) return 0;
    return Math.pow(1 + FACTOR * (elapsedDays / s), DECAY);
  }
  function nextIntervalDays(s, retention, maxIvl) {
    var ivl = (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
    return Math.min(maxIvl, Math.max(1, Math.round(ivl)));
  }
  function nextD(d, g) {
    var d0 = initD(4);
    var delta = -W[6] * (g - 3);
    var next = d + delta * ((10 - d) / 9);
    return clampD(W[7] * d0 + (1 - W[7]) * next);
  }
  function nextRecallS(d, s, r, g) {
    var hardPenalty = g === 2 ? W[15] : 1;
    var easyBonus = g === 4 ? W[16] : 1;
    var mult = Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus;
    return Math.max(0.1, s * (1 + mult));
  }
  function nextForgetS(d, s, r) {
    return Math.max(0.1, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]));
  }

  function fsrsScheduleCard(card, formatDurFn) {
    var opts = getDeckOptions(card.did);
    if (!opts.fsrsEnabled) return null; // Fall back to SM-2

    var nowSec = Math.floor(Date.now() / 1000);
    var map = loadFsrsMap();
    var st = map[String(card.id)];
    var isNew = card.queue === 0 || card.reps === 0;
    var isLearn = card.queue === 1 || card.queue === 3;
    var fmt = typeof formatDurFn === 'function' ? formatDurFn : function (sec) {
      if (sec < 60) return '< 1 分鐘';
      var m = Math.round(sec / 60);
      if (m < 60) return m + ' 分鐘';
      var h = Math.round(m / 60);
      if (h < 24) return h + ' 小時';
      var d = Math.round(h / 24);
      if (d < 30) return d + ' 天';
      var mo = Math.round(d / 30);
      return mo < 12 ? mo + ' 個月' : (d / 365).toFixed(1) + ' 年';
    };

    var out = {};
    for (var g = 1; g <= 4; g++) {
      var newS, newD;
      if (isNew || !st) {
        newS = initS(g);
        newD = initD(g);
      } else {
        var elapsed = Math.max(0, (nowSec - (st.lastReview || nowSec)) / 86400);
        if (elapsed === 0 && card.ivl > 0) elapsed = card.ivl;
        var r = retrievability(elapsed, st.s);
        newD = nextD(st.d, g);
        newS = g === 1 ? nextForgetS(newD, st.s, r) : nextRecallS(newD, st.s, r, g);
      }

      if (g === 1) {
        out[1] = {
          rating: 1, label: isNew ? '< 1 分鐘' : '< 10 分鐘', intervalDays: 0,
          newDue: nowSec + (isNew ? 60 : 600), newQueue: isNew ? 1 : 3, newType: isNew ? 1 : 3,
          newFactor: Math.max(1300, Math.round((11 - newD) * 250)), newLeft: 1001,
          _fsrs: { s: newS, d: newD, lastReview: nowSec }
        };
      } else if ((isNew || isLearn) && g === 2) {
        out[2] = {
          rating: 2, label: '6 分鐘', intervalDays: 0,
          newDue: nowSec + 360, newQueue: 1, newType: 1,
          newFactor: Math.round((11 - newD) * 250), newLeft: 1001,
          _fsrs: { s: newS, d: newD, lastReview: nowSec }
        };
      } else if (isNew && g === 3) {
        out[3] = {
          rating: 3, label: '10 分鐘', intervalDays: 0,
          newDue: nowSec + 600, newQueue: 1, newType: 1,
          newFactor: Math.round((11 - newD) * 250), newLeft: 1001,
          _fsrs: { s: newS, d: newD, lastReview: nowSec }
        };
      } else {
        var ivlDays = nextIntervalDays(newS, opts.fsrsRetention, opts.maxInterval);
        if (g === 3 && out[2] && out[2].intervalDays >= ivlDays) ivlDays = Math.min(opts.maxInterval, out[2].intervalDays + 1);
        if (g === 4 && out[3] && out[3].intervalDays >= ivlDays) ivlDays = Math.min(opts.maxInterval, out[3].intervalDays + 1);
        out[g] = {
          rating: g, label: fmt(ivlDays * 86400), intervalDays: ivlDays,
          newDue: nowSec + ivlDays * 86400, newQueue: 2, newType: 2,
          newFactor: Math.max(1300, Math.round((11 - newD) * 250)), newLeft: 0,
          _fsrs: { s: newS, d: newD, lastReview: nowSec }
        };
      }
    }
    return out;
  }

  function fsrsCommitState(cardId, scheduleItem) {
    if (!scheduleItem || !scheduleItem._fsrs) return;
    var map = loadFsrsMap();
    map[String(cardId)] = scheduleItem._fsrs;
    saveFsrsMap(map);
  }

  // =========================================================================
  // 2. FULL OFFICIAL ANKI SEARCH SYNTAX ENGINE
  // =========================================================================
  function tokenizeSearch(query) {
    var tokens = [];
    var re = /(-?)"([^"]*)"|(\S+)/g;
    var m;
    while ((m = re.exec(query || '')) !== null) {
      if (m[2] !== undefined) tokens.push((m[1] || '') + m[2]);
      else tokens.push(m[3]);
    }
    return tokens;
  }

  function evalSingleToken(tok, item, nowMs) {
    var neg = false;
    if (tok.startsWith('-') && tok.length > 1) {
      neg = true;
      tok = tok.slice(1);
    }
    var low = tok.toLowerCase();
    var cd = item.card;
    var nt = item.note;
    var dName = String((item.deck && item.deck.name) || item.deckName || '').toLowerCase();
    var tags = (nt && Array.isArray(nt.tags) ? nt.tags : []).map(function (t) { return t.toLowerCase(); });
    var rawText = nt && Array.isArray(nt.flds) ? nt.flds.join(' ') : '';
    var plainText = rawText.replace(/<[^>]+>/g, ' ').toLowerCase();
    var matched = false;

    if (low.startsWith('deck:')) {
      var dv = low.slice(5).replace(/^"|"$/g, '').trim();
      matched = dv === '*' || dName === dv || dName.startsWith(dv + '::') || dName.includes(dv);
    } else if (low.startsWith('tag:')) {
      var tv = low.slice(4).trim();
      matched = tv === 'none' ? tags.length === 0 : tags.some(function (t) { return t === tv || t.startsWith(tv + '::') || t.includes(tv); });
    } else if (low === 'is:new') {
      matched = cd.queue === 0;
    } else if (low === 'is:learn') {
      matched = cd.queue === 1 || cd.queue === 3;
    } else if (low === 'is:review') {
      matched = cd.queue === 2;
    } else if (low === 'is:due') {
      matched = cd.queue === 1 || cd.queue === 2 || cd.queue === 3;
    } else if (low === 'is:suspended') {
      matched = cd.queue === -1;
    } else if (low === 'is:buried') {
      matched = cd.queue === -2;
    } else if (low === 'is:marked') {
      matched = tags.includes('marked');
    } else if (low.startsWith('flag:')) {
      matched = (cd.flags || 0) === Number(low.slice(5));
    } else if (low.startsWith('prop:')) {
      var pm = low.slice(5).match(/^(ivl|reps|lapses|ease)(>=|<=|>|<|=)([0-9.]+)$/);
      if (pm) {
        var prop = pm[1], op = pm[2], num = Number(pm[3]);
        var val = prop === 'ivl' ? (cd.ivl || 0)
          : prop === 'reps' ? (cd.reps || 0)
          : prop === 'lapses' ? (cd.lapses || 0)
          : ((cd.factor || 2500) / 1000);
        if (op === '>') matched = val > num;
        else if (op === '>=') matched = val >= num;
        else if (op === '<') matched = val < num;
        else if (op === '<=') matched = val <= num;
        else matched = Math.abs(val - num) < 0.001;
      }
    } else if (low.startsWith('added:')) {
      var daysA = Math.max(0, Number(low.slice(6)) || 1);
      var createdMs = cd.nid > 1e12 ? cd.nid : (cd.id > 1e12 ? cd.id : (cd.mod || 0) * 1000);
      matched = (nowMs - createdMs) <= daysA * 86400 * 1000;
    } else if (low.startsWith('rated:')) {
      var daysR = Math.max(0, Number(low.slice(6)) || 1);
      var lastRev = item.lastReviewedAt || ((cd.mod || 0) * 1000);
      matched = (cd.reps || 0) > 0 && (nowMs - lastRev) <= daysR * 86400 * 1000;
    } else if (low.startsWith('re:')) {
      try { matched = new RegExp(tok.slice(3), 'i').test(rawText); } catch (e) { matched = false; }
    } else {
      matched = plainText.includes(low) || dName.includes(low) || tags.some(function (t) { return t.includes(low); });
    }

    return neg ? !matched : matched;
  }

  function evalAnkiSearch(query, item, nowMs) {
    var tokens = tokenizeSearch(query);
    if (tokens.length === 0) return true;
    var ts = nowMs || Date.now();
    // Split by uppercase OR groups
    var groups = [[]];
    tokens.forEach(function (t) {
      if (t === 'OR') groups.push([]);
      else groups[groups.length - 1].push(t);
    });
    return groups.some(function (grp) {
      if (grp.length === 0) return false;
      return grp.every(function (t) { return evalSingleToken(t, item, ts); });
    });
  }

  // =========================================================================
  // 3. CSV / TSV PLAIN-TEXT IMPORTER (With Official #headers & RFC-4180 Parsing)
  // =========================================================================
  function parseDelimitedText(rawText, forcedSep) {
    var lines = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var headers = {};
    var bodyLines = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (bodyLines.length === 0 && ln.startsWith('#')) {
        var hm = ln.match(/^#([^:]+):(.*)$/);
        if (hm) headers[hm[1].trim().toLowerCase()] = hm[2].trim();
        continue;
      }
      if (ln.trim() === '' && bodyLines.length === 0) continue;
      bodyLines.push(ln);
    }

    var sep = forcedSep;
    if (!sep || sep === 'auto') {
      var hSep = (headers.separator || '').toLowerCase();
      if (hSep === 'tab' || hSep === '\\t') sep = '\t';
      else if (hSep === 'comma' || hSep === ',') sep = ',';
      else if (hSep === 'semicolon' || hSep === ';') sep = ';';
      else if (hSep === 'pipe' || hSep === '|') sep = '|';
      else {
        var sample = bodyLines[0] || '';
        if (sample.includes('\t')) sep = '\t';
        else if (sample.includes(';')) sep = ';';
        else sep = ',';
      }
    }

    // RFC-4180 state machine parser
    var text = bodyLines.join('\n');
    var rows = [];
    var row = [];
    var cell = '';
    var inQuote = false;
    for (var c = 0; c < text.length; c++) {
      var ch = text[c];
      if (inQuote) {
        if (ch === '"') {
          if (text[c + 1] === '"') { cell += '"'; c++; }
          else inQuote = false;
        } else {
          cell += ch;
        }
      } else {
        if (ch === '"' && cell === '') {
          inQuote = true;
        } else if (ch === sep) {
          row.push(cell);
          cell = '';
        } else if (ch === '\n') {
          row.push(cell);
          if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row);
          row = [];
          cell = '';
        } else {
          cell += ch;
        }
      }
    }
    if (cell !== '' || row.length > 0) {
      row.push(cell);
      if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row);
    }

    return { headers: headers, separator: sep, rows: rows };
  }

  // =========================================================================
  // 4. ADVANCED STATS ENGINE (True Retention, 26-Week Heatmap, Interval Dist, Hourly)
  // =========================================================================
  function computeAdvancedStats(cards, reviewLogs, nowMs) {
    var now = nowMs || Date.now();
    var dayMs = 86400 * 1000;
    var dayKey = function (ms) {
      var d = new Date(ms);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };

    var periods = [
      { label: '今天', since: now - dayMs },
      { label: '過去 7 天', since: now - 7 * dayMs },
      { label: '過去 30 天', since: now - 30 * dayMs },
      { label: '全部紀錄', since: 0 }
    ];

    var retention = periods.map(function (p) {
      var sub = reviewLogs.filter(function (l) { return l.reviewedAt >= p.since; });
      var yPass = 0, yFail = 0, mPass = 0, mFail = 0;
      sub.forEach(function (l) {
        var isMature = (l.lastIvl || 0) >= 21;
        var passed = l.rating >= 2;
        if (isMature) { if (passed) mPass++; else mFail++; }
        else { if (passed) yPass++; else yFail++; }
      });
      var pct = function (a, b) { return (a + b) === 0 ? '—' : Math.round((a / (a + b)) * 1000) / 10 + '%'; };
      return {
        label: p.label,
        youngPct: pct(yPass, yFail),
        maturePct: pct(mPass, mFail),
        totalPct: pct(yPass + mPass, yFail + mFail),
        total: sub.length
      };
    });

    // Daily heatmap map & streak
    var dailyCounts = {};
    var hourlyCounts = new Array(24).fill(0);
    var hourlyPass = new Array(24).fill(0);
    var buttonCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };

    reviewLogs.forEach(function (l) {
      var dk = dayKey(l.reviewedAt);
      dailyCounts[dk] = (dailyCounts[dk] || 0) + 1;
      var hr = new Date(l.reviewedAt).getHours();
      hourlyCounts[hr]++;
      if (l.rating >= 2) hourlyPass[hr]++;
      if (buttonCounts[l.rating] !== undefined) buttonCounts[l.rating]++;
    });

    var streak = 0;
    for (var d = 0; d < 365; d++) {
      var k = dayKey(now - d * dayMs);
      if (dailyCounts[k] > 0) streak++;
      else if (d > 0) break;
    }

    var ivlBuckets = [
      { label: '新卡', count: 0 },
      { label: '1 天', count: 0 },
      { label: '2–7 天', count: 0 },
      { label: '8–30 天', count: 0 },
      { label: '1–3 月', count: 0 },
      { label: '3–12 月', count: 0 },
      { label: '1 年+', count: 0 }
    ];
    cards.forEach(function (c) {
      var ivl = c.ivl || 0;
      if (c.queue === 0 || ivl <= 0) ivlBuckets[0].count++;
      else if (ivl === 1) ivlBuckets[1].count++;
      else if (ivl <= 7) ivlBuckets[2].count++;
      else if (ivl <= 30) ivlBuckets[3].count++;
      else if (ivl <= 90) ivlBuckets[4].count++;
      else if (ivl <= 365) ivlBuckets[5].count++;
      else ivlBuckets[6].count++;
    });

    return {
      retention: retention,
      dailyCounts: dailyCounts,
      streak: streak,
      hourlyCounts: hourlyCounts,
      hourlyPass: hourlyPass,
      buttonCounts: buttonCounts,
      ivlBuckets: ivlBuckets
    };
  }

  // Expose pure engines for automated Node testing & UI consumers
  var API = {
    fsrsScheduleCard: fsrsScheduleCard,
    fsrsCommitState: fsrsCommitState,
    evalAnkiSearch: evalAnkiSearch,
    parseDelimitedText: parseDelimitedText,
    computeAdvancedStats: computeAdvancedStats
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
    return;
  }

  window.__ANKI_FSRS_SCHEDULE__ = fsrsScheduleCard;
  window.__ANKI_FSRS_COMMIT__ = fsrsCommitState;
  window.__ANKI_EVAL_SEARCH__ = evalAnkiSearch;
  window.__ANKI_PARSE_CSV__ = parseDelimitedText;
  window.__ANKI_COMPUTE_STATS__ = computeAdvancedStats;

  // =========================================================================
  // UI HELPERS (Browser Only)
  // =========================================================================
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  function makeModal(id, title, maxWidth) {
    var old = document.getElementById(id);
    if (old) old.remove();
    var c = theme();
    var ov = document.createElement('div');
    ov.id = id;
    ov.style.cssText = 'position:fixed;inset:0;z-index:10015;background:rgba(0,0,0,0.58);display:flex;align-items:center;justify-content:center;padding:14px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    var win = document.createElement('div');
    win.style.cssText = 'width:100%;max-width:' + maxWidth + 'px;max-height:88vh;background:' + c.bgWin + ';color:' + c.text + ';border:1px solid ' + c.border + ';border-radius:8px;box-shadow:0 18px 48px rgba(0,0,0,0.45);display:flex;flex-direction:column;overflow:hidden;';
    win.innerHTML =
      '<div style="padding:9px 14px;border-bottom:1px solid ' + c.border + ';display:flex;align-items:center;justify-content:space-between;background:' + c.bgTitle + ';flex-shrink:0;">' +
        '<span style="font-size:13px;font-weight:600;">' + esc(title) + '</span>' +
        '<button type="button" data-close="1" style="border:none;background:transparent;color:' + c.muted + ';font-size:15px;cursor:pointer;padding:2px 6px;">✕</button>' +
      '</div>' +
      '<div data-body="1" style="padding:14px 16px;overflow-y:auto;flex:1;min-height:0;"></div>' +
      '<div data-foot="1" style="padding:10px 16px;border-top:1px solid ' + c.border + ';display:flex;justify-content:flex-end;gap:8px;background:' + c.bgTitle + ';flex-shrink:0;"></div>';
    win.querySelector('[data-close]').onclick = function () { ov.remove(); };
    ov.appendChild(win);
    document.body.appendChild(ov);
    return { ov: ov, body: win.querySelector('[data-body]'), foot: win.querySelector('[data-foot]'), c: c };
  }

  // =========================================================================
  // UI A: CSV / TSV PLAIN-TEXT IMPORT MODAL
  // =========================================================================
  async function openCsvImportModal() {
    var db = window.__ANKI_DB__;
    if (!db) return;
    var decks = await db.decks.toArray();
    var models = await db.models.toArray();
    var m = makeModal('anki-csv-import-dlg', '匯入純文字 / CSV / TSV 檔案', 680);
    var c = m.c;
    var parsed = null;
    var inp = 'padding:5px 8px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgInput + ';color:' + c.text + ';';

    m.body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:12px;font-size:13px;">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
          '<input type="file" id="csv-file" accept=".csv,.tsv,.txt" style="font-size:12px;" />' +
          '<select id="csv-sep" style="' + inp + '"><option value="auto">自動偵測分隔符</option><option value=",">逗號 (,)</option><option value="\t">Tab (\\t)</option><option value=";">分號 (;)</option></select>' +
          '<select id="csv-dup" style="' + inp + '"><option value="update">重複時更新既有筆記</option><option value="ignore">重複時略過</option><option value="add">一律當作新筆記</option></select>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
          '<div><div style="font-size:11px;color:' + c.muted + ';margin-bottom:4px;">目標牌組（或由 #deck 標頭決定）</div><select id="csv-deck" style="width:100%;' + inp + '">' +
            (decks.length ? decks.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + '</option>'; }).join('') : '<option value="new">預設牌組</option>') +
          '</select></div>' +
          '<div><div style="font-size:11px;color:' + c.muted + ';margin-bottom:4px;">筆記類型</div><select id="csv-model" style="width:100%;' + inp + '">' +
            models.map(function (mo) { return '<option value="' + mo.id + '">' + esc(mo.name) + '</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
        '<div id="csv-preview" style="background:' + c.bgPanel + ';border:1px solid ' + c.border + ';border-radius:6px;padding:12px;min-height:120px;overflow-x:auto;font-size:12px;color:' + c.muted + ';">請選擇 UTF-8 編碼的 .csv / .tsv / .txt 檔案（支援 #separator:、#html:、#tags:、#deck: 官方標頭）</div>' +
      '</div>';

    m.foot.innerHTML =
      '<button type="button" id="csv-cancel" style="padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">取消</button>' +
      '<button type="button" id="csv-go" style="padding:6px 18px;font-size:13px;font-weight:600;border-radius:5px;border:none;background:' + c.accent + ';color:#fff;cursor:pointer;">開始匯入</button>';

    var rawFileText = '';
    function refreshPreview() {
      if (!rawFileText) return;
      var sep = m.body.querySelector('#csv-sep').value;
      parsed = parseDelimitedText(rawFileText, sep);
      var pv = m.body.querySelector('#csv-preview');
      if (!parsed.rows.length) { pv.textContent = '檔案中沒有可匯入的資料列。'; return; }
      var cols = parsed.rows[0].length;
      pv.innerHTML =
        '<div style="margin-bottom:8px;color:' + c.text + ';">偵測到 <strong>' + parsed.rows.length + '</strong> 列、<strong>' + cols + '</strong> 欄（分隔符：<code>' + esc(parsed.separator === '\t' ? 'TAB' : parsed.separator) + '</code>）</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;color:' + c.text + ';">' +
        parsed.rows.slice(0, 5).map(function (r) {
          return '<tr style="border-top:1px solid ' + c.border + ';">' + r.map(function (cell) {
            return '<td style="padding:4px 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(cell) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</table>';
    }

    m.body.querySelector('#csv-file').onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { rawFileText = String(rd.result || ''); refreshPreview(); };
      rd.readAsText(f, 'UTF-8');
    };
    m.body.querySelector('#csv-sep').onchange = refreshPreview;
    m.foot.querySelector('#csv-cancel').onclick = function () { m.ov.remove(); };
    m.foot.querySelector('#csv-go').onclick = async function () {
      if (!parsed || !parsed.rows.length) { toast('請先選擇有效的 CSV / TSV 檔案'); return; }
      var dupMode = m.body.querySelector('#csv-dup').value;
      var deckVal = m.body.querySelector('#csv-deck').value;
      var targetMid = Number(m.body.querySelector('#csv-model').value) || (models[0] && models[0].id) || 10001;
      var targetDid = deckVal === 'new' ? Date.now() : Number(deckVal);
      if (deckVal === 'new') {
        var dn = parsed.headers.deck || 'CSV 匯入牌組';
        await db.decks.put({ id: targetDid, name: dn, description: '', createdAt: Math.floor(Date.now() / 1000) });
      }
      var exNotes = await db.notes.toArray();
      var byKey = new Map();
      exNotes.forEach(function (n) {
        byKey.set(n.mid + '\x1f' + String((n.flds && n.flds[0]) || '').trim(), n);
      });
      var hdrTags = parsed.headers.tags ? parsed.headers.tags.split(/\s+/).filter(Boolean) : [];
      var now = Date.now(), nowSec = Math.floor(now / 1000);
      var added = 0, updated = 0, skipped = 0;
      var notesPut = [], cardsPut = [];

      parsed.rows.forEach(function (r, idx) {
        var f0 = String(r[0] || '').trim();
        if (!f0) return;
        var key = targetMid + '\x1f' + f0;
        var ex = byKey.get(key);
        if (ex && dupMode === 'ignore') { skipped++; return; }
        if (ex && dupMode === 'update') {
          notesPut.push(Object.assign({}, ex, { flds: r, tags: Array.from(new Set((ex.tags || []).concat(hdrTags))), mod: nowSec }));
          updated++;
        } else {
          var nid = now + idx * 2;
          notesPut.push({ id: nid, mid: targetMid, flds: r, tags: hdrTags, mod: nowSec, guid: 'csv_' + nid });
          cardsPut.push({ id: nid + 1, nid: nid, did: targetDid, ord: 0, type: 0, queue: 0, due: nid + 1, ivl: 0, factor: 2500, reps: 0, lapses: 0, left: 0, mod: nowSec, flags: 0 });
          added++;
        }
      });

      await db.transaction('rw', [db.notes, db.cards], async function () {
        if (notesPut.length) await db.notes.bulkPut(notesPut);
        if (cardsPut.length) await db.cards.bulkPut(cardsPut);
      });
      m.ov.remove();
      toast('CSV 匯入完成：新增 ' + added + ' 筆、更新 ' + updated + ' 筆、略過 ' + skipped + ' 筆');
      setTimeout(function () { window.location.reload(); }, 500);
    };
  }

  // =========================================================================
  // UI B: ADVANCED STATS MODAL (True Retention + 26-Week SVG Heatmap + Intervals + Hourly)
  // =========================================================================
  async function openAdvancedStatsModal() {
    var db = window.__ANKI_DB__;
    if (!db) return;
    var cards = await db.cards.toArray();
    var logs = await db.reviewLogs.toArray();
    var st = computeAdvancedStats(cards, logs, Date.now());
    var m = makeModal('anki-adv-stats-dlg', '進階學習統計報表 (True Retention / 熱力圖 / 分佈)', 780);
    var c = m.c;

    // 26-week SVG Heatmap
    var weeks = 26, cell = 13, gap = 3;
    var today = new Date();
    var rects = '';
    for (var w = weeks - 1; w >= 0; w--) {
      for (var d = 0; d < 7; d++) {
        var offset = w * 7 + (6 - d);
        var dt = new Date(today.getTime() - offset * 86400000);
        var key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        var cnt = st.dailyCounts[key] || 0;
        var fill = cnt === 0 ? (c.isDark ? '#2b2b2e' : '#e5e7eb')
          : cnt < 10 ? '#9be9a8'
          : cnt < 30 ? '#40c463'
          : cnt < 60 ? '#30a14e'
          : '#216e39';
        var x = (weeks - 1 - w) * (cell + gap);
        var y = d * (cell + gap);
        rects += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" rx="2" fill="' + fill + '"><title>' + key + '：' + cnt + ' 次複習</title></rect>';
      }
    }

    // Interval distribution SVG bars
    var maxIvlC = Math.max(1, Math.max.apply(null, st.ivlBuckets.map(function (b) { return b.count; })));
    var ivlBars = st.ivlBuckets.map(function (b) {
      var hPct = Math.round((b.count / maxIvlC) * 100);
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">' +
        '<span style="font-size:11px;color:' + c.muted + ';">' + b.count + '</span>' +
        '<div style="width:100%;max-width:44px;height:90px;display:flex;align-items:flex-end;justify-content:center;">' +
          '<div style="width:100%;height:' + Math.max(4, hPct) + '%;background:' + c.accent + ';border-radius:3px 3px 0 0;"></div>' +
        '</div>' +
        '<span style="font-size:11px;color:' + c.text + ';">' + b.label + '</span>' +
      '</div>';
    }).join('');

    // Hourly SVG bars
    var maxHr = Math.max(1, Math.max.apply(null, st.hourlyCounts));
    var hrBars = st.hourlyCounts.map(function (cnt, hr) {
      var hPct = Math.round((cnt / maxHr) * 100);
      return '<div title="' + hr + ':00 — ' + cnt + ' 次複習" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">' +
        '<div style="width:100%;height:70px;display:flex;align-items:flex-end;">' +
          '<div style="width:100%;height:' + (cnt ? Math.max(6, hPct) : 2) + '%;background:' + (cnt ? '#34c759' : c.border) + ';border-radius:2px 2px 0 0;"></div>' +
        '</div>' +
        '<span style="font-size:9px;color:' + c.muted + ';">' + (hr % 3 === 0 ? hr : '') + '</span>' +
      '</div>';
    }).join('');

    m.body.innerHTML =
      '<div style="background:' + c.bgPanel + ';border:1px solid ' + c.border + ';border-radius:6px;padding:14px;margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<strong style="font-size:13px;">複習熱力圖（近 26 週）</strong>' +
          '<span style="font-size:12px;color:' + c.muted + ';">連續學習：<strong>' + st.streak + '</strong> 天 · 累計複習：<strong>' + logs.length + '</strong> 次</span>' +
        '</div>' +
        '<div style="overflow-x:auto;"><svg width="' + (weeks * (cell + gap)) + '" height="' + (7 * (cell + gap)) + '">' + rects + '</svg></div>' +
      '</div>' +
      '<div style="background:' + c.bgPanel + ';border:1px solid ' + c.border + ';border-radius:6px;padding:14px;margin-bottom:12px;">' +
        '<strong style="font-size:13px;display:block;margin-bottom:8px;">真實記憶保留率 (True Retention)</strong>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
          '<thead><tr style="border-bottom:1px solid ' + c.border + ';color:' + c.muted + ';"><th style="text-align:left;padding:5px;">區間</th><th>年輕卡片</th><th>成熟卡片 (≥21天)</th><th>總計保留率</th><th>複習次數</th></tr></thead>' +
          '<tbody>' + st.retention.map(function (r) {
            return '<tr style="border-bottom:1px solid ' + c.border + ';"><td style="padding:6px 5px;font-weight:500;">' + r.label + '</td><td style="text-align:center;">' + r.youngPct + '</td><td style="text-align:center;">' + r.maturePct + '</td><td style="text-align:center;font-weight:700;">' + r.totalPct + '</td><td style="text-align:center;">' + r.total + '</td></tr>';
          }).join('') + '</tbody></table>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;">' +
        '<div style="background:' + c.bgPanel + ';border:1px solid ' + c.border + ';border-radius:6px;padding:14px;">' +
          '<strong style="font-size:13px;display:block;margin-bottom:10px;">卡片間隔分佈 (共 ' + cards.length + ' 張)</strong>' +
          '<div style="display:flex;align-items:flex-end;gap:6px;">' + ivlBars + '</div>' +
        '</div>' +
        '<div style="background:' + c.bgPanel + ';border:1px solid ' + c.border + ';border-radius:6px;padding:14px;">' +
          '<strong style="font-size:13px;display:block;margin-bottom:10px;">24 小時複習時段分佈</strong>' +
          '<div style="display:flex;align-items:flex-end;gap:2px;">' + hrBars + '</div>' +
        '</div>' +
      '</div>';

    m.foot.innerHTML = '<button type="button" id="as-close" style="padding:6px 18px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">關閉</button>';
    m.foot.querySelector('#as-close').onclick = function () { m.ov.remove(); };
  }

  // =========================================================================
  // UI C: iPadOS APPLE PENCIL SCRATCHPAD (手寫塗鴉板, shortcut: W)
  // =========================================================================
  function toggleScratchpad() {
    var existing = document.getElementById('anki-scratchpad-layer');
    if (existing) { existing.remove(); return; }

    var layer = document.createElement('div');
    layer.id = 'anki-scratchpad-layer';
    layer.style.cssText = 'position:fixed;inset:0;z-index:9990;pointer-events:auto;touch-action:none;';

    var canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = 'width:100%;height:100%;display:block;background:rgba(0,0,0,0.03);cursor:crosshair;touch-action:none;';
    layer.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var color = document.documentElement.classList.contains('dark') ? '#60a5fa' : '#1d4ed8';
    var width = 3;
    var erasing = false;
    var drawing = false;
    var strokes = [];
    var curStroke = null;

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes.forEach(function (st) {
        if (!st.pts.length) return;
        ctx.save();
        ctx.globalCompositeOperation = st.erase ? 'destination-out' : 'source-over';
        ctx.strokeStyle = st.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(st.pts[0].x, st.pts[0].y);
        for (var i = 1; i < st.pts.length; i++) {
          ctx.lineWidth = st.erase ? 18 : Math.max(1.5, st.width * (st.pts[i].p || 0.7) * 1.4);
          ctx.lineTo(st.pts[i].x, st.pts[i].y);
        }
        ctx.stroke();
        ctx.restore();
      });
    }

    canvas.addEventListener('pointerdown', function (e) {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      curStroke = { color: color, width: width, erase: erasing, pts: [{ x: e.clientX, y: e.clientY, p: e.pressure || 0.7 }] };
      strokes.push(curStroke);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing || !curStroke) return;
      curStroke.pts.push({ x: e.clientX, y: e.clientY, p: e.pressure || 0.7 });
      redraw();
    });
    canvas.addEventListener('pointerup', function () { drawing = false; curStroke = null; });

    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9991;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(28,28,32,0.92);color:#fff;border:1px solid rgba(255,255,255,0.16);box-shadow:0 8px 24px rgba(0,0,0,0.35);font-size:12px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;';
    var colors = ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#ffffff', '#111827'];
    bar.innerHTML =
      '<span style="font-weight:600;margin-right:4px;">✏️ 塗鴉板</span>' +
      colors.map(function (cl) { return '<button type="button" data-sp-col="' + cl + '" style="width:18px;height:18px;border-radius:50%;background:' + cl + ';border:1.5px solid rgba(255,255,255,0.5);cursor:pointer;"></button>'; }).join('') +
      '<button type="button" id="sp-erase" style="padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.25);background:transparent;color:#fff;cursor:pointer;">橡皮擦</button>' +
      '<button type="button" id="sp-undo" style="padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.25);background:transparent;color:#fff;cursor:pointer;">復原</button>' +
      '<button type="button" id="sp-clear" style="padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.25);background:transparent;color:#fff;cursor:pointer;">清除</button>' +
      '<button type="button" id="sp-close" style="padding:3px 10px;border-radius:5px;border:none;background:#2f65d6;color:#fff;font-weight:600;cursor:pointer;">完成</button>';

    bar.querySelectorAll('[data-sp-col]').forEach(function (b) {
      b.onclick = function () { color = b.getAttribute('data-sp-col'); erasing = false; };
    });
    bar.querySelector('#sp-erase').onclick = function () { erasing = !erasing; toast(erasing ? '已切換為橡皮擦' : '已切換為畫筆'); };
    bar.querySelector('#sp-undo').onclick = function () { strokes.pop(); redraw(); };
    bar.querySelector('#sp-clear').onclick = function () { strokes = []; redraw(); };
    bar.querySelector('#sp-close').onclick = function () { layer.remove(); };

    layer.appendChild(bar);
    document.body.appendChild(layer);
  }

  // =========================================================================
  // UI D: iPadOS GESTURES (SWIPES / 9-ZONE TAPS) & BLUETOOTH GAMEPAD SUPPORT
  // =========================================================================
  var INPUT_CFG_KEY = 'anki_ipad_input_cfg_v1';
  function loadInputCfg() {
    var def = { swipesEnabled: true, tapZonesEnabled: false, gamepadEnabled: true };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(INPUT_CFG_KEY) || '{}') || {}); } catch (e) { return def; }
  }
  function saveInputCfg(cfg) {
    try { localStorage.setItem(INPUT_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  function openInputControlsModal() {
    var cfg = loadInputCfg();
    var m = makeModal('anki-input-cfg-dlg', 'iPad 手勢、點擊區與藍牙手把設定', 500);
    var c = m.c;
    var pads = (navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []);

    m.body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:12px;font-size:13px;">' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="ic-swipes" ' + (cfg.swipesEnabled ? 'checked' : '') + ' style="accent-color:' + c.accent + ';" /><span>啟用複習頁四向滑動手勢（左滑：更多選單、右滑：返回／復原、下滑：開啟手寫塗鴉板）</span></label>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="ic-taps" ' + (cfg.tapZonesEnabled ? 'checked' : '') + ' style="accent-color:' + c.accent + ';" /><span>啟用解答畫面左右點擊區（點最左側 = 重來、點最右側 = 良好，中間忽略）</span></label>' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="ic-pad" ' + (cfg.gamepadEnabled ? 'checked' : '') + ' style="accent-color:' + c.accent + ';" /><span>啟用藍牙遊戲手把控制 (8BitDo / Xbox / DualSense：A=顯示答案/良好、B=重來、X=困難、Y=簡單、L1=語音)</span></label>' +
        '<div style="padding:10px 12px;border-radius:6px;background:' + c.bgPanel + ';border:1px solid ' + c.border + ';font-size:12px;color:' + c.muted + ';">' +
          '目前偵測到的手把：<strong>' + (pads.length ? esc(pads.map(function (p) { return p.id; }).join(', ')) : '尚未連線（請按手把任意鍵喚醒）') + '</strong>' +
        '</div>' +
      '</div>';

    m.foot.innerHTML =
      '<button type="button" id="ic-scratch" style="padding:6px 14px;font-size:13px;border-radius:5px;border:1px solid ' + c.border + ';background:' + c.bgBtn + ';color:' + c.text + ';cursor:pointer;">立即開啟手寫塗鴉板 (W)</button>' +
      '<button type="button" id="ic-save" style="padding:6px 18px;font-size:13px;font-weight:600;border-radius:5px;border:none;background:' + c.accent + ';color:#fff;cursor:pointer;">儲存</button>';

    m.foot.querySelector('#ic-scratch').onclick = function () { m.ov.remove(); toggleScratchpad(); };
    m.foot.querySelector('#ic-save').onclick = function () {
      saveInputCfg({
        swipesEnabled: m.body.querySelector('#ic-swipes').checked,
        tapZonesEnabled: m.body.querySelector('#ic-taps').checked,
        gamepadEnabled: m.body.querySelector('#ic-pad').checked
      });
      m.ov.remove();
      toast('已儲存 iPad 手勢與手把設定');
    };
  }

  // Touch Swipes in Reviewer
  var touchStart = null;
  document.addEventListener('touchstart', function (e) {
    if (!window.__ANKI_REVIEW_CTX__ || !window.__ANKI_REVIEW_CTX__.card) return;
    if (e.touches.length !== 1) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!touchStart || !window.__ANKI_REVIEW_CTX__ || !window.__ANKI_REVIEW_CTX__.card) return;
    var cfg = loadInputCfg();
    var end = e.changedTouches[0];
    var dx = end.clientX - touchStart.x;
    var dy = end.clientY - touchStart.y;
    var dt = Date.now() - touchStart.t;
    touchStart = null;

    if (cfg.swipesEnabled && dt < 450) {
      if (Math.abs(dx) > 80 && Math.abs(dy) < 50) {
        if (dx < 0 && window.__ANKI_OPEN_MORE_MENU__) {
          var ctx = window.__ANKI_REVIEW_CTX__;
          window.__ANKI_OPEN_MORE_MENU__(ctx.card, ctx.deck, ctx.skipCard, ctx.reloadCard, null);
        }
      }
    }
    if (cfg.tapZonesEnabled && dt < 280 && Math.abs(dx) < 12 && Math.abs(dy) < 12 && window.__ANKI_REVIEW_CTX__.isAnswer) {
      var ratio = end.clientX / window.innerWidth;
      if (ratio < 0.18) {
        var againBtn = document.querySelector('.anki-native-rate-btn.rate-again');
        if (againBtn) againBtn.click();
      } else if (ratio > 0.82) {
        var goodBtn = document.querySelector('.anki-native-rate-btn.rate-good');
        if (goodBtn) goodBtn.click();
      }
    }
  }, { passive: true });

  // Gamepad polling (8BitDo / Xbox / DualSense)
  var prevButtons = [];
  function pollGamepad() {
    var cfg = loadInputCfg();
    if (cfg.gamepadEnabled && navigator.getGamepads && window.__ANKI_REVIEW_CTX__ && window.__ANKI_REVIEW_CTX__.card) {
      var pads = navigator.getGamepads();
      var pad = pads && (pads[0] || pads[1]);
      if (pad && pad.buttons) {
        var pressed = function (idx) { return pad.buttons[idx] && pad.buttons[idx].pressed && !prevButtons[idx]; };
        if (pressed(0)) { // A -> Show Answer / Good
          var sa = document.querySelector('.anki-native-show-answer') || document.querySelector('.anki-native-rate-btn.rate-good');
          if (sa) sa.click();
        } else if (pressed(1)) { // B -> Again
          var ag = document.querySelector('.anki-native-rate-btn.rate-again');
          if (ag) ag.click();
        } else if (pressed(2)) { // X -> Hard
          var hd = document.querySelector('.anki-native-rate-btn.rate-hard');
          if (hd) hd.click();
        } else if (pressed(3)) { // Y -> Easy
          var es = document.querySelector('.anki-native-rate-btn.rate-easy');
          if (es) es.click();
        } else if (pressed(4)) { // L1 -> Replay audio
          var au = document.querySelector('.anki-sound-play-btn') || document.querySelector('.anki-tts-play-btn');
          if (au) au.click();
        }
        prevButtons = pad.buttons.map(function (b) { return !!b.pressed; });
      }
    }
    requestAnimationFrame(pollGamepad);
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(pollGamepad);

  // Global 'W' shortcut for Scratchpad when reviewing
  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'w' || e.key === 'W')) {
      if (window.__ANKI_REVIEW_CTX__ && window.__ANKI_REVIEW_CTX__.card) {
        e.preventDefault();
        toggleScratchpad();
      }
    }
  });

  window.__ANKI_OPEN_CSV_IMPORT__ = openCsvImportModal;
  window.__ANKI_OPEN_ADV_STATS__ = openAdvancedStatsModal;
  window.__ANKI_TOGGLE_SCRATCHPAD__ = toggleScratchpad;
  window.__ANKI_OPEN_INPUT_CFG__ = openInputControlsModal;
})();
