/* render.js - builds the full standalone HTML document for a generated site.
   Used by app.js (live preview), site.html (published view) and server.js
   (Node backend). This is the fixed template: the AI only supplies
   validated data for its slots, never markup or code. */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stars(rating) {
  var full = Math.round(rating);
  var out = '';
  for (var i = 0; i < 5; i++) out += i < full ? '★' : '☆';
  return out;
}

function renderSiteHtml(spec) {
  var reviewCards = spec.topReviews.map(function (r) {
    return '<article class="card">' +
      (r.rating ? '<div class="card-stars">' + stars(r.rating) + '</div>' : '') +
      '<p class="card-text">“' + esc(r.text) + '”</p>' +
      '<p class="card-author">— ' + esc(r.author || 'A customer') + '</p>' +
      '</article>';
  }).join('');

  var themeChips = spec.themes.map(function (t) {
    return '<li class="chip"><span class="chip-dot"></span>' + esc(t.label) +
      (t.count ? '<span class="chip-count">' + t.count + ' mentions</span>' : '') + '</li>';
  }).join('');

  var serviceItems = spec.services.map(function (s) {
    return '<li>' + esc(s) + '</li>';
  }).join('');

  var ratingChip = (typeof spec.rating === 'number' && isFinite(spec.rating))
    ? '<div class="rating"><span class="stars">' + stars(spec.rating) + '</span><strong>' + spec.rating.toFixed(1) + '</strong><span>from ' + spec.reviewCount + ' reviews</span></div>'
    : '';

  var cta = spec.mapsUrl
    ? '<br><a class="cta" href="' + esc(spec.mapsUrl) + '" target="_blank" rel="noopener">Get directions</a>'
    : '';

  var about = spec.about
    ? '<p class="about">' + esc(spec.about) + '</p>'
    : '';

  return '<!doctype html><html lang="en"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(spec.name) + ' — ' + esc(spec.area) + '</title>' +
    '<meta name="description" content="' + esc(spec.subhead) + '">' +
    '<style>' +
    ':root{--accent:' + spec.palette.accent + ';--ink:#101418;--muted:#5b6470;--soft:#f6f4ef;--card:#ffffff;}' +
    '*{box-sizing:border-box;margin:0;padding:0;}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--ink);background:var(--soft);line-height:1.55;}' +
    '.wrap{max-width:920px;margin:0 auto;padding:0 20px;}' +
    'header.hero{background:linear-gradient(135deg,' + spec.palette.accent + ' 0%,#1d2530 115%);color:#fff;padding:72px 0 64px;text-align:center;}' +
    '.badge{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:6px 16px;font-size:13px;letter-spacing:.4px;text-transform:uppercase;margin-bottom:20px;}' +
    'h1{font-size:clamp(30px,5.4vw,50px);line-height:1.14;font-weight:800;max-width:760px;margin:0 auto 16px;}' +
    '.sub{font-size:clamp(16px,2.4vw,20px);opacity:.92;max-width:640px;margin:0 auto 14px;}' +
    '.about{font-size:15px;opacity:.8;max-width:620px;margin:0 auto 28px;}' +
    '.rating{display:inline-flex;align-items:center;gap:10px;background:rgba(0,0,0,.24);border-radius:14px;padding:12px 20px;font-size:17px;}' +
    '.rating .stars{color:#ffd166;font-size:20px;letter-spacing:2px;}' +
    '.cta{display:inline-block;margin-top:26px;background:#fff;color:var(--ink);font-weight:700;font-size:16px;padding:14px 30px;border-radius:999px;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.22);}' +
    'section{padding:56px 0;}' +
    'h2{font-size:clamp(22px,3.4vw,30px);font-weight:800;margin-bottom:8px;}' +
    '.lead{color:var(--muted);margin-bottom:28px;max-width:640px;}' +
    '.chips{list-style:none;display:flex;flex-wrap:wrap;gap:12px;}' +
    '.chip{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1px solid #e6e1d8;border-radius:999px;padding:10px 18px;font-weight:600;font-size:15px;}' +
    '.chip-dot{width:9px;height:9px;border-radius:50%;background:var(--accent);}' +
    '.chip-count{color:var(--muted);font-weight:500;font-size:13px;}' +
    '.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;}' +
    '.card{background:var(--card);border:1px solid #e9e4da;border-radius:16px;padding:22px;box-shadow:0 2px 10px rgba(16,20,24,.05);}' +
    '.card-stars{color:#f5a623;font-size:16px;letter-spacing:2px;margin-bottom:10px;}' +
    '.card-text{font-size:15px;margin-bottom:14px;}' +
    '.card-author{color:var(--muted);font-size:14px;font-weight:600;}' +
    '.services{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}' +
    '.services li{background:var(--card);border-left:4px solid var(--accent);border-radius:10px;padding:14px 16px;font-weight:600;font-size:15px;}' +
    'footer{background:#101418;color:#c8cfd8;padding:36px 0;text-align:center;font-size:14px;}' +
    'footer .made{margin-top:8px;opacity:.6;font-size:12.5px;}' +
    '</style></head><body>' +
    '<header class="hero"><div class="wrap">' +
    '<span class="badge">' + esc(spec.category) + ' · ' + esc(spec.area) + '</span>' +
    '<h1>' + esc(spec.headline) + '</h1>' +
    '<p class="sub">' + esc(spec.subhead) + '</p>' +
    about +
    ratingChip +
    cta +
    '</div></header>' +
    '<section><div class="wrap"><h2>What customers love</h2>' +
    '<p class="lead">The themes that come up again and again in reviews.</p>' +
    '<ul class="chips">' + themeChips + '</ul></div></section>' +
    '<section style="background:#fff"><div class="wrap"><h2>Words from customers</h2>' +
    '<p class="lead">Review snippets, featured automatically.</p>' +
    '<div class="cards">' + reviewCards + '</div></div></section>' +
    '<section><div class="wrap"><h2>Popular right now</h2>' +
    '<p class="lead">The favourites reviewers keep naming.</p>' +
    '<ul class="services">' + serviceItems + '</ul></div></section>' +
    '<footer><div class="wrap">' + esc(spec.name) + ' · ' + esc(spec.area) +
    '<div class="made">Demo site · ' + esc(spec.sourceLabel || 'sample reviews') + ' · copy drafted by AI · ProofPage</div>' +
    '</div></footer>' +
    '</body></html>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderSiteHtml: renderSiteHtml };
}
