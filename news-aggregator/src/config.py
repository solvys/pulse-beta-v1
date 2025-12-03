"""Configuration management for news aggregator."""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Alpaca API Configuration
ALPACA_API_KEY = os.getenv('ALPACA_API_KEY')
ALPACA_API_SECRET = os.getenv('ALPACA_API_SECRET')
ALPACA_BASE_URL = "https://data.alpaca.markets/v1beta1"

# FinHub API Configuration
FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')
FINNHUB_BASE_URL = "https://finnhub.io/api/v1"

# Gemini API Configuration (for IV scoring)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Application Configuration
POLL_INTERVAL_SECONDS = int(os.getenv('POLL_INTERVAL_SECONDS', 60))
DEDUPE_WINDOW_HOURS = int(os.getenv('DEDUPE_WINDOW_HOURS', 24))
PULSE_ENDPOINT = os.getenv('PULSE_ENDPOINT', 'http://localhost:5000/api/news')

# Symbols to track
TRACKED_SYMBOLS_STR = os.getenv('TRACKED_SYMBOLS', 'AAPL,TSLA,NVDA,GOOGL,MSFT,AMZN')
TRACKED_SYMBOLS = [s.strip() for s in TRACKED_SYMBOLS_STR.split(',') if s.strip()]

# Validation
def validate_config():
    """Validate that required configuration is present."""
    errors = []
    
    if not FINNHUB_API_KEY or FINNHUB_API_KEY == 'your_finnhub_key_here':
        errors.append("FINNHUB_API_KEY is not configured")
    
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'your_gemini_key_here':
        errors.append("GEMINI_API_KEY is not configured (required for IV scoring)")
    
    # Alpaca keys are optional for crypto data
    warnings = []
    if not ALPACA_API_KEY or ALPACA_API_KEY == 'your_alpaca_key_here':
        warnings.append("ALPACA_API_KEY is not configured (optional for crypto data)")
    
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")
    
    if warnings:
        print(f"⚠️  Configuration warnings: {', '.join(warnings)}")
    
    return True

if __name__ == "__main__":
    # Test configuration
    validate_config()
    print("✅ Configuration validated successfully")
    print(f"📊 Tracking {len(TRACKED_SYMBOLS)} symbols: {', '.join(TRACKED_SYMBOLS[:5])}..." if len(TRACKED_SYMBOLS) > 5 else f"📊 Tracking symbols: {', '.join(TRACKED_SYMBOLS)}")
    print(f"🔄 Poll interval: {POLL_INTERVAL_SECONDS}s")
    print(f"🧹 Dedupe window: {DEDUPE_WINDOW_HOURS}h")
