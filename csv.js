(function () {
  // ---- 見た目 ----
  const style = document.createElement("style");
  style.textContent = `
    #csvBtn { position: fixed; left: 16px; bottom: 20px; width: 56px; height: 56px;
      border-radius: 50%; border: none; background: #3a3a3c; color: #fff; font-size: 24px;
      box-shadow: 0 2px 10px rgba(0,0,0,.5); z-index: 5; }
    #csvCard { position: fixed; left: 0; right: 0; bottom: 0; background: #1c1c1e;
      border-radius: 16px 16px 0 0; padding: 16px; z-index: 20;
      transform: translateY(100%); transition: transform .2s; }
    #csvCard.open { transform: translateY(0); }
    #csvMsg { font-size: 13px; color: #bbb; white-space: pre-line; margin-bottom: 12px; }
    .crow { display: flex; gap: 8px; }
    .crow button { flex: 1; border: none; border-radius: 8px; padding: 12px;
      font-size: 15px; color: #fff; background: #444; }
    #csvOut { background: #2f7d4f !important; }
    #csvIn { background: #4a9eff !important; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.id = "csvBtn";
  btn.textContent = "📄";
  const card = document.createElement("div");
  card.id = "csvCard";
  card.innerHTML = `
    <div id="csvMsg"></div>
    <div class="crow">
      <button id="csvOut">⬇ 書き出し</button>
      <button id="csvIn">⬆ 取り込み</button>
      <button id="csvClose">閉じる</button>
    </div>`;
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".csv,text/csv,text/plain,application/vnd.ms-excel";
  file.style.display = "none";
  document.body.appendChild(btn);
  document.body.appendChild(card);
  document.body.appendChild(file);

  const msg = document.getElementById("csvMsg");
  const HELP = "CSVの形式：日付,時刻,タイトル\n例：2026-12-03,15:00,歯医者\n（時刻は空でもOK）";

  function openCard(text) {
    msg.textContent = text || HELP;
    card.classList.add("open");
  }
  btn.onclick = function () { openCard(); };
  document.getElementById("csvClose").onclick = function () {
    card.classList.remove("open");
  };

  function pad(n) { return String(n).padStart(2, "0"); }

  // ---- 書き出し ----
  function esc(s) {
    s = String(s == null ? "" : s);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  document.getElementById("csvOut").onclick = function () {
    const events = loadEvents();
    const keys = Object.keys(events).sort();
    const rows = [["日付", "時刻", "タイトル"]];
    keys.forEach(function (k) {
      events[k]
        .slice()
        .sort(function (a, b) { return (a.time || "99:99").localeCompare(b.time || "99:99"); })
        .forEach(function (ev) { rows.push([k, ev.time || "", ev.title]); });
    });
    if (rows.length === 1) {
      openCard("書き出す予定がありません。\n\n" + HELP);
      return;
    }
    const text = "\uFEFF" + rows.map(function (r) { return r.map(esc).join(","); }).join("\r\n");
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const a = document.createElement("a");
    a.href = url;
    a.download = "calendar_" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    openCard((rows.length - 1) + "件を書き出しました。\nダウンロードフォルダを確認してください。");
  };

  // ---- 取り込み ----
  document.getElementById("csvIn").onclick = function () { file.click(); };

  function decode(buf) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch (e) {
      try { return new TextDecoder("shift_jis").decode(buf); }
      catch (e2) { return new TextDecoder("utf-8").decode(buf); }
    }
  }

  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else { q = false; }
        } else { cell += c; }
      } else if (c === '"') { q = true; }
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
        row = [];
      } else { cell += c; }
    }
    row.push(cell);
    if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
    return rows;
  }

  const DATE_RE = /(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/;
  const TIME_RE = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?/;

  function parseDate(s) {
    const m = String(s || "").match(DATE_RE);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return y + "-" + pad(mo) + "-" + pad(d);
  }
  function parseTime(s) {
    const m = String(s || "").match(TIME_RE);
    if (!m) return "";
    let h = +m[1];
    const mi = +m[2];
    const ap = m[3] ? m[3].toLowerCase() : "";
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h > 23 || mi > 59) return "";
    return pad(h) + ":" + pad(mi);
  }

  const ALIASES = {
    date: ["date", "日付", "開始日", "start date", "startdate", "start"],
    time: ["time", "時刻", "時間", "開始時刻", "start time", "starttime"],
    title: ["title", "タイトル", "件名", "予定", "予定名", "subject", "summary", "name"]
  };
  function findCol(header, names) {
    for (let i = 0; i < header.length; i++) {
      if (names.indexOf(header[i].trim().toLowerCase()) >= 0) return i;
    }
    return -1;
  }

  file.onchange = function () {
    const f = file.files && file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const rows = parseCSV(decode(reader.result));
        if (rows.length === 0) { openCard("CSVが空でした。\n\n" + HELP); return; }

        let iDate = findCol(rows[0], ALIASES.date);
        let iTime = findCol(rows[0], ALIASES.time);
        let iTitle = findCol(rows[0], ALIASES.title);
        let body;
        if (iDate >= 0 && iTitle >= 0) {
          body = rows.slice(1);          // 1行目はヘッダー
        } else {
          iDate = 0; iTime = 1; iTitle = 2;   // ヘッダーなし：日付,時刻,タイトル
          body = parseDate(rows[0][0]) ? rows : rows.slice(1);
        }

        const events = loadEvents();
        let added = 0, dup = 0, bad = 0, firstKey = null;
        body.forEach(function (r) {
          const k = parseDate(r[iDate]);
          const title = (r[iTitle] || "").trim();
          if (!k || !title) { bad++; return; }
          let time = iTime >= 0 ? parseTime(r[iTime]) : "";
          if (!time) time = parseTime(r[iDate]);
          if (!events[k]) events[k] = [];
          const exists = events[k].some(function (e) {
            return e.title === title && (e.time || "") === time;
          });
          if (exists) { dup++; return; }
          events[k].push({ id: Date.now() * 1000 + added, title: title, time: time });
          if (!firstKey) firstKey = k;
          added++;
        });

        if (added > 0) {
          saveEvents(events);
          const p = firstKey.split("-").map(Number);
          current.setFullYear(p[0], p[1] - 1, 1);
          render();
        }
        openCard(added + "件を追加しました。" +
          (dup ? "\n重複 " + dup + "件はスキップ。" : "") +
          (bad ? "\n読み取れない行 " + bad + "件はスキップ。" : "") +
          (added === 0 && bad ? "\n\n" + HELP : ""));
      } catch (e) {
        openCard("取り込みに失敗しました。\n\n" + HELP);
      }
      file.value = "";
    };
    reader.readAsArrayBuffer(f);
  };
})();
