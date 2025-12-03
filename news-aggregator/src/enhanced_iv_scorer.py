"""
Enhanced IV Scoring System for News Headlines
Integrates:
1. Real-time VIX data
2. Gemini NLP sentiment analysis
3. Historical event calibration
"""

import requests
from typing import Dict, List, Tuple
from datetime import datetime
import json
from google import genai

# Historical Event Database for Calibration
HISTORICAL_EVENTS = [
    # Format: (date, event, actual_ES_move_pts, VIX_at_time)
    ("2020-03-09", "COVID panic selling", -225, 54.46),
    ("2020-03-12", "COVID circuit breaker trigger", -150, 75.47),
    ("2022-02-24", "Russia invades Ukraine", -95, 31.60),
    ("2023-03-13", "SVB collapse announced", -120, 25.79),
    ("2008-09-15", "Lehman Brothers bankruptcy", -180, 31.70),
    ("2001-09-11", "9/11 terrorist attacks", -112, 41.00),
    ("2020-11-09", "Pfizer vaccine efficacy 90%", +75, 25.70),
    ("2023-11-14", "CPI softer than expected", +45, 14.30),
    ("2022-06-10", "CPI 8.6% shock", -85, 30.67),
    ("2020-06-05", "Jobs report beats massively", +82, 25.88),
    # Non-macro events for baseline
    ("2024-02-01", "Meta earnings beat", +8, 13.50),
    ("2024-01-15", "Minor Fed comments", +15, 12.80),
]

class EnhancedIVScorer:
    """
    Advanced IV scoring using real-time VIX, Gemini sentiment, and historical calibration.
    """
    
    def __init__(self, gemini_api_key: str):
        """
        Initialize the IV scorer.
        
        Args:
            gemini_api_key: Google Gemini API key for NLP analysis
        """
        self.gemini_client = genai.Client(api_key=gemini_api_key)
        self.vix_cache = {"value": 15.0, "timestamp": 0}  # Cache VIX for 5 min
        self.calibration_factors = self._calculate_calibration()
    
    def _calculate_calibration(self) -> Dict:
        """
        Calculate calibration factors from historical events.
        
        Returns:
            Dictionary of calibration multipliers by event type
        """
        # Analyze historical events to derive multipliers
        macro_events = [e for e in HISTORICAL_EVENTS if abs(e[2]) > 50]
        minor_events = [e for e in HISTORICAL_EVENTS if abs(e[2]) <= 50]
        
        # Average impact per VIX point
        macro_avg_impact = sum(abs(e[2]) for e in macro_events) / len(macro_events)
        minor_avg_impact = sum(abs(e[2]) for e in minor_events) / len(minor_events)
        
        return {
            "macro": macro_avg_impact / 100,  # ~1.2
            "minor": minor_avg_impact / 100,  # ~0.25
            "vix_sensitivity": 1.5  # How much VIX level amplifies impact
        }
    
    def get_current_vix(self) -> float:
        """
        Fetch current VIX value from CBOE or fallback sources.
        Uses caching to avoid rate limits.
        
        Returns:
            Current VIX value
        """
        now = datetime.now().timestamp()
        
        # Check cache (5-minute expiry)
        if now - self.vix_cache["timestamp"] < 300:
            return self.vix_cache["value"]
        
        try:
            # Try Yahoo Finance as primary source (^VIX symbol)
            response = requests.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX",
                params={
                    "interval": "1m",
                    "range": "1d"
                },
                timeout=5
            )
            
            if response.ok:
                data = response.json()
                vix = data["chart"]["result"][0]["meta"]["regularMarketPrice"]
                self.vix_cache = {"value": vix, "timestamp": now}
                return vix
        except Exception as e:
            print(f"⚠️  VIX fetch failed: {e}")
        
        # Fallback to cached or default
        return self.vix_cache["value"]
    
    def analyze_sentiment_with_gemini(self, headline: str) -> Dict:
        """
        Use Gemini to analyze news sentiment and classify event type.
        
        Args:
            headline: News headline text
        
        Returns:
            Dictionary with sentiment, event_type, and confidence
        """
        prompt = f"""Analyze this financial news headline and provide:
1. Sentiment: "very_negative", "negative", "neutral", "positive", "very_positive"
2. Event Type: "macro_critical" (Fed/CPI/NFP/GDP), "geopolitical" (war/crisis), "corporate" (earnings/M&A), "minor" (commentary)
3. Confidence: 0.0 to 1.0
4. Expected Market Impact Direction: "bearish", "neutral", "bullish"

Headline: "{headline}"

Respond ONLY in JSON format:
{{"sentiment": "...", "event_type": "...", "confidence": 0.0, "direction": "..."}}"""

        try:
            response = self.gemini_client.models.generate_content(
                model='gemini-2.5-flash',  # Latest Gemini 2.5
                contents=prompt
            )
            
            # Parse JSON from response
            result_text = response.text.strip()
            # Remove markdown code blocks if present
            if result_text.startswith("```json"):
                result_text = result_text[7:-3]
            elif result_text.startswith("```"):
                result_text = result_text[3:-3]
            
            analysis = json.loads(result_text)
            return analysis
            
        except Exception as e:
            print(f"⚠️  Gemini analysis failed: {e}")
            # Fallback to simple keyword-based analysis
            return self._fallback_sentiment(headline)
    
    def _fallback_sentiment(self, headline: str) -> Dict:
        """Simple keyword-based fallback if Gemini fails."""
        hl = headline.lower()
        
        # Negative keywords
        if any(w in hl for w in ['crash', 'collapse', 'plunge', 'crisis', 'war', 'bankruptcy']):
            sentiment = "very_negative"
        elif any(w in hl for w in ['falls', 'drops', 'slumps', 'concern', 'fear']):
            sentiment = "negative"
        # Positive keywords
        elif any(w in hl for w in ['surge', 'soars', 'breakout', 'boom', 'record']):
            sentiment = "very_positive"
        elif any(w in hl for w in ['rises', 'gains', 'rally', 'optimism']):
            sentiment = "positive"
        else:
            sentiment = "neutral"
        
        # Event type
        if any(w in hl for w in ['fed', 'cpi', 'nfp', 'gdp', 'powell', 'interest rate']):
            event_type = "macro_critical"
        elif any(w in hl for w in ['war', 'invasion', 'attack', 'sanctions']):
            event_type = "geopolitical"
        elif any(w in hl for w in ['earnings', 'merger', 'acquisition', 'ceo']):
            event_type = "corporate"
        else:
            event_type = "minor"
        
        direction = "bearish" if "negative" in sentiment else ("bullish" if "positive" in sentiment else "neutral")
        
        return {
            "sentiment": sentiment,
            "event_type": event_type,
            "confidence": 0.6,
            "direction": direction
        }
    
    def calculate_iv_score(self, headline: str, instrument: str = "ES") -> Dict:
        """
        Calculate IV score using VIX, Gemini sentiment, and historical calibration.
        
        Args:
            headline: News headline to analyze
            instrument: Trading instrument (ES, NQ, RTY, etc.)
        
        Returns:
            {
                'type': 'cyclical' | 'countercyclical',
                'value': float (points),
                'confidence': float,
                'reasoning': str,
                'vix_level': float,
                'sentiment': str
            }
        """
        # 1. Get current VIX
        current_vix = self.get_current_vix()
        
        # 2. Analyze sentiment with Gemini
        sentiment_analysis = self.analyze_sentiment_with_gemini(headline)
        
        # 3. Calculate base points from event type
        event_type = sentiment_analysis["event_type"]
        base_points_map = {
            "macro_critical": 100.0,
            "geopolitical": 85.0,
            "corporate": 15.0,
            "minor": 5.0
        }
        base_points = base_points_map.get(event_type, 5.0)
        
        # 4. Apply sentiment multiplier
        sentiment_multipliers = {
            "very_negative": 2.5,
            "negative": 1.5,
            "neutral": 0.8,
            "positive": 1.2,
            "very_positive": 1.8
        }
        sentiment_mult = sentiment_multipliers.get(sentiment_analysis["sentiment"], 1.0)
        
        # 5. VIX adjustment (higher VIX = more reactive market)
        vix_baseline = 15.0  # "Normal" VIX
        vix_multiplier = (current_vix / vix_baseline) ** self.calibration_factors["vix_sensitivity"]
        
        # 6. Apply historical calibration
        if event_type in ["macro_critical", "geopolitical"]:
            calibration_factor = self.calibration_factors["macro"]
        else:
            calibration_factor = self.calibration_factors["minor"]
        
        # 7. Calculate final IV points
        iv_points = base_points * sentiment_mult * vix_multiplier * calibration_factor
        
        # 8. Instrument-specific adjustment
        instrument_multipliers = {
            "ES": 1.0,      # S&P 500 futures (baseline)
            "NQ": 1.4,      # Nasdaq more volatile
            "RTY": 1.2,     # Russell 2000
            "YM": 0.8,      # Dow less volatile
            "CL": 1.3,      # Oil futures
            "GC": 0.9,      # Gold futures
        }
        instrument_mult = instrument_multipliers.get(instrument, 1.0)
        iv_points *= instrument_mult
        
        # 9. Determine cyclical vs countercyclical
        direction = sentiment_analysis["direction"]
        iv_type = "countercyclical" if direction == "bearish" else "cyclical"
        
        # 10. Build reasoning
        reasoning = f"{event_type.replace('_', ' ').title()} event with {sentiment_analysis['sentiment'].replace('_', ' ')} sentiment. VIX at {current_vix:.1f} (vs normal ~15). Historical calibration suggests ~{iv_points:.0f}pt move."
        
        return {
            'type': iv_type,
            'value': round(iv_points, 1),
            'confidence': sentiment_analysis["confidence"],
            'reasoning': reasoning,
            'vix_level': current_vix,
            'sentiment': sentiment_analysis["sentiment"],
            'event_type': event_type
        }
    
    def backtest_accuracy(self) -> Dict:
        """
        Test the model against historical events to measure accuracy.
        
        Returns:
            Backtesting results with MAE and accuracy metrics
        """
        results = []
        
        for date, event, actual_move, vix_at_time in HISTORICAL_EVENTS:
            # Temporarily override VIX cache
            old_cache = self.vix_cache.copy()
            self.vix_cache = {"value": vix_at_time, "timestamp": datetime.now().timestamp()}
            
            # Calculate predicted move
            prediction = self.calculate_iv_score(event, "ES")
            predicted_move = prediction['value']
            
            # Calculate error
            error = abs(predicted_move - abs(actual_move))
            pct_error = (error / abs(actual_move)) * 100 if actual_move != 0 else 0
            
            results.append({
                'date': date,
                'event': event,
                'actual': actual_move,
                'predicted': predicted_move,
                'error': error,
                'pct_error': pct_error
            })
            
            # Restore VIX cache
            self.vix_cache = old_cache
        
        # Calculate metrics
        mae = sum(r['error'] for r in results) / len(results)
        mape = sum(r['pct_error'] for r in results) / len(results)
        within_20pct = sum(1 for r in results if r['pct_error'] < 20) / len(results)
        
        return {
            'results': results,
            'mae': mae,
            'mape': mape,
            'accuracy_within_20pct': within_20pct * 100,
            'num_events': len(results)
        }


# Usage Example
if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # Initialize with your Gemini API key
    scorer = EnhancedIVScorer(gemini_api_key=os.getenv("GEMINI_API_KEY"))
    
    # Test with a sample headline
    test_headline = "Fed Chair Powell signals aggressive rate hikes amid inflation concerns"
    result = scorer.calculate_iv_score(test_headline, "ES")
    
    print("=" * 60)
    print("📰 HEADLINE:", test_headline)
    print("=" * 60)
    print(f"IV Type: {result['type']}")
    print(f"Expected Move: {result['value']} points")
    print(f"Confidence: {result['confidence']:.0%}")
    print(f"Current VIX: {result['vix_level']:.1f}")
    print(f"Sentiment: {result['sentiment']}")
    print(f"Event Type: {result['event_type']}")
    print(f"Reasoning: {result['reasoning']}")
    print("=" * 60)
    
    # Run backtest
    print("\n🧪 RUNNING BACKTEST...")
    backtest = scorer.backtest_accuracy()
    print(f"Mean Absolute Error: {backtest['mae']:.1f} points")
    print(f"Mean Absolute % Error: {backtest['mape']:.1f}%")
    print(f"Accuracy (within 20%): {backtest['accuracy_within_20pct']:.1f}%")
    print(f"Events Tested: {backtest['num_events']}")
