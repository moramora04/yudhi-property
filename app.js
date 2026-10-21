var HOUSES = [
  { id: 1, name: "Rumah Tanjung Gusta", area: "Tanjung Gusta, Medan", lat: 3.6152808, lon: 98.610141,
    maps: "https://maps.app.goo.gl/nSZEM4FFiYhYMwt67",
    price: 264, lt: null, lb: null, kt: null, km: null, sert: "SHM",
    photos: ["foto/1.jpg", "foto/2.jpg", "foto/3.jpg", "foto/4.jpg"],
    captions: ["Tampak depan dengan pagar besi", "Teras dan pintu masuk", "Ruang dalam", "Kamar"] },
  { id: 2, name: "Rumah Klambir Lima", area: "Jl. Klambir Lima, Hamparan Perak", lat: 3.6571819, lon: 98.5922379,
    maps: "https://maps.app.goo.gl/cu2UQrAxvZEttUaY9",
    price: null, lt: null, lb: null, kt: null, km: null, sert: null,
    photos: [], captions: [] }
];

var NS = "http://www.w3.org/2000/svg";
var LAT0 = 3.62, COS = Math.cos(LAT0 * Math.PI / 180), S = 1000;
function px(lon) { return (lon - 98.6) * S * COS; }
function py(lat) { return (LAT0 - lat) * S; }

var svg = document.getElementById("svg"), world = document.getElementById("world");
var gLabels = document.getElementById("labels"), gTicks = document.getElementById("ticks"), gPins = document.getElementById("pins");
var mapEl = document.getElementById("map"), pop = document.getElementById("pop");
var view = { k: 1, tx: 0, ty: 0 }, W = 0, H = 0;
var KEC = [], selected = null, shot = {};

function node(tag, attrs, parent) {
  var n = document.createElementNS(NS, tag);
  for (var a in attrs) n.setAttribute(a, attrs[a]);
  if (parent) parent.appendChild(n);
  return n;
}
function el(tag, attrs, text) {
  var n = document.createElement(tag);
  for (var a in attrs) n.setAttribute(a, attrs[a]);
  if (text != null) n.textContent = text;
  return n;
}
function find(id) { for (var i = 0; i < HOUSES.length; i++) if (HOUSES[i].id === id) return HOUSES[i]; }
function inRing(x, y, r) {
  var c = false;
  for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
    var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function buildWorld() {
  world.textContent = "";
  var used = {};
  HOUSES.forEach(function (h) {
    KEC.forEach(function (k, i) {
      if (k.rings.some(function (r) { return inRing(h.lon, h.lat, r); })) { h.kec = k.kec; h.kab = k.kab; used[i] = true; }
    });
  });
  KEC.forEach(function (k, i) {
    var d = k.rings.map(function (r) {
      return "M" + r.map(function (p) { return px(p[0]).toFixed(1) + " " + py(p[1]).toFixed(1); }).join("L") + "Z";
    }).join("");
    node("path", { d: d, "class": "kec" + (k.kab === "Kota Medan" ? " city" : "") + (used[i] ? " has" : "") }, world);
    var big = k.rings.reduce(function (a, b) { return b.length > a.length ? b : a; });
    var sx = 0, sy = 0, minx = Infinity, maxx = -Infinity;
    big.forEach(function (p) { sx += p[0]; sy += p[1]; minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); });
    k.cx = px(sx / big.length); k.cy = py(sy / big.length); k.w = (maxx - minx) * S * COS;
  });
  for (var lo = 98.45; lo <= 98.8001; lo += 0.05) node("line", { "class": "grat", x1: px(lo), x2: px(lo), y1: py(3.85), y2: py(3.4) }, world);
  for (var la = 3.45; la <= 3.8501; la += 0.05) node("line", { "class": "grat", x1: px(98.4), x2: px(98.85), y1: py(la), y2: py(la) }, world);
  document.getElementById("nKec").textContent = Object.keys(used).length;
}

function sx(x) { return x * view.k + view.tx; }
function sy(y) { return y * view.k + view.ty; }
function apply() {
  var tf = "translate(" + view.tx + " " + view.ty + ") scale(" + view.k + ")";
  world.setAttribute("transform", tf);
  document.getElementById("roadsW").setAttribute("transform", tf);
  drawLabels(); drawRoadLabels(); drawPois(); drawTicks(); drawPins(); drawScale();
}
function drawLabels() {
  gLabels.textContent = "";
  KEC.forEach(function (k) {
    if (!k.kec || k.w * view.k < 70) return;
    var x = sx(k.cx), y = sy(k.cy);
    if (x < -50 || x > W + 50 || y < -20 || y > H + 20) return;
    node("text", { "class": "klabel", x: x, y: y }, gLabels).textContent = k.kec;
  });
}
function drawTicks() {
  gTicks.textContent = "";
  for (var lo = 98.45; lo <= 98.8001; lo += 0.05) {
    var x = sx(px(lo)); if (x < 60 || x > W - 70) continue;
    node("text", { "class": "tick", x: x + 3, y: H - 40 }, gTicks).textContent = lo.toFixed(2) + "°BT";
  }
  for (var la = 3.45; la <= 3.8501; la += 0.05) {
    var y = sy(py(la)); if (y < 150 || y > H - 60) continue;
    node("text", { "class": "tick", x: W - 62, y: y - 4 }, gTicks).textContent = la.toFixed(2) + "°LU";
  }
}
function label(h) { return h.price ? (h.price >= 1000 ? "Rp " + (h.price / 1000).toLocaleString("id-ID") + " M" : "Rp " + h.price + " jt") : "Dijual"; }
function drawPins() {
  gPins.textContent = "";
  var order = HOUSES.slice().sort(function (a, b) { return ((a.id === selected) - (b.id === selected)) || (b.lat - a.lat); });
  order.forEach(function (h) {
    var x = sx(px(h.lon)), y = sy(py(h.lat));
    var g = node("g", { "class": "pin" + (h.id === selected ? " on" : ""), tabindex: "0", role: "button", "aria-label": h.name + ", " + label(h) }, gPins);
    if (h.id === selected) node("circle", { "class": "halo", cx: x, cy: y, r: 16 }, g);
    var txt = label(h), w = txt.length * 7.2 + 18;
    node("rect", { "class": "tag", x: x - w / 2, y: y - 40, width: w, height: 26, rx: 13 }, g);
    node("path", { "class": "stem", d: "M" + (x - 6) + " " + (y - 15) + "L" + x + " " + (y - 4) + "L" + (x + 6) + " " + (y - 15) + "Z" }, g);
    node("circle", { "class": "stem", cx: x, cy: y, r: 5 }, g);
    node("circle", { "class": "core", cx: x, cy: y, r: 2 }, g);
    node("text", { "class": "tagtext", x: x, y: y - 23, "text-anchor": "middle" }, g).textContent = txt;
    g.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    g.addEventListener("click", function () { select(h.id, false); });
    g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(h.id, false); } });
  });
}
function drawScale() {
  var kmPerPx = 111.32 / (S * view.k);
  var steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20], km = steps[0];
  steps.forEach(function (s) { if (s / kmPerPx <= 120) km = s; });
  document.getElementById("scaleBar").style.width = (km / kmPerPx) + "px";
  document.getElementById("scaleTxt").textContent = km < 1 ? Math.round(km * 1000) + " m" : km + " km";
}

function fitHouses() {
  if (!W) return;
  var xs = HOUSES.map(function (h) { return px(h.lon); }), ys = HOUSES.map(function (h) { return py(h.lat); });
  var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
  var half = Math.max(x1 - x0, y1 - y0, 60) / 2 + 45;
  var k = Math.max(0.15, Math.min(W, H) / (half * 2));
  view.k = k; view.tx = W / 2 - (x0 + x1) / 2 * k; view.ty = H / 2 - (y0 + y1) / 2 * k + 15;
  apply();
}
function zoomAt(f, x, y) {
  var nk = Math.max(0.15, Math.min(view.k * f, 80)); f = nk / view.k;
  view.tx = x - (x - view.tx) * f; view.ty = y - (y - view.ty) * f; view.k = nk; apply();
}
function resize() {
  var r = mapEl.getBoundingClientRect(), ow = W, oh = H;
  W = r.width; H = r.height;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  if (ow) { view.tx += (W - ow) / 2; view.ty += (H - oh) / 2; apply(); }
}

var pts = {};
svg.addEventListener("pointerdown", function (e) {
  svg.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; svg.classList.add("drag");
});
svg.addEventListener("pointermove", function (e) {
  if (!pts[e.pointerId]) return;
  var ids = Object.keys(pts), prev = pts[e.pointerId];
  if (ids.length === 1) {
    view.tx += e.clientX - prev.x; view.ty += e.clientY - prev.y;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY }; apply();
  } else if (ids.length === 2) {
    var o = pts[ids[0] == e.pointerId ? ids[1] : ids[0]];
    var d0 = Math.hypot(prev.x - o.x, prev.y - o.y);
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y), r = mapEl.getBoundingClientRect();
    if (d0 > 0) zoomAt(d1 / d0, (e.clientX + o.x) / 2 - r.left, (e.clientY + o.y) / 2 - r.top);
  }
});
function up(e) { delete pts[e.pointerId]; if (!Object.keys(pts).length) svg.classList.remove("drag"); }
svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
svg.addEventListener("wheel", function (e) {
  e.preventDefault(); var r = mapEl.getBoundingClientRect();
  zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
document.getElementById("zin").onclick = function () { zoomAt(1.6, W / 2, H / 2); };
document.getElementById("zout").onclick = function () { zoomAt(1 / 1.6, W / 2, H / 2); };
document.getElementById("zfit").onclick = fitHouses;

function specs(h) {
  return [
    ["Luas tanah", h.lt ? h.lt + " m²" : null], ["Luas bangunan", h.lb ? h.lb + " m²" : null],
    ["Kamar tidur", h.kt ? String(h.kt) : null], ["Kamar mandi", h.km ? String(h.km) : null],
    ["Sertifikat", h.sert], ["Kecamatan", h.kec || null]
  ];
}
var AGENT = "Yudhi Property", AGENT_WA = "089691757802", PERK = "FREE AJB & Balik Nama";
function waIntl(n) { n = String(n).replace(/\D/g, ""); return n.charAt(0) === "0" ? "62" + n.slice(1) : n; }
function waNice(n) { n = String(n).replace(/\D/g, ""); return n.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3"); }
function waLink(h, n) { return "https://wa.me/" + waIntl(n || AGENT_WA) + "?text=" + encodeURIComponent("Halo " + AGENT + ", saya tertarik dengan " + h.name + " (" + h.area + ")."); }
function priceText(h) { return h.price ? "Rp " + h.price.toLocaleString("id-ID") + " juta" : "Harga: hubungi " + AGENT; }
function photoBlock(h, parent, big) {
  var cur = shot[h.id] || 0;
  if (!h.photos.length) { parent.appendChild(el("div", { "class": "nophoto" }, "Foto menyusul")); return; }
  var im = el("img", { "class": big ? "hero" : "img", src: h.photos[cur], alt: (h.captions[cur] || "Foto") + ", " + h.name });
  im.onerror = function () { var d = el("div", { "class": "nophoto" }, "Foto menyusul"); if (im.parentNode) im.parentNode.replaceChild(d, im); };
  parent.appendChild(im);
}
function renderPop() {
  pop.textContent = "";
  if (selected === null) { pop.hidden = true; return; }
  var h = find(selected), cur = shot[h.id] || 0;
  pop.hidden = false;
  var x = el("button", { "class": "x", type: "button", "aria-label": "Tutup" }, "×");
  x.onclick = function () { select(null); };
  pop.appendChild(x);
  photoBlock(h, pop, true);
  if (h.photos.length > 1) {
    var th = el("div", { "class": "thumbs" });
    h.photos.forEach(function (src, i) {
      var b = el("button", { "class": "thumb", type: "button", "aria-pressed": String(i === cur), "aria-label": h.captions[i] });
      b.appendChild(el("img", { src: src, alt: "" }));
      b.onclick = function () { shot[h.id] = i; renderPop(); };
      th.appendChild(b);
    });
    pop.appendChild(th);
  }
  var body = el("div", { "class": "pbody" }), head = el("div", {});
  head.appendChild(el("h2", { "class": "pname" }, h.name));
  head.appendChild(el("p", { "class": "place" }, h.area + (h.kab ? " · " + h.kab : "")));
  body.appendChild(head);
  var pr = el("div", { "class": "price" + (h.price ? "" : " ask") });
  pr.appendChild(el("b", {}, priceText(h)));
  if (h.price) pr.appendChild(el("span", {}, "nego"));
  body.appendChild(pr);
  body.appendChild(el("div", { "class": "chips" }, null)).appendChild(el("span", { "class": "chip perk" }, "✓ " + PERK));
  var dl = el("dl", { "class": "specs" });
  specs(h).forEach(function (s) {
    var d = el("div", {}); d.appendChild(el("dt", {}, s[0]));
    d.appendChild(el("dd", s[1] ? {} : { "class": "na" }, s[1] || "Menyusul")); dl.appendChild(d);
  });
  body.appendChild(dl);
  body.appendChild(el("div", { "class": "coord" }, h.lat.toFixed(5) + "° LU, " + h.lon.toFixed(5) + "° BT"));
  var row = el("div", { "class": "row" });
  row.appendChild(el("a", { "class": "btn wa", href: waLink(h), target: "_blank", rel: "noopener" }, "Chat " + AGENT + " (WA " + waNice(AGENT_WA) + ")"));
  if (h.maps) row.appendChild(el("a", { "class": "btn ghost", href: h.maps, target: "_blank", rel: "noopener" }, "Rute di Google Maps"));
  body.appendChild(row);
  body.appendChild(el("p", { "class": "note" }, "Titik dari sharelok penjual. Alamat lengkap dan harga diberikan oleh " + AGENT + "."));
  pop.appendChild(body);
  pop.scrollTop = 0;
}
var PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>';
function priceShort(h) { return h.price ? "Rp " + h.price.toLocaleString("id-ID") + " jt" : "Harga: chat kami"; }
function renderList() {
  var box = document.getElementById("list");
  box.textContent = "";
  HOUSES.forEach(function (h) {
    var c = el("article", { "class": "item" + (h.id === selected ? " on" : "") });
    var fig = el("div", { "class": "ifig" });
    if (h.photos.length) {
      var im = el("img", { "class": "img", src: h.photos[0], alt: "Foto " + h.name, loading: "lazy" });
      im.onerror = function () { var d = el("div", { "class": "nophoto" }, "Foto menyusul"); if (im.parentNode) im.parentNode.replaceChild(d, im); };
      fig.appendChild(im);
    } else fig.appendChild(el("div", { "class": "nophoto" }, "Foto menyusul"));
    fig.appendChild(el("span", { "class": "perkflag" }, "✓ " + PERK));
    fig.appendChild(el("span", { "class": "pricetag" + (h.price ? "" : " ask") }, priceShort(h)));
    if (h.photos.length > 1) fig.appendChild(el("span", { "class": "photocount" }, h.photos.length + " foto"));
    c.appendChild(fig);
    var b = el("div", { "class": "ibody" });
    b.appendChild(el("h3", {}, h.name));
    var pl = el("p", { "class": "place" });
    pl.innerHTML = PIN_SVG;
    pl.appendChild(document.createTextNode(h.area + (h.kec ? " · Kec. " + h.kec : "")));
    b.appendChild(pl);
    var ch = el("div", { "class": "chips" });
    if (h.sert) ch.appendChild(el("span", { "class": "chip acc" }, h.sert));
    if (h.lt) ch.appendChild(el("span", { "class": "chip" }, "LT " + h.lt + " m²"));
    if (h.lb) ch.appendChild(el("span", { "class": "chip" }, "LB " + h.lb + " m²"));
    if (h.kt) ch.appendChild(el("span", { "class": "chip" }, h.kt + " KT"));
    if (h.km) ch.appendChild(el("span", { "class": "chip" }, h.km + " KM"));
    if (ch.childNodes.length) b.appendChild(ch);
    var go = el("button", { "class": "btn ghost", type: "button" }, "Lihat di peta");
    go.onclick = function () { select(h.id, true); mapEl.scrollIntoView({ behavior: "smooth", block: "start" }); };
    var r2 = el("div", { "class": "row" });
    r2.appendChild(go);
    r2.appendChild(el("a", { "class": "btn wa", href: waLink(h), target: "_blank", rel: "noopener" }, "Chat WA"));
    b.appendChild(r2);
    c.appendChild(b);
    box.appendChild(c);
  });
  document.getElementById("listCount").textContent = HOUSES.length + " listing aktif";
}
function select(id, fly) {
  selected = id;
  if (id !== null && fly) {
    var h = find(id), k = Math.max(view.k, 12);
    view.k = k; view.tx = W / 2 - px(h.lon) * k; view.ty = H / 2 - py(h.lat) * k + 20;
    if (W > 560) view.tx += 180;
  }
  document.getElementById("hint").hidden = id !== null;
  apply(); renderPop(); renderList();
}

document.getElementById("nHouse").textContent = HOUSES.length;
resize(); fitHouses(); renderList();
window.addEventListener("resize", resize);
fetch("kec_medan.json").then(function (r) { return r.json(); }).then(function (data) {
  KEC = data; buildWorld(); apply(); renderList();
}).catch(function () {});
fetch("roads.json").then(function (r) { return r.json(); }).then(function (d) { ROADS = d.r; POIS = d.p; buildRoads(); apply(); }).catch(function () {});
var ROADS = [], POIS = [];
function buildRoads() {
  var g = document.getElementById("roadsW"); g.textContent = "";
  var sorted = ROADS.slice().sort(function (a, b) { return b[1] - a[1]; });
  ["case", "fill"].forEach(function (layer) {
    sorted.forEach(function (r) {
      var d = "M" + r[2].map(function (p) { return px(p[0]).toFixed(2) + " " + py(p[1]).toFixed(2); }).join("L");
      var w = [6, 5, 4.2, 3][r[1]];
      node("path", { d: d, "class": "rd " + (layer === "case" ? "case" : "c" + r[1]), "stroke-width": layer === "case" ? w + 2 : w }, g);
    });
  });
}
function drawRoadLabels() {
  var g = document.getElementById("rlabels"); g.textContent = "";
  if (!ROADS || !ROADS.length || view.k < 2.5) return;
  var best = {};
  ROADS.forEach(function (r) {
    if (r[1] === 3 && view.k < 6) return;
    var pts = r[2].map(function (p) { return [sx(px(p[0])), sy(py(p[1]))]; }).filter(function (q) { return q[0] > 10 && q[0] < W - 10 && q[1] > 10 && q[1] < H - 10; });
    if (pts.length < 2) return;
    var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (!best[r[0]] || L > best[r[0]].L) best[r[0]] = { L: L, pts: pts };
  });
  var defs = node("defs", {}, g), n = 0;
  Object.keys(best).forEach(function (name) {
    var s = best[name], label = name.replace(/^Jalan /, "Jl. ").replace("Jenderal ", "");
    if (s.L < label.length * 6.3 + 16) return;
    var p = s.pts; if (p[p.length - 1][0] < p[0][0]) p = p.slice().reverse();
    var id = "rl" + (n++);
    node("path", { id: id, d: "M" + p.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("L") }, defs);
    var t = node("text", { "class": "rlabel", dy: "-5" }, g);
    var tp = node("textPath", { href: "#" + id, startOffset: "50%", "text-anchor": "middle" }, t);
    tp.textContent = label;
  });
}
var POI_STYLE = { mall: ["#7c3aed", "M"], hospital: ["#dc2626", "RS"], university: ["#2563eb", "U"], market: ["#ca8a04", "P"], station: ["#0f766e", "KA"], school: ["#64748b", "S"] };
function drawPois() {
  var g = document.getElementById("pois"); g.textContent = "";
  if (!POIS || !POIS.length || view.k < 3) return;
  POIS.forEach(function (p) {
    if (p[1] === "school" && view.k < 9) return;
    var x = sx(px(p[2])), y = sy(py(p[3]));
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) return;
    var st = POI_STYLE[p[1]] || ["#64748b", "•"];
    var gg = node("g", { "class": "poi" }, g);
    node("title", {}, gg).textContent = p[0];
    node("circle", { cx: x, cy: y, r: 8, fill: st[0] }, gg);
    node("text", { "class": "ic", x: x, y: y + 3 }, gg).textContent = st[1];
    if (view.k >= 5) node("text", { "class": "nm", x: x + 11, y: y + 4 }, gg).textContent = p[0];
  });
}

/* === Data dari Google Sheet (tab "Untuk Web", dipublikasikan sebagai CSV) === */
var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSBO5C65KcR67hat5AEp4Q4LI35ogogD6jHyo7DK-ijDbMNp7soNkFx52oC4clAkheaY1CCYp7Mj-o2/pub?gid=1&single=true&output=csv";
function parseCSV(t) {
  var rows = [], row = [], f = "", q = false;
  for (var i = 0; i < t.length; i++) {
    var c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function num(v) {
  v = String(v == null ? "" : v).trim(); if (!v) return null;
  if (v.indexOf(",") >= 0) v = v.replace(/\./g, "").replace(",", ".");
  var n = parseFloat(v); return isNaN(n) ? null : n;
}
function driveImg(u) { var m = String(u).match(/[-\w]{25,}/); return m ? "https://drive.google.com/thumbnail?id=" + m[0] + "&sz=w1200" : u; }
function loadSheet() {
  if (!CSV_URL || CSV_URL.indexOf("http") !== 0) return;
  fetch(CSV_URL, { cache: "no-store" }).then(function (r) { if (!r.ok) throw r.status; return r.text(); }).then(function (t) {
    var rows = parseCSV(t).slice(1).filter(function (r) { return r[0] && num(r[8]) != null && num(r[9]) != null; });
    if (!rows.length) return;
    HOUSES = rows.map(function (r, i) {
      var photos = (r[11] || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean).map(driveImg);
      return { id: i + 1, name: r[0], area: (r[1] || "").replace(/,\s*Sumatera Utara\s*$/i, ""), lat: num(r[8]), lon: num(r[9]), maps: r[10] || "",
        price: num(r[2]), lt: num(r[3]), lb: num(r[4]), kt: num(r[5]), km: num(r[6]), sert: r[7] || null,
        photos: photos, captions: photos.map(function (_, j) { return "Foto " + (j + 1); }) };
    });
    selected = null;
    document.getElementById("nHouse").textContent = HOUSES.length;
    if (KEC.length) buildWorld();
    fitHouses(); renderPop(); renderList();
  }).catch(function () {});
}
loadSheet();
