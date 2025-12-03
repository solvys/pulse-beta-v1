"""FinHub Market News API client."""
import requests
from typing import List, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FinnHubNewsClient:
    """Client for fetching news from FinHub API."""
    
    def __init__(self, api_key: str, base_url: str = "https://finnhub.io/api/v1"):
        """
        Initialize FinHub news client.
        
        Args:
            api_key: FinHub API key
            base_url: Base URL for FinHub API
        """
        self.api_key = api_key
        self.base_url = base_url
        self.last_id = None
    
    def get_news(self, category: str = "general", use_incremental: bool = True) -> List[Dict]:
        """
        Fetch news from FinHub API.
        
        Args:
            category: News category (general, forex, crypto, merger)
            use_incremental: Whether to use minId for incremental fetching
        
        Returns:
            List of news articles in normalized format
        """
        try:
            # Build request parameters
            params = {
                "category": category,
                "token": self.api_key
            }
            
            # Use minId for incremental updates
            if use_incremental and self.last_id:
                params["minId"] = self.last_id
                logger.info(f"Fetching FinHub news incrementally from ID {self.last_id}")
            else:
                logger.info(f"Fetching FinHub news: category={category}")
            
            # Make request
            response = requests.get(
                f"{self.base_url}/news",
                params=params,
                timeout=30
            )
            
            response.raise_for_status()
            news_items = response.json()
            
            # Update last_id for next incremental fetch
            if news_items and len(news_items) > 0:
                max_id = max(article.get('id', 0) for article in news_items)
                if max_id > (self.last_id or 0):
                    self.last_id = max_id
                    logger.debug(f"Updated last_id to {self.last_id}")
            
            logger.info(f"✅ Fetched {len(news_items)} articles from FinHub")
            
            # Normalize to common format
            return [self._normalize_article(article) for article in news_items]
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Error fetching FinHub news: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error in FinHub client: {e}")
            return []
    
    def get_company_news(self, symbol: str, from_date: str, to_date: str) -> List[Dict]:
        """
        Fetch company-specific news from FinHub API.
        
        Args:
            symbol: Company symbol (e.g., 'AAPL')
            from_date: Start date (YYYY-MM-DD)
            to_date: End date (YYYY-MM-DD)
        
        Returns:
            List of news articles in normalized format
        """
        try:
            params = {
                "symbol": symbol,
                "from": from_date,
                "to": to_date,
                "token": self.api_key
            }
            
            logger.info(f"Fetching FinHub company news: {symbol}")
            response = requests.get(
                f"{self.base_url}/company-news",
                params=params,
                timeout=30
            )
            
            response.raise_for_status()
            news_items = response.json()
            
            logger.info(f"✅ Fetched {len(news_items)} company articles from FinHub")
            
            # Normalize to common format
            return [self._normalize_article(article) for article in news_items]
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Error fetching FinHub company news: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error in FinHub company client: {e}")
            return []
    
    def _normalize_article(self, article: Dict) -> Dict:
        """
        Normalize FinHub article to common format.
        
        Args:
            article: Raw article from FinHub API
        
        Returns:
            Normalized article dictionary
        """
        return {
            'id': article.get('id', 0),
            'headline': article.get('headline', ''),
            'summary': article.get('summary', ''),
            'url': article.get('url', ''),
            'image': article.get('image', ''),
            'source': article.get('source', 'FinHub'),
            'datetime': article.get('datetime', int(datetime.now().timestamp())),
            'category': article.get('category', 'general'),
            'related': article.get('related', ''),
            'origin': 'finnhub'
        }


if __name__ == "__main__":
    # Test the client
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    logging.basicConfig(level=logging.INFO)
    
    api_key = os.getenv('FINNHUB_API_KEY')
    if api_key and api_key != 'your_finnhub_key_here':
        client = FinnHubNewsClient(api_key)
        news = client.get_news(category='general')
        print(f"📰 Fetched {len(news)} articles")
        if news:
            print(f"Sample: {news[0]['headline'][:80]}...")
    else:
        print("⚠️  Please configure FINNHUB_API_KEY in .env file")
