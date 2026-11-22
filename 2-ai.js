/* ai.js - ProofPage AI client (milestone 2).
   Calls the free, key-less Pollinations text API directly from the browser.
   Everything the model returns is parsed and validated as DATA. It is never
   executed, and it only ever fills fixed slots in the site template.
   If this page is served by the ProofPage Node backend, calls go to
   /api/* instead and the server picks the AI provider. */
var AI = (function () {
  'use strict';

  var POLLINATIONS = 'https://text.pollinations.ai/';

  /* ---------------- transport ----------------
     The free anonymous tier allows roughly 1 reply per 45s per IP and
     answers 402/503 with a 'Retry after Ns' hint. We honour that hint:
     retry with the asked delay, up to 4 attempts, and tell the UI so the
     pipeline can show the wait instead of looking stuck. */

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function checkResponse(res) {
    if (res.ok) return res.text();
    return res.text().then(function (body) {
      var m = /retry after (\d+)s/i.exec(body || '');
      var err = new Error('AI service HTTP ' + res.status);
      err.status = res.status;
      err.retryAfter = m ? parseInt(m[1], 10) : null;
      throw err;
    });
  }

  function postPollinations(messages, wantJson) {
    return fetch(POLLINATIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages, model: 'openai', jsonMode: !!wantJson, private: true, referrer: 'proofpage-demo' })
    }).then(checkResponse);
  }

  function getPollinations(messages) {
    var prompt = messages.map(function (m) {
      return (m.role === 'system' ? 'INSTRUCTIONS' : 'REQUEST') + ':\n' + m.content;
    }).join('\n\n');
    var url = POLLINATIONS + encodeURIComponent(prompt) + '?model=openai&private=true&referrer=proofpage-demo';
    return fetch(url).then(checkResponse);
  }

  function chatOnce(messages, wantJson) {
    return postPollinations(messages, wantJson).catch(function (postErr) {
      if (postErr.status === 402 || postErr.status === 429 || postErr.status === 503) throw postErr;
      return getPollinations(messages); /* non-rate-limit failure: try the GET transport */
    });
  }

  function chat(messages, wantJson, onWait) {
    var attempt = 0;
    function tryOnce() {
      attempt++;
      return chatOnce(messages, wantJson).catch(function (err) {
        var limited = err.status === 402 || err.status === 429 || err.status === 503;
        if (limited && attempt < 5) {
          var wait = (err.retryAfter || 45) + 3;
          if (onWait) onWait(wait, attempt);
          return sleep(wait * 1000).then(tryOnce);
        }
        throw err;
      });
    }
    return tryOnce();
  }

  /* ---------------- JSON extraction ---------------- */

  function extractJson(raw) {
    var text = String(raw).trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object in AI reply');
    return JSON.parse(text.slice(start, end + 1));
  }

  /* ---------- contact-detail stripping (before anything leaves the page) ---------- */

  function stripContact(text) {
    var removed = 0;
    var out = String(text)
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, function () { removed++; return '[removed]'; })
      .replace(/(https?:\/\/\S+|www\.\S+)/gi, function () { removed++; return '[removed]'; })
      .replace(/(\+?\d[\d\s().-]{6,}\d)/g, function () { removed++; return '[removed]'; });
    return { text: out, removed: removed };
  }

  /* ---------------- step 1: analyse reviews ---------------- */

  var ANALYZE_SYSTEM =
    'You analyse customer reviews for a local business and reply with ONLY a JSON object. ' +
    'Schema: {"themes":[{"label":string,"mentions":number,"reviewIds":[number]}],' +
    '"situations":[string],"objections":[string],"summary":string}. ' +
    'A theme needs support from at least 2 different reviewIds; a one-review observation ' +
    'goes into objections instead. Labels are 2-6 words, concrete and specific to this business. ' +
    'reviewIds refer to the review numbers given. summary is one sentence under 160 characters. ' +
    'objections lists complaints or weaknesses customers mention. ' +
    'Never invent facts, prices, awards or guarantees. No text outside the JSON.';

  function analyzeMessages(facts, reviews) {
    var numbered = reviews.map(function (r, i) {
      return 'REVIEW ' + (i + 1) + (r.rating ? ' (' + r.rating + '/5)' : '') + ': ' + r.text;
    }).join('\n');
    return [
      { role: 'system', content: ANALYZE_SYSTEM },
      { role: 'user', content: 'Business: ' + facts.name + ' (' + facts.category + ', ' + facts.area + ')\n\n' + numbered }
    ];
  }

  function validateAnalysis(data, reviewCount) {
    var errors = [];
    if (!data || typeof data !== 'object') throw new Error('reply is not an object');
    if (!Array.isArray(data.themes)) {
      errors.push('themes missing');
      data.themes = [];
    }
    data.themes = data.themes.filter(function (t) {
      return t && typeof t.label === 'string' && t.label.trim().length >= 3;
    }).slice(0, 6);
    data.themes.forEach(function (t) {
      t.label = t.label.trim().slice(0, 60);
      t.reviewIds = (Array.isArray(t.reviewIds) ? t.reviewIds : []).filter(function (id) {
        return Number.isInteger(id) && id >= 1 && id <= reviewCount;
      });
      t.mentions = t.reviewIds.length || (Number.isInteger(t.mentions) ? Math.max(1, Math.min(t.mentions, reviewCount)) : 1);
    });
    if (data.themes.length < 2) errors.push('need at least 2 valid themes');
    data.summary = typeof data.summary === 'string' ? data.summary.trim().slice(0, 220) : '';
    data.situations = Array.isArray(data.situations) ? data.situations.slice(0, 4).map(String) : [];
    data.objections = Array.isArray(data.objections) ? data.objections.slice(0, 4).map(String) : [];
    if (errors.length) throw new Error(errors.join('; '));
    return data;
  }

  /* ---------------- step 2: compose the page copy ---------------- */

  var COMPOSE_SYSTEM =
    'You write marketing copy for a one-page website and reply with ONLY a JSON object. ' +
    'Schema: {"headline":string,"subhead":string,"about":string,"themeLabels":[string],"topReviewIds":[number]}. ' +
    'headline: max 70 characters, specific to this business, no unsupported superlatives. ' +
    'subhead: max 140 characters. about: max 220 characters, third person. ' +
    'themeLabels must be copied EXACTLY from the supplied theme labels. ' +
    'topReviewIds: up to 3 review numbers that best support the themes. ' +
    'Use ONLY the confirmed facts and themes supplied. Never invent services, prices, ' +
    'awards, contact details or guarantees. No text outside the JSON.';

  function composeMessages(facts, analysis, reviews) {
    return [
      { role: 'system', content: COMPOSE_SYSTEM },
      { role: 'user', content:
        'Confirmed facts: ' + JSON.stringify({
          name: facts.name, category: facts.category, area: facts.area, services: facts.services
        }) +
        '\nApproved theme labels: ' + JSON.stringify(analysis.themes.map(function (t) { return t.label; })) +
        '\nAnalysis summary: ' + analysis.summary +
        '\nReviews:\n' + reviews.map(function (r, i) { return 'REVIEW ' + (i + 1) + ': ' + r.text; }).join('\n') }
    ];
  }

  function validateComposition(data, analysis, reviewCount) {
    var errors = [];
    if (!data || typeof data !== 'object') throw new Error('reply is not an object');
    ['headline', 'subhead', 'about'].forEach(function (field) {
      if (typeof data[field] !== 'string' || !data[field].trim()) {
        errors.push(field + ' missing');
        data[field] = '';
      } else {
        data[field] = stripContact(data[field].trim().slice(0, field === 'headline' ? 80 : field === 'subhead' ? 160 : 240)).text;
      }
    });
    var labels = analysis.themes.map(function (t) { return t.label; });
    var chosen = Array.isArray(data.themeLabels) ? data.themeLabels : [];
    data.themeLabels = chosen.filter(function (l) { return labels.indexOf(l) !== -1; });
    if (!data.themeLabels.length) data.themeLabels = labels.slice(0, 3);
    data.topReviewIds = (Array.isArray(data.topReviewIds) ? data.topReviewIds : []).filter(function (id) {
      return Number.isInteger(id) && id >= 1 && id <= reviewCount;
    }).slice(0, 3);
    if (errors.length) throw new Error(errors.join('; '));
    return data;
  }

  /* ---------- run a call, then one repair attempt if validation fails ---------- */

  function runWithRepair(buildMessages, validate, onWait) {
    var messages = buildMessages();
    return chat(messages, true, onWait).then(function (raw) {
      try {
        return validate(extractJson(raw));
      } catch (firstError) {
        var repair = messages.concat([
          { role: 'assistant', content: typeof raw === 'string' ? raw : String(raw) },
          { role: 'user', content: 'That reply failed validation: ' + firstError.message + '. Return a corrected JSON object only, no other text.' }
        ]);
        return chat(repair, true, onWait).then(function (raw2) {
          return validate(extractJson(raw2));
        });
      }
    });
  }

  return {
    analyze: function (facts, reviews, onWait) {
      return runWithRepair(
        function () { return analyzeMessages(facts, reviews); },
        function (d) { return validateAnalysis(d, reviews.length); },
        onWait);
    },
    compose: function (facts, analysis, reviews, onWait) {
      return runWithRepair(
        function () { return composeMessages(facts, analysis, reviews); },
        function (d) { return validateComposition(d, analysis, reviews.length); },
        onWait);
    },
    stripContact: stripContact
  };
})();
