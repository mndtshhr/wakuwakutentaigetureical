(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const WD = "日月火水木金土";
  let rec = null;
  let listening = false;

  // ---- 見た目 ----
  const style = document.createElement("style");
  style.textContent = `
    #micBtn { position: fixed; right: 16px; bottom: 20px; width: 56px; height: 56px;
      border-radius: 50%; border: none; background: #4a9eff; color: #fff; font-size: 26px;
      box-shadow: 0 2px 10px rgba(0,0,0,.5); z-index: 5; }
    #micBtn.on { background: #ff4d4d; }
    #voiceCard { position: fixed; left: 0; right: 0; bottom: 0; background: #1c1c1e;
      border-radius: 16px 16px 0 0; padding: 16px; z-index: 30;
      transform: translateY(100%); transition: transform .2s; }
    #voiceCard.open { transform: translateY(0); }
    #vMsg { font-size: 14px; color: #ccc; white-space: pre-line; margin-bottom: 10px; }
    #vForm { display: none; }
    #vForm.show { display: block; }
    #vForm input { width: 100%; background: #2a2a2d; border: 1px solid #444;
      border-radius: 8px; color: #eee; padding: 10px; font-size: 16px; margin-bottom: 8px; }
    .vrow { display: flex; gap: 8px; }
    .vrow input { flex: 1; min-width: 0; width: auto !important; }
    .vrow button { flex: 1; border: none; border-radius: 8px; padding: 12px;
      font-size: 16px; color: #fff; background: #444; }
    #vAdd { background: #4a9eff !important; }
  `;
  document.head.appendChild(style);

  const fab = document.createElement("button");
  fab.id = "micBtn";
  fab.textContent = "🎤";
  const card = document.createElement("div");
  card.id = "voiceCard";
  card.innerHTML = `
    <div id="vMsg"></div>
    <div id="vForm">
      <input type="text" id="vTitle" placeholder="予定名">
      <div class="vrow">
        <input type="date" id="vDate">
        <input type="time" id="vTime">
      </div>
      <div class="vrow">
        <button id="vCancel">キャンセル</button>
        <button id="vAdd">追加</button>
      </div>
    </div>`;
  document.body.appendChild(fab);
  document.body.appendChild(card);

  const vMsg = document.getElementById("vMsg");
  const vForm = document.getElementById("vForm");
  const vTitle = document.getElementById("vTitle");
  const vDate = document.getElementById("vDate");
  const vTime = document.getElementById("vTime");

  function show(msg, withForm) {
    vMsg.textContent = msg;
    vForm.classList.toggle("show", !!withForm);
    card.classList.add("open");
  }
  function hide() {
    if (listening && rec) { try { rec.abort(); } catch (e) {} }
    card.classList.remove("open");
  }

  // ---- 日付ユーティリティ ----
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  // マッチした文字列と、その直後の助詞(に/から/は/の)を取り除く
  function cut(s, str) {
    const i = s.indexOf(str);
    if (i < 0) return s;
    let j = i + str.length;
    const pm = s.slice(j).match(/^(から|に|は|の)/);
    if (pm) j += pm[0].length;
    return s.slice(0, i) + s.slice(j);
  }

  function kanji(m) {
    const dig = { "〇": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
    if (m.indexOf("十") >= 0) {
      const p = m.split("十");
      const tens = p[0] === "" ? 1 : dig[p[0]];
      const ones = p[1] === "" ? 0 : dig[p[1]];
      return String(tens * 10 + ones);
    }
    return m.split("").map(c => dig[c]).join("");
  }

  // ---- 文章の解釈 ----
  function parse(raw) {
    let s = raw.replace(/\s+/g, "")
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 65248));
    s = s.replace(/([〇零一二三四五六七八九十]+)(?=月|日|時|分)/g, m => kanji(m));

    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let date = null;
    let m;

    if ((m = s.match(/明々後日|しあさって/))) date = addDays(base, 3);
    else if ((m = s.match(/明後日|あさって/))) date = addDays(base, 2);
    else if ((m = s.match(/明日|あした|あす/))) date = addDays(base, 1);
    else if ((m = s.match(/今日|きょう|本日/))) date = base;
    else if ((m = s.match(/(\d{1,2})日後/))) date = addDays(base, +m[1]);
    else if ((m = s.match(/(\d{1,2})月(\d{1,2})日/)) || (m = s.match(/(\d{1,2})[\/／](\d{1,2})/))) {
      let d = new Date(base.getFullYear(), +m[1] - 1, +m[2]);
      if (d < base) d = new Date(base.getFullYear() + 1, +m[1] - 1, +m[2]);
      date = d;
    }
    else if ((m = s.match(/(再来週|来週|今週)の?([日月火水木金土])曜日?/))) {
      const off = m[1] === "来週" ? 7 : m[1] === "再来週" ? 14 : 0;
      date = addDays(base, -base.getDay() + off + WD.indexOf(m[2]));
    }
    else if ((m = s.match(/([日月火水木金土])曜日?/))) {
      let diff = (WD.indexOf(m[1]) - base.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      date = addDays(base, diff);
    }
    else if ((m = s.match(/(\d{1,2})日/))) {
      let d = new Date(base.getFullYear(), base.getMonth(), +m[1]);
      if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, +m[1]);
      date = d;
    }

    if (date && m) s = cut(s, m[0]);
    if (!date) date = base;

    // 時刻
    let time = "";
    const tm = s.match(/(午前|午後|朝|昼|夕方|夜)?(\d{1,2})(?::(\d{2})|時(?!間)(?:(半)|(\d{1,2})分?)?)/);
    if (tm) {
      let h = +tm[2];
      const pre = tm[1];
      const mi = tm[3] ? +tm[3] : tm[4] ? 30 : tm[5] ? +tm[5] : 0;
      if (pre === "午後" || pre === "夕方" || pre === "夜") { if (h < 12) h += 12; }
      else if (pre === "午前" || pre === "朝") { if (h === 12) h = 0; }
      else if (pre === "昼") { if (h <= 4) h += 12; }
      else if (h >= 1 && h <= 6) { h += 12; }
      if (h < 24 && mi < 60) {
        time = pad(h) + ":" + pad(mi);
        s = cut(s, tm[0]);
      }
    }

    // 予定名
    s = s.replace(/(予定|スケジュール)(を|は)?/g, "");
    s = s.replace(/(?:を|は)?(?:入れて|いれて|入れといて|追加して|追加|登録して|登録|お願いします|お願い|ください)+$/, "");
    s = s.replace(/^(?:に|は|で|の|を|から|、|,|。)+/, "").replace(/(?:に|は|で|の|を|から|、|,|。)+$/, "");
    const title = s || "予定";

    return { date: date, time: time, title: title };
  }

  // ---- 音声認識 ----
  function start() {
    if (!SR) {
      show("このブラウザは音声入力に対応していません。Chromeで開いてください。\n（タップで閉じる）", false);
      return;
    }
    rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = function () {
      listening = true;
      fab.classList.add("on");
      show("🎤 聞いています…\n例：明日の15時に歯医者", false);
    };
    rec.onresult = function (e) {
      const text = e.results[0][0].transcript;
      const r = parse(text);
      vTitle.value = r.title;
      vDate.value = ymd(r.date);
      vTime.value = r.time;
      show("認識：「" + text + "」\n内容を確認して「追加」を押してください", true);
    };
    rec.onerror = function (e) {
      let msg = "音声認識に失敗しました（" + e.error + "）\n（タップで閉じる）";
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        msg = "マイクが許可されていません。\nChromeのアドレスバー左の鍵マーク → 権限 → マイクを許可してください。\n（タップで閉じる）";
      } else if (e.error === "no-speech") {
        msg = "声が聞こえませんでした。もう一度🎤を押してください。\n（タップで閉じる）";
      }
      show(msg, false);
    };
    rec.onend = function () {
      listening = false;
      fab.classList.remove("on");
    };
    try { rec.start(); } catch (e) {}
  }

  fab.onclick = function () {
    if (listening && rec) { rec.stop(); } else { start(); }
  };
  vMsg.onclick = function () {
    if (!vForm.classList.contains("show")) hide();
  };
  document.getElementById("vCancel").onclick = hide;

  document.getElementById("vAdd").onclick = function () {
    const title = vTitle.value.trim();
    const ds = vDate.value;
    if (!title || !ds) {
      vMsg.textContent = "予定名と日付を入れてください";
      return;
    }
    const p = ds.split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    const events = loadEvents();
    const k = key(d);
    if (!events[k]) events[k] = [];
    events[k].push({ id: Date.now(), title: title, time: vTime.value });
    saveEvents(events);
    current.setFullYear(d.getFullYear(), d.getMonth(), 1);
    render();
    hide();
  };
})();
