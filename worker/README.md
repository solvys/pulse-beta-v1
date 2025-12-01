# X API Proxy - Cloudflare Worker

This Worker solves the CORS issue by acting as a proxy between your frontend and the X/Twitter API.

## Quick Deploy

### 1. Install Wrangler (Cloudflare CLI)
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```

### 3. Deploy the Worker
```bash
cd worker
wrangler deploy
```

After deployment, Wrangler will output your Worker URL, something like:
```
https://x-api-proxy.YOUR-SUBDOMAIN.workers.dev
```

### 4. Update Your Frontend

In your `index.tsx`, update the `fetchFeed` function to use the Worker:

```typescript
// Replace this line:
const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?...`, {
    headers: { 'Authorization': `Bearer ${settings.xBearerToken}` }
});

// With this:
const workerUrl = 'https://x-api-proxy.YOUR-SUBDOMAIN.workers.dev';
const res = await fetch(`${workerUrl}?query=${encodeURIComponent(query)}&max_results=${limit}&tweet_fields=created_at,text,referenced_tweets&expansions=referenced_tweets.id`, {
    headers: { 'X-Bearer-Token': settings.xBearerToken }
});
```

## Testing

Test the Worker with curl:

```bash
curl "https://x-api-proxy.YOUR-SUBDOMAIN.workers.dev?query=from:WalterBloomberg&max_results=5" \
  -H "X-Bearer-Token: YOUR_TWITTER_BEARER_TOKEN"
```

## Security Notes

- The Worker allows requests from any origin (`*`). For production, you can restrict this to your domain.
- Bearer tokens are passed through the Worker but never stored.
- Consider adding rate limiting if needed.

## Troubleshooting

**Worker not deploying?**
- Make sure you're logged in: `wrangler whoami`
- Check your account has Workers enabled

**Still getting CORS errors?**
- Verify you're using the Worker URL, not the X API URL directly
- Check the browser console for the exact error

**401 Unauthorized?**
- Verify your X Bearer Token is valid
- Check that the token has Read permissions for X API v2
