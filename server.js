/* server.js - ProofPage milestone-2 backend. Zero dependencies, Node 18+.
 *
 *   node server.js            # serves on http://localhost:3000
 *
 * Routes:
 *   GET  /                -> the generator front-end (static files from this folder)
 *   GET  /api/health      -> { ok: true, provider }
 *   POST /api/generate    -> { analysis, composition }   (body: { facts, reviews })
 *   POST /api/publish     -> { url: "/s/<slug>" }        (body: { spec })
 *   GET  /s/<slug>        -> published one-page site
 *
 * AI provider adapter:
 *   - OPENAI_API_KEY set      -> OpenAI-compatible chat completions
 *                                (OPENAI_BASE_URL, default https://api.openai.com/v1;
 *                                 OPENAI_MODEL, default gpt-5.4-mini; ~$0.03 per site)
 *   - otherwise               -> free key-less Pollinations text API
 *
 * The front-end auto-detects /api/health: served by this server it uses these
 * routes; on GitHub Pages it calls Pollinations directly from the browser.
 *
 * Published sites are stored in sites.json next to this file. On free hosts
 * with an ephemeral filesystem (e.g. Render Free) that file resets on
 * redeploy or spin-down - a real database is a later milestone.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SITES_FILE = path.join(ROOT, 'sites.json');
const MAX_REVIEWS = 100;
const MAX_BODY = 128 * 1024;
const GENERATE_LIMIT_PER_HOUR = 30;

const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/ai.js': ['ai.js', 'text/javascript; charset=utf-8'],
  '/render.js': ['render.js', 'text/javascript; charset=utf-8'],
  '/site.html': ['site.html', 'text/html; charset=utf-8']
};

const { renderSiteHtml } = require('./render.js');

/* ---------------- AI provider adapter ---------------- */

const sleep = ms => new Promise(r => setTimeout(r, ms));

function retryAfterSeconds(body) {
  const m = /retry after (\d+)s/i.exec(body || '');
  return m ? parseInt(m[1], 10) : null;
}

async function callAiOnce(messages, wantJson) {
  if (process.env.OPENAI_API_KEY) {
    const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        messages,
        ...(wantJson ? { response_format: { type: 'json_object' } } : {})
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error('AI provider HTTP ' + res.status);
      err.status = res.status;
      err.retryAfter = retryAfterSeconds(body);
      throw err;
    }
    const data = await res.json();
    return data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
  }
  const res = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model: 'openai', jsonMode: !!wantJson, private: true, referrer: 'proofpage-demo' })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error('AI provider HTTP ' + res.status);
    err.status = res.status;
    err.retryAfter = retryAfterSeconds(body);
    throw err;
  }
  return res.text();
}

/* The free Pollinations tier allows ~1 reply per 45s per IP; honour its
   retry-after hint so a two-call pipeline simply waits instead of failing. */
async function callAi(messages, wantJson) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callAiOnce(messages, wantJson);
    } catch (err) {
      const limited = err.status === 402 || err.status === 429 || err.status === 503;
      if (!limited || attempt >= 6) throw err;
      await sleep(((err.retryAfter || 45) + 3) * 1000);
    }
  }
}

function providerName() {
  return process.env.OPENAI_API_KEY
    ? 'openai-compatible:' + (process.env.OPENAI_MODEL || 'gpt-5.4-mini')
    : 'pollinations-free';
}

/* ---------------- JSON extraction + validation (mirror of ai.js) ---------------- */

function extractJson(raw) {
  const text = String(raw).trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in AI reply');
  return JSON.parse(text.slice(start, end + 1));
}

function stripContact(text) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[removed]')
    .replace(/(https?:\/\/\S+|www\.\S+)/gi, '[removed]')
    .replace(/(\+?\d[\d\s().-]{6,}\d)/g, '[removed]');
}

const ANALYZE_SYSTEM =
  'You analyse customer reviews for a local business and reply with ONLY a JSON object. ' +
  'Schema: {"themes":[{"label":string,"mentions":number,"reviewIds":[number]}],' +
  '"situations":[string],"objections":[string],"summary":string}. ' +
  'A theme needs support from at least 2 different reviewIds; a one-review observation ' +
  'goes into objections instead. Labels are 2-6 words, concrete and specific to this business. ' +
  'reviewIds refer to the review numbers given. summary is one sentence under 160 characters. ' +
  'objections lists complaints or weaknesses customers mention. ' +
  'Never invent facts, prices, awards or guarantees. No text outside the JSON.';

const COMPOSE_SYSTEM =
  'You write marketing copy for a one-page website and reply with ONLY a JSON object. ' +
  'Schema: {"headline":string,"subhead":string,"about":string,"themeLabels":[string],"topReviewIds":[number]}. ' +
  'headline: max 70 characters, specific to this business, no unsupported superlatives. ' +
  'subhead: max 140 characters. about: max 220 characters, third person. ' +
  'themeLabels must be copied EXACTLY from the supplied theme labels. ' +
  'topReviewIds: up to 3 review numbers that best support the themes. ' +
  'Use ONLY the confirmed facts and themes supplied. Never invent services, prices, ' +
  'awards, contact details or guarantees. No text outside the JSON.';

function validateAnalysis(data, reviewCount) {
  if (!data || typeof data !== 'object') throw new Error('reply is not an object');
  if (!Array.isArray(data.themes)) data.themes = [];
  data.themes = data.themes.filter(t => t && typeof t.label === 'string' && t.label.trim().length >= 3).slice(0, 6);
  data.themes.forEach(t => {
    t.label = t.label.trim().slice(0, 60);
    t.reviewIds = (Array.isArray(t.reviewIds) ? t.reviewIds : [])
      .filter(id => Number.isInteger(id) && id >= 1 && id <= reviewCount);
    t.mentions = t.reviewIds.length || (Number.isInteger(t.mentions) ? Math.max(1, Math.min(t.mentions, reviewCount)) : 1);
  });
  if (data.themes.length < 2) throw new Error('need at least 2 valid themes');
  data.summary = typeof data.summary === 'string' ? data.summary.trim().slice(0, 220) : '';
  data.situations = Array.isArray(data.situations) ? data.situations.slice(0, 4).map(String) : [];
  data.objections = Array.isArray(data.objections) ? data.objections.slice(0, 4).map(String) : [];
  return data;
}

function validateComposition(data, analysis, reviewCount) {
  if (!data || typeof data !== 'object') throw new Error('reply is not an object');
  const errors = [];
  [['headline', 80], ['subhead', 160], ['about', 240]].forEach(([field, max]) => {
    if (typeof data[field] !== 'string' || !data[field].trim()) {
      errors.push(field + ' missing');
      data[field] = '';
    } else {
      data[field] = stripContact(data[field].trim().slice(0, max));
    }
  });
  const labels = analysis.themes.map(t => t.label);
  const chosen = Array.isArray(data.themeLabels) ? data.themeLabels : [];
  data.themeLabels = chosen.filter(l => labels.includes(l));
  if (!data.themeLabels.length) data.themeLabels = labels.slice(0, 3);
  data.topReviewIds = (Array.isArray(data.topReviewIds) ? data.topReviewIds : [])
    .filter(id => Number.isInteger(id) && id >= 1 && id <= reviewCount).slice(0, 3);
  if (errors.length) throw new Error(errors.join('; '));
  return data;
}

async function runWithRepair(buildMessages, validate) {
  const messages = buildMessages();
  const raw = await callAi(messages, true);
  try {
    return validate(extractJson(raw));
  } catch (firstError) {
    const repair = messages.concat([
      { role: 'assistant', content: String(raw) },
      { role: 'user', content: 'That reply failed validation: ' + firstError.message + '. Return a corrected JSON object only, no other text.' }
    ]);
    return validate(extractJson(await callAi(repair, true)));
  }
}

async function generate(facts, reviews) {
  const analysis = await runWithRepair(
    () => [
      { role: 'system', content: ANALYZE_SYSTEM },
      { role: 'user', content: 'Business: ' + facts.name + ' (' + facts.category + ', ' + facts.area + ')\n\n' +
        reviews.map((r, i) => 'REVIEW ' + (i + 1) + (r.rating ? ' (' + r.rating + '/5)' : '') + ': ' + r.text).join('\n') }
    ],
    d => validateAnalysis(d, reviews.length));

  const composition = await runWithRepair(
    () => [
      { role: 'system', content: COMPOSE_SYSTEM },
      { role: 'user', content:
        'Confirmed facts: ' + JSON.stringify({ name: facts.name, category: facts.category, area: facts.area, services: facts.services }) +
        '\nApproved theme labels: ' + JSON.stringify(analysis.themes.map(t => t.label)) +
        '\nAnalysis summary: ' + analysis.summary +
        '\nReviews:\n' + reviews.map((r, i) => 'REVIEW ' + (i + 1) + ': ' + r.text).join('\n') }
    ],
    d => validateComposition(d, analysis, reviews.length));

  return { analysis, composition };
}

/* ---------------- publish store ---------------- */

function loadSites() {
  try { return JSON.parse(fs.readFileSync(SITES_FILE, 'utf8')); } catch (e) { return {}; }
}

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('spec missing');
  if (typeof spec.name !== 'string' || !spec.name.trim()) throw new Error('name missing');
  if (typeof spec.headline !== 'string' || !spec.headline.trim()) throw new Error('headline missing');
  spec.name = spec.name.slice(0, 80);
  spec.headline = spec.headline.slice(0, 80);
  spec.subhead = String(spec.subhead || '').slice(0, 160);
  spec.about = String(spec.about || '').slice(0, 240);
  spec.category = String(spec.category || '').slice(0, 60);
  spec.area = String(spec.area || '').slice(0, 60);
  spec.themes = (Array.isArray(spec.themes) ? spec.themes : []).slice(0, 6)
    .filter(t => t && typeof t.label === 'string')
    .map(t => ({ label: String(t.label).slice(0, 60), count: Number.isInteger(t.count) ? t.count : null }));
  spec.topReviews = (Array.isArray(spec.topReviews) ? spec.topReviews : []).slice(0, 3)
    .filter(r => r && typeof r.text === 'string')
    .map(r => ({ author: String(r.author || 'A customer').slice(0, 40), rating: Number.isInteger(r.rating) ? r.rating : null, text: String(r.text).slice(0, 500) }));
  spec.services = (Array.isArray(spec.services) ? spec.services : []).slice(0, 8).map(s => String(s).slice(0, 60));
  const accent = spec.palette && /^#[0-9a-fA-F]{6}$/.test(spec.palette.accent) ? spec.palette.accent : '#e8590c';
  spec.palette = { accent };
  spec.rating = typeof spec.rating === 'number' && isFinite(spec.rating) ? spec.rating : null;
  spec.reviewCount = Number.isInteger(spec.reviewCount) ? spec.reviewCount : (spec.topReviews.length || 0);
  spec.mapsUrl = typeof spec.mapsUrl === 'string' && /^https:\/\//.test(spec.mapsUrl) ? spec.mapsUrl : null;
  spec.sourceLabel = String(spec.sourceLabel || 'reviews supplied by the business owner').slice(0, 80);
  return spec;
}

/* ---------------- tiny rate limiter ---------------- */

const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + 3600e3 }; buckets.set(ip, b); }
  b.count++;
  return b.count > GENERATE_LIMIT_PER_HOUR;
}

/* ---------------- HTTP plumbing ---------------- */

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && STATIC_FILES[pathname]) {
      const [file, type] = STATIC_FILES[pathname];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      fs.createReadStream(path.join(ROOT, file)).pipe(res);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true, provider: providerName() });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/generate') {
      const ip = req.socket.remoteAddress || 'unknown';
      if (rateLimited(ip)) { sendJson(res, 429, { error: 'rate limited, try again later' }); return; }
      const body = await readBody(req);
      const facts = body.facts || {};
      const reviews = (Array.isArray(body.reviews) ? body.reviews : []).slice(0, MAX_REVIEWS)
        .filter(r => r && typeof r.text === 'string' && r.text.trim().length >= 12)
        .map(r => ({ author: 'A customer', rating: Number.isInteger(r.rating) ? r.rating : null, text: stripContact(r.text.trim().slice(0, 500)) }));
      if (!facts.name || !facts.category || !facts.area) { sendJson(res, 400, { error: 'facts.name, facts.category and facts.area are required' }); return; }
      if (reviews.length < 4) { sendJson(res, 400, { error: 'at least 4 reviews are required' }); return; }
      facts.services = (Array.isArray(facts.services) ? facts.services : []).slice(0, 8).map(s => String(s).slice(0, 60));
      const result = await generate({ name: String(facts.name).slice(0, 80), category: String(facts.category).slice(0, 60), area: String(facts.area).slice(0, 60), services: facts.services }, reviews);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/publish') {
      const body = await readBody(req);
      const spec = validateSpec(body.spec);
      const sites = loadSites();
      let slug;
      do { slug = crypto.randomBytes(4).toString('hex'); } while (sites[slug]);
      sites[slug] = { spec, publishedAt: new Date().toISOString() };
      fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2));
      sendJson(res, 200, { url: '/s/' + slug });
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/s/')) {
      const slug = pathname.slice(3).replace(/[^a-z0-9]/gi, '');
      const sites = loadSites();
      const entry = sites[slug];
      if (!entry) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font-family:sans-serif;text-align:center;margin-top:4em">This site does not exist (any more). <a href="/">Make one</a>.</p>');
        return;
      }
      const html = renderSiteHtml(entry.spec);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      res.end(html);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    sendJson(res, 500, { error: 'generation failed: ' + err.message });
  }
});

server.listen(PORT, () => {
  console.log('ProofPage server on http://localhost:' + PORT + ' (AI provider: ' + providerName() + ')');
});
