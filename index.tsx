import React, { useState, useEffect, useRef, createContext, useContext, useCallback, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Activity, Shield, Zap, Settings, Terminal, Lock, ArrowRight,
    ChevronDown, ChevronUp, AlertTriangle, DollarSign, StopCircle,
    Layers, Clock, TrendingUp, Mic, MicOff, Volume2,
    Newspaper, X as XIcon, Check, Timer, Brain, User, LogOut,
    BarChart3, Target, Flame, Eye, AlertOctagon, Hourglass, Wallet,
    Siren, Paperclip, Camera, Video, FileText, Phone, MoreHorizontal, Send, Mic as MicIcon,
    Repeat, Image as ImageIcon, PanelLeftClose, PanelLeftOpen, Menu, LayoutDashboard, Keyboard, ChevronRight, ChevronLeft,
    Notebook, Plus, MessageSquare, Loader, GripHorizontal, HelpCircle, MousePointer2, AudioWaveform, RefreshCw, Bell, BellOff, UserPlus, UserMinus,
    Link as LinkIcon, Square, Trash2, Play, Calendar, Loader2, Save, Cpu
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage, Chat, GenerateContentResponse } from "@google/genai";
import { triggerEmotionalAlert, EmotionalState, playTone, playTiltBass, playTransitionWarning } from './emotionalAlerts';
import { generateAgentResponse, AgentContext } from './agentFrame';
import { ProjectXService, ProjectXAccount, ProjectXPosition } from './projectXService';

// --- Constants ---
const GOLD = "#FFC038";
const TOGGLE_GOLD = "#FBC717";

const CHALLENGE_PRESETS = [
    "Overtrading",
    "Revenge Trading",
    "Impulse Entries",
    "Fear of Missing Out",
    "Lack of Focus",
    "Poor Risk Management",
    "Not Letting Winners Run",
    "Premature Exits"
];

const GOAL_PRESETS = [
    "Improve Consistency",
    "Reduce Emotional Volatility",
    "Increase Win Rate",
    "Improve Risk/Reward",
    "Build Discipline",
    "Follow a Structured Plan"
];

const COGNITIVE_VERBS = [
    "absconding", "adlibbing", "agogging", "amalgamating", "analyzing", "astral-drifting", "baffling",
    "bedazzling", "bewildering", "bewitching", "brain-tinkering", "calculating", "cerebrating", "chronicling",
    "ciphering", "cogitating", "contemplating", "conjuring", "crunching", "dabbling", "deciphering",
    "deducing", "deliberating", "deriving", "disentangling", "discerning", "distilling", "dreamworking",
    "fabricating", "fathoming", "fadoodling", "finessing", "finagling", "flabbergasting", "flux-scanning",
    "galvanizing", "gallivanting", "grokking", "harmonizing", "hypothesizing", "illuminating", "inferring",
    "interpolating", "juggling data", "juxtaposing", "mapping signals", "mulling", "musing", "neutralizing noise",
    "optimizing", "orchestrating", "oscillating", "pattern-matching", "permutating", "pondering", "postulating",
    "processing", "projecting", "quantizing", "rationalizing", "realigning", "recalibrating", "refining",
    "reflecting", "reverse-engineering", "ruminating", "scaffolding insight", "scheming", "scoping",
    "scrutinizing", "sequencing", "signal-sifting", "simulating", "synthesizing", "stream-shaping",
    "theorizing", "translating", "triangulating", "tuning", "unpacking", "untangling", "visualizing",
    "wave-scanning", "whisper-mapping", "zeroing in", "zen-focusing"
];

const MARKET_TERMS = [
    "market-positioning", "flow-scanning", "order-book sifting", "trend-mapping", "momentum-profiling",
    "risk-surfacing", "volatility-probing", "signal-seeking", "macro-threading", "sentiment-gauging",
    "tape-reading", "liquidity-tracing", "impulse-filtering", "range-profiling", "phase-analysis"
];

const INSTRUMENT_RULES: Record<string, { name: string; contract: string; tickSize: number; pointValue: number; ivRange: { low: number; high: number } }> = {
    '/MNQ': { name: 'Micro E-mini NASDAQ 100', contract: 'Dec 25', tickSize: 0.25, pointValue: 2, ivRange: { low: 15, high: 40 } },
    '/MES': { name: 'Micro E-mini S&P 500', contract: 'Dec 25', tickSize: 0.25, pointValue: 5, ivRange: { low: 10, high: 30 } },
    '/MGC': { name: 'Micro Gold', contract: 'Feb 26', tickSize: 0.1, pointValue: 10, ivRange: { low: 10, high: 25 } },
    '/SIL': { name: 'Micro Silver', contract: 'Mar 26', tickSize: 0.005, pointValue: 50, ivRange: { low: 15, high: 35 } }
};

// Fallback Mock Data for Feed
const MOCK_WIRE_DATA = [
    { text: "ES Futures holding 5050 support, buyers stepping in.", source: "ZeroHedge" },
    { text: "VIX crushing below 14, calm before the storm?", source: "FinancialJuice" },
    { text: "AAPL breaking out of consolidation wedge on volume.", source: "Walter Bloomberg" },
    { text: "10Y Yield spiking, tech sector under pressure.", source: "DeltaOne" },
    { text: "JPM desk sees flow shifting to defensive names.", source: "InsiderPaper" },
    { text: "Nvidia testing ATH, gamma squeeze potential.", source: "ZeroHedge" },
    { text: "CPI print expected inline, market pricing in soft landing.", source: "Bloomberg" },
    { text: "Oil testing $80, geopolitical risk premium returning.", source: "FinancialJuice" }
];

// --- Types ---
type Tier = 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';

type Message = { role: 'user' | 'model'; text: string; timestamp: number; attachment?: string };
type Thread = {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
    algo: boolean;
    duration?: string;
    pnl?: 'positive' | 'negative';
    resonance?: 'stable' | 'tilt';
};

type AppSettings = {
    showUpgradeCTAText: boolean;
    xApiKey: string;
    xBearerToken: string;
    xApiSecretKey: string;
    topstepXUserName: string;
    topstepXApiKey: string;
    customInstructions: string;
    drillSergeantMode: boolean;
    devMode: boolean;
    mockDataEnabled: boolean;
    showFireTestTrade: boolean;
    tradingModels: {
        fortyFortyClub: boolean;
        chargedUpRippers: boolean;
        morningFlush: boolean;
        lunchPowerHourFlush: boolean;
        twentyTwoVixFix: boolean;
    };
    // New Alert Settings
    alerts: {
        enabled: boolean;
        voiceEnabled: boolean;
        escalationEnabled: boolean;
        toneType: 'sine' | 'square' | 'sawtooth' | 'triangle';
        voiceStyle: 'calm' | 'motivational' | 'drill';
    };
    // New Account Tracker & Algo Settings
    topstepAccountConnected: boolean;
    algoActive: boolean;
    currentPNL: number;
    tradingModelsExpanded: boolean;
    accountTrackerExpanded: boolean;
    dailyProfitTarget: number;
    dailyLossLimit: number;
    selectedAccount: string;
    maxTradesPerInterval: number;
    tradeIntervalMinutes: number;
    // Instrument & Risk Settings
    selectedInstrument: string;
    contractSize: number;
    claudeApiKey: string;
};

type OnboardingData = {
    challenges: string[];
    goals: string[];
    otherChallenge: string;
    otherGoal: string;
};

type UserState = {
    tier: Tier;
    name: string;
    hasSeenPriceOnboarding: boolean;
    onboardingData: OnboardingData;
};

type IVData = { type: 'cyclical' | 'countercyclical'; value: number };
type FeedItem = {
    id: number;
    time: string;
    text: string;
    type: 'info' | 'warning' | 'success' | 'neutral' | 'psych';
    symbol?: string;
    source?: string;
    iv?: IVData;
};

// --- Utils ---
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

// --- Contexts ---

// 1. Auth & User Context
interface AuthContextType {
    user: UserState;
    updateTier: (tier: Tier) => void;
    markOnboardingSeen: () => void;
    resetOnboarding: () => void;
    saveOnboardingData: (data: OnboardingData) => void;
    partialResetOnboarding: (type: 'challenges' | 'goals') => void;
}
const AuthContext = createContext<AuthContextType | null>(null);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserState>(() => {
        const saved = localStorage.getItem('pulse_user');
        return saved ? JSON.parse(saved) : {
            tier: 'free',
            name: 'Trader',
            hasSeenPriceOnboarding: false,
            onboardingData: { challenges: [], goals: [], otherChallenge: '', otherGoal: '' }
        };
    });

    useEffect(() => {
        localStorage.setItem('pulse_user', JSON.stringify(user));
    }, [user]);

    const updateTier = (tier: Tier) => setUser(prev => ({ ...prev, tier }));
    const markOnboardingSeen = () => setUser(prev => ({ ...prev, hasSeenPriceOnboarding: true }));
    const resetOnboarding = () => setUser(prev => ({
        ...prev,
        hasSeenPriceOnboarding: false,
        onboardingData: { challenges: [], goals: [], otherChallenge: '', otherGoal: '' }
    }));

    const saveOnboardingData = (data: OnboardingData) => {
        setUser(prev => ({
            ...prev,
            onboardingData: data
        }));
    };

    const partialResetOnboarding = (type: 'challenges' | 'goals') => {
        setUser(prev => ({
            ...prev,
            hasSeenPriceOnboarding: false,
            onboardingData: {
                ...prev.onboardingData,
                [type]: [],
                ...(type === 'challenges' ? { otherChallenge: '' } : { otherGoal: '' })
            }
        }));
    };

    return (
        <AuthContext.Provider value={{ user, updateTier, markOnboardingSeen, resetOnboarding, saveOnboardingData, partialResetOnboarding }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
};

// 2. Thread Context
interface ThreadContextType {
    threads: Thread[];
    activeThreadId: string | null;
    createThread: (initialMessage?: string, initialRole?: 'user' | 'model') => string;
    setActiveThread: (id: string) => void;
    addMessage: (threadId: string, msg: Message) => void;
    updateThread: (threadId: string, updates: Partial<Thread>) => void;
    clearHistory: () => void;
    activeThread: Thread | undefined;
}

const ThreadContext = createContext<ThreadContextType | null>(null);

const ThreadProvider = ({ children }: { children: React.ReactNode }) => {
    const [threads, setThreads] = useState<Thread[]>(() => {
        const saved = localStorage.getItem('pulse_threads');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('pulse_threads', JSON.stringify(threads));
    }, [threads]);

    const createThread = (initialMessage?: string, initialRole: 'user' | 'model' = 'user') => {
        const id = Date.now().toString();
        const newThread: Thread = {
            id,
            title: initialMessage && initialRole === 'user' ? (initialMessage.substring(0, 30) + (initialMessage.length > 30 ? '...' : '')) : `Session ${new Date().toLocaleTimeString()} `,
            timestamp: Date.now(),
            messages: initialMessage ? [{ role: initialRole, text: initialMessage, timestamp: Date.now() }] : [],
            algo: false,
            pnl: Math.random() > 0.5 ? 'positive' : 'negative',
            resonance: Math.random() > 0.8 ? 'tilt' : 'stable'
        };
        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(id);
        return id;
    };

    const addMessage = (threadId: string, msg: Message) => {
        setThreads(prev => prev.map(t => {
            if (t.id === threadId) {
                let newTitle = t.title;
                if (t.messages.length === 0 && msg.role === 'user') {
                    newTitle = msg.text.substring(0, 30) + (msg.text.length > 30 ? '...' : '');
                }
                return { ...t, messages: [...t.messages, msg], title: newTitle };
            }
            return t;
        }));
    };

    const updateThread = (threadId: string, updates: Partial<Thread>) => {
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, ...updates } : t));
    };

    const clearHistory = () => {
        setThreads([]);
        setActiveThreadId(null);
    };

    return (
        <ThreadContext.Provider value={{
            threads, activeThreadId, createThread, setActiveThread: setActiveThreadId, addMessage, updateThread, clearHistory,
            activeThread: threads.find(t => t.id === activeThreadId)
        }}>
            {children}
        </ThreadContext.Provider>
    );
};

const useThreads = () => {
    const ctx = useContext(ThreadContext);
    if (!ctx) throw new Error("useThreads must be used within ThreadProvider");
    return ctx;
};

// 3. Settings Context
interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (partial: Partial<AppSettings>) => void;
}
const SettingsContext = createContext<SettingsContextType | null>(null);

const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('pulse_settings');
        // Merge defaults carefully in case of schema update
        const defaults: AppSettings = {
            showUpgradeCTAText: true,
            xApiKey: '',
            xBearerToken: 'AAAAAAAAAAAAAAAAAAAAAB/L5gEAAAAAjeqUBtpMWRv3yVSiD8vc1HPvg1U=Rt4RbYZS5CPTE9lAYlo9wxs7m67teTzJh6I2I1HeNikHckBmXf',
            xApiSecretKey: '',
            topstepXUserName: '',
            topstepXApiKey: '',
            customInstructions: '',
            drillSergeantMode: false,
            devMode: false,
            mockDataEnabled: false,
            showFireTestTrade: false,
            tradingModels: {
                fortyFortyClub: true,
                chargedUpRippers: false,
                morningFlush: false,
                lunchPowerHourFlush: false,
                twentyTwoVixFix: false
            },
            alerts: {
                enabled: true,
                voiceEnabled: true,
                escalationEnabled: true,
                toneType: 'sine',
                voiceStyle: 'motivational'
            },
            // New Account Tracker & Algo Settings
            topstepAccountConnected: false,
            algoActive: false,
            currentPNL: 0,
            tradingModelsExpanded: false,
            accountTrackerExpanded: false,
            dailyProfitTarget: 1000,
            dailyLossLimit: 2000,
            selectedAccount: '',
            maxTradesPerInterval: 5,
            tradeIntervalMinutes: 15,
            selectedInstrument: '/MES',
            contractSize: 1,
            claudeApiKey: ''
        };
        const loaded = saved ? JSON.parse(saved) : {};
        return {
            ...defaults,
            ...loaded,
            tradingModels: { ...defaults.tradingModels, ...(loaded.tradingModels || {}) },
            alerts: { ...defaults.alerts, ...(loaded.alerts || {}) }
        };
    });

    useEffect(() => {
        localStorage.setItem('pulse_settings', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (partial: Partial<AppSettings>) => setSettings(prev => ({ ...prev, ...partial }));

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};
const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
    return ctx;
};

// --- Components ---

// Gemini Icon
const GeminiIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" fill="currentColor" />
        <path d="M19 15L19.8 17.2L22 18L19.8 18.8L19 21L18.2 18.8L16 18L18.2 17.2L19 15Z" fill="currentColor" />
    </svg>
);

// IV Indicator Component
const IVIndicator = ({ change }: { change: number }) => {
    const isBullish = change >= 0;
    const color = isBullish ? "text-emerald-500" : "text-red-500";
    const showValue = Math.abs(change) >= 30;

    return (
        <div className="flex items-center gap-1.5 font-mono text-xs bg-[#140a00] px-2 py-1 rounded border border-[#FFC038]/20 shadow-[0_0_5px_rgba(0,0,0,0.5)]">
            <span className="text-[#FFC038] font-bold tracking-wider">IV:</span>
            {showValue ? (
                <span className={cn("font-bold flex items-center gap-1", color)}>
                    {isBullish ? '▲' : '▼'}
                    <span>{change > 0 ? '+' : ''}{change.toFixed(1)} pts</span>
                </span>
            ) : (
                <span className="text-[#FFC038]/50 font-bold">-</span>
            )}
        </div>
    );
};

// 1. Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    state = { hasError: false };
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error: any, info: any) { console.error("Pulse Error:", error, info); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-[#FFC038] p-8 text-center border border-[#FFC038]/20 bg-[#050500] m-4 rounded-xl">
                    <AlertTriangle className="w-12 h-12 mb-4" />
                    <h2 className="text-xl font-bold font-['Roboto'] mb-2">SYSTEM FAILURE</h2>
                    <p className="font-mono text-sm opacity-60 mb-6">A critical rendering error occurred.</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-[#FFC038] text-black font-bold rounded font-mono hover:bg-[#FFD060]">REBOOT SYSTEM</button>
                </div>
            );
        }
        return this.props.children;
    }
}

// 2. Toggle
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(); }}
        className={cn(
            "w-9 h-5 rounded-full relative transition-colors duration-200 ease-in-out shrink-0 focus:outline-none",
            checked ? "bg-[#FBC717]" : "bg-black border border-[#FBC717]"
        )}
    >
        <span
            className={cn(
                "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-200 ease-in-out shadow-sm",
                checked ? "right-1 bg-black" : "left-1 bg-[#FBC717]"
            )}
        />
    </button>
);

// 3. LockedCard
interface LockedCardProps {
    locked: boolean;
    mode?: 'cta' | 'blur';
    title?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    onUpgrade?: () => void;
}
const LockedCard = ({ locked, mode = 'cta', title, children, className, onUpgrade }: LockedCardProps) => {
    const { settings } = useSettings();
    const showText = settings.showUpgradeCTAText;

    if (!locked) return <div className={cn("relative", className)}>{children}</div>;

    return (
        <div className={cn("relative overflow-hidden rounded-lg group", className)}>
            {title && <div className="relative z-0 opacity-50 blur-[1px] pointer-events-none">{title}</div>}

            <div className="blur-[6px] opacity-40 pointer-events-none select-none grayscale transition-all duration-[1500ms] h-full w-full">
                {children}
            </div>

            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                {mode === 'cta' && showText ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                        <Lock className="w-5 h-5 text-[#FFC038] mb-2" />
                        <span className="text-[10px] font-bold text-[#FFC038] uppercase tracking-widest font-['Roboto']">Locked</span>
                        {onUpgrade && (
                            <button onClick={onUpgrade} className="mt-2 text-[9px] bg-[#FFC038] text-black px-2 py-1 rounded font-bold hover:bg-[#FFD060] transition-colors">
                                UPGRADE TO PULSE+
                            </button>
                        )}
                    </div>
                ) : (
                    <Lock className="w-4 h-4 text-[#FFC038]/50" />
                )}
            </div>
        </div>
    );
};

// 4. Modal
const Modal = ({ isOpen, onClose, children, className, hideClose = false }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; className?: string, hideClose?: boolean }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className={cn("bg-[#050500] border border-[#FFC038]/30 rounded-xl shadow-[0_0_50px_rgba(255,192,56,0.1)] relative max-h-[90vh] overflow-y-auto", className)}>
                {!hideClose && (
                    <button onClick={onClose} className="absolute top-4 right-4 text-[#FFC038]/50 hover:text-[#FFC038] transition-colors">
                        <XIcon className="w-5 h-5" />
                    </button>
                )}
                {children}
            </div>
        </div>
    );
};

// 4.5 Knowledge Base Modal
const KnowledgeBaseModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState(false);

    const handleLogin = () => {
        if (password === "PIResearch25$") {
            setIsAuthenticated(true);
            setError(false);
        } else {
            setError(true);
            playTone(150, 'sawtooth', 0.3, 0.1); // Error tone
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="w-full max-w-4xl h-[80vh] flex flex-col">
            {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center h-full p-8">
                    <Lock className="w-12 h-12 text-[#FFC038] mb-4" />
                    <h2 className="text-xl font-bold text-[#FFC038] mb-2 font-['Roboto'] tracking-wider">RESTRICTED ACCESS</h2>
                    <p className="text-[#FFC038]/60 mb-6 text-sm font-mono">Enter security clearance code to access the Trading Playbook.</p>

                    <div className="flex gap-2 w-full max-w-xs">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            placeholder="Enter Password"
                            className="flex-1 bg-black border border-[#FFC038]/30 rounded px-3 py-2 text-[#FFC038] focus:border-[#FFC038] outline-none font-mono text-sm"
                        />
                        <Button onClick={handleLogin} variant="primary">ACCESS</Button>
                    </div>
                    {error && <p className="text-red-500 text-xs mt-3 font-mono animate-pulse">ACCESS DENIED: INVALID CREDENTIALS</p>}
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    <div className="p-6 border-b border-[#FFC038]/20 flex items-center gap-3">
                        <Notebook className="w-6 h-6 text-[#FFC038]" />
                        <div>
                            <h2 className="text-xl font-bold text-[#FFC038] font-['Roboto'] tracking-wider">TRADING PLAYBOOK</h2>
                            <p className="text-[#FFC038]/50 text-xs font-mono">ALGO CRITERIA & MODEL DEFINITIONS</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* 40/40 Club */}
                        <section>
                            <h3 className="text-lg font-bold text-[#FFC038] mb-3 flex items-center gap-2">
                                <Target className="w-5 h-5" /> 40/40 Club
                            </h3>
                            <div className="bg-[#140a00] border border-[#FFC038]/20 rounded-lg p-4">
                                <p className="text-[#FFC038]/80 text-sm mb-4">A high-probability trend continuation model looking for sustained momentum.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-[#FFC038]/70">
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Trend:</strong> Strong directional bias on 15m/1h.</li>
                                        <li><strong className="text-[#FFC038]">Volume:</strong> Above average relative volume (RVOL &gt; 1.2).</li>
                                        <li><strong className="text-[#FFC038]">Structure:</strong> Clean flag or consolidation break.</li>
                                    </ul>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Entry:</strong> Break of consolidation high/low.</li>
                                        <li><strong className="text-[#FFC038]">Stop:</strong> Below consolidation low / Above high.</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Charged Up Rippers */}
                        <section>
                            <h3 className="text-lg font-bold text-[#FFC038] mb-3 flex items-center gap-2">
                                <Zap className="w-5 h-5" /> Charged Up Rippers
                            </h3>
                            <div className="bg-[#140a00] border border-[#FFC038]/20 rounded-lg p-4">
                                <p className="text-[#FFC038]/80 text-sm mb-4">Momentum scalping model based on rapid order flow imbalances.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-[#FFC038]/70">
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Context:</strong> High volatility environment (IV &gt; 20).</li>
                                        <li><strong className="text-[#FFC038]">Trigger:</strong> Aggressive market buying/selling absorption.</li>
                                        <li><strong className="text-[#FFC038]">Tape:</strong> Speed of tape acceleration.</li>
                                    </ul>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Execution:</strong> Market order on momentum confirmation.</li>
                                        <li><strong className="text-[#FFC038]">Management:</strong> Quick profit taking (scalp).</li>
                                        <li><strong className="text-[#FFC038]">Risk:</strong> Tight stop (5-8 ticks).</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Morning Flush */}
                        <section>
                            <h3 className="text-lg font-bold text-[#FFC038] mb-3 flex items-center gap-2">
                                <ArrowRight className="w-5 h-5 rotate-45" /> Morning Flush
                            </h3>
                            <div className="bg-[#140a00] border border-[#FFC038]/20 rounded-lg p-4">
                                <p className="text-[#FFC038]/80 text-sm mb-4">Reversal model targeting the opening range liquidity sweep.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-[#FFC038]/70">
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Time:</strong> 9:30 AM - 10:00 AM EST.</li>
                                        <li><strong className="text-[#FFC038]">Setup:</strong> Price pushes aggressively into key support/resistance.</li>
                                        <li><strong className="text-[#FFC038]">Signal:</strong> Rejection wick + volume spike.</li>
                                    </ul>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Entry:</strong> Retest of the rejection level.</li>
                                        <li><strong className="text-[#FFC038]">Target:</strong> Opening print or opposing liquidity.</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Lunch Power Hour Flush */}
                        <section>
                            <h3 className="text-lg font-bold text-[#FFC038] mb-3 flex items-center gap-2">
                                <Clock className="w-5 h-5" /> Lunch Power Hour Flush
                            </h3>
                            <div className="bg-[#140a00] border border-[#FFC038]/20 rounded-lg p-4">
                                <p className="text-[#FFC038]/80 text-sm mb-4">Mid-day reversal catching the "lunch money" liquidity grab.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-[#FFC038]/70">
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Time:</strong> 12:00 PM - 1:30 PM EST.</li>
                                        <li><strong className="text-[#FFC038]">Context:</strong> Low volume drift into a level.</li>
                                        <li><strong className="text-[#FFC038]">Trap:</strong> False breakout/breakdown.</li>
                                    </ul>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Confirmation:</strong> Reclaim of the broken level.</li>
                                        <li><strong className="text-[#FFC038]">Target:</strong> Range mean reversion.</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* 22 VIX Fix */}
                        <section>
                            <h3 className="text-lg font-bold text-[#FFC038] mb-3 flex items-center gap-2">
                                <Activity className="w-5 h-5" /> 22 VIX Fix
                            </h3>
                            <div className="bg-[#140a00] border border-[#FFC038]/20 rounded-lg p-4">
                                <p className="text-[#FFC038]/80 text-sm mb-4">Volatility mean reversion model based on VIX extremes.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-[#FFC038]/70">
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Indicator:</strong> VIX &gt; 22 or VIX Bollinger Band tag.</li>
                                        <li><strong className="text-[#FFC038]">Concept:</strong> Fear is overextended.</li>
                                        <li><strong className="text-[#FFC038]">Market:</strong> ES/NQ bottoms while VIX tops.</li>
                                    </ul>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong className="text-[#FFC038]">Entry:</strong> Divergence between Price Low and VIX High.</li>
                                        <li><strong className="text-[#FFC038]">Style:</strong> Swing or long-duration day trade.</li>
                                    </ul>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </Modal>
    );
};

// 5. Button
const Button = ({
    children, onClick, variant = "primary", className = "", disabled = false
}: {
    children?: React.ReactNode; onClick?: () => void;
    variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
    className?: string; disabled?: boolean;
}) => {
    const variants = {
        primary: "bg-[#FFC038] hover:bg-[#FFD060] text-black font-bold shadow-[0_0_15px_rgba(255,192,56,0.3)] border border-[#FFC038]",
        secondary: "bg-black hover:bg-[#1a1500] text-[#FFC038] border border-[#FFC038]/40 hover:border-[#FFC038]",
        danger: "bg-red-900/40 hover:bg-red-800/40 text-red-200 border border-red-800/50",
        success: "bg-emerald-900/40 hover:bg-emerald-800/40 text-emerald-200 border border-emerald-800/50",
        ghost: "bg-transparent hover:bg-[#FFC038]/10 text-[#FFC038]/60 hover:text-[#FFC038]"
    };
    return (
        <button
            onClick={onClick} disabled={disabled}
            className={cn(
                "px-4 py-2 font-mono text-sm transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                className
            )}
        >
            {children}
        </button>
    );
};

// --- New Components (PsychAssist Upgrade) ---

// Waveform Component
const WaveformCanvas = ({ stream, erScore }: { stream: MediaStream | null, erScore: number }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Derived state from ER score
    const isTilt = erScore < -0.5;
    const isStable = erScore > 0.5;

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        analyserRef.current = analyser;
        sourceRef.current = source;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d')!;
        let animationId: number;

        const draw = () => {
            if (!canvas) return;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw logic
            const centerY = canvas.height / 2;
            const barWidth = (canvas.width / bufferLength) * 2;
            let x = 0;

            // Dynamic Color Logic
            // Gold base, Pulse Red if Tilt
            const baseColor = isTilt ? `rgba(255, 64, 64, ${0.5 + Math.abs(Math.sin(Date.now() / 200)) * 0.5})` : '#FBC717';
            ctx.fillStyle = baseColor;

            for (let i = 0; i < bufferLength; i++) {
                let value = dataArray[i];
                let percent = value / 255;
                // Intensity scales with negative ER score if tilted
                let heightMultiplier = isTilt ? 1 + (Math.abs(erScore) * 0.1) : 0.8;
                let height = percent * canvas.height * heightMultiplier;

                // Idle motion
                if (height < 2) {
                    const speed = isTilt ? 100 : 200;
                    height = 2 + Math.sin(Date.now() / speed + i) * (isTilt ? 4 : 1.5);
                }

                ctx.fillRect(x, centerY - height / 2, barWidth, height);
                x += barWidth + 1;
            }

            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationId);
            source.disconnect();
            audioCtx.close();
        };
    }, [stream, isTilt, erScore]);

    return <canvas ref={canvasRef} className="w-full h-full opacity-80" width={240} height={40} />;
};

// Emotional Resonance Monitor Logic
// Logic Patch: PsychAssist Initialization & Reset
const EmotionalResonanceMonitor = ({
    active,
    sessionTime,
    onStateUpdate,
    onTilt
}: {
    active: boolean,
    sessionTime?: string,
    onStateUpdate: (score: number, state: EmotionalState, tiltCount: number) => void,
    onTilt?: (tiltCount: number) => void
}) => {
    const { settings } = useSettings();
    const [score, setScore] = useState(5.0); // Start at +5.0 (Stable)
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [statusText, setStatusText] = useState("Initializing...");
    const [tiltCount, setTiltCount] = useState(0);
    const tiltCountRef = useRef(0); // Sync ref for immediate logic
    const analyserRef = useRef<AnalyserNode | null>(null);

    // Refs for processing loops to avoid dependency stale closures
    const scoreRef = useRef(5.0);
    const lastRecoverTime = useRef(Date.now());
    const lastInfractionTime = useRef(0);

    // Sync ref
    useEffect(() => {
        scoreRef.current = score;
    }, [score]);

    // Derived State
    // Stable: 5.0 to 9.9 (covered by > 0.5 for now, up to max)
    // Neutral: -0.5 to 0.5
    // Tilt: -0.51 to -9.9
    let state: EmotionalState = 'neutral';
    if (score > 0.5) state = 'stable';
    else if (score >= -0.5) state = 'neutral';
    else state = 'tilt';

    // State Change Sound & Voice Alerts
    const lastStateRef = useRef<EmotionalState>('stable');
    const tiltSoundIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Sync state to parent
        onStateUpdate(score, state, tiltCountRef.current);

        if (state !== lastStateRef.current) {
            // Update Tilt Count Logic
            if (state === 'tilt') {
                tiltCountRef.current += 1;
                setTiltCount(tiltCountRef.current);

                // Notify parent for AI Agent
                if (onTilt) onTilt(tiltCountRef.current);

                // Play transition warning if coming from stable (skipping neutral)
                if (lastStateRef.current === 'stable' && settings.alerts.enabled) {
                    playTransitionWarning(settings.alerts.toneType);
                }
            }

            // Trigger Emotional Alerts Engine
            triggerEmotionalAlert(state, tiltCountRef.current, settings.alerts);

            // DUAL TILT WARNING: Special override for 2nd tilt
            if (state === 'tilt' && tiltCountRef.current === 2) {
                // Force escalation message
                setTimeout(() => {
                    playTone(110, settings.alerts.toneType, 2.0, 0.3); // Loud, long warning tone

                    if (settings.alerts.voiceEnabled && 'speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        const ut = new SpeechSynthesisUtterance(
                            settings.alerts.voiceStyle === 'drill'
                                ? "SECOND TILT INFRACTION! STEP AWAY FROM YOUR TRADING SETUP IMMEDIATELY!"
                                : "You've hit tilt twice. Please step away from your trading setup and take a break."
                        );
                        ut.rate = 1.0;
                        ut.pitch = 1.0;
                        ut.volume = 1.0;
                        window.speechSynthesis.speak(ut);
                    }
                }, 600);
            }

            lastStateRef.current = state;
        }

        // Continuous Tilt Bass Sound Monitoring
        if (state === 'tilt' && settings.alerts.enabled) {
            // Clear any existing interval
            if (tiltSoundIntervalRef.current) {
                clearInterval(tiltSoundIntervalRef.current);
            }

            // Play initial bass sound immediately
            playTiltBass(settings.alerts.toneType);

            // Set up interval to play bass sound every 2.5 seconds while tilting
            tiltSoundIntervalRef.current = setInterval(() => {
                if (settings.alerts.enabled) {
                    playTiltBass(settings.alerts.toneType);
                }
            }, 2500);
        } else {
            // Clear interval when not tilting
            if (tiltSoundIntervalRef.current) {
                clearInterval(tiltSoundIntervalRef.current);
                tiltSoundIntervalRef.current = null;
            }
        }

        // Status Text Update
        if (state === 'stable') setStatusText("Emotional state: Stable");
        else if (state === 'tilt') setStatusText("Emotional state: Tilt Detected");
        else setStatusText("Emotional state: Neutral");

        // Cleanup function
        return () => {
            if (tiltSoundIntervalRef.current) {
                clearInterval(tiltSoundIntervalRef.current);
                tiltSoundIntervalRef.current = null;
            }
        };

    }, [state, score, settings.alerts]); // Added score to deps to ensure update

    // Init Mic & Volume Analysis
    useEffect(() => {
        if (!active) return;

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        let localStream: MediaStream;

        navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
            localStream = s;
            setStream(s);
            const source = audioCtx.createMediaStreamSource(s);
            source.connect(analyser);
            analyserRef.current = analyser;
        }).catch(e => console.error(e));

        // Volume Check Loop (Aggressive Tone)
        const volInterval = setInterval(() => {
            if (!analyserRef.current) return;
            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(data);

            // Calculate RMS
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            const avg = sum / data.length;

            // Threshold for "Yelling/Aggressive"
            if (avg > 150) { // arbitrary threshold, tuned for generic mic
                applyPenalty(1.3, "Aggressive Tone");
            }
        }, 1000);

        return () => {
            clearInterval(volInterval);
            if (localStream) localStream.getTracks().forEach(t => t.stop());
            audioCtx.close();
        };
    }, [active]);

    // Init Speech Recognition
    useEffect(() => {
        if (!active) return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.toLowerCase();
            analyzeText(transcript);
        };

        recognition.start();
        return () => recognition.stop();
    }, [active]);

    const applyPenalty = (amount: number, reason: string) => {
        // Debounce penalties slightly
        const now = Date.now();
        if (now - lastInfractionTime.current < 2000) return;

        lastInfractionTime.current = now;
        lastRecoverTime.current = now; // Reset recovery timer

        setScore(prev => Math.max(-9.9, prev - amount));
        console.log(`Penalty: -${amount} (${reason})`);

        // Play bass sound on every tilt violation
        if (settings.alerts.enabled) {
            playTiltBass(settings.alerts.toneType);
        }
    };

    const analyzeText = (text: string) => {
        // Comprehensive curse word detection
        const CURSE_WORDS = [
            'fuck', 'fucking', 'fucked', 'fucker', 'fucks',
            'shit', 'shitty', 'bullshit',
            'damn', 'dammit', 'goddamn',
            'bitch', 'bastard', 'asshole', 'ass',
            'crap', 'piss', 'pissed',
            'hell', 'bloody',
            'cock', 'dick', 'pussy', 'cunt',
            'motherfucker', 'son of a bitch',
            // Additional curse phrases
            'god damn it', 'you have got to be kidding me', 'oh my god'
        ];
        const AGGRESSIVE_WORDS = ['stupid', 'idiot', 'hate', 'lose', 'losing', 'bad', 'worst', 'trash', 'useless', 'garbage'];

        let curseCount = 0;
        let hasAggressive = false;

        // Count curse words
        CURSE_WORDS.forEach(w => {
            if (text.includes(w)) {
                curseCount++;
            }
        });

        // Check for aggressive language
        hasAggressive = AGGRESSIVE_WORDS.some(w => text.includes(w));

        // Apply Penalties
        let penalty = 0;

        if (curseCount >= 3) {
            // Batch penalty for multiple curses (3 or more)
            penalty = 5.0;
            applyPenalty(penalty, `Multiple Curses(${curseCount} detected)`);
        } else if (curseCount > 0) {
            // Individual penalty per curse word
            penalty = curseCount * 0.7;
            applyPenalty(penalty, `Curse Word(s)(${curseCount})`);
        } else if (hasAggressive) {
            // Aggressive language without cursing
            penalty = 1.3;
            applyPenalty(penalty, "Aggressive Language");
        }
    };


    // Recovery Logic (+0.25 every 30s)
    useEffect(() => {
        if (!active) return;

        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastRecoverTime.current >= 30000) {
                setScore(prev => {
                    if (prev >= 9.9) return prev; // Cap stable recovery at ~9.9
                    return Math.min(9.9, prev + 0.25);
                });
                lastRecoverTime.current = now;
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [active]);

    // Dot Color
    const dotColors = {
        stable: 'text-[#00FF85]',
        neutral: 'text-[#FBC717]',
        tilt: 'text-[#FF4040]'
    };

    return (
        <div className="mt-3 pt-3 border-t border-[#FFC038]/20 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-end mb-2">
                <div className="flex flex-col">
                    <span className="text-[9px] text-[#FFC038]/50 uppercase tracking-widest font-bold mb-1">Emotional Resonance</span>
                    <span className="text-[10px] text-[#FFC038] font-mono">{statusText}</span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-[#FFC038]/10">
                    <span className={cn("text-[10px]", dotColors[state])}>●</span>
                    <span className={cn("text-xs font-mono font-bold w-10 text-right", dotColors[state])}>
                        {score > 0 ? '+' : ''}{score.toFixed(1)}
                    </span>
                </div>
            </div>

            <div className={cn("relative h-10 bg-[#0a0a00] rounded overflow-hidden border transition-colors duration-500", state === 'tilt' ? "border-red-900 shadow-[0_0_10px_rgba(255,0,0,0.2)]" : "border-[#FFC038]/10 shadow-inner")}>
                {/* Visualizer */}
                <WaveformCanvas stream={stream} erScore={score} />

                {/* Scanline overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,11,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>

                {/* Session Timer Overlay */}
                {sessionTime && (
                    <div className="absolute top-0 right-0 p-1">
                        <div className="bg-[#FFC038]/10 backdrop-blur-md px-1.5 rounded border border-[#FFC038]/20">
                            <span className="text-[9px] text-[#FFC038] font-mono tracking-wider">{sessionTime}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-1 flex justify-between items-center">
                <span className="text-[9px] text-[#FFC038]/30">Drill Sergeant: {settings.alerts.voiceStyle === 'drill' ? 'ON' : 'OFF'}</span>
                <span className={cn("text-[9px] uppercase font-bold tracking-widest transition-colors duration-300", dotColors[state])}>
                    State: {state}
                </span>
            </div>
        </div>
    );
};

// --- Main Components ---

const ThinkingIndicator = () => {
    const [word, setWord] = useState("initializing");
    const [fade, setFade] = useState(true);

    useEffect(() => {
        const pickWord = () => {
            // 15% chance for market term (approx 1 in 7)
            if (Math.random() < 0.15) {
                return MARKET_TERMS[Math.floor(Math.random() * MARKET_TERMS.length)];
            }
            return COGNITIVE_VERBS[Math.floor(Math.random() * COGNITIVE_VERBS.length)];
        };

        // Initial set
        setWord(pickWord());

        const interval = setInterval(() => {
            setFade(false);
            setTimeout(() => {
                setWord(pickWord());
                setFade(true);
            }, 500); // 500ms fade out transition
        }, 2500); // New word every 2.5s

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-4 py-3 px-2">
            <style>{`
@keyframes wave {
    0 %, 100 % { height: 40 %; opacity: 0.6; }
    50 % { height: 100 %; opacity: 1; }
}
@keyframes shimmer - overlay {
    0 % { transform: translateX(-150 %) skewX(- 20deg);
}
100 % { transform: translateX(150 %) skewX(- 20deg); }
                }
`}</style>

            {/* Animation Container */}
            <div className="relative h-5 flex items-center gap-[3px] overflow-hidden">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className="w-1 bg-[#FBC717] rounded-full"
                        style={{
                            height: '100%',
                            animation: `wave 1s ease -in -out infinite`,
                            animationDelay: `${i * 0.15} s`
                        }}
                    />
                ))}

                {/* Liquid Glass Overlay */}
                <div className="absolute inset-0 z-10 w-full h-full pointer-events-none opacity-60">
                    <div
                        className="h-full w-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                        style={{ animation: 'shimmer-overlay 2s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                    />
                </div>
            </div>

            {/* Rotating Text */}
            <span
                className={cn(
                    "text-[#FBC717] font-['Roboto'] font-normal text-xs tracking-wide transition-opacity duration-500",
                    fade ? "opacity-100" : "opacity-0"
                )}
            >
                {word}...
            </span>
        </div>
    );
};

// Feed Section (Updated Styling)
const FeedSection: React.FC<{ title: string; items: FeedItem[]; onClear?: () => void }> = ({ title, items, onClear }) => (
    <div className="relative mb-4 h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-[#050500] border-b border-[#FFC038]/20 px-4 py-2 flex items-center gap-2 shadow-sm shrink-0">
            <Clock className="w-3 h-3 text-[#FFC038]" />
            <span className="text-[10px] font-bold tracking-widest text-[#FFC038] uppercase font-['Roboto']">{title}</span>
            {onClear && (
                <button onClick={onClear} className="ml-auto text-[10px] text-[#FFC038]/50 hover:text-[#FFC038] uppercase tracking-wider flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Clear
                </button>
            )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {items.map((item) => (
                <div key={item.id} className="p-2 border-l-2 border-[#FFC038]/30 hover:border-[#FFC038] bg-[#FFC038]/5 hover:bg-[#FFC038]/10 transition-all group font-mono">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-[10px] text-[#FFC038]/50">{item.time}</span>
                        {item.symbol && <span className="text-[10px] font-bold text-[#FFC038] tracking-wider">{item.symbol}</span>}
                    </div>
                    <p className="text-[11px] leading-tight text-[#FFC038]/90 group-hover:text-[#FFC038]">
                        {item.source && <span className="text-[#FFC038]/60 mr-1 uppercase text-[9px]">[{item.source}]</span>}
                        {item.text}
                    </p>
                    {item.iv && (
                        <div className="mt-1.5 flex items-center gap-2 text-[9px] font-mono tracking-wide border-t border-[#FFC038]/10 pt-1">
                            <span className="text-[#FFC038] font-bold">IV:</span>
                            <span className="text-[#FFC038] opacity-70">{item.iv.type}</span>
                            {Math.abs(item.iv.value) >= 30 ? (
                                <span className={cn("font-bold", item.iv.value >= 0 ? "text-emerald-500" : "text-red-500")}>
                                    [{item.iv.value >= 0 ? '▲' : '▼'} {item.iv.value > 0 ? '+' : ''}{item.iv.value.toFixed(1)}pts]
                                </span>
                            ) : (
                                <span className="text-[#FFC038]/50 font-bold">[-]</span>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
);

// News Feed Component
// News Feed Component
const NewsFeed = ({ items, onClear, onRefresh }: { items: FeedItem[], onClear: () => void, onRefresh?: () => void }) => {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if ("Notification" in window) {
            setNotificationsEnabled(Notification.permission === 'granted');
        }
    }, []);

    const requestNotifications = async () => {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notifications");
            return;
        }
        const permission = await Notification.requestPermission();
        setNotificationsEnabled(permission === 'granted');
    };

    const handleRefresh = async () => {
        if (!onRefresh) return;
        setRefreshing(true);
        await onRefresh();
        setTimeout(() => setRefreshing(false), 500); // Keep button spinning for at least 500ms
    };

    return (
        <div className="h-full flex flex-col relative bg-[#0a0a00]">
            <div className="p-4 border-b border-[#FFC038]/20 flex items-center justify-between bg-[#050500]">
                <div className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-[#FFC038]" />
                    <span className="text-xs font-bold text-[#FFC038] uppercase font-['Roboto'] tracking-widest">Live Wire</span>
                </div>
                <div className="flex items-center gap-2">
                    <IVIndicator change={1.4} />
                    {onRefresh && (
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-1.5 rounded transition-all text-[#FFC038]/50 hover:text-[#FFC038] disabled:opacity-50"
                            title="Refresh feed"
                        >
                            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                        </button>
                    )}
                    <button
                        onClick={requestNotifications}
                        className={cn("p-1.5 rounded transition-all", notificationsEnabled ? "text-emerald-500 bg-emerald-500/10" : "text-[#FFC038]/50 hover:text-[#FFC038]")}
                    >
                        {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-0">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 text-[#FFC038]">
                        <Newspaper className="w-12 h-12 mb-2" />
                        <span className="text-xs font-mono">Waiting for wire data...</span>
                    </div>
                ) : (
                    <FeedSection title="LIVE WIRE" items={items} onClear={onClear} />
                )}
            </div>
        </div>
    );
};

// Sidebar Thread List  
const ThreadHistory = () => {
    const { threads, activeThreadId, setActiveThread, createThread, updateThread } = useThreads();
    const { user } = useAuth();

    const locked = user.tier === 'free';

    const handleGenerateRecap = () => {
        const today = new Date().toLocaleDateString();
        const recapText = `[DAILY SESSION RECAP]
DATE: ${today}

PERFORMANCE:
• Gross P & L: +$${(Math.random() * 1000 + 200).toFixed(2)}
• Win Rate: ${Math.floor(Math.random() * 30 + 50)}%
• Trades: ${Math.floor(Math.random() * 8 + 3)}

PSYCHOLOGY:
• Tilt Events: ${Math.floor(Math.random() * 3)}
• Average ER Score: ${(Math.random() * 4 + 5).toFixed(1)}
• Flow State Duration: ${Math.floor(Math.random() * 45 + 15)} m

NOTES:
Session marked by strong adherence to the plan during the morning drive.Some slippage in discipline observed near the close.Recommendation: Review tomorrow's key levels tonight.`;

        const id = createThread(recapText, 'model');
        updateThread(id, { title: `Daily Recap - ${today}` });
    };

    // Group threads by date
    const groupedThreads = threads.reduce((acc, thread) => {
        const date = new Date(thread.timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let key = "Older";
        if (date.toDateString() === today.toDateString()) key = "Today";
        else if (date.toDateString() === yesterday.toDateString()) key = "Yesterday";
        else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) key = "Previous 7 Days";

        if (!acc[key]) acc[key] = [];
        acc[key].push(thread);
        return acc;
    }, {} as Record<string, Thread[]>);

    const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Older"];

    return (
        <LockedCard locked={locked} mode="blur" className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-[#FFC038]/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-[#FFC038] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,192,56,0.3)]">
                        <Zap className="w-5 h-5 text-black" />
                    </div>
                    {/* Assuming isCollapsed is defined elsewhere or needs to be added to props/state */}
                    {/* {!isCollapsed && ( */}
                    <div>
                        <h1 className="font-bold text-lg text-[#FFC038] tracking-wider font-['Roboto'] truncate">PULSE</h1>
                        <div className="text-[9px] text-[#FFC038]/50 tracking-[0.2em] uppercase truncate">Terminal v3.0</div>
                    </div>
                    {/* )} */}
                </div>
                <div className="flex items-center gap-1">
                    {/* Assuming setShowKnowledgeBase and setIsCollapsed are defined elsewhere or need to be added to props/state */}
                    {/* <button
                        onClick={() => setShowKnowledgeBase(true)}
                        className="p-1.5 rounded hover:bg-[#FFC038]/10 text-[#FFC038]/50 hover:text-[#FFC038] transition-colors"
                        title="Trading Playbook"
                    >
                        <Notebook className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1.5 rounded hover:bg-[#FFC038]/10 text-[#FFC038]/50 hover:text-[#FFC038] transition-colors"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button> */}
                </div>
            </div>

            <div className="p-4 border-b border-[#FFC038]/20 flex justify-between items-center bg-[#050500] z-30 relative h-14 shrink-0">
                {/* {!isCollapsed && ( */}
                <div className="flex items-center gap-2 text-[#FFC038] animate-in fade-in overflow-hidden whitespace-nowrap">
                    <Layers className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold uppercase font-['Roboto']">Chat History</span>
                </div>
                {/* )} */}
                <button onClick={() => createThread()} className="text-[#FFC038]/50 hover:text-[#FFC038]">
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="p-2 border-b border-[#FFC038]/10">
                <Button onClick={handleGenerateRecap} variant="secondary" className="w-full text-[10px] py-1.5 h-auto">
                    <RefreshCw className="w-3 h-3 mr-1" /> Run Daily Recap
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#FFC038]/20 p-2 space-y-4">
                {threads.length === 0 && <div className="text-[10px] text-[#FFC038]/30 italic p-2 text-center">No history recorded.</div>}

                {groupOrder.map(group => {
                    const groupThreads = groupedThreads[group];
                    if (!groupThreads || groupThreads.length === 0) return null;

                    return (
                        <div key={group} className="space-y-1">
                            <div className="text-[10px] text-[#FFC038]/40 uppercase tracking-wider font-bold px-2 py-1 sticky top-0 bg-[#050500]/80 backdrop-blur-sm z-10">
                                {group}
                            </div>
                            {groupThreads.map(t => {
                                const dateStr = new Date(t.timestamp).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                                const pnl = t.pnl || 'positive';
                                const resonance = t.resonance || 'stable';

                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => setActiveThread(t.id)}
                                        className={cn(
                                            "w-full text-left p-3 rounded border transition-all group relative",
                                            activeThreadId === t.id
                                                ? "bg-[#FFC038]/10 border-[#FFC038] shadow-[0_0_10px_rgba(255,192,56,0.1)]"
                                                : "bg-black border-transparent hover:border-[#FFC038]/30 hover:bg-[#FFC038]/5"
                                        )}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={cn("text-xs font-mono font-medium truncate max-w-[70%]", activeThreadId === t.id ? "text-[#FFC038]" : "text-[#FFC038]/70")}>
                                                {t.title}
                                            </span>
                                            {t.duration && (
                                                <span className="text-[9px] font-mono text-black font-bold bg-[#FFC038] px-1.5 rounded-full shadow-[0_0_5px_rgba(255,192,56,0.5)] flex items-center gap-1">
                                                    <Timer className="w-2 h-2" />
                                                    {t.duration}
                                                </span>
                                            )}
                                        </div>

                                        {/* Metadata Row: P&L Arrow | Date | Resonance Dot */}
                                        <div className="flex items-center gap-2 text-[9px] font-mono mt-1 opacity-70 group-hover:opacity-100">
                                            <span className={pnl === 'negative' ? 'text-red-500' : 'text-emerald-500'}>
                                                {pnl === 'negative' ? '▼' : '▲'}
                                            </span>
                                            <span className="text-[#FFC038]/40">{dateStr}</span>
                                            <span className={resonance === 'tilt' ? 'text-red-500' : 'text-emerald-500'}>●</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </LockedCard>
    );
};

// Attachment Pane
const AttachmentPane = ({ isOpen, onSelect }: { isOpen: boolean; onSelect: (type: string) => void }) => {
    if (!isOpen) return null;
    const options = [
        { icon: <ImageIcon className="w-4 h-4" />, label: "Upload Picture", id: 'image' },
        { icon: <Video className="w-4 h-4" />, label: "Upload Video", id: 'video' },
        { icon: <FileText className="w-4 h-4" />, label: "Upload Document", id: 'doc' },
        { icon: <LinkIcon className="w-4 h-4" />, label: "Paste Link to News", id: 'link' },
    ];

    return (
        <div className="absolute bottom-full left-0 mb-3 z-50 min-w-[200px] overflow-hidden rounded-xl border border-[#FFC038]/20 bg-[#0a0a00]/80 backdrop-blur-xl shadow-[0_0_30px_rgba(255,192,56,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="p-1 space-y-1">
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onSelect(opt.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-mono text-[#FFC038]/80 hover:text-[#FFC038] hover:bg-[#FFC038]/10 rounded-lg transition-colors text-left"
                    >
                        {opt.icon}
                        <span>{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// Chat Interface
const ChatInterface = ({
    feedItems,
    erScore,
    erState,
    tiltCount
}: {
    feedItems: FeedItem[],
    erScore: number,
    erState: EmotionalState,
    tiltCount: number
}) => {
    const { user } = useAuth();
    const { settings } = useSettings();
    const { activeThread, addMessage, createThread } = useThreads();
    const [input, setInput] = useState("");
    const [thinking, setThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showAttachments, setShowAttachments] = useState(false);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeThread?.messages, thinking]);

    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    };

    const handleSendAgent = async () => {
        if (!input.trim()) return;
        let threadId = activeThread?.id;
        if (!threadId) threadId = createThread(input || "New Session");

        const userMsg: Message = { role: 'user', text: input, timestamp: Date.now() };
        addMessage(threadId!, userMsg);

        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setThinking(true);

        const agentContext: AgentContext = {
            erScore,
            erState,
            tiltCount,
            feedItems,
            userTier: user.tier,
            userName: user.name,
            activeThreadId: threadId!,
            instrumentDetails: INSTRUMENT_RULES[settings.selectedInstrument] ? {
                symbol: settings.selectedInstrument,
                name: INSTRUMENT_RULES[settings.selectedInstrument].name,
                tickSize: INSTRUMENT_RULES[settings.selectedInstrument].tickSize,
                pointValue: INSTRUMENT_RULES[settings.selectedInstrument].pointValue,
                ivRange: INSTRUMENT_RULES[settings.selectedInstrument].ivRange
            } : undefined
        };

        const agentSettings = {
            customInstructions: settings.customInstructions,
            drillSergeantMode: settings.alerts.voiceStyle === 'drill',
            claudeApiKey: settings.claudeApiKey
        };

        try {
            const history = activeThread ? activeThread.messages : [];
            const responseText = await generateAgentResponse(userMsg.text, history, agentContext, agentSettings);

            addMessage(threadId!, { role: 'model', text: responseText, timestamp: Date.now() });
        } catch (e) {
            addMessage(threadId!, { role: 'model', text: "Signal lost. Uplink failed.", timestamp: Date.now() });
        } finally {
            setThinking(false);
        }
    };

    const handleAttachmentSelect = (type: string) => {
        console.log("Selected attachment:", type);
        setShowAttachments(false);
    };

    const locked = user.tier === 'free' || user.tier === 'pulse';

    if (locked) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#0a0a00]">
                <div className="max-w-md border border-[#FFC038]/20 bg-[#140a00] p-8 rounded-xl">
                    <GeminiIcon className="w-16 h-16 text-[#FFC038] mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-[#FFC038] font-['Roboto'] mb-2">AI PRICE LOCKED</h2>
                    <p className="text-white/50 text-sm mb-6">Advanced market analysis agent requires Pulse+ clearance.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0a0a00] relative">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {!activeThread ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#FFC038]/30">
                        <Notebook className="w-16 h-16 mb-4 opacity-50" />
                        <p className="font-mono text-sm">Uplink Ready. Initialize Chat.</p>
                    </div>
                ) : (
                    activeThread.messages.map((msg, i) => (
                        <div key={i} className={cn("flex gap-3 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                            <div className={cn(
                                "p-3 rounded-2xl text-sm whitespace-pre-wrap shadow-sm font-['Roboto'] font-normal",
                                msg.role === 'user' ? "bg-[#FFC038] text-black rounded-tr-none" : "bg-zinc-900 border border-[#FFC038]/20 text-zinc-300 rounded-tl-none"
                            )}>
                                {msg.text}
                            </div>
                        </div>
                    ))
                )}
                {thinking && (
                    <div className="animate-in fade-in pl-2">
                        <ThinkingIndicator />
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            <div className="p-4 bg-black/80 backdrop-blur border-t border-[#FFC038]/20 relative">
                <AttachmentPane isOpen={showAttachments} onSelect={handleAttachmentSelect} />

                <div className={cn(
                    "flex gap-2 items-end bg-zinc-900 border rounded-xl px-4 py-2 transition-all duration-300 border-[#FFC038]/30"
                )}>
                    <button
                        onClick={() => setShowAttachments(!showAttachments)}
                        className={cn("mb-2 transition-colors", showAttachments ? "text-[#FFC038]" : "text-[#FFC038]/50 hover:text-[#FFC038]")}
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>

                    <div className="flex-1 min-h-[40px] flex items-center relative">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            className="w-full bg-transparent border-none outline-none text-white text-sm font-['Roboto'] font-normal placeholder-zinc-600 resize-none overflow-hidden py-2 max-h-[120px]"
                            placeholder="Message Price..."
                            value={input}
                            onChange={e => { setInput(e.target.value); adjustHeight(); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendAgent();
                                }
                            }}
                            disabled={thinking}
                        />
                    </div>

                    <button
                        onClick={handleSendAgent}
                        disabled={thinking || !input.trim()}
                        className={cn(
                            "mb-2 transition-all duration-200",
                            input.trim() && !thinking ? "text-[#FFC038] hover:scale-110" : "text-[#FFC038]/30 cursor-not-allowed"
                        )}
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Stop Monitoring Warning Modal
const StopMonitoringModal = ({ isOpen, onContinue, onStop }: { isOpen: boolean; onContinue: () => void; onStop: () => void }) => {
    return (
        <Modal isOpen={isOpen} onClose={onContinue} className="max-w-md bg-[#050500] border border-[#FFC038]/30 backdrop-blur-sm" hideClose={true}>
            <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#FFC038]/10 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(255,192,56,0.2)] animate-pulse">
                    <Activity className="w-8 h-8 text-[#FFC038]" />
                </div>

                <h2 className="text-xl font-bold text-[#FFC038] font-['Roboto'] mb-4 uppercase tracking-wider">End PsychAssist Session?</h2>

                <p className="text-white/70 text-sm mb-8 leading-relaxed font-mono">
                    Your Emotional Resonance session timer will stop, and the data for this session may be incomplete or inaccurate if PsychAssist is disabled prematurely.
                    <br /><br />
                    Are you sure you want to stop monitoring?
                </p>

                <div className="flex gap-4 w-full">
                    <Button onClick={onContinue} variant="primary" className="flex-1 py-3 font-bold">
                        CONTINUE MONITORING
                    </Button>
                    <Button onClick={onStop} variant="secondary" className="flex-1 py-3 font-bold border-[#FFC038] text-[#FFC038]">
                        STOP ANYWAY
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Trading Models Config
const TRADING_MODELS_CONFIG = [
    { key: 'fortyFortyClub' as const, name: '40/40 Club', time: '9:45-10:15 AM ET' },
    { key: 'chargedUpRippers' as const, name: 'Charged Up Rippers', time: '9:30-9:45 AM ET' },
    { key: 'morningFlush' as const, name: 'Morning Flush', time: '9:30-10:00 AM ET' },
    { key: 'lunchPowerHourFlush' as const, name: 'Lunch/Power Hour Flush', time: '12:00-1:00, 3:00-4:00 PM ET' },
    { key: 'twentyTwoVixFix' as const, name: '22 VIX Fix', time: '10:00 AM-3:00 PM ET' }
];

// Control Panel (Mission Control)
const MissionControl = ({ onPsychStateUpdate, onTilt, psychState }: { onPsychStateUpdate: (score: number, state: EmotionalState, tiltCount: number) => void, onTilt: (tiltCount: number) => void, psychState: { score: number, state: EmotionalState } }) => {
    const { user, updateTier } = useAuth();
    const { settings, updateSettings } = useSettings();
    const { activeThreadId, updateThread } = useThreads();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [psychAssistActive, setPsychAssistActive] = useState(false);

    // New State for Warning Modal
    const [showStopWarning, setShowStopWarning] = useState(false);
    const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);

    // Session Timer State
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const handlePsychClick = () => {
        if (psychAssistActive) {
            // Trigger warning instead of stopping immediately
            setShowStopWarning(true);
        } else {
            // Start logic
            setPsychAssistActive(true);
            setSessionSeconds(0);
            timerRef.current = setInterval(() => {
                setSessionSeconds(s => s + 1);
            }, 1000);
        }
    };

    const confirmStopMonitoring = () => {
        setPsychAssistActive(false);
        setShowStopWarning(false);
        if (timerRef.current) clearInterval(timerRef.current);

        // Save duration to thread
        if (activeThreadId && sessionSeconds > 0) {
            updateThread(activeThreadId, { duration: formatTime(sessionSeconds) });
        }
        setSessionSeconds(0);
    };

    const cancelStopMonitoring = () => {
        setShowStopWarning(false);
    };

    useEffect(() => {
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    // ProjectX Integration State
    const [accounts, setAccounts] = useState<ProjectXAccount[]>([]);
    const [positions, setPositions] = useState<ProjectXPosition[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [token, setToken] = useState<string | null>(null);

    // Connect to ProjectX
    useEffect(() => {
        const connect = async () => {
            if (settings.topstepAccountConnected && settings.topstepXUserName && settings.topstepXApiKey) {
                try {
                    setConnectionStatus('connecting');
                    // 1. Login
                    const auth = await ProjectXService.login(settings.topstepXUserName, settings.topstepXApiKey);
                    if (auth.success && auth.token) {
                        setToken(auth.token);
                        // 2. Fetch Accounts
                        const accs = await ProjectXService.searchAccounts(auth.token);
                        setAccounts(accs);
                        setConnectionStatus('connected');
                    } else {
                        console.error("ProjectX Auth Failed", auth);
                        setConnectionStatus('error');
                    }
                } catch (e) {
                    console.error("ProjectX Connection Error", e);
                    setConnectionStatus('error');
                }
            } else {
                setConnectionStatus('disconnected');
                setAccounts([]);
            }
        };
        connect();
    }, [settings.topstepAccountConnected, settings.topstepXUserName, settings.topstepXApiKey]);

    // SignalR & PnL Tracking
    useEffect(() => {
        let mounted = true;

        const initSignalR = async () => {
            if (connectionStatus === 'connected' && token && settings.selectedAccount) {
                const accountId = Number(settings.selectedAccount);
                if (isNaN(accountId)) return;

                try {
                    // Fetch initial daily PnL (sum of today's trades)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const trades = await ProjectXService.searchTrades(token, accountId, today.toISOString());
                    const initialPnL = trades.reduce((sum, t) => sum + (t.profitAndLoss || 0), 0);

                    if (mounted) {
                        updateSettings({ currentPNL: initialPnL });
                    }

                    // Connect SignalR
                    await ProjectXService.connectSignalR(
                        token,
                        accountId,
                        (accData) => {
                            // Account update
                            console.log("Account Update:", accData);
                        },
                        (tradeData) => {
                            // Trade update - update PnL
                            console.log("Trade Update:", tradeData);
                            if (tradeData.profitAndLoss !== undefined && tradeData.profitAndLoss !== null) {
                                // Add this trade's PnL to current
                                // Note: This is a simplification. Ideally we track all trades.
                                updateSettings({ currentPNL: settings.currentPNL + tradeData.profitAndLoss });
                            }
                        },
                        (posData: ProjectXPosition) => {
                            console.log("Position Update:", posData);
                            setPositions(prev => {
                                const exists = prev.find(p => p.contractId === posData.contractId);
                                if (posData.quantity === 0) {
                                    return prev.filter(p => p.contractId !== posData.contractId);
                                }
                                if (exists) {
                                    return prev.map(p => p.contractId === posData.contractId ? posData : p);
                                }
                                return [...prev, posData];
                            });
                        }
                    );
                } catch (e) {
                    console.error("SignalR Error", e);
                }
            }
        };

        initSignalR();

        return () => {
            mounted = false;
            if (settings.selectedAccount) {
                ProjectXService.disconnectSignalR(Number(settings.selectedAccount));
            }
        };
    }, [connectionStatus, token, settings.selectedAccount]);

    const isGlobalLocked = user.tier === 'free';

    return (
        <div className={cn(
            "h-full flex flex-col bg-black border-r border-[#FFC038]/20 relative transition-all duration-300 ease-in-out",
            isCollapsed ? "w-14" : "w-80"
        )}>
            <StopMonitoringModal isOpen={showStopWarning} onContinue={cancelStopMonitoring} onStop={confirmStopMonitoring} />
            <KnowledgeBaseModal isOpen={showKnowledgeBase} onClose={() => setShowKnowledgeBase(false)} />

            {/* PNL Ticker (Top Right Overlay) */}
            {settings.algoActive && !isCollapsed && (
                <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 bg-[#050500] border border-[#FFC038]/30 rounded-full px-4 py-1.5 shadow-[0_0_20px_rgba(255,192,56,0.15)]">
                        <div className="flex items-center gap-2 border-r border-[#FFC038]/20 pr-3 mr-1">
                            <Activity className="w-3 h-3 text-[#FFC038] animate-pulse" />
                            <span className="text-[10px] font-bold text-[#FFC038] tracking-widest font-['Roboto']">ALGO ACTIVE</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#FFC038]/60 font-mono">PNL:</span>
                            <span className={cn(
                                "text-sm font-bold font-mono min-w-[80px] text-right",
                                settings.currentPNL >= 0 ? "text-[#00FF85]" : "text-[#FF4040]"
                            )}>
                                {settings.currentPNL >= 0 ? '+' : '-'}${Math.abs(settings.currentPNL).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar Header */}
            <div className="p-4 border-b border-[#FFC038]/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-[#FFC038] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,192,56,0.3)]">
                        <Zap className="w-5 h-5 text-black" />
                    </div>
                    {!isCollapsed && (
                        <div>
                            <h1 className="font-bold text-lg text-[#FFC038] tracking-wider font-['Roboto'] truncate">PULSE</h1>
                            <div className="text-[9px] text-[#FFC038]/50 tracking-[0.2em] uppercase truncate">Terminal v3.0</div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowKnowledgeBase(true)}
                        className="p-1.5 rounded hover:bg-[#FFC038]/10 text-[#FFC038]/50 hover:text-[#FFC038] transition-colors"
                        title="Trading Playbook"
                    >
                        <Notebook className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1.5 rounded hover:bg-[#FFC038]/10 text-[#FFC038]/50 hover:text-[#FFC038] transition-colors"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>
            </div>



            {isCollapsed ? (
                <div className="flex-1 flex flex-col items-center py-6 gap-8 animate-in fade-in duration-300">
                    {/* Vertical ER Gauge */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-3 h-32 bg-[#140a00] rounded-full border border-[#FFC038]/20 relative overflow-hidden">
                            {/* Neutral Line */}
                            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gray-500 z-10" />

                            {/* Fill */}
                            <div
                                className={cn(
                                    "absolute left-0 right-0 transition-all duration-500 ease-out",
                                    psychState.score >= 5 ? "bottom-1/2 bg-[#00FF85]" : "top-1/2 bg-red-500"
                                )}
                                style={{
                                    height: `${Math.min(Math.abs(psychState.score - 5) * 10, 50)}%`,
                                    top: psychState.score < 5 ? '50%' : 'auto',
                                    bottom: psychState.score >= 5 ? '50%' : 'auto'
                                }}
                            />
                        </div>
                        <span className={cn(
                            "text-[9px] font-bold font-mono",
                            psychState.score >= 5 ? "text-[#00FF85]" : "text-red-500"
                        )}>
                            {psychState.score.toFixed(1)}
                        </span>
                    </div>

                    {/* Algo Status */}
                    <div className="flex flex-col items-center gap-1">
                        <div className="relative">
                            <Zap className={cn("w-5 h-5", settings.algoActive ? "text-[#FFC038]" : "text-[#FFC038]/30")} />
                            <div className={cn(
                                "absolute -top-1 -right-1 w-2 h-2 rounded-full border border-black",
                                settings.algoActive ? "bg-[#00FF85] animate-pulse" : "bg-red-500"
                            )} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-0">

                    {/* 1. Account Tracker (New) */}
                    <div className="bg-[#140a00] border border-[#FFC038]/20 rounded-lg overflow-hidden transition-all">
                        <div
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#FFC038]/5"
                            onClick={() => updateSettings({ accountTrackerExpanded: !settings.accountTrackerExpanded })}
                        >
                            <div className="flex items-center gap-2 text-[#FFC038]">
                                <Wallet className="w-4 h-4" />
                                <span className="text-xs font-bold">Account Tracker</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", settings.topstepAccountConnected ? "bg-[#00FF85]/10 text-[#00FF85]" : "bg-red-900/20 text-red-500")}>
                                    {settings.topstepAccountConnected ? 'CONNECTED' : 'OFFLINE'}
                                </span>
                                {settings.accountTrackerExpanded ? <ChevronUp className="w-3 h-3 text-[#FFC038]/50" /> : <ChevronDown className="w-3 h-3 text-[#FFC038]/50" />}
                            </div>
                        </div>

                        {settings.accountTrackerExpanded && (
                            <div className="p-3 border-t border-[#FFC038]/10 bg-[#0a0a00] animate-in slide-in-from-top-2">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-[#FFC038]/70">TopStepX Connection</span>
                                        <Toggle
                                            checked={settings.topstepAccountConnected}
                                            onChange={() => updateSettings({ topstepAccountConnected: !settings.topstepAccountConnected })}
                                        />
                                    </div>
                                    {settings.topstepAccountConnected && (
                                        <div className="space-y-3">
                                            {/* Account Selector */}
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] text-[#FFC038]/50 uppercase">Select Account</label>
                                                <div className="relative">
                                                    <select
                                                        value={settings.selectedAccount}
                                                        onChange={(e) => updateSettings({ selectedAccount: e.target.value })}
                                                        className="w-full bg-black border border-[#FFC038]/20 rounded px-2 py-1.5 text-xs text-[#FFC038] focus:border-[#FFC038] outline-none font-mono appearance-none"
                                                    >
                                                        <option value="">-- Select Account --</option>
                                                        {accounts.map(acc => (
                                                            <option key={acc.id} value={acc.id}>
                                                                {acc.name} ({acc.id}) - ${acc.balance.toLocaleString()}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#FFC038]/50 pointer-events-none" />
                                                </div>
                                                {connectionStatus === 'error' && <span className="text-[9px] text-red-500">Connection Failed</span>}
                                                {connectionStatus === 'connecting' && <span className="text-[9px] text-[#FFC038]">Connecting...</span>}
                                            </div>

                                            {/* Bi-directional PNL Bar */}
                                            <div className="p-2 bg-[#FFC038]/5 rounded border border-[#FFC038]/10">
                                                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                                                    <span className="text-red-500">-${settings.dailyLossLimit}</span>
                                                    <span className="text-[#FFC038]/50">0</span>
                                                    <span className="text-[#00FF85]">+${settings.dailyProfitTarget}</span>
                                                </div>

                                                <div className="relative w-full h-2 bg-[#1a1500] rounded-full overflow-hidden border border-[#FFC038]/10">
                                                    {/* Center Marker */}
                                                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#FFC038]/30 z-10"></div>

                                                    {/* Profit Bar (Right) */}
                                                    {settings.currentPNL > 0 && (
                                                        <div
                                                            className="absolute left-1/2 top-0 bottom-0 bg-[#00FF85] shadow-[0_0_10px_rgba(0,255,133,0.5)] transition-all duration-500"
                                                            style={{ width: `${Math.min((settings.currentPNL / settings.dailyProfitTarget) * 50, 50)}%` }}
                                                        ></div>
                                                    )}

                                                    {/* Loss Bar (Left) */}
                                                    {settings.currentPNL < 0 && (
                                                        <div
                                                            className="absolute right-1/2 top-0 bottom-0 bg-red-500 shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-all duration-500"
                                                            style={{ width: `${Math.min((Math.abs(settings.currentPNL) / settings.dailyLossLimit) * 50, 50)}%` }}
                                                        ></div>
                                                    )}
                                                </div>

                                                {/* Current Positions Window */}
                                                <div className="mt-3 border border-[#FFC038]/20 rounded-lg overflow-hidden bg-[#0a0a00]">
                                                    <div className="bg-[#FFC038]/10 px-2 py-1.5 flex justify-between items-center border-b border-[#FFC038]/10">
                                                        <span className="text-[10px] font-bold text-[#FFC038] uppercase tracking-wider">Current Positions</span>
                                                        <span className="text-[9px] text-[#FFC038]/50 font-mono">{positions.length} Active</span>
                                                    </div>

                                                    {positions.length === 0 ? (
                                                        <div className="p-4 text-center">
                                                            <span className="text-[10px] text-[#FFC038]/30 italic">No open positions</span>
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-[#FFC038]/10">
                                                            {positions.map((pos) => (
                                                                <div key={pos.contractId} className="p-2 flex items-center justify-between hover:bg-[#FFC038]/5 transition-colors">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={cn(
                                                                                "text-[9px] font-bold px-1 rounded-sm",
                                                                                pos.side === 'Long' ? "bg-[#00FF85]/20 text-[#00FF85]" : "bg-red-900/20 text-red-500"
                                                                            )}>
                                                                                {pos.side.toUpperCase()}
                                                                            </span>
                                                                            <span className="text-xs font-bold text-[#FFC038]">{pos.symbol}</span>
                                                                        </div>
                                                                        <div className="flex gap-2 mt-0.5">
                                                                            <span className="text-[9px] text-[#FFC038]/50">{pos.quantity} @ {pos.averagePrice.toFixed(2)}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-col items-end">
                                                                        <span className={cn(
                                                                            "text-xs font-bold font-mono",
                                                                            pos.profitAndLoss >= 0 ? "text-[#00FF85]" : "text-red-500"
                                                                        )}>
                                                                            {pos.profitAndLoss >= 0 ? '+' : ''}{pos.profitAndLoss.toFixed(2)}
                                                                        </span>
                                                                        <span className="text-[9px] text-[#FFC038]/40">UPL</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex justify-between items-center mt-1.5">
                                                    <span className="text-[9px] text-[#FFC038]/60 uppercase">Session P&L</span>
                                                    <span className={cn(
                                                        "text-xs font-bold font-mono",
                                                        settings.currentPNL >= 0 ? "text-[#00FF85]" : "text-red-500"
                                                    )}>
                                                        {settings.currentPNL >= 0 ? '+' : '-'}${Math.abs(settings.currentPNL).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Algo Status Toggle (Standalone) */}
                    <div className="bg-[#140a00] border border-[#FFC038]/20 rounded-lg p-3 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[#FFC038]">
                            <Brain className="w-4 h-4" />
                            <span className="text-xs font-bold">Algo Status</span>
                        </div>
                        <Toggle
                            checked={settings.algoActive}
                            onChange={() => updateSettings({ algoActive: !settings.algoActive })}
                        />
                    </div>

                    {/* 2.5. Fire Test Trade Button (Shown when enabled in Dev Mode) */}
                    {settings.showFireTestTrade && settings.topstepAccountConnected && settings.selectedAccount && (
                        <div className="bg-[#140a00] border border-[#FF4040]/30 rounded-lg overflow-hidden">
                            <div className="p-3 flex justify-between items-center bg-[#FF4040]/5">
                                <div className="flex items-center gap-2 text-[#FF4040]">
                                    <Flame className="w-4 h-4" />
                                    <span className="text-xs font-bold">Fire Test Trade</span>
                                </div>
                                <Button
                                    onClick={async () => {
                                        if (!token) {
                                            alert('Not authenticated');
                                            return;
                                        }

                                        try {
                                            // Fetch available contracts
                                            const contracts = await ProjectXService.getAvailableContracts(token, true);

                                            // Find NQ contract (E-mini NASDAQ-100)
                                            const nqContract = contracts.find(c => c.symbolId === 'F.US.ENQ' && c.activeContract);

                                            if (!nqContract) {
                                                alert('NQ contract not found');
                                                return;
                                            }

                                            // Confirm
                                            const confirmed = window.confirm(
                                                `🔥 FIRE TEST TRADE\n\n` +
                                                `Contract: ${nqContract.name} (${nqContract.description})\n` +
                                                `Side: BUY\n` +
                                                `Quantity: 1\n` +
                                                `Account: ${settings.selectedAccount}\n\n` +
                                                `This will place a REAL MARKET ORDER. Continue?`
                                            );

                                            if (!confirmed) return;

                                            // Place order
                                            const result = await ProjectXService.placeMarketOrder(
                                                token,
                                                Number(settings.selectedAccount),
                                                nqContract.id,
                                                'buy',
                                                1
                                            );

                                            alert(`✅ Order placed successfully!\n\nOrder ID: ${result.orderId}`);
                                        } catch (error: any) {
                                            alert(`❌ Order failed:\n\n${error.message}`);
                                            console.error('Fire Test Trade Error:', error);
                                        }
                                    }}
                                    variant="danger"
                                    className="text-[10px] px-4 py-1 h-auto bg-[#FF4040] hover:bg-[#FF6060] text-white border-none"
                                >
                                    🔥 FIRE
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 3. PsychAssist */}
                    <div
                        onClick={() => { if (isGlobalLocked) return; }}
                        className={cn(
                            "group relative overflow-hidden rounded-lg bg-[#140a00] border p-3 transition-all",
                            psychAssistActive ? "border-[#FFC038] shadow-[0_0_10px_rgba(255,192,56,0.1)]" : "border-[#FFC038]/20 hover:border-[#FFC038]/50"
                        )}
                    >
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex gap-2 items-center text-[#FFC038]">
                                <Activity className="w-4 h-4" />
                                <span className="text-xs font-bold">PsychAssist</span>
                            </div>
                            <div className="text-[10px] text-[#FFC038]/50">{psychAssistActive ? 'ACTIVE' : 'IDLE'}</div>
                        </div>

                        {!psychAssistActive ? (
                            <div className="w-full">
                                <Button onClick={handlePsychClick} variant="primary" className="w-full py-3 text-xs tracking-widest uppercase font-bold text-black border-none shadow-none bg-[#FFC038] hover:bg-[#FFD060]">
                                    INITIALIZE
                                </Button>
                            </div>
                        ) : (
                            <div onClick={e => e.stopPropagation()}>
                                <EmotionalResonanceMonitor
                                    active={psychAssistActive}
                                    sessionTime={formatTime(sessionSeconds)}
                                    onStateUpdate={onPsychStateUpdate}
                                />
                                <div className="mt-3">
                                    <Button onClick={handlePsychClick} variant="secondary" className="w-full text-[10px] py-1">STOP MONITORING</Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Blindspots */}
                    <LockedCard locked={user.tier === 'pulse' || user.tier === 'free'} mode="cta" title="Blindspots" onUpgrade={() => updateTier('pulse_plus')} className="bg-[#140a00] border border-[#FFC038]/20 p-3">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex gap-2 items-center text-[#FFC038]">
                                <Eye className="w-4 h-4" />
                                <span className="text-xs font-bold">Blindspots</span>
                            </div>
                        </div>
                        <div className="space-y-3 mt-2">
                            {['Impulse Entry', 'Revenge Trading', 'Overleveraging'].map((b, i) => (
                                <div key={i} className="text-[10px] text-[#FFC038] font-bold uppercase tracking-wider pl-1 font-['Roboto'] flex items-center gap-2">
                                    <span className="w-1 h-1 bg-[#FFC038] rounded-full"></span>
                                    {b}
                                </div>
                            ))}
                        </div>
                    </LockedCard>

                    {/* 5. Trading Models (Expandable) */}
                    <LockedCard locked={user.tier === 'pulse' || user.tier === 'free'} mode="cta" title="Trading Models" onUpgrade={() => updateTier('pulse_plus')} className="bg-[#140a00] border border-[#FFC038]/20 overflow-hidden">
                        <div
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#FFC038]/5"
                            onClick={() => updateSettings({ tradingModelsExpanded: !settings.tradingModelsExpanded })}
                        >
                            <div className="flex gap-2 items-center text-[#FFC038]">
                                <Target className="w-4 h-4" />
                                <span className="text-xs font-bold">Trading Models</span>
                            </div>
                            {settings.tradingModelsExpanded ? <ChevronUp className="w-3 h-3 text-[#FFC038]/50" /> : <ChevronDown className="w-3 h-3 text-[#FFC038]/50" />}
                        </div>

                        {settings.tradingModelsExpanded && (
                            <div className="space-y-2 p-3 pt-0 animate-in slide-in-from-top-2 border-t border-[#FFC038]/10 mt-1">
                                {TRADING_MODELS_CONFIG.map(model => (
                                    <div key={model.key} className="bg-[#0a0a00] p-2 rounded border border-[#FFC038]/10 hover:border-[#FFC038]/30 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-[#FFC038] font-medium">{model.name}</span>
                                            <Toggle
                                                checked={!!settings.tradingModels[model.key]}
                                                onChange={() => updateSettings({
                                                    tradingModels: { ...settings.tradingModels, [model.key]: !settings.tradingModels[model.key] }
                                                })}
                                            />
                                        </div>
                                        <div className="text-[9px] text-[#FFC038]/40 font-mono">{model.time}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </LockedCard>

                    {/* 6. Thread History Widget */}
                    <div className="h-64 border border-[#FFC038]/20 rounded-lg overflow-hidden bg-[#140a00]">
                        <ThreadHistory />
                    </div>

                </div>
            )}

            {
                isCollapsed && (
                    <div className="flex-1 flex flex-col items-center py-4 gap-4">
                        <Layers className="w-5 h-5 text-[#FFC038]/50" />
                        <div className="flex-1 w-full flex items-center justify-center">
                            <span className="text-[#FFC038]/50 text-[10px] uppercase font-bold tracking-widest rotate-180 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
                                Mission Control
                            </span>
                        </div>
                    </div>
                )
            }

            {
                !isCollapsed && isGlobalLocked && (
                    <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-1000">
                        <Lock className="w-12 h-12 text-[#FFC038] mb-4" />
                        <h2 className="text-xl font-bold text-[#FFC038] font-['Roboto'] tracking-widest mb-2">MISSION CONTROL LOCKED</h2>
                        <p className="text-[#FFC038]/60 text-xs font-mono mb-6 max-w-[200px]">Advanced telemetry and psychological monitoring require an active uplink.</p>
                        <Button onClick={() => updateTier('pulse')} variant="primary">INITIALIZE PULSE</Button>
                    </div>
                )
            }
        </div >
    );
};

// Settings Modal
const SettingsModal = ({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave?: () => void }) => {
    const { settings, updateSettings } = useSettings();
    const [activeTab, setActiveTab] = useState<'psych' | 'trading' | 'api' | 'dev'>('psych');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const handleSave = () => {
        setSaveStatus('saving');
        if (onSave) onSave();
        setTimeout(() => setSaveStatus('saved'), 500);
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    // Helper to preview tone
    const previewTone = () => {
        playTone(523.25, settings.alerts.toneType, 0.5, 0.2);
    };

    const tabs = [
        { id: 'psych' as const, label: 'PsychAssist', icon: Activity },
        { id: 'trading' as const, label: 'Trading', icon: BarChart3 },
        { id: 'api' as const, label: 'API', icon: LinkIcon },
        { id: 'dev' as const, label: 'Developer', icon: Terminal }
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="w-full max-w-4xl">
            <div className="flex h-[600px]">
                {/* Left Sidebar Navigation */}
                <div className="w-56 bg-[#0a0a00] border-r border-[#FFC038]/20 flex flex-col shrink-0">
                    <div className="p-4 border-b border-[#FFC038]/20">
                        <h2 className="text-base font-bold text-[#FFC038] font-['Roboto'] flex items-center gap-2">
                            <Settings className="w-5 h-5" /> Settings
                        </h2>
                    </div>
                    <nav className="flex-1 p-2">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all mb-1",
                                        activeTab === tab.id
                                            ? "bg-[#FFC038]/10 text-[#FFC038] border border-[#FFC038]/30"
                                            : "text-[#FFC038]/60 hover:bg-[#FFC038]/5 hover:text-[#FFC038]"
                                    )}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-medium">{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* PsychAssist Tab (Interface + Alerts) */}
                        {activeTab === 'psych' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[#FFC038] mb-4">PsychAssist Configuration</h3>

                                    <div className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10 mb-4">
                                        <span className="text-sm text-[#FFC038]">Anti-Anxiety Mode</span>
                                        <Toggle
                                            checked={!settings.showUpgradeCTAText}
                                            onChange={() => updateSettings({ showUpgradeCTAText: !settings.showUpgradeCTAText })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] text-[#FFC038]/70 uppercase font-bold">Max Trades / Interval</label>
                                            <input
                                                type="number"
                                                value={settings.maxTradesPerInterval}
                                                onChange={(e) => updateSettings({ maxTradesPerInterval: Number(e.target.value) })}
                                                className="bg-[#140a00] border border-[#FFC038]/20 rounded px-3 py-2 text-sm text-[#FFC038] focus:border-[#FFC038] outline-none font-mono"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] text-[#FFC038]/70 uppercase font-bold">Interval Duration</label>
                                            <div className="relative">
                                                <select
                                                    value={settings.tradeIntervalMinutes}
                                                    onChange={(e) => updateSettings({ tradeIntervalMinutes: Number(e.target.value) })}
                                                    className="w-full bg-[#140a00] border border-[#FFC038]/20 rounded px-3 py-2 text-sm text-[#FFC038] focus:border-[#FFC038] outline-none font-mono appearance-none"
                                                >
                                                    <option value={5}>5 Minutes</option>
                                                    <option value={10}>10 Minutes</option>
                                                    <option value={15}>15 Minutes</option>
                                                    <option value={30}>30 Minutes</option>
                                                    <option value={60}>60 Minutes</option>
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFC038]/50 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>

                                    <h4 className="text-sm font-bold text-[#FFC038]/70 uppercase mb-3 border-t border-[#FFC038]/20 pt-4">Audio & Alerts</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                        <div className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10">
                                            <span className="text-xs text-[#FFC038]">Emotional Alerts</span>
                                            <Toggle
                                                checked={settings.alerts.enabled}
                                                onChange={() => updateSettings({ alerts: { ...settings.alerts, enabled: !settings.alerts.enabled } })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10">
                                            <span className="text-xs text-[#FFC038]">Voice Alerts</span>
                                            <Toggle
                                                checked={settings.alerts.voiceEnabled}
                                                onChange={() => updateSettings({ alerts: { ...settings.alerts, voiceEnabled: !settings.alerts.voiceEnabled } })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10">
                                            <span className="text-xs text-[#FFC038]">Tilt Escalation</span>
                                            <Toggle
                                                checked={settings.alerts.escalationEnabled}
                                                onChange={() => updateSettings({ alerts: { ...settings.alerts, escalationEnabled: !settings.alerts.escalationEnabled } })}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-3 bg-[#140a00] rounded border border-[#FFC038]/10 mb-4">
                                        <label className="text-xs text-[#FFC038]/70 block mb-2">Voice Alert Style</label>
                                        <div className="flex gap-2">
                                            {['calm', 'motivational', 'drill'].map((style) => (
                                                <button
                                                    key={style}
                                                    onClick={() => updateSettings({ alerts: { ...settings.alerts, voiceStyle: style as any } })}
                                                    className={cn(
                                                        "flex-1 py-2 text-xs border rounded transition-all uppercase font-bold",
                                                        settings.alerts.voiceStyle === style
                                                            ? "bg-[#FFC038] text-black border-[#FFC038]"
                                                            : "bg-black text-[#FFC038]/50 border-[#FFC038]/20 hover:border-[#FFC038]"
                                                    )}
                                                >
                                                    {style === 'drill' ? 'Drill Sergeant' : style}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-[#140a00] rounded border border-[#FFC038]/10 flex items-center justify-between">
                                        <div>
                                            <label className="text-xs text-[#FFC038]/70 block mb-1">Alert Tone</label>
                                            <select
                                                value={settings.alerts.toneType}
                                                onChange={(e) => updateSettings({ alerts: { ...settings.alerts, toneType: e.target.value as any } })}
                                                className="bg-black text-[#FFC038] text-xs border border-[#FFC038]/30 rounded p-1 outline-none"
                                            >
                                                <option value="sine">Sine Wave (Soft)</option>
                                                <option value="triangle">Triangle (Bright)</option>
                                                <option value="square">Square (8-bit)</option>
                                                <option value="sawtooth">Sawtooth (Sharp)</option>
                                            </select>
                                        </div>
                                        <Button onClick={previewTone} variant="secondary" className="text-xs h-8">
                                            <Play className="w-3 h-3" /> Preview
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Trading Tab (Instrument + Risk + Models) */}
                        {activeTab === 'trading' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[#FFC038] mb-4">Trading Configuration</h3>

                                    {/* Instrument Chooser */}
                                    <div className="mb-6">
                                        <label className="text-xs text-[#FFC038]/70 uppercase font-bold block mb-2">Active Instrument</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {Object.entries(INSTRUMENT_RULES).map(([symbol, details]) => (
                                                <button
                                                    key={symbol}
                                                    onClick={() => updateSettings({ selectedInstrument: symbol })}
                                                    className={cn(
                                                        "p-3 rounded border text-left transition-all",
                                                        settings.selectedInstrument === symbol
                                                            ? "bg-[#FFC038] text-black border-[#FFC038]"
                                                            : "bg-[#140a00] text-[#FFC038]/60 border-[#FFC038]/20 hover:border-[#FFC038]/50"
                                                    )}
                                                >
                                                    <div className="font-bold text-sm">{symbol}</div>
                                                    <div className="text-[9px] opacity-70 truncate">{details.name} ({details.contract})</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Risk Settings */}
                                    <div className="mb-6 p-4 bg-[#140a00] rounded border border-[#FFC038]/10">
                                        <h4 className="text-sm font-bold text-[#FFC038] uppercase mb-3 flex items-center gap-2">
                                            <Shield className="w-4 h-4" /> Risk Parameters
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] text-[#FFC038]/70 uppercase font-bold">Contract Size</label>
                                                <input
                                                    type="number"
                                                    value={settings.contractSize}
                                                    onChange={(e) => updateSettings({ contractSize: Number(e.target.value) })}
                                                    className="bg-black border border-[#FFC038]/20 rounded px-3 py-2 text-sm text-[#FFC038] focus:border-[#FFC038] outline-none font-mono"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] text-[#FFC038]/70 uppercase font-bold">Daily Profit Target ($)</label>
                                                <input
                                                    type="number"
                                                    value={settings.dailyProfitTarget}
                                                    onChange={(e) => updateSettings({ dailyProfitTarget: Number(e.target.value) })}
                                                    className="bg-black border border-[#FFC038]/20 rounded px-3 py-2 text-sm text-[#FFC038] focus:border-[#FFC038] outline-none font-mono"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] text-[#FFC038]/70 uppercase font-bold">Daily Loss Limit ($)</label>
                                                <input
                                                    type="number"
                                                    value={settings.dailyLossLimit}
                                                    onChange={(e) => updateSettings({ dailyLossLimit: Number(e.target.value) })}
                                                    className="bg-black border border-[#FFC038]/20 rounded px-3 py-2 text-sm text-[#FFC038] focus:border-[#FFC038] outline-none font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Trading Models */}
                                    <div>
                                        <h4 className="text-sm font-bold text-[#FFC038] uppercase mb-3 flex items-center gap-2">
                                            <Brain className="w-4 h-4" /> Trading Models
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {Object.entries(settings.tradingModels).map(([key, val]) => (
                                                <div key={key} className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10">
                                                    <span className="text-xs text-[#FFC038] capitalize">{key.replace(/([A-Z])/g, ' $1').replace('Twenty Two', '22')}</span>
                                                    <Toggle
                                                        checked={val as boolean}
                                                        onChange={() => updateSettings({
                                                            tradingModels: { ...settings.tradingModels, [key]: !val }
                                                        })}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* API Tab */}
                        {activeTab === 'api' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[#FFC038] mb-4">API Configuration</h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] text-[#FFC038]/70 mb-1">Claude API Key (AI Agent)</label>
                                            <input
                                                type="password"
                                                value={settings.claudeApiKey}
                                                onChange={e => updateSettings({ claudeApiKey: e.target.value })}
                                                className="w-full bg-black border border-[#FFC038]/30 rounded px-3 py-2 text-[#FFC038] text-xs font-mono focus:border-[#FFC038] outline-none"
                                                placeholder="Enter Anthropic Claude API Key"
                                            />
                                        </div>

                                        <div className="border-t border-[#FFC038]/10 my-4"></div>

                                        <div>
                                            <label className="block text-[10px] text-[#FFC038]/70 mb-1">X / Twitter API Key</label>
                                            <input
                                                type="password"
                                                value={settings.xApiKey}
                                                onChange={e => updateSettings({ xApiKey: e.target.value })}
                                                className="w-full bg-black border border-[#FFC038]/30 rounded px-3 py-2 text-[#FFC038] text-xs font-mono focus:border-[#FFC038] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-[#FFC038]/70 mb-1">X / Twitter Bearer Token</label>
                                            <input
                                                type="password"
                                                value={settings.xBearerToken}
                                                onChange={e => updateSettings({ xBearerToken: e.target.value })}
                                                className="w-full bg-black border border-[#FFC038]/30 rounded px-3 py-2 text-[#FFC038] text-xs font-mono focus:border-[#FFC038] outline-none"
                                            />
                                        </div>

                                        <div className="border-t border-[#FFC038]/10 my-4"></div>

                                        <div>
                                            <label className="block text-[10px] text-[#FFC038]/70 mb-1">TopstepX Username</label>
                                            <input
                                                type="text"
                                                value={settings.topstepXUserName}
                                                onChange={e => updateSettings({ topstepXUserName: e.target.value })}
                                                className="w-full bg-black border border-[#FFC038]/30 rounded px-3 py-2 text-[#FFC038] text-xs font-mono focus:border-[#FFC038] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-[#FFC038]/70 mb-1">TopstepX API Key</label>
                                            <input
                                                type="password"
                                                value={settings.topstepXApiKey}
                                                onChange={e => updateSettings({ topstepXApiKey: e.target.value })}
                                                className="w-full bg-black border border-[#FFC038]/30 rounded px-3 py-2 text-[#FFC038] text-xs font-mono focus:border-[#FFC038] outline-none"
                                            />
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <Button
                                                onClick={handleSave}
                                                variant="primary"
                                                className={cn("w-full md:w-auto transition-all", saveStatus === 'saved' ? "bg-emerald-500 border-emerald-500 text-black" : "")}
                                            >
                                                {saveStatus === 'saving' ? (
                                                    <><Loader2 className="w-3 h-3 animate-spin mr-2" /> Saving...</>
                                                ) : saveStatus === 'saved' ? (
                                                    <><Check className="w-3 h-3 mr-2" /> Changes Saved</>
                                                ) : (
                                                    <><Save className="w-3 h-3 mr-2" /> Save Changes</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Developer Mode Tab */}
                        {activeTab === 'dev' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div>
                                    <h3 className="text-lg font-bold text-[#FFC038] mb-4">Developer Mode</h3>

                                    <div className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10 mb-3">
                                        <span className="text-sm text-[#FFC038]">Dev Mode</span>
                                        <Toggle
                                            checked={settings.devMode}
                                            onChange={() => updateSettings({ devMode: !settings.devMode })}
                                        />
                                    </div>

                                    {settings.devMode && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10">
                                                <span className="text-xs text-[#FFC038]">Show Fire Test Trade</span>
                                                <Toggle
                                                    checked={settings.showFireTestTrade}
                                                    onChange={() => updateSettings({ showFireTestTrade: !settings.showFireTestTrade })}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10">
                                                <div className="flex items-center gap-2">
                                                    <Terminal className="w-3 h-3 text-[#FFC038]" />
                                                    <span className="text-xs text-[#FFC038]">Mock Data</span>
                                                </div>
                                                <Toggle
                                                    checked={settings.mockDataEnabled}
                                                    onChange={() => updateSettings({ mockDataEnabled: !settings.mockDataEnabled })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// AI Price Settings Modal
const AIPriceSettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { settings, updateSettings } = useSettings();
    const { resetOnboarding, partialResetOnboarding } = useAuth();
    const [instructions, setInstructions] = useState(settings.customInstructions || '');
    const [isEditing, setIsEditing] = useState(false);
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    useEffect(() => {
        setInstructions(settings.customInstructions || '');
    }, [settings.customInstructions, isOpen]);

    const handleSave = () => {
        updateSettings({ customInstructions: instructions });
        setIsEditing(false);
        onClose();
    };

    const handleReset = () => {
        setInstructions('');
        updateSettings({ customInstructions: '' });
        setIsEditing(false);
    };

    const handleStartEdit = () => {
        setShowDisclaimer(true);
    };

    const confirmDisclaimer = () => {
        setShowDisclaimer(false);
        setIsEditing(true);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
            {showDisclaimer ? (
                <div className="p-8 text-center">
                    <AlertTriangle className="w-12 h-12 text-[#FFC038] mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-[#FFC038] mb-4 font-['Roboto']">WARNING: SYSTEM OVERRIDE</h2>
                    <p className="text-white/70 text-sm mb-6 leading-relaxed">
                        You are modifying the AI Assistant.
                        <br />
                        We cannot guarantee financial accuracy or reliability of added instructions.
                        <br /><br />
                        Do you want to continue?
                    </p>
                    <div className="flex gap-3">
                        <Button onClick={() => setShowDisclaimer(false)} variant="secondary" className="w-full">CANCEL</Button>
                        <Button onClick={confirmDisclaimer} variant="primary" className="w-full">CONTINUE</Button>
                    </div>
                </div>
            ) : (
                <div className="p-6">
                    <h2 className="text-xl font-bold text-[#FFC038] mb-6 flex items-center gap-2 font-['Roboto']">
                        <GeminiIcon className="w-6 h-6" /> AI CONFIGURATION
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-[#FFC038]/70 mb-2 uppercase font-bold tracking-wider">Custom User Instructions</label>
                            <div className="relative">
                                <textarea
                                    value={instructions}
                                    onChange={e => setInstructions(e.target.value)}
                                    disabled={!isEditing}
                                    className={cn(
                                        "w-full h-40 bg-black border rounded-lg p-3 text-sm font-mono focus:outline-none resize-none transition-colors",
                                        isEditing ? "border-[#FFC038] text-[#FFC038]" : "border-[#FFC038]/20 text-[#FFC038]/50"
                                    )}
                                    placeholder="Enter custom instructions for Price..."
                                />
                                {!isEditing && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                                        <Button onClick={handleStartEdit} variant="secondary">MODIFY SYSTEM</Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isEditing && (
                            <div className="flex gap-3 pt-2">
                                <Button onClick={handleReset} variant="danger" className="w-1/3">RESET</Button>
                                <Button onClick={handleSave} variant="primary" className="w-2/3">SAVE CONFIG</Button>
                            </div>
                        )}

                        <div className="border-t border-[#FFC038]/20 pt-4 mt-4">
                            <h3 className="text-xs font-bold text-[#FFC038]/50 uppercase mb-4">AI Uplink Calibration</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={() => { partialResetOnboarding('challenges'); onClose(); }} variant="secondary" className="w-full text-[10px]">
                                    Reset Challenges
                                </Button>
                                <Button onClick={() => { partialResetOnboarding('goals'); onClose(); }} variant="secondary" className="w-full text-[10px]">
                                    Reset Goals
                                </Button>
                            </div>
                            <div className="mt-2">
                                <Button onClick={() => { resetOnboarding(); onClose(); }} variant="danger" className="w-full text-[10px]">
                                    Reset Full Calibration
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

// Pricing Modal
const PricingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { user, updateTier } = useAuth();

    const handleUpgrade = (tier: Tier) => {
        updateTier(tier);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-6xl bg-black">
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-[#FFC038] font-['Roboto'] mb-2">SELECT YOUR EDGE</h2>
                <p className="text-[#FFC038]/60 text-sm mb-10">Institutional grade tooling for the retail savage.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* FREE */}
                    <div className="border border-[#FFC038]/20 rounded-xl p-4 flex flex-col items-center opacity-80 hover:opacity-100 transition-opacity">
                        <div className="text-base font-bold text-white mb-2">PULSE (FREE)</div>
                        <div className="text-2xl font-bold text-[#FFC038] mb-4">$0</div>
                        <ul className="space-y-2 text-[10px] text-zinc-400 mb-6 flex-1 text-left w-full px-4">
                            <li className="text-zinc-500 italic">No perks</li>
                            <li className="flex gap-2 text-zinc-600"><Lock className="w-3 h-3" /> Mission Control</li>
                            <li className="flex gap-2 text-zinc-600"><Lock className="w-3 h-3" /> PsychAssist</li>
                            <li className="flex gap-2 text-zinc-600"><Lock className="w-3 h-3" /> AI Price</li>
                            <li className="flex gap-2 text-zinc-600"><Lock className="w-3 h-3" /> Newswire</li>
                        </ul>
                        <Button onClick={() => handleUpgrade('free')} variant="secondary" className="w-full text-xs" disabled={user.tier === 'free'}>
                            {user.tier === 'free' ? 'CURRENT' : 'DOWNGRADE'}
                        </Button>
                    </div>

                    {/* PULSE ($49) */}
                    <div className={cn("border rounded-xl p-4 flex flex-col items-center transition-all", user.tier === 'pulse' ? "border-[#FFC038] bg-[#FFC038]/5" : "border-[#FFC038]/20 hover:border-[#FFC038]/60")}>
                        <div className="text-base font-bold text-white mb-2">PULSE</div>
                        <div className="text-2xl font-bold text-[#FFC038] mb-4">$49<span className="text-xs font-normal text-white/50">/mo</span></div>
                        <ul className="space-y-2 text-[10px] text-[#FFC038]/80 mb-6 flex-1 text-left w-full px-4">
                            <li className="flex gap-2"><Check className="w-3 h-3" /> PsychAssist</li>
                            <li className="flex gap-2 text-zinc-500"><XIcon className="w-3 h-3" /> No Algo Trader</li>
                            <li className="flex gap-2 text-zinc-500"><XIcon className="w-3 h-3" /> No News Feed</li>
                            <li className="flex gap-2 text-zinc-500"><XIcon className="w-3 h-3" /> No AI Price</li>
                        </ul>
                        <Button onClick={() => handleUpgrade('pulse')} variant={user.tier === 'pulse' ? "primary" : "secondary"} className="w-full text-xs" disabled={user.tier === 'pulse'}>
                            {user.tier === 'pulse' ? 'CURRENT' : 'ACTIVATE'}
                        </Button>
                    </div>

                    {/* PULSE+ ($99) */}
                    <div className={cn("border rounded-xl p-4 flex flex-col items-center transition-all shadow-xl shadow-[#FFC038]/10", user.tier === 'pulse_plus' ? "border-[#FFC038] bg-[#FFC038]/5" : "border-[#FFC038]/20 hover:border-[#FFC038]/60")}>
                        <div className="text-base font-bold text-white mb-2">PULSE+</div>
                        <div className="text-2xl font-bold text-[#FFC038] mb-4">$99<span className="text-xs font-normal text-white/50">/mo</span></div>
                        <ul className="space-y-2 text-[10px] text-[#FFC038]/80 mb-6 flex-1 text-left w-full px-4">
                            <li className="flex gap-2"><Check className="w-3 h-3" /> Algo Trader / Post Algo</li>
                            <li className="flex gap-2"><Check className="w-3 h-3" /> PsychAssist</li>
                            <li className="flex gap-2"><Check className="w-3 h-3" /> AI Price</li>
                        </ul>
                        <Button onClick={() => handleUpgrade('pulse_plus')} variant={user.tier === 'pulse_plus' ? "primary" : "secondary"} className="w-full text-xs" disabled={user.tier === 'pulse_plus'}>
                            {user.tier === 'pulse_plus' ? 'CURRENT' : 'UPGRADE'}
                        </Button>
                    </div>

                    {/* PULSE PRO ($149) */}
                    <div className={cn("border rounded-xl p-4 flex flex-col items-center transition-all", user.tier === 'pulse_pro' ? "border-[#FFC038] bg-[#FFC038]/5" : "border-[#FFC038]/20 hover:border-[#FFC038]/60")}>
                        <div className="text-base font-bold text-white mb-2">PULSE PRO</div>
                        <div className="text-2xl font-bold text-[#FFC038] mb-4">$149<span className="text-xs font-normal text-white/50">/mo</span></div>
                        <ul className="space-y-2 text-[10px] text-[#FFC038]/80 mb-6 flex-1 text-left w-full px-4">
                            <li className="flex gap-2 font-bold"><Check className="w-3 h-3" /> Real-Time Newswire</li>
                            <li className="flex gap-2"><Check className="w-3 h-3" /> Everything in Pulse+</li>
                        </ul>
                        <Button onClick={() => handleUpgrade('pulse_pro')} variant={user.tier === 'pulse_pro' ? "primary" : "secondary"} className="w-full text-xs" disabled={user.tier === 'pulse_pro'}>
                            {user.tier === 'pulse_pro' ? 'CURRENT' : 'UPGRADE'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

// Onboarding Modal
const UplinkOnboardingModal = ({ isOpen, onComplete, onCancel }: { isOpen: boolean; onComplete: () => void; onCancel: () => void }) => {
    const { user, saveOnboardingData } = useAuth();
    const [challenges, setChallenges] = useState<string[]>(user.onboardingData?.challenges || []);
    const [goals, setGoals] = useState<string[]>(user.onboardingData?.goals || []);
    const [otherChallenge, setOtherChallenge] = useState(user.onboardingData?.otherChallenge || '');
    const [otherGoal, setOtherGoal] = useState(user.onboardingData?.otherGoal || '');

    const toggleChallenge = (item: string) => {
        setChallenges(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    const toggleGoal = (item: string) => {
        setGoals(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    const isValid = challenges.length >= 2 && goals.length >= 1;

    const handleComplete = () => {
        if (!isValid) return;
        saveOnboardingData({ challenges, goals, otherChallenge, otherGoal });
        onComplete();
    };

    return (
        <Modal isOpen={isOpen} onClose={onCancel} className="max-w-2xl" hideClose={true}>
            <div className="p-8">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#FFC038]/10 flex items-center justify-center mb-4 animate-pulse mx-auto">
                        <Zap className="w-8 h-8 text-[#FFC038]" />
                    </div>
                    <h2 className="text-xl font-bold text-[#FFC038] mb-2 font-['Roboto']">INITIALIZING UPLINK</h2>
                    <p className="text-white/60 text-xs leading-relaxed">
                        Complete calibration to establish neural link.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Challenges */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] text-[#FFC038]/70 uppercase font-bold">Challenges (Select at least 2)</label>
                            <span className={cn("text-[10px]", challenges.length >= 2 ? "text-emerald-500" : "text-red-500")}>{challenges.length}/2</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                            {CHALLENGE_PRESETS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => toggleChallenge(c)}
                                    className={cn(
                                        "text-[9px] p-2 rounded border transition-all text-center h-full flex items-center justify-center",
                                        challenges.includes(c)
                                            ? "bg-[#FFC038] text-black border-[#FFC038] font-bold"
                                            : "bg-transparent text-[#FFC038]/60 border-[#FFC038]/20 hover:border-[#FFC038]/50"
                                    )}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        <textarea
                            value={otherChallenge}
                            onChange={e => setOtherChallenge(e.target.value)}
                            className="w-full bg-black border border-[#FFC038]/20 rounded px-3 py-2 text-[#FFC038] text-xs font-mono focus:border-[#FFC038] outline-none h-16 resize-none placeholder-[#FFC038]/20"
                            placeholder="Other challenges..."
                        />
                    </div>

                    {/* Goals */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] text-[#FFC038]/70 uppercase font-bold">Goals (Select at least 1)</label>
                            <span className={cn("text-[10px]", goals.length >= 1 ? "text-emerald-500" : "text-red-500")}>{goals.length}/1</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                            {GOAL_PRESETS.map(g => (
                                <button
                                    key={g}
                                    onClick={() => toggleGoal(g)}
                                    className={cn(
                                        "text-[9px] p-2 rounded border transition-all text-center h-full flex items-center justify-center",
                                        goals.includes(g)
                                            ? "bg-[#FFC038] text-black border-[#FFC038] font-bold"
                                            : "bg-transparent text-[#FFC038]/60 border-[#FFC038]/20 hover:border-[#FFC038]/50"
                                    )}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                        <textarea
                            value={otherGoal}
                            onChange={e => setOtherGoal(e.target.value)}
                            className="w-full bg-black border border-[#FFC038]/20 rounded px-3 py-2 text-[#FFC038] text-xs font-mono focus:border-[#FFC038] outline-none h-16 resize-none placeholder-[#FFC038]/20"
                            placeholder="Other goals..."
                        />
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                        <Button onClick={handleComplete} variant="primary" className="w-full py-3" disabled={!isValid}>ESTABLISH CONNECTION</Button>
                        <button onClick={onCancel} className="text-[10px] text-[#FFC038]/40 hover:text-[#FFC038] uppercase tracking-widest">Abort Uplink</button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

// --- App Content ---
const AppContent = () => {
    const { user, markOnboardingSeen } = useAuth();
    const { settings } = useSettings();
    const [activeTab, setActiveTab] = useState<'feed' | 'news' | 'analysis'>('feed');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAIPriceSettingsOpen, setIsAIPriceSettingsOpen] = useState(false);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

    // Feed States
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [newsItems, setNewsItems] = useState<FeedItem[]>([]);

    // Psych State (Lifted for Agent Context)
    const [psychState, setPsychState] = useState<{ score: number, state: EmotionalState, tiltCount: number }>({
        score: 5.0,
        state: 'stable',
        tiltCount: 0
    });

    // Calculate IV helper using Gemini API for realistic analysis
    const calculateIV = async (text: string): Promise<IVData> => {
        const instrument = INSTRUMENT_RULES[settings.selectedInstrument] || INSTRUMENT_RULES['ES'];
        try {
            // Use Gemini to analyze the headline for market impact
            const prompt = `Analyze this market news headline for ${instrument.name} (${settings.selectedInstrument}) day trading:

"${text}"

Provide a realistic implied volatility estimate in points for a scalping timeframe (minutes to hours).
Use economic reasoning (e.g., earnings, Fed speakers, geopolitical events) to determine impact.
Current Instrument Rules: Tick Size: ${instrument.tickSize}, Point Value: $${instrument.pointValue}.
Typical IV Range: ${instrument.ivRange.low}-${instrument.ivRange.high} points.

Ranges:
- Minor news: ${instrument.ivRange.low}-${instrument.ivRange.high} points
- Medium news: ${instrument.ivRange.high}-${instrument.ivRange.high * 2} points
- Major news: ${instrument.ivRange.high * 2}+ points

Respond in JSON format ONLY:
{"points": <number>, "direction": "bullish" or "bearish", "reasoning": "<brief explanation>"}`;

            const apiKey = settings.geminiApiKey || (window as any).__GEMINI_API_KEY__ || import.meta.env.VITE_GEMINI_API_KEY;

            if (!apiKey) throw new Error("No Gemini API Key");

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 200
                    }
                })
            });

            const data = await response.json();
            const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Parse JSON from AI response
            const jsonMatch = aiResponse.match(/\{[^}]+\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const value = parsed.direction === 'bearish' ? -Math.abs(parsed.points) : Math.abs(parsed.points);
                const type = value >= 0 ? 'cyclical' : 'countercyclical';
                return { type, value };
            }
        } catch (error) {
            console.error('Gemini IV Analysis Error:', error);
        }

        // Fallback to simple analysis if API fails
        const lowerText = text.toLowerCase();
        const bullishTerms = ['beats', 'surge', 'rally', 'gain', 'positive', 'growth', 'up', 'rise'];
        const bearishTerms = ['miss', 'crash', 'drop', 'loss', 'negative', 'decline', 'down', 'fall'];
        const majorTerms = ['fomc', 'fed', 'cpi', 'nfp', 'inflation', 'gdp', 'rate', 'powell'];

        const isBullish = bullishTerms.some(t => lowerText.includes(t));
        const isBearish = bearishTerms.some(t => lowerText.includes(t));
        const isMajor = majorTerms.some(t => lowerText.includes(t));

        const magnitude = isMajor
            ? Math.floor(30 + Math.random() * 40)
            : Math.floor(10 + Math.random() * 20);

        let value = isBearish ? -magnitude : isBullish ? magnitude : (Math.random() > 0.5 ? 1 : -1) * magnitude;

        const type = value >= 0 ? 'cyclical' : 'countercyclical';
        return { type, value };
    };

    const processItems = useCallback(async (rawItems: any[]) => {
        const newItems: FeedItem[] = await Promise.all(rawItems.map(async (t: any) => {
            const iv = await calculateIV(t.text);
            return {
                id: Number(t.id),
                time: new Date(t.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }) + " EST",
                text: t.text,
                type: 'info',
                source: 'X', // Default source
                iv: iv
            };
        }));

        // Update System Feed
        setFeedItems(prev => {
            const existingIds = new Set(prev.map(i => i.id));
            const filtered = newItems.filter(i => !existingIds.has(i.id));
            return [...filtered, ...prev].slice(0, 50);
        });

        // Update News Feed
        setNewsItems(prev => {
            const existingIds = new Set(prev.map(i => i.id));
            const filtered = newItems.filter(i => !existingIds.has(i.id));
            return [...filtered, ...prev].slice(0, 50);
        });
    }, []);

    // Live Feed Fetcher with Fallback
    const fetchFeed = useCallback(async (limit: number = 20) => {
        console.log(`[Feed] Fetching... Limit: ${limit}, Mock: ${settings.mockDataEnabled}, Token: ${settings.xBearerToken ? 'Present' : 'Missing'}`);

        // STRICT REAL MODE: Only mock if explicitly enabled
        if (settings.mockDataEnabled) {
            // Simulate network latency then return mock
            await new Promise(r => setTimeout(r, 500));
            const mockItem = MOCK_WIRE_DATA[Math.floor(Math.random() * MOCK_WIRE_DATA.length)];
            const newRawItems = [{
                id: Date.now(),
                created_at: new Date().toISOString(),
                text: mockItem.text,
                source: mockItem.source
            }];
            await processItems(newRawItems);
            return;
        }

        // REAL DATA MODE
        if (!settings.xBearerToken) {
            console.warn("[Feed] No Bearer Token provided. Skipping fetch.");
            return;
        }

        try {
            console.log("[Feed] Uplinking to X API via Worker...");

            // Unfiltered query including quotes
            const query = "from:FinancialJuice OR from:WalterBloomberg OR from:ZeroHedge OR from:DeltaOne OR from:InsiderPaper";

            // IMPORTANT: Worker is deployed! Using real URL
            const WORKER_URL = 'https://x-api-proxy.pricedinresearch.workers.dev';

            // Build request URL with query parameters
            const url = new URL(WORKER_URL);
            url.searchParams.set('query', query);
            url.searchParams.set('max_results', limit.toString());
            url.searchParams.set('tweet_fields', 'created_at,text,referenced_tweets');
            url.searchParams.set('expansions', 'referenced_tweets.id');

            // Make request to Worker (not directly to X API)
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'X-Bearer-Token': settings.xBearerToken // Worker expects token in this header
                }
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`API Failure: ${res.status} ${res.statusText} - ${errorText}`);
            }

            const data = await res.json();
            console.log(`[Feed] Received ${data.data?.length || 0} items`);

            if (data.data && Array.isArray(data.data)) {
                await processItems(data.data);
            }
        } catch (e) {
            console.error("[Feed] Uplink Failed:", e);
            // Do NOT fallback to mock data in real mode
        }
    }, [settings.xBearerToken, settings.mockDataEnabled, processItems, settings.selectedInstrument, settings.claudeApiKey]);

    useEffect(() => {
        fetchFeed(); // Initial fetch
        const interval = setInterval(() => fetchFeed(20), 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [fetchFeed]);

    const handleTabChange = (tab: 'feed' | 'news' | 'analysis') => {
        const canAccessAI = user.tier === 'pulse_plus' || user.tier === 'pulse_pro';

        if (tab === 'analysis') {
            if (canAccessAI && !user.hasSeenPriceOnboarding) {
                setIsOnboardingOpen(true);
            }
        }
        setActiveTab(tab);
    };

    const handleOnboardingComplete = () => {
        markOnboardingSeen();
        setIsOnboardingOpen(false);
    }

    const handleOnboardingCancel = () => {
        setIsOnboardingOpen(false);
        if (!user.hasSeenPriceOnboarding) {
            setActiveTab('feed');
        }
    }

    const handlePsychUpdate = (score: number, state: EmotionalState, tiltCount: number) => {
        // Only update if state changed significantly or periodically
        // For now, we just log it or update local state if needed
        // The monitor handles the alerts directly
    };

    const handleTilt = async (tiltCount: number) => {
        console.log("User Tilt Detected:", tiltCount);

        // Generate AI Response for Tilt
        if (settings.claudeApiKey) {
            const context: AgentContext = {
                marketState: 'volatile', // Mock - should derive from market data
                userState: {
                    pnl: settings.currentPNL,
                    emotionalState: 'tilt',
                    tiltCount: tiltCount,
                    openPositions: positions.length
                },
                activePositions: positions.map(p => ({
                    symbol: p.symbol,
                    pnl: p.profitAndLoss,
                    side: p.side
                }))
            };

            const prompt = `User has tilted ${tiltCount} times. PNL is ${settings.currentPNL}. Provide a short, punchy, drill-sergeant style warning to snap them out of it.`;

            try {
                const response = await generateAgentResponse(prompt, [], context, {
                    name: 'Pulse',
                    style: 'drill_sergeant',
                    riskTolerance: 'low',
                    maxDrawdown: settings.dailyLossLimit
                });

                // Add to chat or display as alert
                // For now, we'll just log it, but ideally this goes into a chat/alert stream
                console.log("AI Agent Tilt Response:", response);

                // You could also trigger a specific voice alert here using ElevenLabs if integrated
            } catch (e) {
                console.error("Failed to generate AI response for tilt:", e);
            }
        }
    };

    const getTierLabel = () => {
        switch (user.tier) {
            case 'free': return 'PULSE';
            case 'pulse': return 'PULSE';
            case 'pulse_plus': return 'PULSE+';
            case 'pulse_pro': return 'PULSE PRO';
            default: return 'PULSE';
        }
    };

    return (
        <ErrorBoundary>
            <div className="h-screen w-screen bg-black text-[#FFC038] font-mono flex flex-col overflow-hidden relative selection:bg-[#FFC038] selection:text-black">
                {/* Modals */}
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onSave={() => fetchFeed(15)}
                />
                <AIPriceSettingsModal isOpen={isAIPriceSettingsOpen} onClose={() => setIsAIPriceSettingsOpen(false)} />
                <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
                <UplinkOnboardingModal isOpen={isOnboardingOpen} onComplete={handleOnboardingComplete} onCancel={handleOnboardingCancel} />

                {/* Header */}
                <header className="h-14 border-b border-[#FFC038]/20 flex items-center justify-between px-6 bg-[#050500] shrink-0 z-50">
                    <div className="flex items-center gap-4">
                        <span className="text-[#FFC038] font-bold text-xl tracking-widest uppercase font-['Roboto']">Pulse</span>

                        <div>
                            <div className="flex gap-2 items-center">
                                <p className="text-[9px] text-[#FFC038] font-mono tracking-widest">SYSTEM {user.tier === 'free' ? 'OFFLINE' : 'ONLINE'}</p>
                                <span className={cn("w-1.5 h-1.5 rounded-full", user.tier === 'free' ? "bg-red-500" : "bg-emerald-500 animate-pulse")} />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeTab === 'analysis' && (
                            <div className="flex items-center">
                                <span className="text-[#FFC038] font-bold text-xs uppercase mr-2 font-['Roboto']">AI Agent Settings</span>
                                <button
                                    onClick={() => setIsAIPriceSettingsOpen(true)}
                                    className="p-2 text-[#FFC038] hover:bg-[#FFC038]/10 rounded-full transition-colors"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <Button onClick={() => setIsPricingOpen(true)} variant={user.tier === 'pulse_plus' || user.tier === 'pulse_pro' ? "secondary" : "primary"} className="h-8 text-[10px] px-3 uppercase">
                            {getTierLabel()}
                        </Button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar (Navigation) */}
                    <nav className="w-16 border-r border-[#FFC038]/20 bg-[#050500] flex flex-col items-center py-4 z-40">
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => handleTabChange('feed')}
                                className={cn("p-3 rounded-xl transition-all", activeTab === 'feed' ? "bg-[#FFC038] text-black shadow-[0_0_15px_rgba(255,192,56,0.5)]" : "text-[#FFC038]/50 hover:text-[#FFC038]")}
                            >
                                <Terminal className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => handleTabChange('analysis')}
                                className={cn("p-3 rounded-xl transition-all", activeTab === 'analysis' ? "bg-[#FFC038] text-black shadow-[0_0_15px_rgba(255,192,56,0.5)]" : "text-[#FFC038]/50 hover:text-[#FFC038]")}
                            >
                                <GeminiIcon className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => handleTabChange('news')}
                                className={cn("p-3 rounded-xl transition-all", activeTab === 'news' ? "bg-[#FFC038] text-black shadow-[0_0_15px_rgba(255,192,56,0.5)]" : "text-[#FFC038]/50 hover:text-[#FFC038]")}
                            >
                                <Newspaper className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="mt-auto flex flex-col gap-4">
                            <button onClick={() => setIsSettingsOpen(true)} className="p-3 text-[#FFC038]/50 hover:text-[#FFC038] hover:bg-[#FFC038]/10 rounded-xl transition-colors">
                                <Settings className="w-6 h-6" />
                            </button>
                            <button onClick={() => window.location.reload()} className="p-3 text-red-500/50 hover:text-red-500 hover:bg-red-900/10 rounded-xl transition-colors">
                                <LogOut className="w-6 h-6" />
                            </button>
                        </div>
                    </nav>

                    {/* Middle Column (Mission Control) */}
                    <aside className="shrink-0 z-30 h-full">
                        <MissionControl onPsychStateUpdate={handlePsychUpdate} onTilt={handleTilt} psychState={psychState} />
                    </aside>

                    {/* Right Column (Main Content) */}
                    <main className="flex-1 bg-[#0a0a00] relative min-w-0">
                        {activeTab === 'feed' && (
                            <div className="h-full overflow-y-auto p-4">
                                {feedItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full opacity-30 text-[#FFC038]">
                                        <Activity className="w-12 h-12 mb-2" />
                                        <span className="text-xs font-mono">System Idle. Waiting for data uplink...</span>
                                    </div>
                                ) : (
                                    <FeedSection title="SYSTEM FEED" items={feedItems} onClear={() => setFeedItems([])} />
                                )}
                            </div>
                        )}

                        {activeTab === 'analysis' && (
                            <ChatInterface
                                feedItems={feedItems}
                                erScore={psychState.score}
                                erState={psychState.state}
                                tiltCount={psychState.tiltCount}
                            />
                        )}

                        {activeTab === 'news' && (
                            <div className="h-full relative flex flex-col">
                                {user.tier !== 'pulse_pro' ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                        <div className="max-w-md">
                                            <Newspaper className="w-16 h-16 text-[#FFC038]/30 mx-auto mb-6" />
                                            <h2 className="text-2xl font-bold text-[#FFC038] font-['Roboto'] mb-2">NEWSWIRE LOCKED</h2>
                                            <p className="text-white/50 text-sm mb-6">Real-time institutional squawk and sentiment analysis requires Pulse Pro clearance.</p>
                                            <Button onClick={() => setIsPricingOpen(true)} variant="primary" className="mx-auto">UNLOCK NEWSWIRE</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <NewsFeed
                                        items={newsItems}
                                        onClear={() => setNewsItems([])}
                                        onRefresh={() => fetchFeed(20)}
                                    />
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </ErrorBoundary>
    );
};

// --- Root Render ---
const root = createRoot(document.getElementById('root')!);
root.render(
    <React.StrictMode>
        <AuthProvider>
            <SettingsProvider>
                <ThreadProvider>
                    <AppContent />
                </ThreadProvider>
            </SettingsProvider>
        </AuthProvider>
    </React.StrictMode>
);