# Pulse Trading Platform - Fixes & Configuration Guide

## Overview
This document describes the fixes applied to resolve the MNQ symbol contract issue and improve error visibility for Gemini AI integration.

---

## 1. Fixed: MNQ Symbol Contract Not Found Error

### Problem
The "Fire Test Trade" button was hardcoded to search for the NQ (E-mini NASDAQ-100) contract using symbolId `F.US.ENQ`, regardless of which instrument the user had selected in settings. This caused:
- Failed trades when users wanted to trade other instruments (MNQ, MES, MGC, SIL)
- Poor error messages that didn't indicate the root cause
- No visibility into what contracts were available

### Solution

#### A. Added Symbol Mapping (`index.tsx:72-79`)
Created a mapping from our instrument symbols to potential TopstepX symbolIds:

```typescript
const TOPSTEPX_SYMBOL_MAP: Record<string, string[]> = {
    '/MNQ': ['F.US.MNQH', 'F.US.MNQ', 'Micro E-mini NASDAQ'],
    '/MES': ['F.US.MESH', 'F.US.MES', 'Micro E-mini S&P'],
    '/MGC': ['F.US.MGCH', 'F.US.MGC', 'Micro Gold'],
    '/SIL': ['F.US.SIL', 'Micro Silver']
};
```

#### B. Dynamic Contract Resolution (`index.tsx:2162-2261`)
The Fire Test Trade button now:

1. **Reads the selected instrument** from `settings.selectedInstrument`
2. **Fetches all available contracts** from TopstepX
3. **Logs available contracts** to console for debugging
4. **Tries multiple matching strategies**:
   - Exact symbolId match
   - Partial symbolId match
   - Contract name match
   - Contract description match
5. **Provides detailed error logging** if contract not found
6. **Uses `settings.contractSize`** for quantity (not hardcoded to 1)

#### C. Comprehensive Error Logging
All test trade operations now log with the prefix `TEST_TRADE:` or `TEST_TRADE_FAILED:`:

- `TEST_TRADE: Fetching available contracts...`
- `TEST_TRADE: Available contracts: [...]`
- `TEST_TRADE: Found contract {...}`
- `TEST_TRADE_FAILED: CONTRACT_NOT_FOUND {...}`

**To diagnose contract issues:** Check browser console for these logs when clicking "Fire Test Trade".

---

## 2. Fixed: Gemini AI Error Visibility

### Problem
When Gemini API calls failed (for IV scoring or AI Price chat), errors were silently caught with minimal logging, making it impossible to diagnose:
- Missing API keys
- Rate limits
- Network failures
- Invalid API responses

### Solution

#### A. Enhanced IV Calculation Error Logging (`index.tsx:3111-3148`)
Added structured error logging:

```typescript
// API Error
console.error('GEMINI_IV_FAILED: API Error', {
    status: response.status,
    statusText: response.statusText,
    error: errorData,
    instrument: settings.selectedInstrument
});

// Empty Response
console.warn('GEMINI_IV_FAILED: Empty response', { data });

// Parse Error
console.warn('GEMINI_IV_FAILED: Could not parse JSON from response', { aiResponse });

// Catch-All
console.error('GEMINI_IV_FAILED:', {
    error: error.message,
    instrument: settings.selectedInstrument,
    hasApiKey: !!settings.geminiApiKey,
    headline: text.substring(0, 100)
});
```

#### B. Enhanced AI Price Agent Error Logging (`agentFrame.ts:175-227`)
Added detailed logging for Price chat:

```typescript
// Missing API Key
console.error("PRICE_AI_GEMINI_FAILED: No API Key found", {
    hasSettingsKey: !!settings.geminiApiKey,
    hasWindowKey: !!(window as any).__GEMINI_API_KEY__,
    hasEnvKey: !!import.meta.env.VITE_GEMINI_API_KEY
});

// Empty Response
console.error("PRICE_AI_GEMINI_FAILED: Empty response", { result });

// Success
console.log('PRICE_AI_SUCCESS: Response generated', {
    length: text.length,
    instrument: context.instrumentDetails?.symbol
});

// Failure
console.error("PRICE_AI_GEMINI_FAILED:", {
    error: error.message,
    stack: error.stack,
    intent,
    instrument: context.instrumentDetails?.symbol,
    hasApiKey: !!settings.geminiApiKey,
    userMessage: userMessage.substring(0, 100)
});
```

**To diagnose Gemini issues:** Open browser console and look for logs prefixed with:
- `GEMINI_IV_FAILED:` - IV scoring failures
- `PRICE_AI_GEMINI_FAILED:` - AI Price chat failures
- `PRICE_AI_SUCCESS:` - Successful AI responses

---

## 3. Verified: Instrument Selection Propagation

### Confirmed Working

All components correctly use `settings.selectedInstrument`:

1. **IV Calculation** (`index.tsx:3075`)
   ```typescript
   const instrument = INSTRUMENT_RULES[settings.selectedInstrument] || INSTRUMENT_RULES['ES'];
   ```

2. **AI Price Agent Context** (`index.tsx:1541-1547`)
   ```typescript
   instrumentDetails: INSTRUMENT_RULES[settings.selectedInstrument] ? {
       symbol: settings.selectedInstrument,
       name: INSTRUMENT_RULES[settings.selectedInstrument].name,
       tickSize: INSTRUMENT_RULES[settings.selectedInstrument].tickSize,
       pointValue: INSTRUMENT_RULES[settings.selectedInstrument].pointValue,
       ivRange: INSTRUMENT_RULES[settings.selectedInstrument].ivRange
   } : undefined
   ```

3. **Fire Test Trade** (now dynamically uses selected instrument)

### User Experience
When a user changes the instrument in Settings:
- **IV scores** immediately reflect the new instrument's volatility characteristics
- **AI Price** provides analysis specific to the selected instrument
- **Test trades** execute on the correct contract for that instrument

---

## 4. News Aggregator Configuration

### Architecture
The news aggregator is a **separate Python service** that runs independently of the frontend. It:
- Polls Alpaca and Finnhub APIs for news
- Scores news with Gemini AI for IV impact
- Delivers processed news to the Pulse endpoint

### Configuration (`news-aggregator/.env`)

The news aggregator has its own instrument configuration:

```bash
# Instrument for IV scoring (independent of frontend)
SELECTED_INSTRUMENT=/MES  # or /MNQ, /MGC, /SIL

# Gemini API Key (required for IV scoring)
GEMINI_API_KEY=your_gemini_api_key_here

# Alpaca API (optional, for additional news)
ALPACA_API_KEY=your_alpaca_key_here
ALPACA_API_SECRET=your_alpaca_secret_here

# Finnhub API (required)
FINNHUB_API_KEY=your_finnhub_key_here

# Pulse Integration
PULSE_ENDPOINT=http://localhost:5000/api/news
POLL_INTERVAL_SECONDS=60
```

### Important Notes

1. **Frontend vs Backend Instrument Settings**
   - Frontend `settings.selectedInstrument`: Controls UI, IV display, test trades
   - Backend `SELECTED_INSTRUMENT`: Controls which instrument IV scorer analyzes for

2. **Syncing Instruments**
   - If you want consistent IV scoring, set the news aggregator's `SELECTED_INSTRUMENT` to match your primary trading instrument
   - Or run multiple news aggregator instances, one per instrument

3. **Running the News Aggregator**
   ```bash
   cd news-aggregator
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your API keys
   python src/main.py
   ```

---

## 5. Testing & Verification

### A. Test Contract Resolution

1. Open the app in browser
2. Open Developer Console (F12)
3. Go to Settings → Select an instrument (e.g., /MNQ)
4. Go to Account Tracker → Enable "Fire Test Trade"
5. Click "🔥 FIRE"
6. Check console logs:
   - Should see `TEST_TRADE: Fetching available contracts...`
   - Should see `TEST_TRADE: Available contracts: [...]` with a list
   - Should see `TEST_TRADE: Found contract {...}` if successful
   - Or `TEST_TRADE_FAILED: CONTRACT_NOT_FOUND` with details if failed

### B. Test Gemini AI (IV Scoring)

1. Ensure `VITE_GEMINI_API_KEY` is set or add it in Settings
2. Go to Tape Ticker feed
3. Wait for news items to load
4. Check console for:
   - `GEMINI_IV_FAILED:` logs if errors occur
   - Each news item should have an IV score displayed

### C. Test Gemini AI (Price Chat)

1. Open a chat with AI Price
2. Send a message: "Check the tape"
3. Check console for:
   - `PRICE_AI: Generating response...`
   - `PRICE_AI_SUCCESS: Response generated` if successful
   - `PRICE_AI_GEMINI_FAILED:` if errors occur

---

## 6. Common Issues & Solutions

### Issue: "MNQ contract not found in TopstepX"

**Cause:** Your TopstepX account may not have access to Micro E-mini contracts, or the symbolId mapping is incorrect.

**Solution:**
1. Check console logs for `availableContracts` list
2. Verify your TopstepX account permissions
3. If symbolId is different, update `TOPSTEPX_SYMBOL_MAP` in `index.tsx`

### Issue: "Gemini IV Analysis Error: No Gemini API Key"

**Cause:** Gemini API key not configured.

**Solution:**
1. Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to `.env` as `VITE_GEMINI_API_KEY=...`
3. Or add via Settings panel in the UI

### Issue: "Signal lost. The AI uplink dropped out"

**Cause:** Gemini API error (rate limit, network issue, invalid key).

**Solution:**
1. Check browser console for `PRICE_AI_GEMINI_FAILED:` log
2. Look at the error details (401 = bad key, 429 = rate limit, etc.)
3. Verify API key is valid and has quota remaining

### Issue: Tape Ticker shows "Waiting for wire data..."

**Cause:** News aggregator service not running or not delivering to correct endpoint.

**Solution:**
1. Start the news aggregator: `cd news-aggregator && python src/main.py`
2. Verify `PULSE_ENDPOINT` in `.env` matches your frontend's API endpoint
3. Check news aggregator logs for errors

---

## 7. Summary of Changes

### Files Modified

1. **`index.tsx`**
   - Added `TOPSTEPX_SYMBOL_MAP` (lines 72-79)
   - Rewrote Fire Test Trade handler (lines 2162-2261) to use dynamic instrument selection
   - Enhanced Gemini IV error logging (lines 3111-3148)

2. **`agentFrame.ts`**
   - Enhanced Gemini agent error logging (lines 175-227)
   - Added structured console logs for debugging

3. **`FIXES.md`** (this file)
   - Comprehensive documentation of fixes and configuration

### Key Improvements

- ✅ Test trades now use the user's selected instrument (no longer hardcoded to NQ)
- ✅ All symbol-related functionality respects `settings.selectedInstrument`
- ✅ Comprehensive error logging with clear prefixes (`TEST_TRADE:`, `GEMINI_IV_FAILED:`, `PRICE_AI_GEMINI_FAILED:`)
- ✅ Detailed error context for debugging (status codes, available contracts, API key presence)
- ✅ Fallback mechanisms when Gemini API fails (keyword-based IV scoring)
- ✅ Better user feedback via console logs and error messages

---

## 8. Next Steps (Optional Enhancements)

### A. Health Check Endpoint
If you add a backend service, create a `/api/health` endpoint:

```typescript
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: !!process.env.VITE_GEMINI_API_KEY,
    newsAggregatorRunning: checkNewsAggregator(),
    instrumentSelected: getSelectedInstrument()
  });
});
```

### B. Contract Sync Service
Create a service that periodically fetches TopstepX contracts and caches them locally to improve test trade performance.

### C. Multi-Instrument News Aggregator
Run multiple news aggregator instances, one per instrument, and merge their feeds in the frontend.

### D. Automated Testing
Add tests for:
- Contract resolution logic
- Symbol mapping
- Gemini API error handling

---

## Questions?

For issues or questions:
- Check browser console logs (all operations are now logged)
- Review this document for configuration details
- File an issue with console logs and error details
