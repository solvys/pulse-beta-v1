# Cloudflare Workers Deployment Guide

## News Aggregator Worker

### Quick Deploy

```bash
cd worker

# Login to Cloudflare (if not already)
npx wrangler login

# Set API keys as secrets (recommended)
npx wrangler secret put ALPACA_API_KEY
npx wrangler secret put ALPACA_API_SECRET
npx wrangler secret put FINNHUB_API_KEY

# Deploy the news aggregator
npx wrangler deploy news-aggregator.js --config wrangler-news.toml
```

### Option 2: Manual Deployment (Dashboard)

If you prefer using the Cloudflare Dashboard:

1.  **Create Application**:
    *   Log in to Cloudflare Dashboard > **Workers & Pages**.
    *   Click **Create Application** > **Create Worker**.
    *   Name it `news-aggregator` (or similar).
    *   Click **Deploy**.

2.  **Update Code**:
    *   Click **Edit Code**.
    *   Delete the default "Hello World" code.
    *   Copy the entire content of `worker/news-aggregator.js` from your local project.
    *   Paste it into the editor (replace everything).
    *   Click **Save and Deploy**.

3.  **Configure Secrets (API Keys)**:
    *   Go back to the Worker's **Settings** tab.
    *   Go to **Variables and Secrets**.
    *   Click **Add** for each key:
        *   `ALPACA_API_KEY`: Your Alpaca Key
        *   `ALPACA_API_SECRET`: Your Alpaca Secret
        *   `FINNHUB_API_KEY`: Your Finnhub Key
    *   Click **Deploy** again if needed to apply changes.

4.  **Get URL**:
    *   Copy your worker's URL (e.g., `https://news-aggregator.your-subdomain.workers.dev`).
    *   Update `index.tsx` with this new URL.

### Option 3: CLI Deployment (Recommended)

### Test the Worker

Once deployed, test it:
```bash
curl "https://news-aggregator.YOUR_SUBDOMAIN.workers.dev/?limit=10"
```

### Update Frontend

In `index.tsx`, change the worker URL from:
```typescript
const WORKER_URL = 'https://x-api-proxy.pricedinresearch.workers.dev/';
```

To:
```typescript
const NEWS_WORKER_URL = 'https://news-aggregator.YOUR_SUBDOMAIN.workers.dev/';
```

---

## Newswire API Worker (formerly X API Proxy)

The X API proxy has been replaced/renamed to `newswire-api.js`.

```bash
# Deploy Newswire API
npx wrangler deploy newswire-api.js
```

---

## Troubleshooting

**CORS errors?**
- Check that worker is returning proper CORS headers
- Verify `Access-Control-Allow-Origin: *` is set

**No data?**
- Check API keys are set in Cloudflare dashboard
- View worker logs: `npx wrangler tail news-aggregator`

**Rate limits?**
- Alpaca: 200 requests/minute
- Finnhub: Depends on plan (free tier: 60 calls/minute)
