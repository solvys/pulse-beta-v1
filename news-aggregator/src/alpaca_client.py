"""Alpaca Market Data API client for news fetching."""
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class AlpacaNewsClient:
    """Client for fetching news from Alpaca Market Data API."""
    
    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None, base_url: str = "https://data.alpaca.markets/v1beta1"):
        """
        Initialize Alpaca news client.
        
        Args:
            api_key: Alpaca API key (optional for crypto data)
            api_secret: Alpaca API secret (optional for crypto data)
            base_url: Base URL for Alpaca API
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url
        self.last_fetch_time = None
    
    def get_news(self, symbols: Optional[List[str]] = None, hours_back: int = 1, limit: int = 50) -> List[Dict]:
        """
        Fetch news from Alpaca API.
        
        Args:
            symbols: List of symbols to fetch news for (None for all)
            hours_back: How many hours back to fetch news
            limit: Maximum number of articles to return
        
        Returns:
            List of news articles in normalized format
        """
        try:
            # Calculate time range
            end = datetime.now()
            start = end - timedelta(hours=hours_back)
            
            # Build request parameters
            params = {
                "start": start.isoformat() + "Z",
                "end": end.isoformat() + "Z",
                "limit": limit,
                "sort": "desc"
            }
            
            if symbols:
                params["symbols"] = ",".join(symbols)
            
            # Build headers
            headers = {}
            if self.api_key and self.api_secret:
                headers = {
                    "APCA-API-KEY-ID": self.api_key,
                    "APCA-API-SECRET-KEY": self.api_secret
                }
            
            # Make request
            logger.info(f"Fetching Alpaca news: symbols={symbols}, hours_back={hours_back}")
            response = requests.get(
                f"{self.base_url}/news",
                params=params,
                headers=headers,
                timeout=30
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Extract news array from response
            news_items = data.get('news', []) if isinstance(data, dict) else data
            
            logger.info(f"✅ Fetched {len(news_items)} articles from Alpaca")
            self.last_fetch_time = datetime.now()
            
            # Normalize to common format
            return [self._normalize_article(article) for article in news_items]
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Error fetching Alpaca news: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error in Alpaca client: {e}")
            return []
    
    def _normalize_article(self, article: Dict) -> Dict:
        """
        Normalize Alpaca article to common format.
        
        Args:
            article: Raw article from Alpaca API
        
        Returns:
            Normalized article dictionary
        """
        # Parse timestamp
        created_at = article.get('created_at', article.get('updated_at', ''))
        try:
            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            timestamp = int(dt.timestamp())
        except:
            timestamp = int(datetime.now().timestamp())
        
        # Extract symbols
        symbols = article.get('symbols', [])
        related = ','.join(symbols) if symbols else ''
        
        return {
            'id': article.get('id', 0),
            'headline': article.get('headline', ''),
            'summary': article.get('summary', ''),
            'url': article.get('url', ''),
            'image': article.get('images', [{}])[0].get('url', '') if article.get('images') else '',
            'source': article.get('source', 'Alpaca'),
            'datetime': timestamp,
            'category': 'company',
            'related': related,
            'origin': 'alpaca'
        }


if __name__ == "__main__":
    # Test the client
    logging.basicConfig(level=logging.INFO)
    client = AlpacaNewsClient()
    news = client.get_news(symbols=['AAPL', 'TSLA'], hours_back=2, limit=10)
    print(f"📰 Fetched {len(news)} articles")
    if news:
        print(f"Sample: {news[0]['headline'][:80]}...")
