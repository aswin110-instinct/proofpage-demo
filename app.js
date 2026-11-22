/* app.js - ProofPage generator.
   Milestone 2: REAL AI analysis. Reviews come from fictional sample
   businesses, or from feedback the merchant pastes and confirms rights to.
   A pasted Google Maps link is accepted as a business REFERENCE only -
   nothing is scraped. The automatic Google-import gate stays OFF.
   The AI returns validated JSON that fills a fixed template (render.js);
   it never writes executable code. */

var BUSINESSES = [
  {
    id: 'saffron-dhaba',
    name: 'Saffron Dhaba',
    category: 'North Indian dhaba',
    area: 'Amritsar',
    emoji: '🍛',
    mapsUrl: 'https://maps.google.com/?q=Saffron+Dhaba+Amritsar',
    palette: { accent: '#c2410c' },
    services: ['Soya chaap platters', 'Dal makhani', 'Tandoori rotis', 'Family seating', 'Takeaway'],
    reviews: [
      { author: 'Harpreet S.', rating: 5, text: 'The soya chaap here is unreal - dripping with butter and perfectly smoky. We plan our road trips around this place.' },
      { author: 'Meena K.', rating: 5, text: 'Stopped at 11pm and they still served us hot rotis straight off the tandoor. Genuine dhaba warmth.' },
      { author: 'Rohit V.', rating: 4, text: 'Simple place, big flavours. The dal makhani tastes like it has been simmering all day.' },
      { author: 'Anita D.', rating: 5, text: 'Clean, quick and honest food. The chaap portion easily feeds two.' },
      { author: 'Vikram T.', rating: 3, text: 'Food is great but the weekend rush means 30 minute waits and the parking is chaotic. Go on a weekday.' },
      { author: 'Simran G.', rating: 5, text: 'Their chaap gravy is rich without being heavy. Staff remembered us from our last trip and had our usual ready.' },
      { author: 'Dev P.', rating: 4, text: 'Portions are generous for the price. The tandoori roti basket is a must with the dal.' },
      { author: 'Nisha R.', rating: 5, text: 'Travelling with kids is easy here - quick service, high chairs, and nobody minds the noise.' }
    ]
  },
  {
    id: 'brew-bean',
    name: 'Brew & Bean Café',
    category: 'Café',
    area: 'Bengaluru',
    emoji: '☕',
    mapsUrl: 'https://maps.google.com/?q=Brew+and+Bean+Cafe+Bengaluru',
    palette: { accent: '#7c5a3a' },
    services: ['South Indian filter coffee', 'Pour-overs', 'Fresh bakes', 'Work-friendly tables', 'Free Wi-Fi'],
    reviews: [
      { author: 'Divya R.', rating: 5, text: 'Finally a café that takes filter coffee seriously. Strong, frothy, perfect. My new weekend office.' },
      { author: 'Arjun M.', rating: 5, text: 'The back corner table plus an almond croissant is my whole personality now. Staff never rush you.' },
      { author: 'Sana F.', rating: 5, text: 'Calm playlist, warm light, and the croissant flaked exactly right. 10/10 work spot.' },
      { author: 'Karthik N.', rating: 4, text: 'Gets busy on Sunday mornings but the coffee is worth the short wait.' },
      { author: 'Anand S.', rating: 3, text: 'Love the coffee but the Wi-Fi drops during peak hours and power sockets are only along one wall.' },
      { author: 'Priya L.', rating: 5, text: 'Baristas remember your order after two visits. The pour-over menu changes with the season.' },
      { author: 'Rahul D.', rating: 5, text: 'I finish more work here in two hours than at home in a day. Quiet, bright, great coffee.' },
      { author: 'Meera J.', rating: 4, text: 'Croissants sell out by 11am on weekends. Come early or miss out.' }
    ]
  },
  {
    id: 'glow-grace',
    name: 'Glow & Grace Salon',
    category: 'Salon & spa',
    area: 'Chennai',
    emoji: '💇',
    mapsUrl: 'https://maps.google.com/?q=Glow+and+Grace+Salon+Chennai',
    palette: { accent: '#a61e6d' },
    services: ['Bridal & occasion packages', 'Hair spa & treatments', 'Haircuts & styling', 'Facials & cleanups'],
    reviews: [
      { author: 'Lakshmi P.', rating: 5, text: 'They did my bridal makeup and hair - calm, punctual and so skilled. Felt like the best version of myself.' },
      { author: 'Revathi S.', rating: 5, text: 'The hair spa fixed months of damage in two sessions. They explain everything before they touch your hair.' },
      { author: 'Joel T.', rating: 4, text: 'Took my mother for a haircut; the stylist was patient and kind. She left beaming.' },
      { author: 'Farhana A.', rating: 5, text: 'Booked the pre-wedding package. Zero stress, zero surprises, gorgeous results.' },
      { author: 'Divya M.', rating: 3, text: 'Lovely work but appointments run 20 minutes late on Saturdays. Book the first slot of the day.' },
      { author: 'Keerthi V.', rating: 5, text: 'They explained every product before using it and checked for allergies. Felt completely safe.' },
      { author: 'Sarah J.', rating: 5, text: 'My bridal trial turned into the full package - they sketched three looks and helped me choose.' },
      { author: 'Anitha R.', rating: 4, text: 'The hair spa is worth every rupee. Booking on WhatsApp is quick and they confirm the same day.' }
    ]
  }
];

var PALETTES = ['#c2410c', '#7c5a3a', '#a61e6d', '#0f766e', '#1d4ed8'];
var BACKEND = null; /* set to '' (same origin) when served by the Node backend */
var currentSpec = null;

/* ---------------- intake ---------------- */

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

function sampleInput(biz) {
  var ratings = biz.reviews.map(function (r) { return r.rating; });
  var avg = ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length;
  return {
    facts: {
      name: biz.name, category: biz.category, area: biz.area,
      services: biz.services, mapsUrl: biz.mapsUrl,
      rating: Math.round(avg * 10) / 10, reviewCount: biz.reviews.length,
      palette: biz.palette
    },
    reviews: biz.reviews,
    sourceLabel: 'fictional sample reviews'
  };
}

function parsePastedReviews(raw) {
  var reviews = [];
  var removedContacts = 0;
  var lines = String(raw).split('\n');
  for (var i = 0; i < lines.length && reviews.length < 50; i++) {
    var line = lines[i].trim();
    if (line.length < 12) continue;
    var rating = null;
    var m = line.match(/^([1-5])\s*(?:\/\s*5|stars?|⭐|[-–:.)|])\s*(.+)$/i);
    if (m) { rating = parseInt(m[1], 10); line = m[2].trim(); }
    var cleaned = AI.stripContact(line.slice(0, 500));
    removedContacts += cleaned.removed;
    reviews.push({ author: 'A customer', rating: rating, text: cleaned.text });
  }
  return { reviews: reviews, removedContacts: removedContacts };
}

function hashIndex(str, n) {
  var hash = 0;
  for (var j = 0; j < str.length; j++) hash = (hash * 31 + str.charCodeAt(j)) >>> 0;
  return hash % n;
}

/* ---------------- pipeline ---------------- */

var STEPS = [
  'Reading the reviews',
  'AI is finding the themes customers repeat',
  'AI is writing your page copy',
  'Checking the copy against the reviews',
  'Composing your one-page site'
];

function setStep(activeIdx, warn) {
  var stepsEl = document.getElementById('steps');
  stepsEl.innerHTML = STEPS.map(function (s, i) {
    var cls = i < activeIdx ? 'done' : (i === activeIdx ? 'active' : '');
    return '<li class="' + cls + '"><span class="dot"></span><span>' + s + '</span></li>';
  }).join('') + (warn ? '<li class="warn"><span class="dot"></span><span>' + esc(warn) + '</span></li>' : '');
}

function startPipelineUi() {
  document.getElementById('result').classList.add('hidden');
  var pipelineEl = document.getElementById('pipeline');
  pipelineEl.classList.remove('hidden');
  setStep(0);
  pipelineEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function runPipeline(input) {
  startPipelineUi();
  var analysis = null;

  function viaBackend() {
    return fetch('api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facts: publicFacts(input.facts), reviews: input.reviews })
    }).then(function (r) {
      if (!r.ok) throw new Error('backend HTTP ' + r.status);
      return r.json();
    });
  }

  function onWaitFactory(stepIdx) {
    return function (waitSecs, attempt) {
      setStep(stepIdx, 'Free AI tier allows one request a minute - retrying in ~' + waitSecs + 's (attempt ' + (attempt + 1) + ')');
    };
  }

  function viaDirectAi() {
    setStep(1);
    return AI.analyze(input.facts, input.reviews, onWaitFactory(1)).then(function (a) {
      analysis = a;
      setStep(2);
      return AI.compose(input.facts, a, input.reviews, onWaitFactory(2)).then(function (c) {
        return { analysis: a, composition: c };
      });
    });
  }

  var work = (BACKEND !== null) ? viaBackend() : viaDirectAi();

  work.then(function (out) {
    analysis = out.analysis;
    setStep(3);
    void analysis;
    return new Promise(function (resolve) { setTimeout(resolve, 500); }).then(function () {
      setStep(4);
      return buildSpecFromAi(input, out.analysis, out.composition);
    });
  }).then(function (spec) {
    setStep(5);
    showResult(spec);
  }).catch(function (err) {
    /* AI unreachable or twice invalid: fall back to fixed template copy. */
    setStep(5, 'Live AI unavailable right now - used simple template copy instead.');
    setTimeout(function () { showResult(fallbackSpec(input)); }, 600);
  });
}

function publicFacts(f) {
  return { name: f.name, category: f.category, area: f.area, services: f.services };
}

function buildSpecFromAi(input, analysis, comp) {
  var themes = comp.themeLabels.map(function (label) {
    for (var i = 0; i < analysis.themes.length; i++) {
      if (analysis.themes[i].label === label) return { label: label, count: analysis.themes[i].mentions };
    }
    return { label: label, count: null };
  });
  var topReviews = comp.topReviewIds.map(function (id) { return input.reviews[id - 1]; }).filter(Boolean);
  if (!topReviews.length) topReviews = input.reviews.slice(0, 3);
  return {
    name: input.facts.name,
    category: input.facts.category,
    area: input.facts.area,
    mapsUrl: input.facts.mapsUrl || null,
    rating: input.facts.rating,
    reviewCount: input.facts.reviewCount,
    headline: comp.headline,
    subhead: comp.subhead,
    about: comp.about,
    themes: themes,
    topReviews: topReviews,
    services: input.facts.services,
    palette: input.facts.palette,
    sourceLabel: input.sourceLabel
  };
}

/* Fixed-template fallback when the AI cannot be reached or stays invalid. */
function fallbackSpec(input) {
  var f = input.facts;
  var sorted = input.reviews.slice().sort(function (a, b) { return (b.rating || 3) - (a.rating || 3); });
  return {
    name: f.name,
    category: f.category,
    area: f.area,
    mapsUrl: f.mapsUrl || null,
    rating: f.rating,
    reviewCount: f.reviewCount,
    headline: f.area + '’s most-loved ' + f.category.toLowerCase(),
    subhead: 'What customers keep saying, turned into a one-page site.',
    about: 'Generated from ' + f.reviewCount + ' ' + input.sourceLabel + '.',
    themes: f.services.slice(0, 3).map(function (s) { return { label: s, count: null }; }),
    topReviews: sorted.slice(0, 3),
    services: f.services,
    palette: f.palette,
    sourceLabel: input.sourceLabel
  };
}

function showResult(spec) {
  currentSpec = spec;
  document.getElementById('pipeline').classList.add('hidden');
  var resultEl = document.getElementById('result');
  resultEl.classList.remove('hidden');
  document.getElementById('published').classList.add('hidden');
  document.getElementById('preview').srcdoc = renderSiteHtml(currentSpec);
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function b64urlEncode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function showPublished(url) {
  var pub = document.getElementById('published');
  var link = document.getElementById('published-link');
  link.href = url;
  link.textContent = url;
  pub.classList.remove('hidden');
  pub.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------------- wiring ---------------- */

document.addEventListener('DOMContentLoaded', function () {
  /* Detect whether the ProofPage backend is hosting this page. */
  var statusEl = document.getElementById('ai-status');
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, 1500) : null;
  fetch('api/health', { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
    .then(function (r) { if (timer) clearTimeout(timer); return r.ok ? r.json() : null; })
    .then(function (j) {
      if (j && j.ok) {
        BACKEND = '';
        statusEl.textContent = 'Live AI via the ProofPage server · no Google data fetched';
      }
    })
    .catch(function () { /* static hosting: direct browser-to-AI mode */ });

  var cardsEl = document.getElementById('sample-cards');
  cardsEl.innerHTML = BUSINESSES.map(function (b) {
    return '<button type="button" class="sample-card" data-id="' + b.id + '">' +
      '<span class="sample-emoji">' + b.emoji + '</span>' +
      '<div class="sample-name">' + esc(b.name) + '</div>' +
      '<div class="sample-meta">' + esc(b.category) + ' · ' + esc(b.area) + '</div>' +
      '<div class="sample-stars">' + stars(b.reviews[0].rating) + ' ' + b.reviews.length + ' sample reviews</div>' +
      '</button>';
  }).join('');

  cardsEl.addEventListener('click', function (e) {
    var card = e.target.closest('.sample-card');
    if (!card) return;
    var biz = BUSINESSES.filter(function (b) { return b.id === card.dataset.id; })[0];
    runPipeline(sampleInput(biz));
  });

  /* A pasted Maps link is a business reference only - the demo analyses
     the matching fictional sample. Automatic Google import stays OFF. */
  document.getElementById('gen-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var link = document.getElementById('maps-input').value.trim();
    runPipeline(sampleInput(pickBusiness(link)));
  });

  document.getElementById('own-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var errEl = document.getElementById('own-error');
    function fail(msg) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    errEl.classList.add('hidden');

    var name = document.getElementById('own-name').value.trim();
    var category = document.getElementById('own-category').value.trim();
    var area = document.getElementById('own-area').value.trim();
    var services = document.getElementById('own-services').value.split(',')
      .map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 8);
    var parsed = parsePastedReviews(document.getElementById('own-reviews').value);

    if (!name || !category || !area) return fail('Fill in the business name, category and city.');
    if (parsed.reviews.length < 4) return fail('Paste at least 4 reviews, one per line.');
    if (!document.getElementById('own-rights').checked) {
      return fail('Please confirm you have the right to use these reviews.');
    }

    var ratings = parsed.reviews.map(function (r) { return r.rating; }).filter(function (r) { return r !== null; });
    var avg = ratings.length ? ratings.reduce(function (a, b) { return a + b; }, 0) / ratings.length : null;
    var mapsLink = document.getElementById('maps-input').value.trim();

    var input = {
      facts: {
        name: name.slice(0, 80), category: category.slice(0, 60), area: area.slice(0, 60),
        services: services.length ? services : ['Services listed on the site'],
        mapsUrl: mapsLink || null,
        rating: avg !== null ? Math.round(avg * 10) / 10 : null,
        reviewCount: parsed.reviews.length,
        palette: { accent: PALETTES[hashIndex(name, PALETTES.length)] }
      },
      reviews: parsed.reviews,
      sourceLabel: 'reviews supplied by the business owner'
    };
    if (parsed.removedContacts > 0) {
      var noteEl = document.getElementById('own-note');
      noteEl.textContent = 'Removed ' + parsed.removedContacts + ' email/phone/link before the AI saw anything.';
      noteEl.classList.remove('hidden');
    }
    runPipeline(input);
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
    var hashUrl = new URL('site.html#d=' + b64urlEncode(currentSpec), window.location.href).href;
    if (BACKEND !== null) {
      fetch('api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: currentSpec })
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          showPublished(j && j.url ? new URL(j.url, window.location.href).href : hashUrl);
        })
        .catch(function () { showPublished(hashUrl); });
    } else {
      showPublished(hashUrl);
    }
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
