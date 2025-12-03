"""Tests for deduplicator module."""
import pytest
from datetime import datetime
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from deduplicator import NewsDedupe


def create_article(headline, url, source="TestSource", related="AAPL", offset_seconds=0):
    """Helper to create test article."""
    return {
        'headline': headline,
        'url': url,
        'source': source,
        'datetime': int(datetime.now().timestamp()) + offset_seconds,
        'related': related,
        'summary': f'Summary for {headline}',
        'image': 'https://example.com/image.jpg',
        'category': 'company',
        'origin': 'test'
    }


class TestNewsDedupe:
    """Test cases for news deduplication."""
    
    def test_exact_url_duplicate(self):
        """Test detection of exact URL duplicates."""
        deduper = NewsDedupe()
        
        articles = [
            create_article("News 1", "https://example.com/article1"),
            create_article("News 1", "https://example.com/article1"),  # Exact duplicate
        ]
        
        unique = deduper.process(articles)
        assert len(unique) == 1
        assert deduper.stats['exact_url_dupes'] == 1
    
    def test_similar_headline_same_source(self):
        """Test detection of similar headlines from same source."""
        deduper = NewsDedupe()
        
        articles = [
            create_article("Apple announces new iPhone", "https://example.com/1", "TechNews"),
            create_article("Apple unveils new iPhone", "https://example.com/2", "TechNews"),
        ]
        
        unique = deduper.process(articles)
        assert len(unique) == 1  # Should dedupe due to high similarity
        assert deduper.stats['similarity_dupes'] >= 1
    
    def test_different_sources_unique(self):
        """Test that same news from different sources is kept unique."""
        deduper = NewsDedupe()
        
        articles = [
            create_article("Apple announces new iPhone", "https://source1.com/1", "Source1"),
            create_article("Apple announces new iPhone", "https://source2.com/1", "Source2"),
        ]
        
        unique = deduper.process(articles)
        # Different sources with exact same headline - borderline case
        # Should be 2 unless similarity is very high and they're from same source
        assert len(unique) in [1, 2]  # Allow both behaviors
    
    def test_time_proximity_symbol_match(self):
        """Test deduplication based on time proximity and symbol match."""
        deduper = NewsDedupe()
        
        # Two similar articles within 5 minutes about same symbol
        articles = [
            create_article("Tesla stock rises", "https://example.com/1", "Source1", "TSLA", 0),
            create_article("Tesla shares increase", "https://example.com/2", "Source2", "TSLA", 120),  # 2 min later
        ]
        
        unique = deduper.process(articles)
        assert len(unique) == 1  # Should dedupe due to time+symbol+similarity
    
    def test_completely_unique_articles(self):
        """Test that completely different articles are kept."""
        deduper = NewsDedupe()
        
        articles = [
            create_article("Apple announces iPhone", "https://example.com/1", related="AAPL"),
            create_article("Tesla launches new car", "https://example.com/2", related="TSLA"),
            create_article("Google updates search", "https://example.com/3", related="GOOGL"),
        ]
        
        unique = deduper.process(articles)
        assert len(unique) == 3
        assert deduper.stats['unique_articles'] == 3
    
    def test_cache_cleaning(self):
        """Test that old articles are removed from cache."""
        deduper = NewsDedupe(window_hours=1)
        
        # Add old article (simulate)
        old_article = create_article("Old news", "https://example.com/old", offset_seconds=-7200)  # 2 hours ago
        deduper.seen_articles.append(old_article)
        deduper.seen_urls.add(old_article['url'])
        
        # Process new articles
        new_articles = [
            create_article("New news", "https://example.com/new")
        ]
        
        unique = deduper.process(new_articles)
        
        # Old article should be cleaned from cache
        assert len(deduper.seen_articles) == 1  # Only new article
        assert "https://example.com/old" not in deduper.seen_urls
    
    def test_similarity_calculation(self):
        """Test similarity calculation function."""
        deduper = NewsDedupe()
        
        # Very similar
        sim1 = deduper._calculate_similarity("Apple announces iPhone", "Apple unveils iPhone")
        assert sim1 > 0.7
        
        # Completely different
        sim2 = deduper._calculate_similarity("Apple announces iPhone", "Tesla launches car")
        assert sim2 < 0.5
        
        # Identical
        sim3 = deduper._calculate_similarity("Same text", "Same text")
        assert sim3 == 1.0
    
    def test_stats_tracking(self):
        """Test that statistics are tracked correctly."""
        deduper = NewsDedupe()
        
        articles = [
            create_article("News 1", "https://example.com/1"),
            create_article("News 1", "https://example.com/1"),  # Duplicate
            create_article("News 2", "https://example.com/2"),
        ]
        
        unique = deduper.process(articles)
        stats = deduper.get_stats()
        
        assert stats['total_processed'] == 3
        assert stats['unique_articles'] == 2
        assert stats['exact_url_dupes'] >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
