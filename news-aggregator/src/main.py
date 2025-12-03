"""Main entry point for the news aggregator."""
import asyncio
import argparse
import logging
import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    ALPACA_API_KEY,
    ALPACA_API_SECRET,
    FINNHUB_API_KEY,
    GEMINI_API_KEY,
    SELECTED_INSTRUMENT,
    POLL_INTERVAL_SECONDS,
    DEDUPE_WINDOW_HOURS,
    PULSE_ENDPOINT,
    TRACKED_SYMBOLS,
    validate_config
)
from news_aggregator import NewsAggregator


def setup_logging(verbose: bool = False):
    """Configure logging."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Hybrid news aggregator for Pulse using Alpaca + FinHub'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Run in test mode (single cycle then exit)'
    )
    parser.add_argument(
        '--duration',
        type=int,
        help='Maximum duration in seconds (for testing)'
    )
    parser.add_argument(
        '--symbols',
        type=str,
        help='Comma-separated list of symbols to track (overrides config)'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=POLL_INTERVAL_SECONDS,
        help=f'Polling interval in seconds (default: {POLL_INTERVAL_SECONDS})'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    return parser.parse_args()


async def main():
    """Main entry point."""
    args = parse_args()
    setup_logging(verbose=args.verbose)
    
    logger = logging.getLogger(__name__)
    
    # Print banner
    logger.info("=" * 60)
    logger.info("  📰 PULSE NEWS AGGREGATOR")
    logger.info("  Alpaca + FinHub Hybrid Integration")
    logger.info("=" * 60)
    
    try:
        # Validate configuration
        validate_config()
        
        # Parse symbols
        symbols = None
        if args.symbols:
            symbols = [s.strip() for s in args.symbols.split(',') if s.strip()]
            logger.info(f"📌 Tracking custom symbols: {', '.join(symbols)}")
        else:
            symbols = TRACKED_SYMBOLS if TRACKED_SYMBOLS else None
            if symbols:
                logger.info(f"📌 Tracking configured symbols: {', '.join(symbols[:5])}{'...' if len(symbols) > 5 else ''}")
        
        # Initialize aggregator
        aggregator = NewsAggregator(
            alpaca_key=ALPACA_API_KEY,
            alpaca_secret=ALPACA_API_SECRET,
            finnhub_key=FINNHUB_API_KEY,
            gemini_key=GEMINI_API_KEY,
            pulse_endpoint=PULSE_ENDPOINT,
            dedupe_window_hours=DEDUPE_WINDOW_HOURS,
            selected_instrument=SELECTED_INSTRUMENT
        )
        
        # Run based on mode
        if args.test:
            logger.info("🧪 Running in TEST MODE (single cycle)")
            result = await aggregator.fetch_and_process(symbols=symbols)
            logger.info(f"✅ Test complete: {result}")
            aggregator.print_summary()
        else:
            logger.info(f"🚀 Starting continuous mode (interval: {args.interval}s)")
            await aggregator.run_continuous(
                interval_seconds=args.interval,
                symbols=symbols,
                max_duration=args.duration
            )
    
    except KeyboardInterrupt:
        logger.info("👋 Shutting down gracefully...")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
