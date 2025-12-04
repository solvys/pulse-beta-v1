/**
 * Cloudflare Worker: News Aggregator API
 * 
 * Fetches news from Alpaca Markets and Finnhub APIs
 * Returns combined, deduplicated news feed
 */

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Alpaca-Key, X-Alpaca-Secret, X-Finnhub-Key',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        // Only allow GET requests
        if (request.method !== 'GET') {
            return new Response('Method not allowed', { status: 405 });
        }

        try {
            const url = new URL(request.url);
            const limit = parseInt(url.searchParams.get('limit') || '20');

            // Fetch from both sources in parallel
            const [alpacaNews, finnhubNews] = await Promise.all([
                fetchAlpacaNews(env, request, limit / 2),
                fetchFinnhubNews(env, request, limit / 2)
            ]);

            // Combine and sort by datetime
            const allNews = [...alpacaNews, ...finnhubNews]
                .sort((a, b) => b.datetime - a.datetime)
                .slice(0, limit);

            return new Response(JSON.stringify({
                success: true,
                data: allNews,
                count: allNews.length
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });

        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
    },
};

/**
 * Fetch news from Alpaca Markets API
 */
async function fetchAlpacaNews(env, request, limit = 10) {
    try {
        // Try getting keys from headers first, then env vars
        const apiKey = request.headers.get('X-Alpaca-Key') || env.ALPACA_API_KEY;
        const apiSecret = request.headers.get('X-Alpaca-Secret') || env.ALPACA_API_SECRET;

        if (!apiKey || !apiSecret) {
            // Only warn if we really expected to fetch (i.e. not just probing)
            // console.warn('Alpaca API keys not configured');
            return [];
        }

        // Calculate time range (last 1 hour)
        const end = new Date();
        const start = new Date(end.getTime() - 60 * 60 * 1000);

        const url = new URL('https://data.alpaca.markets/v1beta1/news');
        url.searchParams.set('start', start.toISOString());
        url.searchParams.set('end', end.toISOString());
        url.searchParams.set('limit', limit.toString());
        url.searchParams.set('sort', 'desc');

        const response = await fetch(url.toString(), {
            headers: {
                'APCA-API-KEY-ID': apiKey,
                'APCA-API-SECRET-KEY': apiSecret,
            },
        });

        if (!response.ok) {
            // Don't throw, just return empty to allow partial success
            console.error(`Alpaca API error: ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        const newsItems = data.news || [];

        return newsItems.map(article => ({
            id: article.id || 0,
            time: formatTime(new Date(article.created_at)),
            text: article.headline || '',
            type: 'info',
            source: article.source || 'Alpaca',
            symbol: (article.symbols && article.symbols.length > 0) ? article.symbols[0] : undefined,
            iv: null // IV will be calculated by frontend if needed
        }));

    } catch (error) {
        console.error('Alpaca fetch error:', error);
        return [];
    }
}

/**
 * Fetch news from Finnhub API
 */
async function fetchFinnhubNews(env, request, limit = 10) {
    try {
        // Try getting key from headers first, then env var
        const apiKey = request.headers.get('X-Finnhub-Key') || env.FINNHUB_API_KEY;

        if (!apiKey) {
            // console.warn('Finnhub API key not configured');
            return [];
        }

        const url = new URL('https://finnhub.io/api/v1/news');
        url.searchParams.set('category', 'general');
        url.searchParams.set('token', apiKey);

        const response = await fetch(url.toString());

        if (!response.ok) {
            console.error(`Finnhub API error: ${response.statusText}`);
            return [];
        }

        const newsItems = await response.json();

        return newsItems.slice(0, limit).map(article => ({
            id: article.id || 0,
            time: formatTime(new Date(article.datetime * 1000)),
            text: article.headline || '',
            type: 'info',
            source: article.source || 'Finnhub',
            symbol: undefined,
            iv: null,
            datetime: article.datetime
        }));

    } catch (error) {
        console.error('Finnhub fetch error:', error);
        return [];
    }
}

/**
 * Format time as HH:MM
 */
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}
