
// Frequencies for SFX based on emotional state
const STABLE_TONES = [440, 523.25, 659.25, 783.99]; // A4, C5, E5, G5 (Major chord)
const NEUTRAL_TONES = [329.63, 392.00, 493.88, 587.33]; // E4, G4, B4, D5 (Em7)
const TILT_TONES = [110, 123.47, 130.81, 146.83]; // Low dissonance

const VOICE_LINES = {
    neutral: {
        calm: "Let's take a breath and refocus.",
        motivational: "Stay sharp. Opportunity is everywhere.",
        drill: "Focus up! Get your head in the game."
    },
    tilt: {
        calm: "I'm detecting some stress. Let's pause.",
        motivational: "Don't let emotions drive. Stick to the plan.",
        drill: "Lock in, trader. What are YOU doing?"
    },
    escalation: {
        calm: "Please step away from the terminal for a moment.",
        motivational: "Protect your capital. Walk away.",
        drill: "You are spiraling! Step away immediately! Session over!"
    }
};

type ToneType = 'sine' | 'square' | 'sawtooth' | 'triangle';
type VoiceStyle = 'calm' | 'motivational' | 'drill';
export type EmotionalState = 'stable' | 'neutral' | 'tilt';

export interface AlertConfig {
    enabled: boolean;
    voiceEnabled: boolean;
    escalationEnabled: boolean;
    toneType: ToneType;
    voiceStyle: VoiceStyle;
}

// Helper: Play a synthesized tone
export const playTone = (freq: number, type: ToneType, duration: number, vol: number = 0.1) => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
};

// Helper: Play deep bass tilt sound (can be called repeatedly)
export const playTiltBass = (toneType: ToneType = 'sine') => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Deep bass frequency with sawtooth for richness
    osc.type = toneType;
    osc.frequency.setValueAtTime(80, ctx.currentTime); // Very low bass
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.8);
};

// Helper: Play transition warning sound (stable → tilt)
export const playTransitionWarning = (toneType: ToneType = 'sine') => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();

    // Create a descending tone sequence for dramatic effect
    const frequencies = [440, 370, 294, 220]; // Descending A4 to A3
    const duration = 0.4; // Each tone

    frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = toneType;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + (i * duration * 0.7); // Overlap slightly
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    });
};

// Helper: Text to Speech
const speakAlert = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    // Cancel any current speech to prioritize the new alert
    window.speechSynthesis.cancel();

    const ut = new SpeechSynthesisUtterance(text);
    ut.rate = 1.1; // Slightly faster for urgency
    ut.pitch = 1.0;
    ut.volume = 1.0;
    window.speechSynthesis.speak(ut);
};

// Main Trigger Function
export const triggerEmotionalAlert = (
    state: EmotionalState,
    tiltCount: number,
    config: AlertConfig = { enabled: true, voiceEnabled: true, escalationEnabled: true, toneType: 'sine', voiceStyle: 'drill' }
) => {
    if (!config.enabled) return;

    // 1. Play SFX
    let pool = NEUTRAL_TONES;
    let vol = 0.1;

    if (state === 'stable') { pool = STABLE_TONES; }
    if (state === 'neutral') { pool = NEUTRAL_TONES; }
    if (state === 'tilt') { pool = TILT_TONES; vol = 0.25; }

    // Pick random tone from pool
    const freq = pool[Math.floor(Math.random() * pool.length)];
    playTone(freq, config.toneType, 1.5, vol);

    // 2. Voice Alert
    if (!config.voiceEnabled) return;

    let message = "";

    if (state === 'neutral') {
        message = VOICE_LINES.neutral[config.voiceStyle];
    } else if (state === 'tilt') {
        if (tiltCount >= 3 && config.escalationEnabled) {
            message = VOICE_LINES.escalation[config.voiceStyle];
        } else {
            message = VOICE_LINES.tilt[config.voiceStyle];
        }
    }

    // Only speak if there is a message (Stable has no voice alert by default)
    if (message) {
        // Slight delay for voice so it doesn't clash with tone onset
        setTimeout(() => speakAlert(message), 400);
    }
};
