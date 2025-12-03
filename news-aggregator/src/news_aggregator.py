"""Main news aggregator orchestrating Alpaca and FinHub integration."""
import asyncio
from typing import List, Dict
import logging
from datetime import datetime

from alpaca_client import AlpacaNewsClient
from finnhub_client import FinnHubNewsClient
from deduplicator import NewsDedupe
from delivery import NewsDelivery
from enhanced_iv_scorer import EnhancedIVScorer

logger = logging.getLogger(__name__)


class NewsAggregator:
    """Main orchestrator for hybrid news aggregation."""
    
    def __init__(
        self,
        alpaca_key: str = None,
        alpaca_secret: str = None,
        finnhub_key: str = None,
        gemini_key: str = None,
        pulse_endpoint: str = None,
        dedupe_window_hours: int = 24,
        selected_instrument: str = "/MES"
    ):
        """
        Initialize news aggregator.
        
        Args:
            alpaca_key: Alpaca API key (optional for crypto)
            alpaca_secret: Alpaca API secret (optional for crypto)
            finnhub_key: FinHub API key
            gemini_key: Gemini API key for IV scoring
            pulse_endpoint: Pulse API endpoint
            dedupe_window_hours: Deduplication window in hours
            selected_instrument: Trading instrument for IV scoring (/MES, /MNQ, /MGC, /SIL)
        """
        self.alpaca = AlpacaNewsClient(alpaca_key, alpaca_secret)
        self.finnhub = FinnHubNewsClient(finnhub_key) if finnhub_key else None
        self.deduper = NewsDedupe(window_hours=dedupe_window_hours)
        self.delivery = NewsDelivery(pulse_endpoint) if pulse_endpoint else NewsDelivery()
        self.iv_scorer = EnhancedIVScorer(gemini_key) if gemini_key else None
        self.selected_instrument = selected_instrument
        
        self.stats = {
            'total_runs': 0,
            'total_articles_fetched': 0,
            'total_unique_articles': 0,
            'total_delivered': 0
        }
    
    async def fetch_and_process(self, symbols: List[str] = None) ->Dict:
        """
        Fetch news from both sources, deduplicate, and deliver.
        
        Args:
            symbols: List of symbols to track (None for all)
        
        Returns:
            Summary of the operation
        """
        logger.info(f"🔄 Starting news aggregation cycle {self.stats['total_runs'] + 1}")
        
        try:
            # Fetch from both sources
            alpaca_news = self.alpaca.get_news(symbols=symbols, hours_back=1, limit=50)
            finnhub_news = self.finnhub.get_news(category='general') if self.finnhub else []
            
            # Combine all articles
            all_articles = alpaca_news + finnhub_news
            self.stats['total_articles_fetched'] += len(all_articles)
            
            logger.info(f"📥 Fetched {len(alpaca_news)} from Alpaca, {len(finnhub_news)} from FinHub")
            
            if not all_articles:
                logger.info("📭 No new articles to process")
                return {'success': True, 'unique': 0, 'delivered': 0}
            
            # Deduplicate
            unique_articles = self.deduper.process(all_articles)
            self.stats['total_unique_articles'] += len(unique_articles)
            
            # Calculate IV scores for each article
            if self.iv_scorer:
                for article in unique_articles:
                    try:
                        iv_score = self.iv_scorer.calculate_iv_score(
                            article.get('headline', ''),
                            instrument=self.selected_instrument
                        )
                        article['iv_score'] = iv_score
                        logger.debug(f"IV Score for '{article['headline'][:50]}...': {iv_score['value']}pts ({iv_score['type']})")
                    except Exception as e:
                        logger.warning(f"IV scoring failed for article: {e}")
                        # Fallback to neutral IV
                        article['iv_score'] = {
                            'type': 'neutral',
                            'value': 2.0,
                            'confidence': 0.0,
                            'reasoning': 'Fallback - scoring unavailable'
                        }
            
            # Sort by timestamp (newest first)
            sorted_articles = sorted(
                unique_articles,
                key=lambda x: x['datetime'],
                reverse=True
            )
            
            # Deliver to Pulse
            delivery_result = await self.delivery.send_to_pulse(sorted_articles)
            
            if delivery_result.get('success'):
                self.stats['total_delivered'] += delivery_result.get('sent', 0)
            
            self.stats['total_runs'] += 1
            
            # Log summary
            logger.info(f"✅ Cycle complete: {len(unique_articles)} unique articles")
            logger.info(f"📊 Dedup stats: {self.deduper.get_stats()}")
            
            return {
                'success': True,
                'fetched': len(all_articles),
                'unique': len(unique_articles),
                'delivered': delivery_result.get('sent', 0),
                'alpaca_count': len(alpaca_news),
                'finnhub_count': len(finnhub_news)
            }
            
        except Exception as e:
            logger.error(f"❌ Error in aggregation cycle: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}
    
    async def run_continuous(
        self,
        interval_seconds: int = 60,
        symbols: List[str] = None,
        max_duration: int = None
    ):
        """
        Run continuous news aggregation.
        
        Args:
            interval_seconds: Polling interval in seconds
            symbols: Symbols to track
            max_duration: Maximum duration in seconds (None for infinite)
        """
        logger.info(f"🚀 Starting continuous aggregation (interval: {interval_seconds}s)")
        
        start_time = datetime.now()
        
        try:
            while True:
                # Fetch and process
                result = await self.fetch_and_process(symbols=symbols)
                
                # Check if we should stop
                if max_duration:
                    elapsed = (datetime.now() - start_time).total_seconds()
                    if elapsed >= max_duration:
                        logger.info(f"⏱️  Max duration ({max_duration}s) reached, stopping")
                        break
                
                # Wait for next cycle
                logger.info(f"⏸️  Sleeping for {interval_seconds}s...")
                await asyncio.sleep(interval_seconds)
                
        except KeyboardInterrupt:
            logger.info("⏹️  Stopped by user")
        except Exception as e:
            logger.error(f"❌ Fatal error: {e}", exc_info=True)
        finally:
            self.print_summary()
    
    def print_summary(self):
        """Print aggregation summary."""
        logger.info("=" * 60)
        logger.info("📊 NEWS AGGREGATION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total runs: {self.stats['total_runs']}")
        logger.info(f"Total articles fetched: {self.stats['total_articles_fetched']}")
        logger.info(f"Total unique articles: {self.stats['total_unique_articles']}")
        logger.info(f"Total delivered: {self.stats['total_delivered']}")
        logger.info(f"Deduplication stats: {self.deduper.get_stats()}")
        logger.info(f"Delivery stats: {self.delivery.get_stats()}")
        logger.info("=" * 60)


if __name__ == "__main__":
    # Test aggregator
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    aggregator = NewsAggregator(
        alpaca_key=os.getenv('ALPACA_API_KEY'),
        alpaca_secret=os.getenv('ALPACA_API_SECRET'),
        finnhub_key=os.getenv('FINNHUB_API_KEY'),
        pulse_endpoint=os.getenv('PULSE_ENDPOINT', 'mock'),
        dedupe_window_hours=24
    )
    
    # Run a single cycle
    asyncio.run(aggregator.fetch_and_process(symbols=['AAPL', 'TSLA', 'NVDA']))
