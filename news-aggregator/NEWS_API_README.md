# News Feed API Setup

## Quick Start (Local)

1. **Install dependencies:**
```bash
cd news-aggregator
pip install -r requirements_api.txt
```

2. **Set API keys in `.env`:**
```bash
ALPACA_API_KEY=your_alpaca_key
ALPACA_API_SECRET=your_alpaca_secret
FINNHUB_API_KEY=your_finnhub_key
```

3. **Run the server:**
```bash
python api_server.py
```

Server runs on `http://localhost:5000`

## Endpoints

### GET `/news`
Returns aggregated news from Alpaca + Finnhub

**Parameters:**
- `limit` (optional): Number of articles (default: 20)
- `symbols` (optional): Comma-separated symbols for Alpaca filtering

**Example:**
```
GET http://localhost:5000/news?limit=20&symbols=SPY,QQQ
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "headline": "Market Update...",
      "summary": "...",
      "source": "Alpaca",
      "datetime": 1733275200,
      "origin": "alpaca"
    }
  ],
  "count": 20
}
```

### GET `/health`
Health check endpoint

## Deploy to Cloudflare Workers

The Flask app can be deployed to Cloudflare Workers using:
- Convert to Workers format, OR
- Deploy as is using Cloudflare Workers Python runtime

## Update Frontend

Change the news feed fetch URL in `index.tsx` from:
```typescript
const WORKER_URL = 'https://x-api-proxy.pricedinresearch.workers.dev/';
```

To:
```typescript
const NEWS_API_URL = 'http://localhost:5000/news'; // or your deployed URL
```
