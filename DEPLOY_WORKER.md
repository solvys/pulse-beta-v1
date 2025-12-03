# News Feed Cloudflare Worker Deployment

## Quick Deploy Instructions

Your X API proxy worker code is already correct with CORS headers in `/worker/x-api-proxy.js`.

To deploy/redeploy the worker to fix the CORS errors:

```bash
cd "/Users/tifos/Library/Mobile Documents/com~apple~CloudDocs/Priced In/pulse/worker"

# Login to Cloudflare (if not already)
npx wrangler login

# Deploy the worker
npx wrangler deploy x-api-proxy.js

# Or publish (same thing)
npx wrangler publish x-api-proxy.js
```

The worker will be deployed to: `https://x-api-proxy.pricedinresearch.workers.dev/`

## What the Worker Does

- Proxies requests to X/Twitter API
- Adds proper CORS headers for localhost:3000
- Requires bearer token in `X-Bearer-Token` header
- Handles preflight OPTIONS requests

## Current Issues in Console

1. **CORS Error**: Worker deployed but not responding with CORS headers → **REDEPLOY WORKER**
2. **Claude Model**: Fixed (changed from 20241022 to 20240620) ✅
3. **ProjectX Auth**: Needs valid credentials in settings
4. **SignalR**: Connects then disconnects (auth issue)

## Alternative: Update Worker Code

If the worker needs changes, the file at `/worker/x-api-proxy.js` already has correct CORS configuration. Just redeploy it.
