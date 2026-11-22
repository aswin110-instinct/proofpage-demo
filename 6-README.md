# ProofPage demo

A static milestone-1 demo of a "paste a Google Maps link, get a one-page website
written from the business's reviews" product.

**Demo only.** Every link generates from the three fictional sample businesses
bundled in `app.js`. No real Google data is fetched or stored, and this project
is not affiliated with Google.

## Flow

1. Paste a Google Maps link (or pick a sample business).
2. A simulated pipeline analyses the sample reviews, surfaces repeated themes,
   and writes the page copy.
3. Preview the generated one-page site (desktop / mobile).
4. **Publish** produces a shareable link (`site.html#d=…`) — the whole site spec
   is encoded in the URL, so the published page works on any static host with no
   backend. In the full product this link would be emailed to the business owner.

## Files

- `index.html` — generator app (landing, pipeline, preview, publish)
- `app.js` — sample businesses and generation logic
- `render.js` — shared renderer for the generated one-page site
- `site.html` — published-site view (decodes the URL hash)
- `styles.css` — generator app styles

## Running

Static files only. Open `index.html` or serve the folder with any static host
(e.g. GitHub Pages).
