/* Form Titip Jual — Yudhi Property
   Data dikirim ke Google Apps Script (Web App) yang menulis ke Google Sheet dan menyimpan foto di Google Drive.
   URL Web App (hasil "Deploy" Apps Script) diatur di config.js */
var AGENT_WA = "6289691757802";

var form = document.getElementById("tf"), ferr = document.getElementById("ferr");
var KEC = [], pin = null, acc = null, photos = [];

/* ---------- Peta pemilih titik ---------- */
var AREA = L.latLngBounds([3.21, 98.22], [3.96, 98.88]);
var pmap = L.map("pmap", { zoomControl: true, minZoom: 10, maxZoom: 19, maxBounds: AREA.pad(0.15), maxBoundsViscosity: 1 })
  .setView([3.595, 98.672], 12);
pmap.attributionControl.setPrefix(false);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(pmap);
var pinIcon = L.divIcon({ className: "pickpin", iconSize: [30, 40], iconAnchor: [15, 40],
  html: '<svg viewBox="0 0 30 40"><path d="M15 39s13-13.4 13-23.5A13 13 0 0 0 2 15.5C2 25.6 15 39 15 39Z" fill="#d4521a" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="15.5" r="5" fill="#fff"/></svg>' });

function inRing(x, y, r) {
  var c = false;
  for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
    var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function detectKec(lat, lon) {
  for (var i = 0; i < KEC.length; i++)
    if (KEC[i].rings.some(function (r) { return inRing(lon, lat, r); })) return KEC[i];
  return null;
}
function setPin(lat, lon, accuracy) {
  if (!pin) {
    pin = L.marker([lat, lon], { icon: pinIcon, draggable: true, autoPan: true }).addTo(pmap);
    pin.on("dragend", function () { var p = pin.getLatLng(); stopGps(); clearAcc(); afterPin(p.lat, p.lng, null); });
  } else pin.setLatLng([lat, lon]);
  if (accuracy) {
    if (!acc) acc = L.circle([lat, lon], { radius: accuracy, color: "#d4521a", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(pmap);
    else acc.setLatLng([lat, lon]).setRadius(accuracy);
  }
  afterPin(lat, lon, accuracy);
}
function clearAcc() { if (acc) { pmap.removeLayer(acc); acc = null; } }
function afterPin(lat, lon, accuracy) {
  var k = detectKec(lat, lon), sel = form.kecamatan;
  if (k) sel.value = k.kec;
  var t = lat.toFixed(6) + ", " + lon.toFixed(6);
  document.getElementById("pinfo").innerHTML = "<b>Titik tersimpan</b> · " + t +
    (accuracy ? " · akurasi ±" + Math.round(accuracy) + " m" : "") + (k ? " · Kec. " + k.kec : "") +
    ' · <a href="https://www.google.com/maps?q=' + t.replace(" ", "") + '" target="_blank" rel="noopener">cek di Google Maps</a>';
  document.getElementById("pinfo").classList.add("ok");
}
pmap.on("click", function (e) { stopGps(); clearAcc(); setPin(e.latlng.lat, e.latlng.lng, null); });

/* ---------- Lokasi real-time (GPS) ---------- */
var watchId = null, gpsTimer = null, best = null;
var locBtn = document.getElementById("loc"), locTxt = document.getElementById("locTxt");
function stopGps(msg) {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null; clearTimeout(gpsTimer); locBtn.classList.remove("live");
  if (msg) locTxt.textContent = msg;
}
locBtn.onclick = function () {
  if (watchId !== null) { stopGps(best ? "Lokasi dikunci (±" + Math.round(best.accuracy) + " m). Tekan lagi untuk ulangi" : "Pakai lokasi saya sekarang"); return; }
  if (!navigator.geolocation) { locTxt.textContent = "HP ini tidak mendukung lokasi. Ketuk peta saja."; return; }
  best = null; locBtn.classList.add("live");
  locTxt.textContent = "Mencari sinyal GPS… (tekan untuk berhenti)";
  watchId = navigator.geolocation.watchPosition(function (pos) {
    var c = pos.coords;
    if (best && c.accuracy > best.accuracy) return;
    best = { lat: c.latitude, lon: c.longitude, accuracy: c.accuracy };
    if (!AREA.pad(0.3).contains([c.latitude, c.longitude])) {
      stopGps("Lokasi Anda di luar Medan & sekitarnya. Ketuk peta di lokasi rumah."); return;
    }
    setPin(best.lat, best.lon, best.accuracy);
    pmap.setView([best.lat, best.lon], Math.max(pmap.getZoom(), 17));
    locTxt.textContent = "Lokasi real-time · akurasi ±" + Math.round(c.accuracy) + " m (tekan untuk kunci)";
    if (c.accuracy <= 12) stopGps("Lokasi dikunci (±" + Math.round(c.accuracy) + " m). Geser titik bila kurang pas");
  }, function (err) {
    stopGps(err.code === 1 ? "Izin lokasi ditolak. Aktifkan lokasi di browser, atau ketuk peta." : "GPS belum dapat sinyal. Coba di luar ruangan, atau ketuk peta.");
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  gpsTimer = setTimeout(function () {
    stopGps(best ? "Lokasi dikunci (±" + Math.round(best.accuracy) + " m). Geser titik bila kurang pas" : "GPS belum dapat sinyal. Ketuk peta di lokasi rumah.");
  }, 30000);
};

/* ---------- Daftar kecamatan ---------- */
fetch("kec_medan.json").then(function (r) { return r.json(); }).then(function (data) {
  KEC = data.filter(function (k) { return k.kec; });
  var groups = {};
  KEC.forEach(function (k) { (groups[k.kab] = groups[k.kab] || []).push(k.kec); });
  var sel = form.kecamatan;
  ["Kota Medan", "Deli Serdang", "Kota Binjai", "Langkat"].forEach(function (kab) {
    if (!groups[kab]) return;
    var og = document.createElement("optgroup"); og.label = kab;
    groups[kab].sort().forEach(function (n) { var o = document.createElement("option"); o.value = o.textContent = n; og.appendChild(o); });
    sel.appendChild(og);
  });
  var o = document.createElement("option"); o.value = o.textContent = "Lainnya (di luar daftar)"; sel.appendChild(o);
  if (pin) { var p = pin.getLatLng(); afterPin(p.lat, p.lng, acc ? acc.getRadius() : null); }
}).catch(function () {});

/* ---------- Harga terbaca ---------- */
function num(v) { v = String(v || "").replace(/\s/g, "").replace(",", "."); var n = parseFloat(v); return isNaN(n) ? null : n; }
form.harga.addEventListener("input", function () {
  var n = num(form.harga.value), t = document.getElementById("hargaTxt");
  t.textContent = n ? "= Rp " + (n >= 1000 ? (n / 1000).toLocaleString("id-ID") + " miliar" : n.toLocaleString("id-ID") + " juta") : "";
});

/* ---------- Foto: perkecil di HP sebelum dikirim ---------- */
var MAXP = 12, thumbs = document.getElementById("thumbs"), drop = document.getElementById("drop");
function shrink(file) {
  return new Promise(function (ok, bad) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = function () { URL.revokeObjectURL(url); bad(); };
    img.src = url;
  });
}
function addFiles(list) {
  var files = Array.prototype.slice.call(list).filter(function (f) { return /^image\//.test(f.type); });
  files.slice(0, MAXP - photos.length).forEach(function (f) {
    var item = { data: null };
    photos.push(item); renderThumbs();
    shrink(f).then(function (d) { item.data = d; renderThumbs(); }).catch(function () { photos.splice(photos.indexOf(item), 1); renderThumbs(); });
  });
  if (photos.length >= MAXP) showErr("Maksimal " + MAXP + " foto. Foto lain bisa dikirim lewat WhatsApp.");
}
function renderThumbs() {
  thumbs.textContent = "";
  photos.forEach(function (p, i) {
    var d = document.createElement("div"); d.className = "tp";
    if (p.data) { var im = document.createElement("img"); im.src = p.data; im.alt = "Foto " + (i + 1); d.appendChild(im); }
    else d.classList.add("busy");
    var x = document.createElement("button"); x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Hapus foto " + (i + 1));
    x.onclick = function () { photos.splice(i, 1); renderThumbs(); };
    d.appendChild(x); thumbs.appendChild(d);
  });
  drop.querySelector("span").innerHTML = photos.length ? "<b>Tambah foto</b> · " + photos.length + "/" + MAXP : "<b>Pilih foto</b> atau seret ke sini";
}
document.getElementById("files").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
["dragover", "dragenter"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("over"); }); });
drop.addEventListener("drop", function (e) { e.preventDefault(); addFiles(e.dataTransfer.files); });

/* ---------- Kirim ---------- */
function showErr(m, el) {
  ferr.textContent = m; ferr.hidden = !m;
  if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
}
function val(n) { var e = form.elements[n]; if (!e) return ""; if (e.length && !e.tagName) { for (var i = 0; i < e.length; i++) if (e[i].checked) return e[i].value; return ""; } return e.type === "checkbox" ? e.checked : String(e.value || "").trim(); }
function summary(d) {
  return ["Halo Yudhi Property, saya mau titip jual " + d.jenis.toLowerCase() + ".",
    "Nama: " + d.nama, "WA: " + d.wa, "Alamat: " + d.alamat + (d.kelurahan ? ", " + d.kelurahan : "") + ", Kec. " + d.kecamatan,
    d.lat ? "Titik: https://www.google.com/maps?q=" + d.lat + "," + d.lon : "",
    d.harga ? "Harga: Rp " + d.harga + " jt" : "", d.lt ? "LT: " + d.lt : "", d.lb ? "LB: " + d.lb : "",
    d.kt ? "KT: " + d.kt : "", d.sert ? "Sertifikat: " + d.sert : ""].filter(Boolean).join("\n");
}
form.addEventListener("submit", function (e) {
  e.preventDefault(); showErr("");
  if (val("website")) return;
  var d = {
    nama: val("nama"), wa: val("wa"), jenis: val("jenis"), alamat: val("alamat"), kecamatan: val("kecamatan"), kelurahan: val("kelurahan"),
    harga: val("harga"), net: val("net"), kpr: val("kpr"), lt: val("lt"), lb: val("lb"), lantai: val("lantai"), kt: val("kt"), km: val("km"),
    akses: val("akses"), listrik: val("listrik"), air: val("air"), sert: val("sert"), atasnama: val("atasnama"), pbb: val("pbb"), ket: val("ket"),
    lat: pin ? +pin.getLatLng().lat.toFixed(7) : "", lon: pin ? +pin.getLatLng().lng.toFixed(7) : "",
    akurasi: acc ? Math.round(acc.getRadius()) : "", sumber: pin ? (acc ? "GPS penjual" : "Ditandai di peta") : "Alamat saja"
  };
  if (!d.nama) return showErr("Nama pemilik belum diisi.", form.nama);
  if (!/^(\+?62|0)8\d{7,12}$/.test(d.wa.replace(/[\s.-]/g, ""))) return showErr("Nomor HP/WA belum benar. Contoh: 0812-3456-7890", form.wa);
  if (!d.alamat) return showErr("Alamat rumah belum diisi.", form.alamat);
  if (!d.kecamatan) return showErr("Pilih kecamatan, atau tandai titik rumah di peta.", form.kecamatan);
  if (!pin && !val("tanpaTitik")) return showErr("Tandai titik rumah di peta (atau pakai lokasi saya). Kalau tidak bisa, centang \"pakai alamat saja\".", document.getElementById("loc"));
  if (d.harga && num(d.harga) == null) return showErr("Harga jual cukup ditulis angka dalam juta. Contoh: 350", form.harga);
  if (photos.some(function (p) { return !p.data; })) return showErr("Foto masih diproses, tunggu sebentar lalu kirim lagi.");
  if (!val("setuju")) return showErr("Centang persetujuan pemasaran dulu.", form.setuju);

  document.getElementById("doneWa").href = "https://wa.me/" + AGENT_WA + "?text=" + encodeURIComponent(summary(d) + (photos.length ? "\n(" + photos.length + " foto sudah diunggah di form)" : ""));
  if (!ENDPOINT) {
    showErr("Form online belum aktif. Data Anda akan dikirim lewat WhatsApp.");
    window.open(document.getElementById("doneWa").href, "_blank"); return;
  }
  var btn = document.getElementById("send"), prog = document.getElementById("prog");
  btn.disabled = true; btn.textContent = "Mengirim…"; prog.hidden = false;
  prog.textContent = photos.length ? "Mengunggah " + photos.length + " foto, mohon tunggu…" : "";
  d.photos = photos.map(function (p, i) { return { name: (i + 1) + ".jpg", type: "image/jpeg", data: p.data.split(",")[1] }; });
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(d) })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.error || "gagal");
      form.hidden = true; document.getElementById("done").hidden = false;
      window.scrollTo({ top: document.querySelector(".band").offsetHeight - 20, behavior: "smooth" });
    })
    .catch(function () {
      btn.disabled = false; btn.textContent = "Kirim ulang"; prog.hidden = true;
      ferr.innerHTML = 'Pengiriman gagal (sinyal lemah?). Coba kirim ulang, atau <a target="_blank" rel="noopener" href="' + document.getElementById("doneWa").href + '">kirim lewat WhatsApp</a>.';
      ferr.hidden = false;
    });
});
form.addEventListener("input", function () { if (!ferr.hidden && !document.getElementById("send").disabled) ferr.hidden = true; });
