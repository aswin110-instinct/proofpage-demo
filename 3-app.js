/* app.js - ProofPage demo generator.
   Static front-end only: every link generates from the fictional sample
   businesses below. No real Google data is fetched. */

var BUSINESSES = [
  {
    id: 'saffron-dhaba',
    name: 'Saffron Dhaba',
    category: 'North Indian dhaba',
    area: 'Amritsar',
    emoji: '🍛',
    mapsUrl: 'https://maps.google.com/?q=Saffron+Dhaba+Amritsar',
    rating: 4.6,
    reviewCount: 214,
    palette: { accent: '#c2410c' },
    themes: [
      { label: 'Butter-loaded soya chaap', count: 63 },
      { label: 'Tandoori rotis straight off the fire', count: 41 },
      { label: 'Open late for highway travellers', count: 27 }
    ],
    services: ['Soya chaap platters', 'Dal makhani', 'Tandoori rotis', 'Family seating', 'Takeaway'],
    reviews: [
      { author: 'Harpreet S.', rating: 5, text: 'The soya chaap here is unreal — dripping with butter and perfectly smoky. We plan our road trips around this place.' },
      { author: 'Meena K.', rating: 5, text: 'Stopped at 11pm and they still served us hot rotis straight off the tandoor. Genuine dhaba warmth.' },
      { author: 'Rohit V.', rating: 4, text: 'Simple place, big flavours. The dal makhani tastes like it has been simmering all day.' },
      { author: 'Anita D.', rating: 5, text: 'Clean, quick and honest food. The chaap portion easily feeds two.' }
    ]
  },
  {
    id: 'brew-bean',
    name: 'Brew & Bean Café',
    category: 'Café',
    area: 'Bengaluru',
    emoji: '☕',
    mapsUrl: 'https://maps.google.com/?q=Brew+and+Bean+Cafe+Bengaluru',
    rating: 4.8,
    reviewCount: 156,
    palette: { accent: '#7c5a3a' },
    themes: [
      { label: 'Filter coffee done right', count: 48 },
      { label: 'Quiet corners to work from', count: 35 },
      { label: 'The almond croissant', count: 29 }
    ],
    services: ['South Indian filter coffee', 'Pour-overs', 'Fresh bakes', 'Work-friendly tables', 'Free Wi-Fi'],
    reviews: [
      { author: 'Divya R.', rating: 5, text: 'Finally a café that takes filter coffee seriously. Strong, frothy, perfect. My new weekend office.' },
      { author: 'Arjun M.', rating: 5, text: 'The back corner table plus an almond croissant is my whole personality now. Staff never rush you.' },
      { author: 'Sana F.', rating: 5, text: 'Calm playlist, warm light, and the croissant flaked exactly right. 10/10 work spot.' },
      { author: 'Karthik N.', rating: 4, text: 'Gets busy on Sunday mornings but the coffee is worth the short wait.' }
    ]
  },
  {
    id: 'glow-grace',
    name: 'Glow & Grace Salon',
    category: 'Salon & spa',
    area: 'Chennai',
    emoji: '💇',
    mapsUrl: 'https://maps.google.com/?q=Glow+and+Grace+Salon+Chennai',
    rating: 4.7,
    reviewCount: 189,
    palette: { accent: '#a61e6d' },
    themes: [
      { label: 'Bridal packages', count: 44 },
      { label: 'Hair spa that actually works', count: 37 },
      { label: 'Patient, friendly stylists', count: 31 }
    ],
    services: ['Bridal & occasion packages', 'Hair spa & treatments', 'Haircuts & styling', 'Facials & cleanups'],
    reviews: [
      { author: 'Lakshmi P.', rating: 5, text: 'They did my bridal makeup and hair — calm, punctual and so skilled. Felt like the best version of myself.' },
      { author: 'Revathi S.', rating: 5, text: 'The hair spa fixed months of damage in two sessions. They explain everything before they touch your hair.' },
      { author: 'Joel T.', rating: 4, text: 'Took my mother for a haircut; the stylist was patient and kind. She left beaming.' },
      { author: 'Farhana A.', rating: 5, text: 'Booked the pre-wedding package. Zero stress, zero surprises, gorgeous results.' }
    ]
  }
];

function pickBusiness(link) {
  if (!link) return BUSINESSES[0];
  var s = link.toLowerCase();
  for (var i = 0; i < BUSINESSES.length; i++) {
    var b = BUSINESSES[i];
    if (s.indexOf(b.name.toLowerCase().split(' ')[0]) !== -1 || s.indexOf(b.area.toLowerCase()) !== -1) return b;
  }
  var hash = 0;
  for (var j = 0; j < link.length; j++) hash = (hash * 31 + link.charCodeAt(j)) >>> 0;
  return BUSINESSES[hash % BUSINESSES.length];
}

function buildSpec(biz) {
  var t = biz.themes;
  var headline;
  if (biz.category.indexOf('dhaba') !== -1) {
    headline = 'The ' + biz.area + ' dhaba people plan their drives around';
  } else if (biz.category === 'Café') {
    headline = biz.area + '’s cosiest corner for coffee and quiet work';
  } else {
    headline = biz.area + '’s most-loved ' + biz.category.toLowerCase();
  }
  return {
    name: biz.name,
    category: biz.category,
    area: biz.area,
    mapsUrl: biz.mapsUrl,
    rating: biz.rating,
    reviewCount: biz.reviewCount,
    headline: headline,
    subhead: 'Customers keep coming back for ' + t[0].label.toLowerCase() + ' and ' + t[1].label.toLowerCase() + '.',
    about: 'Generated from ' + biz.reviewCount + ' sample reviews.',
    themes: t,
    topReviews: biz.reviews.slice(0, 3),
    services: biz.services,
    palette: biz.palette
  };
}

function b64urlEncode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

var currentSpec = null;

function runPipeline(biz) {
  var steps = [
    'Reading the business link',
    'Analysing ' + biz.reviewCount + ' reviews',
    'Found ' + biz.themes.length + ' themes customers repeat',
    'Writing the headline and page copy',
    'Composing your one-page site'
  ];
  var pipelineEl = document.getElementById('pipeline');
  var stepsEl = document.getElementById('steps');
  var resultEl = document.getElementById('result');
  resultEl.classList.add('hidden');
  pipelineEl.classList.remove('hidden');
  stepsEl.innerHTML = steps.map(function (s) { return '<li><span class="dot"></span><span>' + s + '</span></li>'; }).join('');
  var items = stepsEl.querySelectorAll('li');
  pipelineEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  var i = 0;
  function tick() {
    if (i > 0) { items[i - 1].classList.remove('active'); items[i - 1].classList.add('done'); }
    if (i >= items.length) { showResult(biz); return; }
    items[i].classList.add('active');
    i++;
    setTimeout(tick, 850);
  }
  setTimeout(tick, 350);
}

function showResult(biz) {
  currentSpec = buildSpec(biz);
  document.getElementById('pipeline').classList.add('hidden');
  var resultEl = document.getElementById('result');
  resultEl.classList.remove('hidden');
  document.getElementById('published').classList.add('hidden');
  document.getElementById('preview').srcdoc = renderSiteHtml(currentSpec);
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', function () {
  var cardsEl = document.getElementById('sample-cards');
  cardsEl.innerHTML = BUSINESSES.map(function (b) {
    return '<button type="button" class="sample-card" data-id="' + b.id + '">' +
      '<span class="sample-emoji">' + b.emoji + '</span>' +
      '<div class="sample-name">' + esc(b.name) + '</div>' +
      '<div class="sample-meta">' + esc(b.category) + ' · ' + esc(b.area) + '</div>' +
      '<div class="sample-stars">' + stars(b.rating) + ' ' + b.rating.toFixed(1) + ' (' + b.reviewCount + ')</div>' +
      '</button>';
  }).join('');

  cardsEl.addEventListener('click', function (e) {
    var card = e.target.closest('.sample-card');
    if (!card) return;
    var biz = BUSINESSES.filter(function (b) { return b.id === card.dataset.id; })[0];
    runPipeline(biz);
  });

  document.getElementById('gen-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var link = document.getElementById('maps-input').value.trim();
    runPipeline(pickBusiness(link));
  });

  var wrap = document.getElementById('preview-frame-wrap');
  document.getElementById('view-desktop').addEventListener('click', function () {
    wrap.classList.remove('mobile');
    this.classList.add('active');
    document.getElementById('view-mobile').classList.remove('active');
  });
  document.getElementById('view-mobile').addEventListener('click', function () {
    wrap.classList.add('mobile');
    this.classList.add('active');
    document.getElementById('view-desktop').classList.remove('active');
  });

  document.getElementById('publish-btn').addEventListener('click', function () {
    if (!currentSpec) return;
    var url = 'site.html#d=' + b64urlEncode(currentSpec);
    var absolute = new URL(url, window.location.href).href;
    var pub = document.getElementById('published');
    var link = document.getElementById('published-link');
    link.href = absolute;
    link.textContent = absolute;
    pub.classList.remove('hidden');
    pub.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  document.getElementById('copy-btn').addEventListener('click', function () {
    var link = document.getElementById('published-link');
    navigator.clipboard.writeText(link.href).then(function () {
      document.getElementById('copy-btn').textContent = 'Copied';
      setTimeout(function () { document.getElementById('copy-btn').textContent = 'Copy link'; }, 1500);
    });
  });

  document.getElementById('edit-btn').addEventListener('click', function () {
    document.getElementById('result').classList.add('hidden');
    document.getElementById('maps-input').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
