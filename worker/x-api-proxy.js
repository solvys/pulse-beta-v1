/**
 * Cloudflare Worker: X API Proxy
 * 
 * This Worker acts as a CORS-friendly proxy for the X/Twitter API.
 * It receives requests from your frontend and forwards them to X API,
 * then returns the response with proper CORS headers.
 * 
 * Deploy this to Cloudflare Workers and update your frontend
 * WORKER_URL to point to this deployed worker.
 */

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bearer-Token',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        // Only allow GET requests
        if (request.method !== 'GET') {
            return new Response('Method not allowed', { status: 405 });
        }

        try {
            // Parse the incoming request URL
            const url = new URL(request.url);

            // Extract query parameters
            const query = url.searchParams.get('query');
            const maxResults = url.searchParams.get('max_results') || '20';
            const tweetFields = url.searchParams.get('tweet_fields') || 'created_at,text,referenced_tweets';
            const expansions = url.searchParams.get('expansions') || 'referenced_tweets.id';

            // Get the bearer token from the request header
            const bearerToken = request.headers.get('X-Bearer-Token');

            if (!bearerToken) {
                return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            if (!query) {
                return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            // Build the X API URL
            const xApiUrl = new URL('https://api.twitter.com/2/tweets/search/recent');
            xApiUrl.searchParams.set('query', query);
            xApiUrl.searchParams.set('max_results', maxResults);
            xApiUrl.searchParams.set('tweet.fields', tweetFields);
            xApiUrl.searchParams.set('expansions', expansions);

            // Make the request to X API
            const xApiResponse = await fetch(xApiUrl.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                },
            });

            // Get the response data
            const data = await xApiResponse.text();

            // Return the response with CORS headers
            return new Response(data, {
                status: xApiResponse.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bearer-Token',
                },
            });

        } catch (error) {
            return new Response(JSON.stringify({
                error: 'Proxy error',
                message: error.message
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
