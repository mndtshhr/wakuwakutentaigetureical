(function () {
  if (typeof openSheet !== "function") return;

  var PI = Math.PI, rad = PI / 180, dayMs = 86400000;
  var J1970 = 2440588, J2000 = 2451545;
  var sin = Math.sin, cos = Math.cos, tan = Math.tan;
  var asin = Math.asin, atan2 = Math.atan2, sqrt = Math.sqrt;

  function pad(n) { return String(n).padStart(2, "0"); }
  function hm(t) { return pad(t.getHours()) + ":" + pad(t.getMinutes()); }
  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  function shift(y, m, d, n) {
    var t = new Date(Date.UTC(y, m - 1, d + n));
    return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  }
  function daysBetween(a, b) {
    return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / dayMs);
  }

  // =========================================================
  // 二十四節気・雑節（日本時間の日付で判定）
  // =========================================================
  function sunLon(ms) {
    var T = (ms / dayMs + 2440587.5 - J2000) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) +
            (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
    var om = (125.04 - 1934.136 * T) * rad;
    return norm360(L0 + C - 0.00569 - 0.00478 * sin(om));
  }
  function jstStart(y, m, d) { return Date.UTC(y, m - 1, d) - 9 * 3600000; }
  function lonStart(y, m, d) { return sunLon(jstStart(y, m, d)); }
  function lonEnd(y, m, d) { return sunLon(jstStart(y, m, d) + dayMs); }

  var TERMS = ["春分", "清明", "穀雨", "立夏", "小満", "芒種", "夏至", "小暑", "大暑",
               "立秋", "処暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
               "冬至", "小寒", "大寒", "立春", "雨水", "啓蟄"]; // 番号 = 黄経 / 15

  function termStartingOn(y, m, d) {
    var ka = Math.floor(lonStart(y, m, d) / 15);
    var kb = Math.floor(lonEnd(y, m, d) / 15);
    return ka !== kb ? kb % 24 : -1;
  }
  function crossesOn(y, m, d, deg) {
    var da = norm360(lonStart(y, m, d) - deg);
    var db = norm360(lonEnd(y, m, d) - deg);
    return da > 180 && db <= 180;
  }
  function risshun(y) {
    for (var dd = 2; dd <= 6; dd++) {
      if (termStartingOn(y, 2, dd) === 21) return [y, 2, dd];
    }
    return [y, 2, 4];
  }

  var DOYO = [[27, 45, "春"], [117, 135, "夏"], [207, 225, "秋"], [297, 315, "冬"]];
  function doyoType(y, m, d) {
    var b = lonEnd(y, m, d);
    for (var i = 0; i < 4; i++) {
      if (b >= DOYO[i][0] && b < DOYO[i][1]) return i;
    }
    return -1;
  }
  function branch(y, m, d) { // 0=子 1=丑 ...
    var jdn = Math.round(Date.UTC(y, m - 1, d) / dayMs) + J1970;
    return (((jdn + 1) % 12) + 12) % 12;
  }

  function termLine(y, m, d) {
    var k = termStartingOn(y, m, d);
    if (k >= 0) return "二十四節気「" + TERMS[k] + "」の日";
    var idx = Math.floor(lonEnd(y, m, d) / 15) % 24;
    var i, q, s = null, nx = null, nk = -1;
    for (i = 1; i <= 20; i++) {
      q = shift(y, m, d, -i);
      if (termStartingOn(q[0], q[1], q[2]) === idx) { s = q; break; }
    }
    for (i = 1; i <= 20; i++) {
      q = shift(y, m, d, i);
      nk = termStartingOn(q[0], q[1], q[2]);
      if (nk >= 0) { nx = q; break; }
    }
    var txt = "二十四節気：" + TERMS[idx];
    if (s) txt += "（" + s[1] + "/" + s[2] + "〜）";
    if (nx) txt += "　次は" + TERMS[nk] + " " + nx[1] + "/" + nx[2];
    return txt;
  }

  function zassetsuList(y, m, d) {
    var out = [];
    var t1 = shift(y, m, d, 1);
    if (termStartingOn(t1[0], t1[1], t1[2]) === 21) out.push("節分");

    var n = daysBetween([y, m, d], risshun(y));
    if (n === 87) out.push("八十八夜");
    if (n === 209) out.push("二百十日");
    if (n === 219) out.push("二百二十日");

    if (crossesOn(y, m, d, 80)) out.push("入梅");
    if (crossesOn(y, m, d, 100)) out.push("半夏生");

    for (var off = -3; off <= 3; off++) {
      var q = shift(y, m, d, off);
      var k = termStartingOn(q[0], q[1], q[2]);
      if (k === 0 || k === 12) {
        var season = k === 0 ? "春" : "秋";
        if (off === 3) out.push(season + "の彼岸入り");
        else if (off === 0) out.push(season + "の彼岸 中日（" + TERMS[k] + "）");
        else if (off === -3) out.push(season + "の彼岸明け");
        else out.push(season + "の彼岸");
        break;
      }
    }

    var dt = doyoType(y, m, d);
    if (dt >= 0) {
      var pv = shift(y, m, d, -1), nt = shift(y, m, d, 1);
      var pt = doyoType(pv[0], pv[1], pv[2]);
      var nn = doyoType(nt[0], nt[1], nt[2]);
      var nm = DOYO[dt][2] + "の土用";
      if (pt !== dt) out.push(nm + "入り");
      else if (nn !== dt) out.push(nm + "明け");
      else out.push(nm + "（期間中）");
      if (dt === 1 && branch(y, m, d) === 1) {
        var p12 = shift(y, m, d, -12);
        out.push("土用の丑の日（" + (doyoType(p12[0], p12[1], p12[2]) === 1 ? "二の丑" : "一の丑") + "）");
      }
    }
    return out;
  }

  // =========================================================
  // 日の出入り・月の出入り
  // =========================================================
  var OBL = rad * 23.4397;
  function rightAscension(l, b) { return atan2(sin(l) * cos(OBL) - tan(b) * sin(OBL), cos(l)); }
  function declination(l, b) { return asin(sin(b) * cos(OBL) + cos(b) * sin(OBL) * sin(l)); }
  function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }
  function astroRefraction(h) {
    if (h < 0) h = 0;
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
  }
  function toDays(date) { return date.valueOf() / dayMs - 0.5 + J1970 - J2000; }
  function hoursLater(t, h) { return new Date(t.valueOf() + h * dayMs / 24); }

  function sunCoords(d) {
    var M = rad * (357.5291 + 0.98560028 * d);
    var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M));
    var L = M + C + rad * 102.9372 + PI;
    return { ra: rightAscension(L, 0), dec: declination(L, 0) };
  }
  function moonCoords(d) {
    var L = rad * (218.316 + 13.176396 * d);
    var M = rad * (134.963 + 13.064993 * d);
    var F = rad * (93.272 + 13.229350 * d);
    var l = L + rad * 6.289 * sin(M);
    var b = rad * 5.128 * sin(F);
    return { ra: rightAscension(l, b), dec: declination(l, b) };
  }
  function bodyAlt(coordsFn, date, lat, lng, refr) {
    var d = toDays(date), lw = rad * -lng, phi = rad * lat, c = coordsFn(d);
    var H = siderealTime(d, lw) - c.ra;
    var h = asin(sin(phi) * sin(c.dec) + cos(phi) * cos(c.dec) * cos(H));
    return refr ? h + astroRefraction(h) : h;
  }

  // 2時間ごとの高度から2次曲線で地平線との交点を探す
  function riseSet(altFn, t, hc) {
    var h0 = altFn(t) - hc, h1, h2, rise = null, set = null;
    var a, b, xe, ye, dd, roots, x1, x2, dx;
    for (var i = 1; i <= 24; i += 2) {
      h1 = altFn(hoursLater(t, i)) - hc;
      h2 = altFn(hoursLater(t, i + 1)) - hc;
      a = (h0 + h2) / 2 - h1;
      b = (h2 - h0) / 2;
      xe = -b / (2 * a);
      ye = (a * xe + b) * xe + h1;
      dd = b * b - 4 * a * h1;
      roots = 0;
      if (dd >= 0) {
        dx = sqrt(dd) / (Math.abs(a) * 2);
        x1 = xe - dx;
        x2 = xe + dx;
        if (Math.abs(x1) <= 1) roots++;
        if (Math.abs(x2) <= 1) roots++;
        if (x1 < -1) x1 = x2;
      }
      if (roots === 1) {
        if (h0 < 0) rise = i + x1; else set = i + x1;
      } else if (roots === 2) {
        rise = i + (ye < 0 ? x2 : x1);
        set = i + (ye < 0 ? x1 : x2);
      }
      if (rise !== null && set !== null) break;
      h0 = h2;
    }
    return {
      rise: rise !== null ? hoursLater(t, rise) : null,
      set: set !== null ? hoursLater(t, set) : null
    };
  }

  function sunLine(d, loc) {
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    var r = riseSet(function (dt) { return bodyAlt(sunCoords, dt, loc.lat, loc.lon, false); }, t, -0.833 * rad);
    var txt = "🌅 日の出 " + (r.rise ? hm(r.rise) : "—") + " ／ 日の入 " + (r.set ? hm(r.set) : "—");
    if (r.rise && r.set) {
      var mins = Math.round((r.set - r.rise) / 60000);
      txt += "（昼 " + Math.floor(mins / 60) + "時間" + (mins % 60) + "分）";
    }
    return txt;
  }
  function moonLine(d, loc) {
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    var r = riseSet(function (dt) { return bodyAlt(moonCoords, dt, loc.lat, loc.lon, true); }, t, 0.133 * rad);
    return "🌙 月の出 " + (r.rise ? hm(r.rise) : "—") + " ／ 月の入 " + (r.set ? hm(r.set) : "—");
  }

  // =========================================================
  // 惑星（近似軌道要素 JPL / 1800-2050）
  // [a, a', e, e', I, I', L, L', 近日点経度, 同', 昇交点経度, 同']
  // =========================================================
  var EL = {
    mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
    venus:   [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
    earth:   [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0],
    mars:    [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
    jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
    saturn:  [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794]
  };

  function helio(el, T) {
    var a = el[0] + el[1] * T;
    var e = el[2] + el[3] * T;
    var I = (el[4] + el[5] * T) * rad;
    var L = el[6] + el[7] * T;
    var wb = el[8] + el[9] * T;
    var O = (el[10] + el[11] * T) * rad;
    var w = wb * rad - O;
    var M = ((L - wb) % 360) * rad;
    var E = M;
    for (var i = 0; i < 15; i++) E = M + e * sin(E);
    var xp = a * (cos(E) - e);
    var yp = a * sqrt(1 - e * e) * sin(E);
    var cw = cos(w), sw = sin(w), cO = cos(O), sO = sin(O), cI = cos(I), sI = sin(I);
    return [
      (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
      (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
      (sw * sI) * xp + (cw * sI) * yp
    ];
  }

  function geoAt(name, y, m, d, hour) {
    var ms = new Date(y, m - 1, d, hour === undefined ? 12 : hour).getTime();
    var T = (ms / dayMs + 2440587.5 - J2000) / 36525;
    var p = helio(EL[name], T), ea = helio(EL.earth, T);
    var g = [p[0] - ea[0], p[1] - ea[1], p[2] - ea[2]];
    var s = [-ea[0], -ea[1], -ea[2]];
    var dot = g[0] * s[0] + g[1] * s[1] + g[2] * s[2];
    var c = dot / (sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) * sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]));
    c = Math.max(-1, Math.min(1, c));
    var lamP = atan2(g[1], g[0]) / rad, lamS = atan2(s[1], s[0]) / rad;
    return { elong: Math.acos(c) / rad, diff: norm360(lamP - lamS) }; // diff<180 → 太陽の東側(宵)
  }

  function planetLine(y, m, d) {
    var names = { mercury: "水星", venus: "金星", mars: "火星", jupiter: "木星", saturn: "土星" };
    var p = shift(y, m, d, -1), n = shift(y, m, d, 1);
    var out = [];

    ["venus", "mercury"].forEach(function (k) {
      var g = geoAt(k, y, m, d);
      if (g.elong < (k === "venus" ? 20 : 15)) return;
      var eve = g.diff < 180;
      var txt = names[k];
      if (k === "venus") txt += eve ? " 宵の明星" : " 明けの明星";
      else txt += eve ? " 宵の西空" : " 明けの東空";
      txt += "（離角" + Math.round(g.elong) + "°）";
      var gp = geoAt(k, p[0], p[1], p[2]), gn = geoAt(k, n[0], n[1], n[2]);
      if (g.elong >= gp.elong && g.elong > gn.elong) txt += " 最大離角";
      out.push(txt);
    });

    ["mars", "jupiter", "saturn"].forEach(function (k) {
      var g0 = geoAt(k, y, m, d, 0), g1 = geoAt(k, n[0], n[1], n[2], 0);
      var g = geoAt(k, y, m, d);
      if (g0.diff < 180 && g1.diff >= 180 && g1.diff - g0.diff < 90) {
        out.push(names[k] + " 衝（真夜中に南中・一晩中見える）");
      } else if (g.elong >= 120) {
        out.push(names[k] + " 見頃（夜遅くまで見える）");
      }
    });

    return out.length ? "🪐 " + out.join(" ／ ") : "🪐 見頃の惑星：なし";
  }

  // =========================================================
  // シートへの表示
  // =========================================================
  var style = document.createElement("style");
  style.textContent =
    "#sheetAstro { margin: 6px 0 12px; padding: 8px 10px; background: #242427;" +
    " border-radius: 8px; font-size: 13px; line-height: 1.7; color: #ccc; }" +
    "#sheetAstro .hl { color: #ffd479; font-weight: bold; }" +
    "#sheetAstro .fr { color: #8fd3ff; }";
  document.head.appendChild(style);

  function ensureBox() {
    var box = document.getElementById("sheetAstro");
    if (box) return box;
    box = document.createElement("div");
    box.id = "sheetAstro";
    var anchor = document.getElementById("sheetWx");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else document.getElementById("sheet").appendChild(box);
    return box;
  }

  function add(box, text, cls) {
    var div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = text;
    box.appendChild(div);
  }

  function fill(d) {
    var box = ensureBox();
    box.innerHTML = "";
    var y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
    var loc = (typeof loadLoc === "function" && loadLoc()) || { lat: 35.68, lon: 139.69 };

    try { add(box, "🌾 " + termLine(y, m, dd)); } catch (e) { add(box, "🌾 節気の計算に失敗しました"); }
    try {
      var z = zassetsuList(y, m, dd);
      if (z.length) add(box, "🌾 雑節：" + z.join("、"), "hl");
    } catch (e) {}

    try {
      var key = y + "-" + pad(m) + "-" + pad(dd);
      var w = (typeof weather !== "undefined") ? weather[key] : null;
      if (w && w.min != null) {
        var mn = Math.round(w.min);
        if (w.min <= 0) add(box, "❄️ 霜・凍結に警戒（予想最低 " + mn + "°）", "fr");
        else if (w.min <= 3) add(box, "❄️ 霜に注意（予想最低 " + mn + "°／地表は気温より低くなりがち）", "fr");
        else if (w.min <= 5 && (w.code === 0 || w.code === 1)) add(box, "❄️ 晴れて冷え込む夜。放射冷却に注意（予想最低 " + mn + "°）", "fr");
      }
    } catch (e) {}

    try { add(box, sunLine(d, loc)); } catch (e) { add(box, "🌅 日の出入りの計算に失敗しました"); }
    try { add(box, moonLine(d, loc)); } catch (e) { add(box, "🌙 月の出入りの計算に失敗しました"); }
    try { add(box, planetLine(y, m, dd)); } catch (e) { add(box, "🪐 惑星の計算に失敗しました"); }
  }

  var origOpen = openSheet;
  openSheet = function (d) {
    origOpen(d);
    try { fill(d); } catch (e) {}
  };
})();
