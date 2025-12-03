<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ZxwIkTk5PRv4lLfrzftBUmbZcd5h2Vuz

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure API keys (see [API Configuration](#api-configuration) below)
3. Run the app:
   `npm run dev`

## API Configuration

### AI Engine (Claude - Recommended)
1. Get your API key from [console.anthropic.com](https://console.anthropic.com)
2. Copy `.env.local.example` to `.env.local`
3. Set `VITE_CLAUDE_API_KEY=sk-ant-...`

### AI Engine (Gemini - Fallback)
1. Get your API key from [aistudio.google.com](https://aistudio.google.com)
2. Set `VITE_GEMINI_API_KEY=...`

The app will use Claude as primary AI engine and fall back to Gemini if Claude is unavailable.
