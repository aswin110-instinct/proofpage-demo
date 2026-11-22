# ProofPage demo

A "paste a Google Maps link, get a one-page website written from the
business's reviews" product — milestone 2: **live AI analysis**.

**Demo only.** Reviews come from three fictional sample businesses bundled in
`app.js`, or from feedback a merchant pastes themselves and confirms rights
to. No real Google data is fetched or stored, nothing is scraped, and this
project is not affiliated with Google.

## What's new in milestone 2

- **Real AI, not a simulation.** A free, key-less text AI API
  ([Pollinations](https://pollinations.ai)) runs the two blueprint calls:
  analyse reviews into themes, then compose the page copy.
- **Validated JSON into a fixed template.** Both AI replies are parsed and
  checked (theme labels, review IDs, length caps, contact-detail stripping),
  with one repair attempt and a template-copy fallback. The model never
  writes markup or code — `render.js` owns the page.
- **Your own reviews.** Merchants can paste their own feedback (one per
  line, optional `5 - ` rating prefix). Emails, phone numbers and links are
  stripped before the AI sees anything, and a rights confirmation is
  required.
- **A real backend, ready to deploy.** `server.js` is a zero-dependency
  Node server that serves the same front-end plus `/api/generate`,
  `/api/publish` and short published URLs at `/s/<slug>`. The front-end
  auto-detects it via `/api/health`.

The automatic Google-review import stays **off** — official Google APIs
return at most 5 reviews and their terms restrict building content from
them. A pasted Maps link is accepted as a business reference only.

## Flow

1. Paste a Google Maps link (reference only), pick a sample business, or
   paste your own reviews.
2. Live AI finds the themes customers repeat, then writes the page copy.
3. Preview the generated one-page site (desktop / mobile).
4. **Publish** produces a shareable link. On GitHub Pages the whole site is
   encoded in the URL (`site.html#d=…`); on the Node backend it is a short
   `/s/<slug>` link stored server-side. In the full product this link is
   emailed to the business owner.

## Files

- `index.html` — generator app (landing, own-reviews intake, pipeline, preview, publish)
- `app.js` — sample businesses, intake, pipeline orchestration
- `ai.js` — browser AI client: Pollinations transport, prompts, JSON validation
- `render.js` — shared fixed template for the generated one-page site
- `site.html` — published-site view (decodes the URL hash)
- `server.js` — zero-dependency Node backend (static hosting + API + short publish URLs)
- `styles.css` — generator app styles

## Running the backend

```bash
node server.js    # http://localhost:3000
```

No `npm install` needed (Node 18+). AI provider adapter:

- Default: free Pollinations text API, no key.
- Paid, higher quality: set `OPENAI_API_KEY` (optionally `OPENAI_BASE_URL`
  and `OPENAI_MODEL`, default `gpt-5.4-mini`). Roughly **$0.03 per
  generated site** at current list prices.

### Deploy free

- **Render Free web service**: New → Web Service → this repo, start command
  `node server.js`. $0; sleeps after 15 idle minutes with a ~1 minute cold
  start, and `sites.json` resets on redeploy (ephemeral disk).
- **Cloudflare Workers/Pages Free**: 100,000 requests/day at $0; needs the
  code adapted to the Workers runtime (not full Node).
- Both need a new hosting account — pick one and this repo is ready.

## Static hosting

GitHub Pages serves this folder as-is; the front-end then talks to the AI
directly from the browser and publishes URL-encoded sites.
