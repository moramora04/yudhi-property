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

/* ===== Peta (Leaflet) ===== */
var mapEl = document.getElementById("map"), pop = document.getElementById("pop");
var KEC = [], selected = null, shot = {}, MK = {};
var AREA = L.latLngBounds([3.21, 98.22], [3.96, 98.88]);
var map = L.map("lmap", { zoomControl: false, minZoom: 10, maxZoom: 19, zoomSnap: 0.5, maxBounds: AREA.pad(0.08), maxBoundsViscosity: 1, worldCopyJump: false });
map.attributionControl.setPrefix(false);
var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
/* HP: geser peta pakai dua jari, supaya satu jari tetap bisa scroll halaman */
function twoFinger(m, box) {
  if (!(L.Browser.touch && L.Browser.mobile)) return;
  m.dragging.disable();
  var h = document.createElement("div"); h.className = "twohint"; h.textContent = "Pakai dua jari untuk menggeser peta"; box.appendChild(h);
  var t = null;
  m.getContainer().addEventListener("touchmove", function (e) {
    if (e.touches.length !== 1) { h.classList.remove("on"); return; }
    h.classList.add("on"); clearTimeout(t); t = setTimeout(function () { h.classList.remove("on"); }, 1300);
  }, { passive: true });
}
twoFinger(map, document.getElementById("map"));

map.createPane("kecPane").style.zIndex = 350;
map.createPane("kecLbl").style.zIndex = 450;
map.getPane("kecPane").style.pointerEvents = "none";
map.getPane("kecLbl").style.pointerEvents = "none";
var gKec = L.layerGroup().addTo(map), gKecLbl = L.layerGroup().addTo(map);
var PAL = {
  "Kota Medan": ["#ffad85", "#ffc6a6", "#ff9a6b", "#ffd5bd", "#f9b892"],
  "Deli Serdang": ["#86d0b0", "#a6dec5", "#6fc39f", "#bfe8d5"],
  "Kota Binjai": ["#bfa9ef", "#d3c4f5", "#ab92e6"],
  "Langkat": ["#94c2ef", "#b3d4f5", "#7cb2e8", "#c9e1f8"]
};
var cnt = {};
function kecColor(kab) { var p = PAL[kab] || ["#d9dee3"]; cnt[kab] = (cnt[kab] || 0) + 1; return p[(cnt[kab] - 1) % p.length]; }

function minZoomFit() {
  var z = map.getBoundsZoom(AREA, false);
  map.setMinZoom(Math.max(8, Math.floor(z * 2) / 2));
}
function styleByZoom() {
  var z = map.getZoom();
  var fo = z < 11.5 ? 0.82 : z < 12.5 ? 0.6 : z < 13.5 ? 0.38 : z < 14.5 ? 0.2 : 0.07;
  var to = z < 11 ? 0.18 : z < 12 ? 0.4 : z < 13 ? 0.7 : 1;
  tiles.setOpacity(to);
  KEC.forEach(function (k) { if (k.poly) k.poly.setStyle({ fillOpacity: fo, opacity: z < 15 ? 1 : 0.6 }); });
  drawKecLabels();
}
function drawKecLabels() {
  gKecLbl.clearLayers();
  var z = map.getZoom(); if (z > 14.5) return;
  var view = map.getBounds().pad(0.1), scale = 256 * Math.pow(2, z) / 360;
  var boxes = [];
  KEC.slice().sort(function (a, b) { return b.wdeg - a.wdeg; }).forEach(function (k) {
    if (!k.center || !view.contains(k.center)) return;
    if (k.wdeg * scale < 64) return;
    var p = map.latLngToContainerPoint(k.center), hw = k.kec.length * 3.9 + 6, bx = [p.x - hw, p.y - 9, p.x + hw, p.y + 9];
    if (boxes.some(function (o) { return bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1]; })) return;
    boxes.push(bx);
    L.marker(k.center, { pane: "kecLbl", interactive: false, keyboard: false,
      icon: L.divIcon({ className: "klabel", html: "<span>" + k.kec.replace(/^Medan /, "Medan&nbsp;") + "</span>", iconSize: [0, 0] }) }).addTo(gKecLbl);
  });
}
function buildWorld() {
  gKec.clearLayers(); cnt = {};
  var used = {};
  HOUSES.forEach(function (h) {
    h.kec = null; h.kab = null;
    KEC.forEach(function (k, i) {
      if (k.rings.some(function (r) { return inRing(h.lon, h.lat, r); })) { h.kec = k.kec; h.kab = k.kab; used[i] = true; }
    });
  });
  KEC.forEach(function (k, i) {
    var ll = k.rings.map(function (r) { return r.map(function (p) { return [p[1], p[0]]; }); });
    k.poly = L.polygon(ll, { pane: "kecPane", interactive: false, color: used[i] ? "#d4521a" : "#ffffff",
      weight: used[i] ? 2.4 : 1.4, fillColor: kecColor(k.kab), fillOpacity: 0.8, smoothFactor: 1 }).addTo(gKec);
    var big = k.rings.reduce(function (a, b) { return b.length > a.length ? b : a; });
    var sx = 0, sy = 0, minx = Infinity, maxx = -Infinity;
    big.forEach(function (p) { sx += p[0]; sy += p[1]; minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); });
    var c = [sy / big.length, sx / big.length];
    k.center = inRing(c[1], c[0], big) ? L.latLng(c) : k.poly.getBounds().getCenter();
    k.wdeg = maxx - minx;
  });
  document.getElementById("nKec").textContent = Object.keys(used).length;
  styleByZoom();
}

function label(h) { return h.price ? (h.price >= 1000 ? "Rp " + (h.price / 1000).toLocaleString("id-ID") + " M" : "Rp " + h.price.toLocaleString("id-ID") + " jt") : "Dijual"; }
function pinIcon(h) {
  var txt = label(h), w = Math.round(txt.length * 7.4 + 24);
  return L.divIcon({ className: "hpin" + (h.id === selected ? " on" : ""), iconSize: [w, 46], iconAnchor: [w / 2, 46],
    html: '<span class="ptag">' + txt + '</span><i class="pstem"></i><i class="pdot"></i>' });
}
var cluster = L.markerClusterGroup({
  showCoverageOnHover: false, spiderfyOnMaxZoom: true, maxClusterRadius: 70, zoomToBoundsOnClick: true,
  iconCreateFunction: function (c) {
    var n = c.getChildCount();
    return L.divIcon({ className: "clu", iconSize: [56, 56], html: "<b>" + n + "</b><span>rumah</span>" });
  }
}).addTo(map);
function drawPins() {
  cluster.clearLayers(); MK = {};
  HOUSES.forEach(function (h) {
    var m = L.marker([h.lat, h.lon], { icon: pinIcon(h), title: h.name + ", " + label(h), riseOnHover: true });
    m.on("click", function () { select(h.id, false); });
    MK[h.id] = m; cluster.addLayer(m);
  });
}
function refreshPins() { HOUSES.forEach(function (h) { if (MK[h.id]) { MK[h.id].setIcon(pinIcon(h)); MK[h.id].setZIndexOffset(h.id === selected ? 1000 : 0); } }); }

function fitHouses() {
  if (!HOUSES.length) return;
  var b = L.latLngBounds(HOUSES.map(function (h) { return [h.lat, h.lon]; }));
  map.fitBounds(b.pad(0.2), { padding: [60, 60], maxZoom: 13 });
}
document.getElementById("zin").onclick = function () { map.zoomIn(1); };
document.getElementById("zout").onclick = function () { map.zoomOut(1); };
document.getElementById("zfit").onclick = fitHouses;
document.getElementById("sheetbg").onclick = function () { select(null); };
map.on("zoomend", styleByZoom);
map.on("moveend", drawKecLabels);
window.addEventListener("resize", function () { map.invalidateSize(); minZoomFit(); });

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
/* Galeri foto: tombol ‹ › , geser (swipe) di HP, dan penanda 1/6 */
function gallery(h, parent, big, onChange) {
  if (!h.photos.length) { parent.appendChild(el("div", { "class": "nophoto" }, "Foto menyusul")); return null; }
  var n = h.photos.length, wrap = el("div", { "class": "gal" + (big ? " big" : "") });
  var im = el("img", { "class": big ? "hero" : "img", alt: "", loading: big ? "eager" : "lazy" });
  im.onerror = function () { im.classList.add("broken"); };
  im.onload = function () { im.classList.remove("broken"); };
  wrap.appendChild(im);
  var cnt = null;
  function show(i) {
    i = ((i % n) + n) % n; shot[h.id] = i;
    im.src = h.photos[i]; im.alt = (h.captions[i] || "Foto") + ", " + h.name;
    if (cnt) cnt.textContent = (i + 1) + " / " + n;
    if (onChange) onChange(i);
  }
  if (n > 1) {
    var pv = el("button", { "class": "gnav prev", type: "button", "aria-label": "Foto sebelumnya" }, "‹");
    var nx = el("button", { "class": "gnav next", type: "button", "aria-label": "Foto berikutnya" }, "›");
    pv.onclick = function (e) { e.stopPropagation(); show((shot[h.id] || 0) - 1); };
    nx.onclick = function (e) { e.stopPropagation(); show((shot[h.id] || 0) + 1); };
    cnt = el("span", { "class": "gcount" });
    wrap.appendChild(pv); wrap.appendChild(nx); wrap.appendChild(cnt);
    var x0 = null;
    wrap.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener("touchend", function (e) {
      if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) show((shot[h.id] || 0) + (dx < 0 ? 1 : -1));
    });
  }
  parent.appendChild(wrap);
  show(shot[h.id] || 0);
  return show;
}
function renderPop() {
  pop.textContent = "";
  mapEl.classList.toggle("sheet-open", selected !== null);
  if (selected === null) { pop.hidden = true; return; }
  var h = find(selected), cur = shot[h.id] || 0;
  pop.hidden = false;
  var x = el("button", { "class": "x", type: "button", "aria-label": "Tutup" }, "×");
  x.onclick = function () { select(null); };
  pop.appendChild(x);
  var th = null;
  var showPop = gallery(h, pop, true, function (i) {
    if (th) Array.prototype.forEach.call(th.children, function (b, j) { b.setAttribute("aria-pressed", String(i === j)); });
  });
  if (h.photos.length > 1) {
    th = el("div", { "class": "thumbs" });
    h.photos.forEach(function (src, i) {
      var b = el("button", { "class": "thumb", type: "button", "aria-pressed": String(i === cur), "aria-label": h.captions[i] });
      b.appendChild(el("img", { src: src, alt: "", loading: "lazy" }));
      b.onclick = function () { showPop(i); };
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
    gallery(h, fig, false);
    fig.appendChild(el("span", { "class": "perkflag" }, "✓ " + PERK));
    fig.appendChild(el("span", { "class": "pricetag" + (h.price ? "" : " ask") }, priceShort(h)));
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
    var h = find(id), z = Math.max(map.getZoom(), 17);
    var p = map.project([h.lat, h.lon], z);
    if (mapEl.clientWidth > 560) p = p.subtract([180, 0]);
    map.flyTo(map.unproject(p, z), z, { duration: 0.8 });
  }
  document.getElementById("hint").hidden = id !== null;
  refreshPins(); renderPop(); renderList();
}

document.getElementById("nHouse").textContent = HOUSES.length;
minZoomFit(); drawPins(); fitHouses(); renderList();
fetch("kec_medan.json").then(function (r) { return r.json(); }).then(function (data) {
  KEC = data.filter(function (k) { return k.kec; }); buildWorld(); renderList();
}).catch(function () {});

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
var SHEET_H = null, TITIP_H = [];
function setHouses() {
  var list = (SHEET_H || HOUSES0).concat(TITIP_H.filter(function (t) {
    return !(SHEET_H || HOUSES0).some(function (h) { return Math.abs(h.lat - t.lat) < 1e-6 && Math.abs(h.lon - t.lon) < 1e-6; });
  }));
  list.forEach(function (h, i) { h.id = i + 1; });
  HOUSES = list; selected = null;
  document.getElementById("nHouse").textContent = HOUSES.length;
  if (KEC.length) buildWorld();
  drawPins(); fitHouses(); renderPop(); renderList();
}
var HOUSES0 = HOUSES.slice();
function loadSheet() {
  if (!CSV_URL || CSV_URL.indexOf("http") !== 0) return;
  fetch(CSV_URL, { cache: "no-store" }).then(function (r) { if (!r.ok) throw r.status; return r.text(); }).then(function (t) {
    var rows = parseCSV(t).slice(1).filter(function (r) { return r[0] && num(r[8]) != null && num(r[9]) != null; });
    if (!rows.length) return;
    SHEET_H = rows.map(function (r) {
      var photos = (r[11] || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean).map(driveImg);
      return { name: r[0], area: (r[1] || "").replace(/,\s*Sumatera Utara\s*$/i, ""), lat: num(r[8]), lon: num(r[9]), maps: r[10] || "",
        price: num(r[2]), lt: num(r[3]), lb: num(r[4]), kt: num(r[5]), km: num(r[6]), sert: r[7] || null,
        photos: photos, captions: photos.map(function (_, j) { return "Foto " + (j + 1); }) };
    });
    setHouses();
  }).catch(function () {});
}
/* Listing dari Form Titip Jual yang statusnya "Tayang" (lewat Apps Script; data rahasia sudah disaring di server) */
function loadTitip() {
  if (typeof ENDPOINT === "undefined" || !ENDPOINT) return;
  fetch(ENDPOINT + "?list=1").then(function (r) { return r.json(); }).then(function (res) {
    if (!res.ok || !res.items) return;
    TITIP_H = res.items.filter(function (x) { return num(x.lat) != null && num(x.lon) != null; }).map(function (x) {
      var photos = (x.photos || []).map(driveImg);
      return { name: x.name, area: x.area || "", lat: num(x.lat), lon: num(x.lon), maps: x.maps || "",
        price: (function (p) { return p != null && p >= 100000 ? Math.round(p / 1e5) / 10 : p; })(num(x.price)), lt: num(x.lt), lb: num(x.lb), kt: num(x.kt), km: num(x.km), sert: x.sert || null,
        photos: photos, captions: photos.map(function (_, j) { return "Foto " + (j + 1); }) };
    });
    if (TITIP_H.length) setHouses();
  }).catch(function () {});
}
loadSheet();
loadTitip();
