(function () {
  'use strict';

  var PREF_KEY = 'anki_ipad_preferences_v1';

  var DEFAULTS = {
    // 外觀
    language: 'zh-TW',
    videoDriver: 'Direct3D (預設)',
    checkAppUpdate: true,
    checkAddonUpdate: true,
    theme: 'system', // 'system' | 'light' | 'dark'
    uiScale: 100,
    hideTopBar: false,
    hideBottomBar: false,
    reduceMotion: true,
    minimalistMode: false,
    // 複習
    nextDayStartsAt: 4,
    learnAheadLimit: 20,
    timeboxTimeLimit: 0,
    showAudioButtons: true,
    interruptAudio: true,
    showRemainingCount: true,
    showNextReviewTime: true,
    spaceEnterAnswers: true,
    generateLatex: false,
    keyAgain: '1',
    keyHard: '2',
    keyGood: '3',
    keyEasy: '4',
    // 編輯
    pasteImagesAsPng: false,
    stripHtmlOnPaste: false,
    defaultDeckBehavior: 'current',
    defaultSearchText: '',
    ignoreAccents: false,
    // 網路
    syncAudioImages: true,
    autoSyncOnProfile: true,
    periodicMediaSync: true,
    forceOneWaySync: false,
    networkTimeout: 60,
    selfHostedSyncUrl: '',
    // 備份
    autoBackupInterval: 30,
    dailyBackups: 12,
    weeklyBackups: 10,
    monthlyBackups: 9,
    // 實驗功能
    svelteNoteEditor: false
  };

  function loadPrefs() {
    var merged = Object.assign({}, DEFAULTS);
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.assign(merged, parsed);
        }
      }
    } catch (e) {}
    return merged;
  }

  function savePrefs(p) {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(p));
    } catch (e) {}
  }

  function applyPrefs(p) {
    window.__ANKI_PREFS__ = p;
    var root = document.documentElement;

    // Theme
    if (p.theme === 'dark') {
      root.classList.add('dark');
    } else if (p.theme === 'light') {
      root.classList.remove('dark');
    } else {
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }

    // UI Scale
    var scale = Math.max(70, Math.min(150, Number(p.uiScale) || 100));
    if (document.body) {
      document.body.style.zoom = (scale / 100).toFixed(2);
    }

    // Visual toggles
    root.classList.toggle('anki-pref-hide-top', !!p.hideTopBar);
    root.classList.toggle('anki-pref-hide-bottom', !!p.hideBottomBar);
    root.classList.toggle('anki-pref-reduce-motion', !!p.reduceMotion);
    root.classList.toggle('anki-pref-minimalist', !!p.minimalistMode);
    root.classList.toggle('anki-pref-hide-audio', !p.showAudioButtons);
    root.classList.toggle('anki-pref-hide-intervals', !p.showNextReviewTime);
    root.classList.toggle('anki-pref-hide-remaining', !p.showRemainingCount);
  }

  // Apply saved preferences on load (after DOM ready so body exists)
  var initialPrefs = loadPrefs();
  window.__ANKI_PREFS__ = initialPrefs;
  document.addEventListener('DOMContentLoaded', function () {
    applyPrefs(loadPrefs());
  });
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        var cur = loadPrefs();
        if (cur.theme === 'system') applyPrefs(cur);
      });
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var TABS = [
    { id: 'appearance', label: '外觀' },
    { id: 'review', label: '複習' },
    { id: 'editing', label: '編輯' },
    { id: 'network', label: '網路' },
    { id: 'backups', label: '備份' },
    { id: 'thirdparty', label: '第三方服務' },
    { id: 'experimental', label: '實驗功能' }
  ];

  function openPreferencesModal(startTab) {
    var existing = document.getElementById('anki-prefs-modal-root');
    if (existing) existing.remove();

    var activeTab = startTab || 'appearance';
    var prefs = loadPrefs();

    var overlay = document.createElement('div');
    overlay.id = 'anki-prefs-modal-root';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.58);display:flex;align-items:center;justify-content:center;padding:14px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;';

    function render() {
      var isDark = document.documentElement.classList.contains('dark');
      var bgWin = isDark ? '#2c2c2c' : '#f0f0f0';
      var bgPanel = isDark ? '#323232' : '#ffffff';
      var bgInput = isDark ? '#242424' : '#ffffff';
      var bgBtn = isDark ? '#3c3c3c' : '#e8e8e8';
      var border = isDark ? '#454545' : '#cccccc';
      var text = isDark ? '#ececec' : '#1a1a1a';
      var muted = isDark ? '#a8a8a8' : '#606060';
      var accent = '#2f65d6';

      var tabHtml = TABS.map(function (t, i) {
        var isAct = t.id === activeTab;
        var rad = i === 0 ? '5px 0 0 5px' : i === TABS.length - 1 ? '0 5px 5px 0' : '0';
        return (
          '<button type="button" data-pref-tab="' + t.id + '" style="' +
            'padding:5px 14px;font-size:12px;font-weight:' + (isAct ? '600' : '500') + ';' +
            'border:1px solid ' + (isAct ? accent : border) + ';' +
            (i > 0 ? 'margin-left:-1px;' : '') +
            'border-radius:' + rad + ';' +
            'background:' + (isAct ? accent : bgBtn) + ';' +
            'color:' + (isAct ? '#ffffff' : text) + ';' +
            'cursor:pointer;white-space:nowrap;' +
          '">' + t.label + '</button>'
        );
      }).join('');

      function fieldset(legend, inner) {
        return (
          '<fieldset style="border:1px solid ' + border + ';border-radius:6px;padding:12px 14px 14px;margin:0 0 12px;background:' + bgPanel + ';">' +
            '<legend style="font-size:12px;font-weight:600;color:' + text + ';padding:0 6px;">' + legend + '</legend>' +
            inner +
          '</fieldset>'
        );
      }

      function chk(key, label) {
        return (
          '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:' + text + ';margin:6px 0;cursor:pointer;user-select:none;">' +
            '<input type="checkbox" data-pref-chk="' + key + '" ' + (prefs[key] ? 'checked' : '') + ' style="width:15px;height:15px;accent-color:' + accent + ';cursor:pointer;" />' +
            '<span>' + label + '</span>' +
          '</label>'
        );
      }

      function row(label, controlHtml) {
        return (
          '<div style="display:grid;grid-template-columns:minmax(130px, 1fr) minmax(180px, 1.15fr);align-items:center;gap:10px;margin:7px 0;font-size:13px;">' +
            '<span style="color:' + text + ';">' + label + '</span>' +
            controlHtml +
          '</div>'
        );
      }

      var inputStyle = 'width:100%;padding:5px 9px;font-size:13px;border-radius:5px;border:1px solid ' + border + ';background:' + bgInput + ';color:' + text + ';outline:none;';

      var bodyHtml = '';

      if (activeTab === 'appearance') {
        bodyHtml =
          fieldset('一般',
            row('語言',
              '<select data-pref-sel="language" style="' + inputStyle + '">' +
                '<option value="zh-TW" ' + (prefs.language === 'zh-TW' ? 'selected' : '') + '>繁體中文</option>' +
                '<option value="en" ' + (prefs.language === 'en' ? 'selected' : '') + '>English</option>' +
              '</select>'
            ) +
            row('視訊驅動程式',
              '<select data-pref-sel="videoDriver" style="' + inputStyle + '">' +
                '<option value="Direct3D (預設)" ' + (prefs.videoDriver === 'Direct3D (預設)' ? 'selected' : '') + '>Direct3D (預設)</option>' +
                '<option value="WebGL / 瀏覽器硬體加速" ' + (prefs.videoDriver === 'WebGL / 瀏覽器硬體加速' ? 'selected' : '') + '>WebGL / 瀏覽器硬體加速</option>' +
              '</select>'
            )
          ) +
          fieldset('更新',
            chk('checkAppUpdate', '檢查程式更新') +
            chk('checkAddonUpdate', '檢查附加元件更新')
          ) +
          fieldset('使用者介面',
            row('佈景主題',
              '<select data-pref-sel="theme" style="' + inputStyle + '">' +
                '<option value="system" ' + (prefs.theme === 'system' ? 'selected' : '') + '>跟隨系統設定</option>' +
                '<option value="light" ' + (prefs.theme === 'light' ? 'selected' : '') + '>淺色</option>' +
                '<option value="dark" ' + (prefs.theme === 'dark' ? 'selected' : '') + '>深色</option>' +
              '</select>'
            ) +
            row('使用者介面大小 (%)',
              '<input type="number" min="70" max="150" step="5" data-pref-num="uiScale" value="' + esc(prefs.uiScale) + '" style="' + inputStyle + '" />'
            ) +
            '<div style="margin-top:8px;">' +
              '<button type="button" id="anki-pref-reset-zoom" style="width:100%;padding:6px 12px;font-size:13px;border-radius:5px;border:1px solid ' + accent + ';background:transparent;color:' + text + ';cursor:pointer;">重設視窗大小</button>' +
            '</div>'
          ) +
          fieldset('減少干擾',
            chk('hideTopBar', '複習時隱藏頂部列') +
            chk('hideBottomBar', '複習時隱藏底部列') +
            chk('reduceMotion', '減少動態效果') +
            chk('minimalistMode', '極簡模式')
          );
      } else if (activeTab === 'review') {
        bodyHtml =
          fieldset('排程器',
            row('次日始於（時）', '<input type="number" min="0" max="23" data-pref-num="nextDayStartsAt" value="' + esc(prefs.nextDayStartsAt) + '" style="' + inputStyle + '" />') +
            row('提前學習上限（分鐘）', '<input type="number" min="0" max="120" data-pref-num="learnAheadLimit" value="' + esc(prefs.learnAheadLimit) + '" style="' + inputStyle + '" />') +
            row('限時學習時長（分鐘）', '<input type="number" min="0" max="180" data-pref-num="timeboxTimeLimit" value="' + esc(prefs.timeboxTimeLimit) + '" style="' + inputStyle + '" />')
          ) +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;">' +
            fieldset('複習',
              chk('showAudioButtons', '在卡片上顯示音訊播放按鈕') +
              chk('interruptAudio', '回答後中斷正在播放的音訊') +
              chk('showRemainingCount', '顯示剩餘卡片數量') +
              chk('showNextReviewTime', '在回答按鈕上顯示下次複習時間') +
              chk('spaceEnterAnswers', '使用空白鍵/Enter 鍵回答卡片') +
              chk('generateLatex', '產生 LaTeX 影像（安全風險）')
            ) +
            fieldset('回答按鍵',
              row('重來', '<input type="text" maxlength="4" data-pref-txt="keyAgain" value="' + esc(prefs.keyAgain) + '" style="' + inputStyle + '" />') +
              row('困難', '<input type="text" maxlength="4" data-pref-txt="keyHard" value="' + esc(prefs.keyHard) + '" style="' + inputStyle + '" />') +
              row('良好', '<input type="text" maxlength="4" data-pref-txt="keyGood" value="' + esc(prefs.keyGood) + '" style="' + inputStyle + '" />') +
              row('簡單', '<input type="text" maxlength="4" data-pref-txt="keyEasy" value="' + esc(prefs.keyEasy) + '" style="' + inputStyle + '" />')
            ) +
          '</div>';
      } else if (activeTab === 'editing') {
        bodyHtml =
          fieldset('編輯',
            chk('pasteImagesAsPng', '將剪貼板影像轉換為 PNG 格式') +
            chk('stripHtmlOnPaste', '自動清除文字格式（按住 Shift 鍵來保留格式）') +
            row('預設牌組',
              '<select data-pref-sel="defaultDeckBehavior" style="' + inputStyle + '">' +
                '<option value="current" ' + (prefs.defaultDeckBehavior === 'current' ? 'selected' : '') + '>新增筆記時，預設加入當前牌組</option>' +
                '<option value="notetype" ' + (prefs.defaultDeckBehavior === 'notetype' ? 'selected' : '') + '>依筆記類型決定牌組</option>' +
              '</select>'
            )
          ) +
          fieldset('瀏覽',
            row('預設搜尋條件', '<input type="text" placeholder="例如「deck:current」" data-pref-txt="defaultSearchText" value="' + esc(prefs.defaultSearchText) + '" style="' + inputStyle + '" />') +
            chk('ignoreAccents', '搜尋時忽略字母的變音符號（速度較慢）')
          );
      } else if (activeTab === 'network') {
        bodyHtml =
          fieldset('同步',
            chk('syncAudioImages', '同步音訊與影像') +
            chk('autoSyncOnProfile', '打開/關閉設定檔時自動同步') +
            chk('periodicMediaSync', '定期同步媒體') +
            chk('forceOneWaySync', '下次同步時，強制單向更動') +
            row('網路逾時（秒）', '<input type="number" min="10" max="600" data-pref-num="networkTimeout" value="' + esc(prefs.networkTimeout) + '" style="' + inputStyle + '" />')
          ) +
          fieldset('AnkiWeb 帳號',
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;">' +
              '<span style="color:' + muted + ';">本機離線 PWA 模式（透過 .apkg 匯入／匯出同步）</span>' +
              '<button type="button" id="anki-pref-open-profiles" style="padding:4px 12px;font-size:12px;border-radius:5px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';cursor:pointer;">切換設定檔</button>' +
            '</div>'
          ) +
          row('自託管同步伺服器', '<input type="text" placeholder="供進階使用者使用 — 請參閱使用手冊" data-pref-txt="selfHostedSyncUrl" value="' + esc(prefs.selfHostedSyncUrl) + '" style="' + inputStyle + '" />');
      } else if (activeTab === 'backups') {
        bodyHtml =
          fieldset('備份',
            '<p style="margin:0 0 10px;font-size:12px;color:' + muted + ';">Anki 會定期備份你的集合。網頁版資料儲存於瀏覽器 IndexedDB，建議定期手動匯出 .apkg 備份。</p>' +
            row('自動備份間隔（分鐘）：', '<input type="number" min="5" max="1440" data-pref-num="autoBackupInterval" value="' + esc(prefs.autoBackupInterval) + '" style="' + inputStyle + '" />') +
            row('每日保留備份數量：', '<input type="number" min="0" max="50" data-pref-num="dailyBackups" value="' + esc(prefs.dailyBackups) + '" style="' + inputStyle + '" />') +
            row('每週保留備份數量：', '<input type="number" min="0" max="50" data-pref-num="weeklyBackups" value="' + esc(prefs.weeklyBackups) + '" style="' + inputStyle + '" />') +
            row('每月保留備份數量：', '<input type="number" min="0" max="50" data-pref-num="monthlyBackups" value="' + esc(prefs.monthlyBackups) + '" style="' + inputStyle + '" />') +
            '<p style="margin:10px 0 0;font-size:12px;color:' + muted + ';">你可以透過「檔案」&gt;「切換設定檔」管理多組獨立使用者資料庫。</p>'
          ) +
          fieldset('附註',
            '<p style="margin:0;font-size:12px;color:' + muted + ';">清除瀏覽器網站資料會一併移除本機 IndexedDB，請定期透過「匯出備份」下載完整 .apkg。</p>'
          );
      } else if (activeTab === 'thirdparty') {
        bodyHtml =
          '<p style="margin:0 0 12px;font-size:12px;color:' + muted + ';">Anki 與第三方服務無合作關係，不予擔保。使用這些服務可能需要付費。</p>' +
          fieldset('AnkiHub',
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;">' +
              '<span>AnkiHub 可以合作編輯牌組，並提供其他學習工具。部分功能需付費訂閱。</span>' +
              '<a href="https://www.ankihub.net/" target="_blank" rel="noopener noreferrer" style="padding:5px 14px;font-size:12px;border-radius:5px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';text-decoration:none;white-space:nowrap;">前往 AnkiHub</a>' +
            '</div>'
          );
      } else if (activeTab === 'experimental') {
        bodyHtml =
          '<div style="border:1px solid #9a6700;background:' + (isDark ? 'rgba(154,103,0,0.18)' : '#fff8c5') + ';color:' + (isDark ? '#f2cc60' : '#7a5200') + ';border-radius:6px;padding:12px 14px;margin-bottom:14px;font-size:13px;">' +
            '<div style="font-weight:700;margin-bottom:4px;">⚠ Experimental Features</div>' +
            '<div>These features may change, break, or be removed without notice, use at your own risk.</div>' +
          '</div>' +
          '<div style="border:1px solid ' + border + ';background:' + bgPanel + ';border-radius:6px;padding:14px;max-width:360px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
              '<strong style="font-size:13px;">Svelte note editor</strong>' +
              '<input type="checkbox" data-pref-chk="svelteNoteEditor" ' + (prefs.svelteNoteEditor ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:' + accent + ';cursor:pointer;" />' +
            '</div>' +
            '<p style="margin:0;font-size:12px;color:' + muted + ';line-height:1.5;">Replaces the legacy editor with a new Svelte-based implementation. May affect addon compatibility.</p>' +
          '</div>';
      }

      overlay.innerHTML =
        '<div style="width:100%;max-width:740px;max-height:88vh;background:' + bgWin + ';color:' + text + ';border:1px solid ' + border + ';border-radius:8px;box-shadow:0 18px 48px rgba(0,0,0,0.45);display:flex;flex-direction:column;overflow:hidden;">' +
          '<div style="padding:9px 14px;border-bottom:1px solid ' + border + ';display:flex;align-items:center;justify-content:space-between;background:' + (isDark ? '#242424' : '#e6e6e6') + ';flex-shrink:0;">' +
            '<span style="font-size:13px;font-weight:600;">偏好設定</span>' +
            '<button type="button" id="anki-prefs-x" style="border:none;background:transparent;color:' + muted + ';font-size:15px;cursor:pointer;padding:2px 6px;">✕</button>' +
          '</div>' +
          '<div style="padding:12px 14px 8px;display:flex;justify-content:center;flex-wrap:wrap;flex-shrink:0;">' +
            '<div style="display:inline-flex;flex-wrap:wrap;justify-content:center;">' + tabHtml + '</div>' +
          '</div>' +
          '<div style="padding:8px 18px 12px;overflow-y:auto;flex:1;min-height:0;">' +
            bodyHtml +
          '</div>' +
          '<div style="padding:10px 16px;border-top:1px solid ' + border + ';display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;background:' + (isDark ? '#272727' : '#e9e9e9') + ';">' +
            '<span style="font-size:12px;color:' + muted + ';">部分設定在重新啟動 Anki 後才會生效。</span>' +
            '<div style="display:flex;gap:8px;">' +
              '<button type="button" id="anki-prefs-close" style="padding:5px 18px;font-size:13px;border-radius:5px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';cursor:pointer;">關閉</button>' +
              '<button type="button" id="anki-prefs-help" style="padding:5px 16px;font-size:13px;border-radius:5px;border:1px solid ' + border + ';background:' + bgBtn + ';color:' + text + ';cursor:pointer;">說明</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      // Bind tab switches
      overlay.querySelectorAll('[data-pref-tab]').forEach(function (b) {
        b.onclick = function () {
          activeTab = b.getAttribute('data-pref-tab');
          render();
        };
      });

      // Bind checkboxes
      overlay.querySelectorAll('[data-pref-chk]').forEach(function (el) {
        el.onchange = function () {
          prefs[el.getAttribute('data-pref-chk')] = el.checked;
          savePrefs(prefs);
          applyPrefs(prefs);
        };
      });

      // Bind selects
      overlay.querySelectorAll('[data-pref-sel]').forEach(function (el) {
        el.onchange = function () {
          var k = el.getAttribute('data-pref-sel');
          prefs[k] = el.value;
          savePrefs(prefs);
          applyPrefs(prefs);
          if (k === 'theme') render();
        };
      });

      // Bind numbers
      overlay.querySelectorAll('[data-pref-num]').forEach(function (el) {
        el.onchange = function () {
          prefs[el.getAttribute('data-pref-num')] = Number(el.value);
          savePrefs(prefs);
          applyPrefs(prefs);
        };
      });

      // Bind text
      overlay.querySelectorAll('[data-pref-txt]').forEach(function (el) {
        el.oninput = function () {
          prefs[el.getAttribute('data-pref-txt')] = el.value;
          savePrefs(prefs);
        };
      });

      var resetZoomBtn = overlay.querySelector('#anki-pref-reset-zoom');
      if (resetZoomBtn) {
        resetZoomBtn.onclick = function () {
          prefs.uiScale = 100;
          savePrefs(prefs);
          applyPrefs(prefs);
          render();
        };
      }

      var openProfBtn = overlay.querySelector('#anki-pref-open-profiles');
      if (openProfBtn) {
        openProfBtn.onclick = function () {
          overlay.remove();
          if (window.__ANKI_OPEN_PROFILES__) window.__ANKI_OPEN_PROFILES__();
        };
      }

      var closeA = overlay.querySelector('#anki-prefs-x');
      var closeB = overlay.querySelector('#anki-prefs-close');
      if (closeA) closeA.onclick = function () { overlay.remove(); };
      if (closeB) closeB.onclick = function () { overlay.remove(); };

      var helpBtn = overlay.querySelector('#anki-prefs-help');
      if (helpBtn) {
        helpBtn.onclick = function () {
          window.open('https://docs.ankiweb.net/preferences.html', '_blank', 'noopener');
        };
      }
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    render();
    document.body.appendChild(overlay);
  }

  window.__ANKI_OPEN_PREFS__ = openPreferencesModal;

  // Global Ctrl+P shortcut (official Anki Preferences shortcut)
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      openPreferencesModal();
    }
  });
})();
