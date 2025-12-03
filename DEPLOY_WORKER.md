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

### Alternative: Set Variables in Dashboard

1. Go to Cloudflare Workers dashboard
2. Select your worker
3. Go to Settings → Variables
4. Add:
   - `ALPACA_API_KEY`
   - `ALPACA_API_SECRET`
   - `FINNHUB_API_KEY`

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
