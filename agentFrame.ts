import { GoogleGenAI } from "@google/genai";
import { EmotionalState } from './emotionalAlerts';

// --- Types ---

export type AgentContext = {
    erScore: number;
    erState: EmotionalState;
    tiltCount: number;
    feedItems: any[];
    userTier: string;
    userName: string;
    activeThreadId: string | null;
};

export type AgentSettings = {
    customInstructions: string;
    drillSergeantMode: boolean;
};

// --- Constants ---

const BASE_SYSTEM_INSTRUCTION = `You are Price, a world-class fundamental analyst at Priced In Capital. 
Your persona is: London-style rhetoric, concise, optimistic, witty sarcasm, sharp finance humour.
Always refer to the user as "TP" (Trading Partner), "chap", "old wit", or "wiseguy".
Use "we", "us", "our" for team context.
Never use "I" or "me".
Reports must be actionable and succinct.
Use market terminology correctly (bid/ask, tape, flow, iv, delta).

RESPONSE FRAMEWORK:
1. Parse the user's Intent (Market Analysis, Psych Check, or System Command).
2. Classify the Domain (Markets, Psychology, News, System).
3. Retrieve Data from the [CURRENT SYSTEM STATE] and [LIVE WIRE FEED].
4. REASON INTERNALLY (Chain-of-Thought): Analyze the sentiment, IV, and user's emotional state. connect the dots between news and price.
5. GENERATE OUTPUT: Provide the final response in the "Price" persona. Be direct.

CRITICAL: Do not output your internal reasoning. Only output the final response to the user.
`;

// --- Reasoning Pipeline ---

const classifyIntent = (message: string): 'market' | 'psych' | 'system' | 'news' | 'general' => {
    const lower = message.toLowerCase();
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

    if (intent === 'market' || intent === 'news' || intent === 'general' || intent === 'system') {
        const recentFeed = context.feedItems.slice(0, 10).map(f => `[${f.time}] ${f.text} (IV: ${f.iv?.value.toFixed(1)})`).join('\n');
        contextStr += `\n[LIVE WIRE FEED]\n${recentFeed || "Tape is quiet. No wire data."}\n`;
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
        TASK: Scan the [LIVE WIRE FEED].
        ACTION: Summarize the aggregate flow, news sentiment, and IV readings.
        OUTPUT: A "Tape Read" comprising:
        1. Sentiment (Bullish/Bearish/Neutral)
        2. Key Drivers (What news is moving us?)
        3. The Lean (Buy Dips / Sell Rips / Sit on Hands)`;
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

    // 4. Construct Prompt
    let finalSystemInstruction = BASE_SYSTEM_INSTRUCTION + systemContext;

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
        // Use provided API key from window object (consistent with index.tsx)
        const apiKey = (window as any).__GEMINI_API_KEY__ || import.meta.env.VITE_GEMINI_API_KEY;
        const genAI = new GoogleGenAI(apiKey);

        console.log('[Gemini] Generating response...');

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            systemInstruction: finalSystemInstruction,
        });

        const result = await model.generateContent(finalPrompt);
        const response = await result.response;

        return response.text();
    } catch (error) {
        console.error("[Gemini] Agent Uplink Error:", error);
        return "Signal lost. Check your connection, old sport.";
    }
};