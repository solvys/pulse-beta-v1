"""Delivery module for sending news to Pulse application."""
import requests
from typing import List, Dict
import logging
import json

logger = logging.getLogger(__name__)


class NewsDelivery:
    """Handles delivery of news articles to the Pulse application."""
    
    def __init__(self, pulse_endpoint: str = "http://localhost:5000/api/news"):
        """
        Initialize news delivery.
        
        Args:
            pulse_endpoint: Endpoint URL for Pulse news API
        """
        self.pulse_endpoint = pulse_endpoint
        self.delivery_stats = {
            'total_sent': 0,
            'successful': 0,
            'failed': 0
        }
    
    async def send_to_pulse(self, news_items: List[Dict]) -> Dict:
        """
        Send news items to Pulse application (async compatible).
        
        Args:
            news_items: List of deduplicated news articles
        
        Returns:
            Summary of delivery operation
        """
        return self.send_to_pulse_sync(news_items)
    
    def send_to_pulse_sync(self, news_items: List[Dict]) -> Dict:
        """
        Send news items to Pulse application.
        
        Args:
            news_items: List of deduplicated news articles
        
        Returns:
            Summary of delivery operation
        """
        if not news_items:
            logger.info("📭 No news items to deliver")
            return {'sent': 0, 'success': True}
        
        # Format for Pulse app
        formatted = self._format_for_pulse(news_items)
        
        try:
            # Log what we're about to send
            logger.info(f"📤 Sending {len(formatted)} articles to Pulse at {self.pulse_endpoint}")
            
            # For now, just log the formatted data
            # In production, this would POST to Pulse endpoint
            if self.pulse_endpoint.startswith('http'):
                response = requests.post(
                    self.pulse_endpoint,
                    json={'news': formatted},
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                if response.status_code == 200:
                    self.delivery_stats['successful'] += len(formatted)
                    logger.info(f"✅ Successfully delivered {len(formatted)} articles")
                    return {'sent': len(formatted), 'success': True}
                else:
                    logger.error(f"❌ Pulse API returned status {response.status_code}")
                    self.delivery_stats['failed'] += len(formatted)
                    return {'sent': 0, 'success': False, 'error': f"Status {response.status_code}"}
            else:
                # Mock mode for testing
                logger.info("📝 Mock delivery mode - logging articles:")
                for item in formatted[:3]:  # Show first 3
                    logger.info(f"  • {item['headline'][:60]}... ({item['source']})")
                if len(formatted) > 3:
                    logger.info(f"  ... and {len(formatted) - 3} more")
                
                self.delivery_stats['successful'] += len(formatted)
                return {'sent': len(formatted), 'success': True, 'mode': 'mock'}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Network error delivering to Pulse: {e}")
            self.delivery_stats['failed'] += len(formatted)
            return {'sent': 0, 'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"❌ Error delivering to Pulse: {e}")
            self.delivery_stats['failed'] += len(formatted)
            return {'sent': 0, 'success': False, 'error': str(e)}
    
    def _format_for_pulse(self, news_items: List[Dict]) -> List[Dict]:
        """
        Format news items for Pulse application.
        
        Args:
            news_items: Raw news items
        
        Returns:
            Formatted news items ready for Pulse
        """
        formatted = []
        
        for item in news_items:
            # Parse symbols from related field
            related_str = item.get('related', '')
            symbols = [s.strip() for s in related_str.split(',') if s.strip()] if related_str else []
            
            formatted.append({
                'id': f"{item.get('origin', 'unknown')}-{item.get('id', 0)}",
                'headline': item.get('headline', ''),
                'summary': item.get('summary', ''),
                'url': item.get('url', ''),
                'image': item.get('image', ''),
                'source': item.get('source', 'Unknown'),
                'timestamp': item.get('datetime', 0),
                'symbols': symbols,
                'category': item.get('category', 'general'),
                'origin': item.get('origin', 'unknown')
            })
        
        return formatted
    
    def get_stats(self) -> Dict:
        """Get delivery statistics."""
        return {
            **self.delivery_stats,
            'total_sent': self.delivery_stats['successful'] + self.delivery_stats['failed']
        }
    
    def save_to_file(self, news_items: List[Dict], filename: str = 'news_output.json'):
        """
        Save news items to a JSON file (useful for testing).
        
        Args:
            news_items: News items to save
            filename: Output filename
        """
        try:
            formatted = self._format_for_pulse(news_items)
            with open(filename, 'w') as f:
                json.dump(formatted, f, indent=2)
            logger.info(f"💾 Saved {len(formatted)} articles to {filename}")
            return True
        except Exception as e:
            logger.error(f"❌ Error saving to file: {e}")
            return False


if __name__ == "__main__":
    # Test delivery
    from datetime import datetime
    logging.basicConfig(level=logging.INFO)
    
    delivery = NewsDelivery(pulse_endpoint="mock")
    
    # Sample news items
    test_news = [
        {
            'id': 1,
            'headline': 'Apple announces record earnings',
            'summary': 'Apple Inc. reported record quarterly earnings...',
            'url': 'https://example.com/apple-earnings',
            'image': 'https://example.com/image.jpg',
            'source': 'FinHub',
            'datetime': int(datetime.now().timestamp()),
            'related': 'AAPL',
            'origin': 'finnhub'
        }
    ]
    
    result = delivery.send_to_pulse_sync(test_news)
    print(f"📊 Delivery result: {result}")
    print(f"📈 Stats: {delivery.get_stats()}")
