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
  Link as LinkIcon, Square, Trash2, Play
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage, Chat, GenerateContentResponse } from "@google/genai";
import { triggerEmotionalAlert, EmotionalState, playTone } from './emotionalAlerts';
import { generateAgentResponse, AgentContext } from './agentFrame';

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
  topstepXApiKey: string;
  customInstructions: string;
  drillSergeantMode: boolean;
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
  }
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
  createThread: (initialMessage?: string) => string;
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

  const createThread = (initialMessage?: string) => {
    const id = Date.now().toString();
    const newThread: Thread = {
      id,
      title: initialMessage ? initialMessage.substring(0, 30) + (initialMessage.length > 30 ? '...' : '') : `Session ${new Date().toLocaleTimeString()}`,
      timestamp: Date.now(),
      messages: [],
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
            xBearerToken: '',
            topstepXApiKey: '',
            customInstructions: '',
            drillSergeantMode: false,
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
            }
        };
        const loaded = saved ? JSON.parse(saved) : {};
        return { ...defaults, ...loaded, alerts: { ...defaults.alerts, ...(loaded.alerts || {}) } };
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
    if(!ctx) throw new Error("useSettings must be used within SettingsProvider");
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
    
    return (
        <div className="flex items-center gap-1.5 font-mono text-xs bg-[#140a00] px-2 py-1 rounded border border-[#FFC038]/20 shadow-[0_0_5px_rgba(0,0,0,0.5)]">
             <span className="text-[#FFC038] font-bold tracking-wider">IV:</span>
             <span className={cn("font-bold flex items-center gap-1", color)}>
                {isBullish ? '▲' : '▼'}
                <span>{change > 0 ? '+' : ''}{change.toFixed(1)} pts</span>
             </span>
        </div>
    );
};

// 1. Error Boundary
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
    constructor(props: any) { super(props); this.state = { hasError: false }; }
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
            const baseColor = isTilt ? `rgba(255, 64, 64, ${0.5 + Math.abs(Math.sin(Date.now()/200))*0.5})` : '#FBC717';
            ctx.fillStyle = baseColor;
            
            for(let i = 0; i < bufferLength; i++) {
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

                ctx.fillRect(x, centerY - height/2, barWidth, height);
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
    onStateUpdate
}: { 
    active: boolean, 
    sessionTime?: string,
    onStateUpdate: (score: number, state: EmotionalState, tiltCount: number) => void
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
    
    useEffect(() => {
        // Sync state to parent
        onStateUpdate(score, state, tiltCountRef.current);

        if (state !== lastStateRef.current) {
            // Update Tilt Count Logic
            if (state === 'tilt') {
                tiltCountRef.current += 1;
                setTiltCount(tiltCountRef.current);
            }

            // Trigger Emotional Alerts Engine
            triggerEmotionalAlert(state, tiltCountRef.current, settings.alerts);
            
            lastStateRef.current = state;
        }
        
        // Status Text Update
        if (state === 'stable') setStatusText("Emotional state: Stable");
        else if (state === 'tilt') setStatusText("Emotional state: Tilt Detected");
        else setStatusText("Emotional state: Neutral");

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
            for(let i=0; i<data.length; i++) sum += data[i];
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
    };

    const analyzeText = (text: string) => {
        const CURSE_WORDS = ['shit', 'fuck', 'damn', 'bitch', 'crap', 'hell', 'ass', 'bastard', 'piss'];
        const AGGRESSIVE_WORDS = ['stupid', 'idiot', 'hate', 'lose', 'bad', 'worst', 'trash', 'useless'];
        
        let penalty = 0;
        let isCurse = false;
        
        // Count curses
        CURSE_WORDS.forEach(w => {
            if (text.includes(w)) {
                penalty += 0.7;
                isCurse = true;
            }
        });
        
        if (isCurse) {
            penalty += 1.3; // Base aggression for cursing
        } else if (AGGRESSIVE_WORDS.some(w => text.includes(w))) {
             penalty += 1.3;
        }
        
        if (penalty > 0) {
            applyPenalty(penalty, "Verbal Infraction");
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
                    0%, 100% { height: 40%; opacity: 0.6; }
                    50% { height: 100%; opacity: 1; }
                }
                @keyframes shimmer-overlay {
                    0% { transform: translateX(-150%) skewX(-20deg); }
                    100% { transform: translateX(150%) skewX(-20deg); }
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
                            animation: `wave 1s ease-in-out infinite`,
                            animationDelay: `${i * 0.15}s`
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
const FeedSection: React.FC<{ title: string; items: FeedItem[] }> = ({ title, items }) => (
  <div className="relative mb-4 h-full flex flex-col">
    <div className="sticky top-0 z-10 bg-[#050500] border-b border-[#FFC038]/20 px-4 py-2 flex items-center gap-2 shadow-sm shrink-0">
      <Clock className="w-3 h-3 text-[#FFC038]" />
      <span className="text-[10px] font-bold tracking-widest text-[#FFC038] uppercase font-['Roboto']">{title}</span>
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
                  <span className={cn("font-bold", item.iv.value >= 0 ? "text-emerald-500" : "text-red-500")}>
                      [{item.iv.value >= 0 ? '▲' : '▼'} {item.iv.value > 0 ? '+' : ''}{item.iv.value.toFixed(1)}pts]
                  </span>
              </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// News Feed Component
const NewsFeed = ({ items, following, onToggleFollow }: { items: FeedItem[], following: string[], onToggleFollow: (s: string) => void }) => {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    
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

    const MOCK_SOURCES = ["Walter Bloomberg", "ZeroHedge", "FinancialJuice", "DeltaOne", "InsiderPaper"];

    return (
        <div className="h-full flex flex-col relative bg-[#0a0a00]">
             <div className="p-4 border-b border-[#FFC038]/20 flex items-center justify-between bg-[#050500]">
                 <div className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-[#FFC038]" />
                    <span className="text-xs font-bold text-[#FFC038] uppercase font-['Roboto'] tracking-widest">Following Feed</span>
                 </div>
                 <div className="flex items-center gap-4">
                     <IVIndicator change={1.4} />
                     <button 
                        onClick={requestNotifications}
                        className={cn("p-1.5 rounded transition-all", notificationsEnabled ? "text-emerald-500 bg-emerald-500/10" : "text-[#FFC038]/50 hover:text-[#FFC038]")}
                     >
                        {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                     </button>
                 </div>
             </div>

             <div className="px-4 py-2 border-b border-[#FFC038]/10 flex gap-2 overflow-x-auto scrollbar-none">
                 {MOCK_SOURCES.map(source => (
                     <button
                        key={source}
                        onClick={() => onToggleFollow(source)}
                        className={cn(
                            "text-[9px] px-2 py-1 rounded border transition-all whitespace-nowrap flex items-center gap-1",
                            following.includes(source) 
                                ? "bg-[#FFC038] text-black border-[#FFC038] font-bold" 
                                : "text-[#FFC038]/50 border-[#FFC038]/20 hover:border-[#FFC038]"
                        )}
                     >
                        {following.includes(source) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {source}
                     </button>
                 ))}
             </div>

             <div className="flex-1 overflow-hidden p-0">
                 {items.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full opacity-30 text-[#FFC038]">
                         <Newspaper className="w-12 h-12 mb-2" />
                         <span className="text-xs font-mono">Waiting for wire data...</span>
                     </div>
                 ) : (
                    <FeedSection title="LIVE WIRE" items={items} />
                 )}
             </div>
        </div>
    );
};

// Sidebar Thread List
const ThreadHistory = () => {
    const { threads, activeThreadId, setActiveThread, createThread } = useThreads();
    const { user } = useAuth();
    
    const locked = user.tier === 'free';

    return (
        <LockedCard locked={locked} mode="blur" className="h-full flex flex-col">
            <div className="p-4 border-b border-[#FFC038]/20 flex justify-between items-center bg-[#0a0a00]">
                <div className="flex items-center gap-2 text-[#FFC038]">
                    <Notebook className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase font-['Roboto']">History</span>
                </div>
                <button onClick={() => createThread()} className="text-[#FFC038]/50 hover:text-[#FFC038]">
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#FFC038]/20 p-2 space-y-1">
                {threads.length === 0 && <div className="text-[10px] text-[#FFC038]/30 italic p-2 text-center">No history recorded.</div>}
                {threads.map(t => {
                    const dateStr = new Date(t.timestamp).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                    // Default values if legacy data
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
            activeThreadId: threadId!
        };

        const agentSettings = {
            customInstructions: settings.customInstructions,
            drillSergeantMode: settings.alerts.voiceStyle === 'drill'
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

// Control Panel (Mission Control)
const MissionControl = ({ onPsychStateUpdate }: { onPsychStateUpdate: (score: number, state: EmotionalState, tiltCount: number) => void }) => {
    const { user, updateTier } = useAuth();
    const { settings, updateSettings } = useSettings();
    const { activeThreadId, updateThread } = useThreads();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [psychAssistActive, setPsychAssistActive] = useState(false);
    
    // New State for Warning Modal
    const [showStopWarning, setShowStopWarning] = useState(false);
    
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
    
    const isGlobalLocked = user.tier === 'free';

    return (
        <div className={cn(
            "h-full flex flex-col bg-black border-r border-[#FFC038]/20 relative transition-all duration-300 ease-in-out",
            isCollapsed ? "w-14" : "w-80"
        )}>
             <StopMonitoringModal isOpen={showStopWarning} onContinue={cancelStopMonitoring} onStop={confirmStopMonitoring} />
             
             <div className="p-4 border-b border-[#FFC038]/20 flex justify-between items-center bg-[#050500] z-30 relative h-14 shrink-0">
                 {!isCollapsed && (
                     <div className="flex items-center gap-2 text-[#FFC038] animate-in fade-in overflow-hidden whitespace-nowrap">
                         <Layers className="w-4 h-4 shrink-0" />
                         <span className="text-xs font-bold uppercase font-['Roboto']">Mission Control</span>
                     </div>
                 )}
                 {isCollapsed ? (
                    <button onClick={() => setIsCollapsed(false)} className="w-full flex justify-center text-[#FFC038] hover:text-white">
                        <ArrowRight className="w-4 h-4" />
                    </button>
                 ) : (
                    <div className="flex items-center gap-2">
                         {isGlobalLocked && <Lock className="w-3 h-3 text-[#FFC038]" />}
                         <button onClick={() => setIsCollapsed(true)} className="text-[#FFC038]/50 hover:text-[#FFC038]">
                            <ChevronLeft className="w-4 h-4" />
                         </button>
                    </div>
                 )}
             </div>

             {!isCollapsed && (
             <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-0">
                 
                 {/* 1. PsychAssist */}
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

                 {/* 2. Blindspots */}
                 <LockedCard locked={user.tier === 'pulse' || user.tier === 'free'} mode="cta" title="Blindspots" onUpgrade={() => updateTier('pulse_plus')} className="bg-[#140a00] border border-[#FFC038]/20 p-3">
                     <div className="flex justify-between items-center mb-3">
                         <div className="flex gap-2 items-center text-[#FFC038]">
                             <Eye className="w-4 h-4" />
                             <span className="text-xs font-bold">Blindspots</span>
                         </div>
                     </div>
                     <div className="space-y-3 mt-2">
                        {['Impulse Entry', 'Revenge Trading', 'Overleveraging'].map((b,i) => (
                             <div key={i} className="text-[10px] text-[#FFC038] font-bold uppercase tracking-wider pl-1 font-['Roboto'] flex items-center gap-2">
                                 <span className="w-1 h-1 bg-[#FFC038] rounded-full"></span>
                                 {b}
                             </div>
                        ))}
                     </div>
                 </LockedCard>
                 
                 {/* 3. Algo Status */}
                 <LockedCard locked={user.tier === 'pulse' || user.tier === 'free'} mode="cta" title="Algo Status" onUpgrade={() => updateTier('pulse_plus')} className="bg-[#140a00] border border-[#FFC038]/20 p-3">
                     <div className="flex justify-between items-center mb-3">
                         <div className="flex gap-2 items-center text-[#FFC038]">
                             <TrendingUp className="w-4 h-4" />
                             <span className="text-xs font-bold">Algo Status</span>
                         </div>
                     </div>
                     <div className="flex items-center justify-between bg-[#0a0a00] p-2 rounded border border-[#FFC038]/10">
                         <span className="text-xs text-[#FFC038]/60">Scouting Mode</span>
                         <Toggle checked={false} onChange={() => {}} />
                     </div>
                 </LockedCard>

                 {/* 4. Thread History Widget */}
                 <div className="h-64 border border-[#FFC038]/20 rounded-lg overflow-hidden bg-[#140a00]">
                    <ThreadHistory />
                 </div>

             </div>
             )}
             
             {isCollapsed && (
                 <div className="flex-1 flex flex-col items-center py-4 gap-4">
                     <Layers className="w-5 h-5 text-[#FFC038]/50" />
                     <div className="flex-1 w-full flex items-center justify-center">
                        <span className="text-[#FFC038]/50 text-[10px] uppercase font-bold tracking-widest rotate-180 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
                            Mission Control
                        </span>
                     </div>
                 </div>
             )}

             {!isCollapsed && isGlobalLocked && (
                 <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-1000">
                     <Lock className="w-12 h-12 text-[#FFC038] mb-4" />
                     <h2 className="text-xl font-bold text-[#FFC038] font-['Roboto'] tracking-widest mb-2">MISSION CONTROL LOCKED</h2>
                     <p className="text-[#FFC038]/60 text-xs font-mono mb-6 max-w-[200px]">Advanced telemetry and psychological monitoring require an active uplink.</p>
                     <Button onClick={() => updateTier('pulse')} variant="primary">INITIALIZE PULSE</Button>
                 </div>
             )}
        </div>
    );
};

// Settings Modal
const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { settings, updateSettings } = useSettings();
    
    // Helper to preview tone
    const previewTone = () => {
        playTone(523.25, settings.alerts.toneType, 0.5, 0.2);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="w-full max-w-2xl">
            <div className="p-6">
                <h2 className="text-xl font-bold text-[#FFC038] font-['Roboto'] mb-6 flex items-center gap-2">
                    <Settings className="w-6 h-6" /> SYSTEM CONFIGURATION
                </h2>
                
                <div className="space-y-8">
                    {/* General UI */}
                    <section>
                        <h3 className="text-xs font-bold text-[#FFC038]/50 uppercase border-b border-[#FFC038]/20 pb-2 mb-4">Interface</h3>
                        <div className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10 mb-2">
                            <span className="text-sm text-[#FFC038]">Anti-Anxiety Mode</span>
                            <Toggle 
                                checked={!settings.showUpgradeCTAText} 
                                onChange={() => updateSettings({ showUpgradeCTAText: !settings.showUpgradeCTAText })} 
                            />
                        </div>
                    </section>
                    
                    {/* Alerts & Audio */}
                    <section>
                         <h3 className="text-xs font-bold text-[#FFC038]/50 uppercase border-b border-[#FFC038]/20 pb-2 mb-4">Alerts & Audio</h3>
                         
                         <div className="space-y-3">
                             {/* Toggles */}
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

                             {/* Voice Style */}
                             <div className="p-3 bg-[#140a00] rounded border border-[#FFC038]/10">
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

                             {/* Tone Type */}
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
                    </section>
                    
                    {/* API Keys */}
                    <section>
                        <h3 className="text-xs font-bold text-[#FFC038]/50 uppercase border-b border-[#FFC038]/20 pb-2 mb-4">External Uplinks</h3>
                        <div className="grid grid-cols-1 gap-4">
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
                            <div>
                                <label className="block text-[10px] text-[#FFC038]/70 mb-1">TopStep X API Key</label>
                                <input 
                                    type="password" 
                                    value={settings.topstepXApiKey} 
                                    onChange={e => updateSettings({ topstepXApiKey: e.target.value })}
                                    className="w-full bg-black border border-[#FFC038]/30 rounded px-3 py-2 text-[#FFC038] text-xs font-mono focus:border-[#FFC038] outline-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Trading Models */}
                    <section>
                        <h3 className="text-xs font-bold text-[#FFC038]/50 uppercase border-b border-[#FFC038]/20 pb-2 mb-4">Algo Models</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(settings.tradingModels).map(([key, val]) => (
                                <div key={key} className="flex items-center justify-between p-3 bg-[#140a00] rounded border border-[#FFC038]/10">
                                    <span className="text-xs text-[#FFC038] capitalize">{key.replace(/([A-Z])/g, ' $1').replace('Twenty Two', '22')}</span>
                                    <Toggle 
                                        checked={val} 
                                        onChange={() => updateSettings({ 
                                            tradingModels: { ...settings.tradingModels, [key]: !val } 
                                        })} 
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
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
                        <br/>
                        We cannot guarantee financial accuracy or reliability of added instructions.
                        <br/><br/>
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
    const [following, setFollowing] = useState<string[]>(["Walter Bloomberg", "ZeroHedge", "FinancialJuice", "DeltaOne"]);
    
    // Psych State (Lifted for Agent Context)
    const [psychState, setPsychState] = useState<{score: number, state: EmotionalState, tiltCount: number}>({
        score: 5.0,
        state: 'stable',
        tiltCount: 0
    });

    // Calculate IV helper
    const calculateIV = (text: string): IVData => {
        // Pseudo-random IV calculation based on text hash to simulate analysis
        const sum = text.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        // Value between -2.5 and +2.5
        const value = (sum % 500) / 100 - 2.5; 
        const type = value >= 0 ? 'cyclical' : 'countercyclical';
        return { type, value };
    };

    // Live Feed Fetcher with Fallback
    useEffect(() => {
        const fetchFeed = async () => {
            const usingMock = !settings.xBearerToken;
            let newRawItems = [];

            if (usingMock) {
                // Simulate network latency then return mock
                await new Promise(r => setTimeout(r, 500));
                // Randomly pick a mock item
                const mockItem = MOCK_WIRE_DATA[Math.floor(Math.random() * MOCK_WIRE_DATA.length)];
                newRawItems = [{
                    id: Date.now(),
                    created_at: new Date().toISOString(),
                    text: mockItem.text,
                    source: mockItem.source
                }];
            } else {
                try {
                     // Simple search query for demonstration
                     const query = following.map(u => `from:${u.replace(/\s/g, '')}`).join(' OR ');
                     const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&tweet.fields=created_at&max_results=10`, {
                         headers: { 'Authorization': `Bearer ${settings.xBearerToken}` }
                     });
                     
                     if (!res.ok) throw new Error("API Failure");
                     
                     const data = await res.json();
                     if (data.data && Array.isArray(data.data)) {
                         newRawItems = data.data;
                     }
                } catch (e) {
                     // Fallback to Mock on error to prevent UI crash
                     console.warn("Feed Uplink Failed, switching to simulation.");
                     const mockItem = MOCK_WIRE_DATA[Math.floor(Math.random() * MOCK_WIRE_DATA.length)];
                     newRawItems = [{
                        id: Date.now(),
                        created_at: new Date().toISOString(),
                        text: mockItem.text + " [SIMULATED]",
                        source: mockItem.source
                    }];
                }
            }

            // Process Items
            const newItems: FeedItem[] = newRawItems.map((t: any) => {
                 const iv = calculateIV(t.text);
                 return {
                     id: Number(t.id),
                     time: new Date(t.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }) + " EST",
                     text: t.text,
                     type: 'info',
                     source: t.source || 'X',
                     iv: iv
                 };
            });
             
            // Avoid duplicates and update state
            setFeedItems(prev => {
                 const existingIds = new Set(prev.map(i => i.id));
                 const filtered = newItems.filter(i => !existingIds.has(i.id));
                 return [...filtered, ...prev].slice(0, 50);
            });

            setNewsItems(prev => {
                 const existingIds = new Set(prev.map(i => i.id));
                 const filtered = newItems.filter(i => !existingIds.has(i.id));
                 return [...filtered, ...prev].slice(0, 50);
            });
        };

        fetchFeed(); // Initial fetch
        const interval = setInterval(fetchFeed, 15000); // Poll every 15s for more activity
        
        return () => clearInterval(interval);
    }, [settings.xBearerToken, following]);

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

    const toggleFollow = (source: string) => {
        setFollowing(prev => prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]);
    };
    
    const handlePsychUpdate = (score: number, state: EmotionalState, tiltCount: number) => {
        setPsychState({ score, state, tiltCount });
    };

    const getTierLabel = () => {
        switch(user.tier) {
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
                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
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
                        <MissionControl onPsychStateUpdate={handlePsychUpdate} />
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
                                    <FeedSection title="SYSTEM FEED" items={feedItems} />
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
                                        following={following} 
                                        onToggleFollow={toggleFollow} 
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