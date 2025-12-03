import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mock news data for development
const mockNews = [
  { id: 1, headline: "Fed signals potential rate pause amid cooling inflation", datetime: new Date().toISOString(), source: "Reuters" },
  { id: 2, headline: "Tech stocks rally on strong earnings outlook", datetime: new Date().toISOString(), source: "Bloomberg" },
  { id: 3, headline: "Oil prices surge on Middle East supply concerns", datetime: new Date().toISOString(), source: "CNBC" },
  { id: 4, headline: "S&P 500 futures point to higher open ahead of jobs data", datetime: new Date().toISOString(), source: "MarketWatch" },
  { id: 5, headline: "Treasury yields retreat from recent highs", datetime: new Date().toISOString(), source: "WSJ" },
  { id: 6, headline: "Nvidia shares hit new record on AI chip demand", datetime: new Date().toISOString(), source: "TechCrunch" },
  { id: 7, headline: "Bitcoin breaks $100K as institutional buying accelerates", datetime: new Date().toISOString(), source: "CoinDesk" },
  { id: 8, headline: "VIX drops below 14 signaling low volatility regime", datetime: new Date().toISOString(), source: "Barron's" },
];

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    {
      name: 'mock-news-api',
      configureServer(server) {
        server.middlewares.use('/api/newsfeed', (req, res) => {
          // Return random subset of mock news with fresh timestamps
          const shuffled = [...mockNews]
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)
            .map((item, idx) => ({
              ...item,
              id: Date.now() + idx,
              datetime: new Date(Date.now() - Math.random() * 300000).toISOString()
            }));

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(shuffled));
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  }
});
