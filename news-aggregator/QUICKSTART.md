# 🎯 Quick Start Guide - Alpaca + FinHub News Integration

## ✅ What's Ready

The complete news aggregation system has been implemented in:
```
/Users/tifos/Library/Mobile Documents/com~apple~CloudDocs/Priced In/pulse/news-aggregator/
```

### 📁 Complete Structure (14 files)

```
news-aggregator/
├── src/               # 7 Python modules (1,030+ lines)
├── tests/             # Test suite
├── setup.sh           # Quick setup script
├── requirements.txt   # Dependencies
├── .env.example       # Configuration template
└── README.md          # Full documentation
```

---

## 🚀 Quick Setup (3 Steps)

### 1. Navigate to Project
```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Priced\ In/pulse/news-aggregator
```

### 2. Run Setup Script
```bash
./setup.sh
```

This will:
- Create Python virtual environment
- Install all dependencies
- Create `.env` file from template
- Validate configuration

### 3. Add API Keys

Edit the `.env` file:
```bash
nano .env  # or use your preferred editor
```

**Required:**
- `FINNHUB_API_KEY` - Get from https://finnhub.io/dashboard

**Optional (for stock news):**
- `ALPACA_API_KEY` - Get from https://app.alpaca.markets
- `ALPACA_API_SECRET`

---

## 🧪 Testing

### Test Configuration
```bash
python src/config.py
```

### Run Single Cycle Test
```bash
python src/main.py --test
```

### Run Automated Tests
```bash
pytest
```

---

## 🏃 Running

### Continuous Mode (Production)
```bash
python src/main.py
```

### Custom Settings
```bash
# Track specific symbols
python src/main.py --symbols AAPL,TSLA,NVDA

# Change polling interval to 30 seconds
python src/main.py --interval 30

# 5-minute test run
python src/main.py --duration 300

# Verbose logging
python src/main.py --verbose
```

---

## 🔑 Getting API Keys

### Alpaca (Optional for stock news)
1. Go to https://app.alpaca.markets/brokerage/new-account
2. Complete account signup (Individual or Business)
3. Navigate to API section in sidebar
4. Click "Generate New Keys"
5. Copy both API Key and Secret

### FinHub (Required)
1. Go to https://finnhub.io/register
2. Sign up for free account
3. Go to https://finnhub.io/dashboard
4. Copy your API key
5. Free tier includes 60 API calls/minute

---

## 📊 What You'll See

When running successfully:

```
==============================================================
  📰 PULSE NEWS AGGREGATOR
  Alpaca + FinHub Hybrid Integration
==============================================================
✅ Configuration validated successfully
📌 Tracking configured symbols: AAPL, TSLA, NVDA, GOOGL, MSFT...
🔄 Starting news aggregation cycle 1
📥 Fetched 23 from Alpaca, 15 from FinHub
🧹 Deduplication: 32/38 unique articles
📤 Sending 32 articles to Pulse at mock
✅ Cycle complete: 32 unique articles
📊 Dedup stats: {'total_processed': 38, 'exact_url_dupes': 4, ...}
⏸️  Sleeping for 60s...
```

---

## 🔗 Integration with Pulse

### Option 1: HTTP Endpoint (Recommended)
Set `PULSE_ENDPOINT` in `.env`:
```env
PULSE_ENDPOINT=http://localhost:5000/api/news
```

The system will POST news in this format:
```json
{
  "news": [
    {
      "id": "finnhub-123456",
      "headline": "Tesla announces...",
      "summary": "Summary text",
      "url": "https://...",
      "image": "https://...",
      "source": "FinHub",
      "timestamp": 1701518400,
      "symbols": ["TSLA"],
      "category": "company",
      "origin": "finnhub"
    }
  ]
}
```

### Option 2: File-Based
Leave `PULSE_ENDPOINT` as `mock` and use:
```python
from delivery import NewsDelivery
delivery = NewsDelivery()
delivery.save_to_file(news_items, 'pulse_news.json')
```

---

## 📈 Performance Expectations

- **Latency**: < 10 seconds from fetch to delivery
- **Deduplication**: 15-30% typical duplicate rate
- **Memory**: ~50-100 MB for 24-hour cache
- **API Calls**: 2 calls/minute (1 Alpaca + 1 FinHub)

---

## 🆘 Troubleshooting

### "Configuration errors: FINNHUB_API_KEY is not configured"
→ Add your FinHub API key to `.env` file

### "Error fetching FinHub news"
→ Check API key is valid  
→ Verify internet connection  
→ Check FinHub API status

### No articles returned
→ Normal during low-volume periods  
→ Try different symbols  
→ Check time range settings

---

## 📚 Documentation

- **README.md** - Complete documentation
- **implementation_plan.md** - Architecture & design
- **walkthrough.md** - Implementation details
- Code comments - Inline documentation

---

## 🎯 Next Actions

1. ✅ **Setup Complete** - All code is ready
2. ⏳ **Add API Keys** - Get keys and configure `.env`
3. ⏳ **Test System** - Run `python src/main.py --test`
4. ⏳ **Integrate with Pulse** - Set up endpoint or file watching
5. ⏳ **Deploy** - Run in production mode

---

## 💡 Pro Tips

- Start with `--test` mode to verify everything works
- Use `--verbose` for debugging
- Monitor logs for `❌` error messages
- Check deduplication stats to tune thresholds
- Run tests after any code changes: `pytest`

---

## 📞 Support

- Implementation plan: `implementation_plan.md`
- Detailed walkthrough: `walkthrough.md`
- API docs: Alpaca & FinHub official documentation
- Tests: Run `pytest -v` for detailed output

---

**Status**: ✅ Ready to use once API keys are configured!
