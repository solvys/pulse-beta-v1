"""News deduplication logic."""
from difflib import SequenceMatcher
from datetime import datetime, timedelta
from typing import List, Dict, Set
import logging

logger = logging.getLogger(__name__)


class NewsDedupe:
    """Intelligent news deduplication using multi-level matching."""
    
    def __init__(self, window_hours: int = 24):
        """
        Initialize deduplicator.
        
        Args:
            window_hours: How many hours of articles to keep in cache
        """
        self.window_hours = window_hours
        self.seen_urls: Set[str] = set()
        self.seen_articles: List[Dict] = []
        self.stats = {
            'total_processed': 0,
            'exact_url_dupes': 0,
            'similarity_dupes': 0,
            'unique_articles': 0
        }
    
    def process(self, articles: List[Dict]) -> List[Dict]:
        """
        Process articles and return only unique ones.
        
        Args:
            articles: List of normalized articles
        
        Returns:
            List of unique articles after deduplication
        """
        if not articles:
            return []
        
        # Clean old cache (articles older than window_hours)
        self._clean_cache()
        
        unique = []
        for article in articles:
            self.stats['total_processed'] += 1
            
            if not self._is_duplicate(article):
                unique.append(article)
                self.seen_urls.add(article['url'])
                self.seen_articles.append(article)
                self.stats['unique_articles'] += 1
        
        logger.info(f"🧹 Deduplication: {len(unique)}/{len(articles)} unique articles")
        return unique
    
    def _is_duplicate(self, article: Dict) -> bool:
        """
        Check if article is a duplicate using multi-level matching.
        
        Args:
            article: Article to check
        
        Returns:
            True if duplicate, False if unique
        """
        # Level 1: Exact URL match
        if article['url'] in self.seen_urls:
            self.stats['exact_url_dupes'] += 1
            logger.debug(f"Duplicate (URL): {article['headline'][:50]}...")
            return True
        
        # Level 2 & 3: Similarity matching
        for seen in self.seen_articles:
            if self._are_similar(article, seen):
                self.stats['similarity_dupes'] += 1
                logger.debug(f"Duplicate (similarity): {article['headline'][:50]}...")
                return True
        
        return False
    
    def _are_similar(self, art1: Dict, art2: Dict) -> bool:
        """
        Check if two articles are similar enough to be considered duplicates.
        
        Uses multiple criteria:
        1. Same source + high headline similarity (>85%)
        2. Time proximity (<5 min) + symbol match + moderate similarity (>70%)
        
        Args:
            art1: First article
            art2: Second article
        
        Returns:
            True if articles are similar, False otherwise
        """
        # Level 2: Same source + high headline similarity
        if art1['source'] == art2['source']:
            similarity = self._calculate_similarity(
                art1['headline'],
                art2['headline']
            )
            if similarity > 0.85:
                logger.debug(f"Similar match (source): {similarity:.2f}")
                return True
        
        # Level 3: Time proximity + related symbol + moderate similarity
        time_diff = abs(art1['datetime'] - art2['datetime'])
        if time_diff < 300:  # 5 minutes
            # Check if they have overlapping symbols
            art1_symbols = set(s.strip() for s in art1.get('related', '').split(',') if s.strip())
            art2_symbols = set(s.strip() for s in art2.get('related', '').split(',') if s.strip())
            
            if art1_symbols and art2_symbols and art1_symbols & art2_symbols:
                similarity = self._calculate_similarity(
                    art1['headline'],
                    art2['headline']
                )
                if similarity > 0.70:
                    logger.debug(f"Similar match (time+symbol): {similarity:.2f}")
                    return True
        
        return False
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate similarity between two text strings.
        
        Args:
            text1: First text
            text2: Second text
        
        Returns:
            Similarity ratio between 0 and 1
        """
        if not text1 or not text2:
            return 0.0
        
        return SequenceMatcher(
            None,
            text1.lower().strip(),
            text2.lower().strip()
        ).ratio()
    
    def _clean_cache(self):
        """Remove articles older than the configured window from cache."""
        cutoff_time = datetime.now() - timedelta(hours=self.window_hours)
        cutoff_timestamp = int(cutoff_time.timestamp())
        
        before_count = len(self.seen_articles)
        
        # Filter out old articles
        self.seen_articles = [
            article for article in self.seen_articles
            if article['datetime'] > cutoff_timestamp
        ]
        
        # Rebuild URL set from remaining articles
        self.seen_urls = {article['url'] for article in self.seen_articles}
        
        removed = before_count - len(self.seen_articles)
        if removed > 0:
            logger.debug(f"🗑️  Cleaned {removed} old articles from cache")
    
    def get_stats(self) -> Dict:
        """Get deduplication statistics."""
        return {
            **self.stats,
            'cache_size': len(self.seen_articles),
            'url_cache_size': len(self.seen_urls)
        }
    
    def reset_stats(self):
        """Reset statistics counters."""
        self.stats = {
            'total_processed': 0,
            'exact_url_dupes': 0,
            'similarity_dupes': 0,
            'unique_articles': 0
        }


if __name__ == "__main__":
    # Test deduplication
    logging.basicConfig(level=logging.DEBUG)
    
    deduper = NewsDedupe(window_hours=24)
    
    # Sample articles for testing
    now = int(datetime.now().timestamp())
    test_articles = [
        {
            'headline': 'Apple announces new iPhone',
            'url': 'https://example.com/article1',
            'source': 'TechNews',
            'datetime': now,
            'related': 'AAPL'
        },
        {
            'headline': 'Apple announces new iPhone',  # Exact duplicate
            'url': 'https://example.com/article1',
            'source': 'TechNews',
            'datetime': now,
            'related': 'AAPL'
        },
        {
            'headline': 'Apple unveils new iPhone',  # Similar headline
            'url': 'https://example.com/article2',
            'source': 'TechNews',
            'datetime': now,
            'related': 'AAPL'
        },
        {
            'headline': 'Tesla stock rises',  # Unique
            'url': 'https://example.com/article3',
            'source': 'NewsSource',
            'datetime': now,
            'related': 'TSLA'
        }
    ]
    
    unique = deduper.process(test_articles)
    print(f"\n📊 Processed {len(test_articles)} articles, {len(unique)} unique")
    print(f"📈 Stats: {deduper.get_stats()}")
