"""
Simple Flask/FastAPI endpoint to serve news from Alpaca + Finnhub.
Deploy this to Cloudflare Workers or any serverless platform.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Import the clients from news-aggregator
import sys
sys.path.append('./news-aggregator/src')
from alpaca_client import AlpacaNewsClient
from finnhub_client import FinnHubNewsClient

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize clients
alpaca = AlpacaNewsClient(
    api_key=os.getenv('ALPACA_API_KEY'),
    api_secret=os.getenv('ALPACA_API_SECRET')
)

finnhub = FinnHubNewsClient(
    api_key=os.getenv('FINNHUB_API_KEY')
)

@app.route('/news', methods=['GET'])
def get_news():
    """
    Get aggregated news from Alpaca + Finnhub.
    
    Query Parameters:
    - limit: number of articles (default: 20)
    - symbols: comma-separated symbols for Alpaca (optional)
    """
    try:
        limit = int(request.args.get('limit', 20))
        symbols_param = request.args.get('symbols', '')
        symbols = symbols_param.split(',') if symbols_param else None
        
        # Fetch from both sources
        alpaca_news = alpaca.get_news(symbols=symbols, hours_back=1, limit=limit//2) if symbols else []
        finnhub_news = finnhub.get_news(category='general', use_incremental=True)[:limit//2]
        
        # Combine and sort by datetime
        all_news = alpaca_news + finnhub_news
        all_news.sort(key=lambda x: x.get('datetime', 0), reverse=True)
        
        # Return in format expected by frontend
        return jsonify({
            'success': True,
            'data': all_news[:limit],
            'count': len(all_news[:limit])
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
