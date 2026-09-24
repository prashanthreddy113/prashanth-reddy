namespace ManaBandi.Api.Controllers;

/// <summary>Self-contained share page (Telugu + English). Reads the token from the URL and polls the JSON every 5 s.</summary>
public static class TrackPage
{
    public const string Html = """
<!doctype html>
<html lang="te">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>మన బండి · Live trip</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" crossorigin="anonymous">
<style>
  :root { --green:#128A46; --ink:#1d2327; --muted:#6b7280; --bg:#f6f7f5; }
  * { box-sizing:border-box; }
  body { margin:0; font-family: "Noto Sans Telugu", "Noto Sans", system-ui, sans-serif; color:var(--ink); background:var(--bg); }
  header { background:var(--green); color:#fff; padding:12px 16px; }
  header h1 { margin:0; font-size:18px; }
  header small { opacity:.85; }
  #map { height:58vh; width:100%; background:#e5e7eb; }
  .card { background:#fff; margin:12px; padding:14px 16px; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  .status { font-size:18px; font-weight:700; }
  .row { display:flex; justify-content:space-between; gap:12px; margin-top:8px; flex-wrap:wrap; }
  .label { color:var(--muted); font-size:13px; }
  .plate { font-family: ui-monospace, monospace; font-size:17px; font-weight:700; letter-spacing:1px; }
  .expired { text-align:center; padding:40px 16px; }
  footer { text-align:center; color:var(--muted); font-size:12px; padding:12px; }
</style>
</head>
<body>
<header><h1>మన బండి · Mana Bandi</h1><small>ప్రయాణం లైవ్ · Live trip</small></header>
<div id="map"></div>
<div class="card" id="info">
  <div class="status" id="status">లోడ్ అవుతోంది… · Loading…</div>
  <div class="row"><div><div class="label">కెప్టెన్ · Captain</div><div id="captain">—</div></div>
  <div><div class="label">బండి నంబర్ · Vehicle no.</div><div class="plate" id="plate">—</div></div></div>
  <div class="row"><div><div class="label">ఎక్కడ నుండి · From</div><div id="from">—</div></div>
  <div><div class="label">ఎక్కడికి · To</div><div id="to">—</div></div></div>
  <div class="row"><div class="label" id="updated"></div></div>
</div>
<footer>అత్యవసరమైతే 112 కి కాల్ చేయండి · In an emergency call 112</footer>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" crossorigin="anonymous"></script>
<script>
(function () {
  var token = location.pathname.split('/').filter(Boolean).pop() || '';
  var STATUS = {
    searching: ['కెప్టెన్ కోసం వెతుకుతున్నాం', 'Finding a captain'],
    accepted: ['కెప్టెన్ వస్తున్నారు', 'Captain is on the way'],
    arrived: ['కెప్టెన్ చేరుకున్నారు', 'Captain has arrived'],
    started: ['ప్రయాణం జరుగుతోంది', 'Trip in progress'],
    finished: ['ప్రయాణం పూర్తయింది', 'Trip finished'],
    cancelled: ['రద్దు చేయబడింది', 'Cancelled'],
    no_captain: ['కెప్టెన్ దొరకలేదు', 'No captain found']
  };
  var map = null, capMarker = null, pickMarker = null, dropMarker = null, fitted = false, timer = null;
  function text(id, v) { document.getElementById(id).textContent = v; }
  function place(p) { return p ? ((p.nameTe ? p.nameTe + ' · ' : '') + (p.name || '')) : '—'; }
  function initMap(lat, lng) {
    if (map || typeof L === 'undefined') return;
    map = L.map('map').setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  }
  function dot(color) { return { radius: 9, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 }; }
  function render(d) {
    var s = STATUS[d.status] || [d.status, d.status];
    text('status', s[0] + ' · ' + s[1]);
    text('captain', d.captain ? d.captain.name : '—');
    text('plate', d.captain ? d.captain.vehicleNo : '—');
    text('from', place(d.pickup));
    text('to', place(d.drop));
    text('updated', 'చివరి అప్‌డేట్ · Updated ' + new Date(d.updatedAt).toLocaleTimeString());
    initMap(d.pickup.lat, d.pickup.lng);
    if (!map) return;
    if (!pickMarker) pickMarker = L.circleMarker([d.pickup.lat, d.pickup.lng], dot('#128A46')).addTo(map).bindTooltip('Pickup');
    if (!dropMarker) dropMarker = L.circleMarker([d.drop.lat, d.drop.lng], dot('#d9480f')).addTo(map).bindTooltip('Drop');
    var loc = d.captain && d.captain.location;
    if (loc) {
      if (!capMarker) capMarker = L.circleMarker([loc.lat, loc.lng], dot('#1c7ed6')).addTo(map).bindTooltip('Captain');
      else capMarker.setLatLng([loc.lat, loc.lng]);
    } else if (capMarker) { map.removeLayer(capMarker); capMarker = null; }
    if (!fitted) {
      var pts = [[d.pickup.lat, d.pickup.lng], [d.drop.lat, d.drop.lng]];
      if (loc) pts.push([loc.lat, loc.lng]);
      map.fitBounds(pts, { padding: [40, 40] });
      fitted = true;
    }
    if (['finished', 'cancelled', 'no_captain'].indexOf(d.status) >= 0 && timer) { clearInterval(timer); timer = null; }
  }
  function expired() {
    if (timer) { clearInterval(timer); timer = null; }
    document.getElementById('info').innerHTML = '<div class="expired"><b>ఈ లింక్ గడువు ముగిసింది</b><br>This tracking link has expired.</div>';
  }
  function poll() {
    fetch('/api/public/track/' + encodeURIComponent(token), { cache: 'no-store' })
      .then(function (r) { if (r.status === 404) { expired(); return null; } return r.ok ? r.json() : null; })
      .then(function (d) { if (d) render(d); })
      .catch(function () { /* keep polling on network errors */ });
  }
  poll();
  timer = setInterval(poll, 5000);
})();
</script>
</body>
</html>
""";
}
