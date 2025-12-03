# News Aggregator - Alpaca + FinHub Hybrid Integration

A Python-based news aggregation system that combines Alpaca's market data API and FinHub's news API with intelligent deduplication for the Pulse trading application.

## Features

- **Dual-Source Integration**: Fetches news from both Alpaca and FinHub APIs
- **Smart Deduplication**: Multi-level matching to eliminate duplicate articles
- **Real-time Updates**: Optimized polling with incremental fetching
- **Rate Limit Management**: Automatic backoff and caching
- **Easy Configuration**: Environment-based API key management

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys
```

## Configuration

Create a `.env` file in the `news-aggregator` directory:

```env
# Alpaca API (get from https://app.alpaca.markets)
ALPACA_API_KEY=your_alpaca_key_here
ALPACA_API_SECRET=your_alpaca_secret_here

# FinHub API (get from https://finnhub.io/dashboard)
FINNHUB_API_KEY=your_finnhub_key_here

# Optional: Pulse endpoint
PULSE_ENDPOINT=http://localhost:5000/api/news

# Polling configuration
POLL_INTERVAL_SECONDS=60
DEDUPE_WINDOW_HOURS=24
```

## Usage

### Basic Usage

```bash
# Run the news aggregator
python src/main.py

# Run in test mode (5-minute test)
python src/main.py --test --duration=300

# Run with custom symbols
python src/main.py --symbols AAPL,TSLA,NVDA
```

### Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_deduplicator.py

# Run with coverage
pytest --cov=src tests/
```

## Project Structure

```
news-aggregator/
├── src/
│   ├── main.py              # Entry point
│   ├── news_aggregator.py   # Main orchestrator
│   ├── alpaca_client.py     # Alpaca API client
│   ├── finnhub_client.py    # FinHub API client
│   ├── deduplicator.py      # Deduplication logic
│   ├── delivery.py          # Delivery to Pulse
│   └── config.py            # Configuration management
├── tests/
│   ├── test_alpaca_client.py
│   ├── test_finnhub_client.py
│   ├── test_deduplicator.py
│   └── test_integration.py
├── requirements.txt
├── .env.example
└── README.md
```

## API Documentation

### Alpaca Market Data API
- Documentation: https://docs.alpaca.markets/docs/getting-started-with-alpaca-market-data
- News endpoint: `/v1beta1/news`

### FinHub Market News API
- Documentation: https://finnhub.io/docs/api
- News endpoint: `/api/v1/news`

## How Deduplication Works

The system uses a multi-level approach to identify duplicates:

1. **Exact URL Match** (100% duplicate)
2. **Source + Headline Similarity** > 85% (likely duplicate)
3. **Time Proximity** (within 5 min) + Symbol Match + Headline Similarity > 70%

Articles that don't match any criteria are considered unique and delivered to Pulse.

## Performance

- **Latency**: < 10 seconds from API fetch to Pulse delivery
- **Memory**: Maintains 24-hour cache of articles for deduplication
- **Rate Limits**: Automatic exponential backoff on 429 errors

## Support

For issues or questions:
- Check the implementation plan: `/Users/tifos/.gemini/antigravity/brain/*/implementation_plan.md`
- Review API documentation for Alpaca and FinHub
- Check logs in the console output

## License

MIT
