(function () {
  var fileInput = null;

  var style = document.createElement("style");
  style.textContent =
    "#pasteBtn { position: fixed; left: 144px; bottom: 20px; width: 56px; height: 56px;" +
    " border-radius: 50%; border: none; background: #3a3a3c; color: #fff; font-size: 24px;" +
    " box-shadow: 0 2px 10px rgba(0,0,0,.5); z-index: 5; }" +
    "#pasteCard { position: fixed; left: 0; right: 0; bottom: 0; background: #1c1c1e;" +
    " border-radius: 16px 16px 0 0; padding: 16px; z-index: 20;" +
    " transform: translateY(100%); transition: transform .2s; }" +
    "#pasteCard.open { transform: translateY(0); }" +
    "#pasteMsg { font-size: 13px; color: #bbb; margin-bottom: 8px; }" +
    "#pasteText { width: 100%; height: 160px; background: #2a2a2d; border: 1px solid #444;" +
    " border-radius: 8px; color: #eee; padding: 10px; font-size: 14px; margin-bottom: 10px; }" +
    ".prow { display: flex; gap: 8px; }" +
    ".prow button { flex: 1; border: none; border-radius: 8px; padding: 12px;" +
    " font-size: 15px; color: #fff; background: #444; }" +
    "#pasteGo { background: #4a9eff !important; }";
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "pasteBtn";
  btn.textContent = "✏️";
  var card = document.createElement("div");
  card.id = "pasteCard";
  card.innerHTML =
    '<div id="pasteMsg">CSVの中身を貼り付けてください（1行目は 日付,時刻,タイトル）</div>' +
    '<textarea id="pasteText" placeholder="2026-11-03,13:00,13:00-22:00"></textarea>' +
    '<div class="prow"><button id="pasteGo">取り込み</button>' +
    '<button id="pasteClose">閉じる</button></div>';
  document.body.appendChild(btn);
  document.body.appendChild(card);

  function closeOthers() {
    if (typeof closeSheet === "function") closeSheet();
    ["csvCard", "locCard"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove("open");
    });
  }

  btn.onclick = function () {
    closeOthers();
    card.classList.add("open");
  };
  document.getElementById("pasteClose").onclick = function () {
    card.classList.remove("open");
  };

  document.getElementById("pasteGo").onclick = function () {
    var text = document.getElementById("pasteText").value.trim();
    if (!text) return;
    fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) {
      document.getElementById("pasteMsg").textContent = "csv.js が読み込まれていません";
      return;
    }
    try {
      var dt = new DataTransfer();
      dt.items.add(new File([text], "paste.csv", { type: "text/csv" }));
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change"));
      document.getElementById("pasteText").value = "";
      card.classList.remove("open"); // 結果は📄のカードに表示されます
    } catch (e) {
      document.getElementById("pasteMsg").textContent = "取り込みに失敗しました";
    }
  };
})();