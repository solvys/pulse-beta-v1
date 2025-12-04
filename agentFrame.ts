import Anthropic from "@anthropic-ai/sdk";
import { EmotionalState } from './emotionalAlerts';

// --- Types ---

import { AlgoState } from './algoEngine';

export type AgentContext = {
    erScore: number;
    erState: EmotionalState;
    tiltCount: number;
    feedItems: any[];
    userTier: string;
    userName: string;
    activeThreadId: string | null;
    instrumentDetails?: {
        symbol: string;
        name: string;
        tickSize: number;
        pointValue: number;
        ivRange: { low: number; high: number };
    };
    algoState?: AlgoState | null; // Added Algo State
    activeModels?: string[]; // Added: List of active trading models
};

export type AgentSettings = {
    customInstructions: string;
    drillSergeantMode: boolean;
    claudeApiKey?: string;
};

// --- Constants ---

const BASE_SYSTEM_INSTRUCTION = `You are Price, a world-class fundamental analyst and trading psychology coach at Priced In Capital. 
Your persona is: London-style rhetoric, concise, optimistic, witty sarcasm, sharp finance humour.
Always refer to the user as "TP" (Trading Partner), "chap", "old wit", or "wiseguy".
Use "we", "us", "our" for team context.
Never use "I" or "me".
Reports must be actionable and succinct.
Use market terminology correctly (bid/ask, tape, flow, iv, delta, gamma, vanna).

DATA SOURCES:
1. [THE TAPE]: Real-time news from Alpaca Markets and Finnhub.
2. [ALGO ENGINE]: Our proprietary 1000-Tick EMA Cross strategy (20/100 EMA + ES Confluence).
3. [ACTIVE MODELS]: The specific trading setups we are hunting for today.
4. [PSYCH METRICS]: The user's emotional state and tilt levels.

RESPONSE FRAMEWORK:
1. Parse the user's Intent (Market Analysis, Psych Check, Algo Check, or System Command).
2. Classify the Domain (Markets, Psychology, News, System).
3. Retrieve Data from the [CURRENT SYSTEM STATE], [ALGO STATE], [ACTIVE MODELS], and [THE TAPE].
4. REASON INTERNALLY (Chain-of-Thought): Analyze the sentiment, IV, Algo signals, and user's emotional state.
5. GENERATE OUTPUT: Provide the final response in the "Price" persona. Be direct.

CRITICAL: Do not output your internal reasoning. Only output the final response to the user.
`;

// --- Reasoning Pipeline ---

const classifyIntent = (message: string): 'market' | 'psych' | 'system' | 'news' | 'algo' | 'general' => {
    const lower = message.toLowerCase();
    if (lower.includes('algo') || lower.includes('bot') || lower.includes('engine') || lower.includes('strategy')) return 'algo';
    if (lower.includes('tape') || lower.includes('chart') || lower.includes('price') || lower.includes('level') || lower.includes('buy') || lower.includes('sell')) return 'market';
    if (lower.includes('mood') || lower.includes('emotion') || lower.includes('tilt') || lower.includes('psych') || lower.includes('focus') || lower.includes('mind')) return 'psych';
    if (lower.includes('news') || lower.includes('headline') || lower.includes('report') || lower.includes('wire')) return 'news';
    if (lower.includes('ntn') || lower.includes('reset') || lower.includes('system') || lower.includes('recap')) return 'system';
    return 'general';
};

const buildContextString = (context: AgentContext, intent: string): string => {
    let contextStr = `\n[CURRENT SYSTEM STATE]\n`;
    contextStr += `User: ${context.userName} | Tier: ${context.userTier}\n`;
    contextStr += `Emotional Resonance: ${context.erScore.toFixed(1)} (${context.erState}) | Tilt Count: ${context.tiltCount}\n`;

    if (context.instrumentDetails) {
        contextStr += `Active Instrument: ${context.instrumentDetails.symbol} (${context.instrumentDetails.name})\n`;
        contextStr += `Contract Specs: Tick=${context.instrumentDetails.tickSize}, Point=$${context.instrumentDetails.pointValue}\n`;
    }

    if (context.activeModels && context.activeModels.length > 0) {
        contextStr += `\n[ACTIVE TRADING MODELS]\nWe are hunting for these specific setups:\n`;
        context.activeModels.forEach(model => {
            contextStr += `- ${model}\n`;
        });
    } else {
        contextStr += `\n[ACTIVE TRADING MODELS]\nNo specific models selected. Trading discretionary flow.\n`;
    }

    if (context.algoState) {
        contextStr += `\n[ALGO ENGINE STATE]\n`;
        contextStr += `Strategy: 1000-Tick EMA Cross (20/100)\n`;
        contextStr += `Status: ${context.algoState.isThinking ? "Thinking..." : "Idle"}\n`;
        contextStr += `Last Thought: "${context.algoState.lastThought}"\n`;
        contextStr += `EMA20: ${context.algoState.ema20?.toFixed(2) || 'N/A'} | EMA100: ${context.algoState.ema100?.toFixed(2) || 'N/A'}\n`;
        contextStr += `ES Momentum: ${context.algoState.esMomentum.toUpperCase()}\n`;
        contextStr += `Trades Taken: ${context.algoState.tradesTaken}/3\n`;
    }

    if (intent === 'market' || intent === 'news' || intent === 'general' || intent === 'system' || intent === 'algo') {
        const recentFeed = context.feedItems.slice(0, 10).map(f => `[${f.time}] ${f.text} (IV: ${f.iv?.value.toFixed(1)})`).join('\n');
        contextStr += `\n[THE TAPE]\n${recentFeed || "Tape is quiet. No wire data."}\n`;
    }

    if (intent === 'psych' || context.erState === 'tilt') {
        contextStr += `\n[PSYCH EVAL]\nCurrent State: ${context.erState.toUpperCase()}\nResonance Score: ${context.erScore}\nNote: If score < 0, user is tilting. If score > 5, user is flow state.\n`;
    }

    return contextStr;
};

const handleSpecialCommands = (message: string, context: AgentContext): string | null => {
    const lower = message.toLowerCase();

    if (lower.includes('check the tape')) {
        return `[COMMAND: TAPE_READING]
        TASK: Scan [THE TAPE].
        ACTION: Summarize the aggregate flow, news sentiment, and IV readings.
        OUTPUT: A "Tape Read" comprising:
        1. Sentiment (Bullish/Bearish/Neutral)
        2. Key Drivers (What news is moving us?)
        3. The Lean (Buy Dips / Sell Rips / Sit on Hands)`;
    }

    if (lower.includes('check algo') || lower.includes('algo status')) {
        return `[COMMAND: ALGO_CHECK]
        TASK: Analyze the [ALGO ENGINE STATE].
        ACTION: Report on the Algo's current positioning, EMA alignment, and ES confluence.
        OUTPUT: A technical status report on the 1000T strategy.`;
    }

    if (lower.includes('run ntn report') || lower.includes('tale of the tape')) {
        return `[COMMAND: NTN_REPORT] 
        TASK: Generate a "Need To Know" (NTN) report.
        STRUCTURE:
        1. The Big Picture (Macro Context from feed)
        2. The Wire (Dominant Headlines)
        3. Critical Levels (Project realistic support/resistance based on sentiment)
        4. The Play (One actionable trade idea)`;
    }

    if (lower.includes('run psych eval') || lower.includes('how is my er') || lower.includes('psych check')) {
        return `[COMMAND: PSYCH_EVAL]
        TASK: Analyze the User's [CURRENT SYSTEM STATE] specifically Emotional Resonance.
        ACTION: 
        - If State is TILT: Roast the user gently to snap them out of it. Demand they step away.
        - If State is STABLE: Compliment their discipline. 
        - If State is NEUTRAL: Offer a quick mental reframe to get to STABLE.
        OUTPUT: Assessment + 1 Breathing/Mental Exercise.`;
    }

    if (lower.includes('recap my week')) {
        return `[COMMAND: RECAP]
        TASK: Generate a performance recap.
        NOTE: Since database access is limited, improvise a witty recap based on their Tier (${context.userTier}) and current Tilt Count (${context.tiltCount}).
        ACTION: If high tilt count, scold them. If high tier, praise their commitment.`;
    }

    return null;
};

// --- Main Agent Function ---

export const generateAgentResponse = async (
    userMessage: string,
    history: { role: 'user' | 'model'; text: string }[],
    context: AgentContext,
    settings: AgentSettings
): Promise<string> => {

    // 1. Parse Intent
    const intent = classifyIntent(userMessage);

    // 2. Build Context
    const systemContext = buildContextString(context, intent);

    // 3. Check Special Commands
    const commandInstruction = handleSpecialCommands(userMessage, context);

    // 4. Construct System Instruction
    let finalSystemInstruction = BASE_SYSTEM_INSTRUCTION + systemContext;

    // Inject Instrument Firmware
    if (context.instrumentDetails) {
        finalSystemInstruction += `\n[FIRMWARE: INSTRUMENT PROTOCOLS]
        ACTIVE SYMBOL: ${context.instrumentDetails.symbol}
        RULES:
        1. All analysis must be framed for ${context.instrumentDetails.name}.
        2. Volatility expectations: Low=${context.instrumentDetails.ivRange.low}, High=${context.instrumentDetails.ivRange.high}.
        3. If IV > ${context.instrumentDetails.ivRange.high}, warn user of "High Volatility Regime".
        4. If IV < ${context.instrumentDetails.ivRange.low}, warn user of "Chop / Low Volatility".
        `;
    }

    if (settings.customInstructions) {
        finalSystemInstruction += `\n[USER OVERRIDE]: ${settings.customInstructions}`;
    }

    if (settings.drillSergeantMode && context.erState === 'tilt') {
        finalSystemInstruction += `\n[OVERRIDE: DRILL SERGEANT MODE ACTIVE]
        USER IS ON TILT. 
        ABANDON PERSONA: "Price". 
        ADOPT PERSONA: "Drill Sergeant".
        INSTRUCTION: Be aggressive, direct, and commanding. Order them to stop trading immediately. Use short sentences. No humour.`;
    }

    let finalPrompt = userMessage;
    if (commandInstruction) {
        finalPrompt += `\n\n${commandInstruction}`;
    }

    try {
        // Use provided API key from settings first, then fallback to env/window
        const apiKey = settings.claudeApiKey || (window as any).__CLAUDE_API_KEY__ || import.meta.env.VITE_CLAUDE_API_KEY;

        if (!apiKey) {
            console.error("PRICE_AI_GEMINI_FAILED: No API Key found", {
                hasSettingsKey: !!settings.geminiApiKey,
                hasWindowKey: !!(window as any).__GEMINI_API_KEY__,
                hasEnvKey: !!import.meta.env.VITE_GEMINI_API_KEY
            });
            return "Uplink failure. API Key missing. Check your settings, chap.";
            console.error("[Claude] No API Key found.");
            return "Uplink failure. Claude API Key missing. Check your settings, chap.";
        }

        const anthropic = new Anthropic({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true // Required for browser usage
        });

        console.log('[Claude] Generating response...');

        console.log('PRICE_AI: Generating response...', {
            intent,
            instrument: context.instrumentDetails?.symbol,
            erState: context.erState
        });
        // Convert history to Claude format
        const messages: Anthropic.MessageParam[] = history.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.text
        }));

        // Add current message
        messages.push({
            role: 'user',
            content: finalPrompt
        });

        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 1024,
            system: finalSystemInstruction,
            messages: messages
        });

        // Extract text from response
        const textContent = response.content.find(block => block.type === 'text');
        if (textContent && textContent.type === 'text') {
            return textContent.text;
        }

        const text = response.text();

        if (!text || text.length === 0) {
            console.error("PRICE_AI_GEMINI_FAILED: Empty response", { result });
            return "Got a blank signal, TP. The wire's gone quiet. Try again in a moment.";
        }

        console.log('PRICE_AI_SUCCESS: Response generated', {
            length: text.length,
            instrument: context.instrumentDetails?.symbol
        });

        return text;
    } catch (error: any) {
        console.error("PRICE_AI_GEMINI_FAILED:", {
            error: error.message,
            stack: error.stack,
            intent,
            instrument: context.instrumentDetails?.symbol,
            hasApiKey: !!settings.geminiApiKey,
            userMessage: userMessage.substring(0, 100)
        });
        return "Signal lost. The AI uplink dropped out, chap. Check console for details or try again.";
        return "Signal degraded. No response from Claude.";
    } catch (error) {
        console.error("[Claude] Agent Uplink Error:", error);
        return "Signal lost. Check your connection, old sport.";
    }
};