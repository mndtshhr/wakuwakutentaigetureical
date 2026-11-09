(function () {
  if (typeof render !== "function") return;

  // ★ マークの大きさはここを変えるだけ（px）
  var ICON_SIZE = 24;

  var weather = {};
  var origRender = render;
  var origOpenSheet = typeof openSheet === "function" ? openSheet : null;

  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function wxInfo(code) {
    if (code === 0) return ["☀️", "快晴"];
    if (code === 1) return ["🌤️", "晴れ"];
    if (code === 2) return ["⛅", "くもり時々晴れ"];
    if (code === 3) return ["☁️", "くもり"];
    if (code === 45 || code === 48) return ["🌫️", "霧"];
    if (code >= 51 && code <= 57) return ["🌦️", "霧雨"];
    if (code >= 61 && code <= 67) return ["🌧️", "雨"];
    if (code >= 71 && code <= 77) return ["🌨️", "雪"];
    if (code >= 80 && code <= 82) return ["🌦️", "にわか雨"];
    if (code === 85 || code === 86) return ["🌨️", "にわか雪"];
    if (code >= 95) return ["⛈️", "雷雨"];
    return ["❓", "不明"];
  }

  // ---- 見た目 ----
  var style = document.createElement("style");
  style.textContent =
    ".wxbig { display: flex; align-items: center; gap: 2px; margin-top: 1px; white-space: nowrap; }" +
    ".wxbig .wi { font-size: " + ICON_SIZE + "px; line-height: 1; }" +
    ".wxbig .wt { font-size: 11px; color: #ccc; }" +
    "#locBtn { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);" +
    " width: 44px; height: 44px; border-radius: 50%; border: none; background: #3a3a3c;" +
    " color: #fff; font-size: 20px; box-shadow: 0 2px 10px rgba(0,0,0,.5); z-index: 5; }";
  document.head.appendChild(style);

  var locBtn = document.createElement("button");
  locBtn.id = "locBtn";
  locBtn.textContent = "📍";
  document.body.appendChild(locBtn);

  // ---- 各マスに天気を重ねる ----
  function decorate() {
    try {
      var grid = document.getElementById("grid");
      if (!grid) return;
      var year = current.getFullYear();
      var month = current.getMonth();
      var offset = new Date(year, month, 1).getDay();
      var cells = grid.children;
      for (var i = 0; i < cells.length; i++) {
        var d = new Date(year, month, 1 - offset + i);
        var w = weather[ymd(d)];
        if (!w) continue;
        var box = document.createElement("div");
        box.className = "wxbig";
        var ic = document.createElement("span");
        ic.className = "wi";
        ic.textContent = wxInfo(w.code)[0];
        var tp = document.createElement("span");
        tp.className = "wt";
        tp.textContent = Math.round(w.max) + "°";
        box.appendChild(ic);
        box.appendChild(tp);
        var top = cells[i].querySelector(".top");
        if (top && top.nextSibling) cells[i].insertBefore(box, top.nextSibling);
        else cells[i].appendChild(box);
      }
    } catch (e) {}
  }

  render = function () {
    origRender();
    decorate();
  };

  // ---- 予定シートにも天気を表示 ----
  if (origOpenSheet) {
    openSheet = function (d) {
      origOpenSheet(d);
      try {
        var el = document.getElementById("sheetMoon");
        var w = weather[ymd(d)];
        if (el && w) {
          var info = wxInfo(w.code);
          el.textContent += "\n" + info[0] + " " + info[1] + "　" +
            Math.round(w.max) + "° / " + Math.round(w.min) + "°" +
            (w.pop != null ? "　降水 " + w.pop + "%" : "");
          el.style.whiteSpace = "pre-line";
        }
      } catch (e) {}
    };
  }

  // ---- 天気の取得 ----
  var DEFAULT_LOC = { lat: 35.68, lon: 139.69 }; // 東京

  function getPosition() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        function (p) { resolve({ lat: p.coords.latitude, lon: p.coords.longitude }); },
        function () { resolve(null); },
        { timeout: 10000, maximumAge: 600000 }
      );
    });
  }

  function apply(data) {
    weather = {};
    var d = data.daily;
    for (var i = 0; i < d.time.length; i++) {
      weather[d.time[i]] = {
        code: d.weather_code[i],
        max: d.temperature_2m_max[i],
        min: d.temperature_2m_min[i],
        pop: d.precipitation_probability_max[i]
      };
    }
    render();
  }

  async function load(force) {
    var loc = null;
    try { loc = JSON.parse(localStorage.getItem("loc") || "null"); } catch (e) {}
    if (force || !loc) {
      var pos = await getPosition();
      loc = pos || loc || DEFAULT_LOC;
      localStorage.setItem("loc", JSON.stringify(loc));
    }

    try {
      var c = JSON.parse(localStorage.getItem("wx") || "null");
      if (c && !force &&
          Math.abs(c.lat - loc.lat) < 0.01 && Math.abs(c.lon - loc.lon) < 0.01 &&
          Date.now() - c.t < 3 * 3600 * 1000) {
        apply(c.data);
        return;
      }
    } catch (e) {}

    var url = "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + loc.lat.toFixed(3) +
      "&longitude=" + loc.lon.toFixed(3) +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=auto&past_days=3&forecast_days=16";
    try {
      var res = await fetch(url);
      var data = await res.json();
      if (!data.daily) return;
      localStorage.setItem("wx", JSON.stringify({ t: Date.now(), lat: loc.lat, lon: loc.lon, data: data }));
      apply(data);
    } catch (e) {
      try {
        var old = JSON.parse(localStorage.getItem("wx") || "null");
        if (old) apply(old.data);
      } catch (e2) {}
    }
  }

  locBtn.onclick = function () { load(true); };
  load(false);
})();
