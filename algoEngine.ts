
export interface Bar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface AlgoState {
    isThinking: boolean;
    lastThought: string;
    confluenceScore: number;
    activeTrade: boolean;
    tradesTaken: number;
    currentBar: Bar | null;
    bars: Bar[];
    ema20: number | null;
    ema100: number | null;
    esMomentum: 'bullish' | 'bearish' | 'neutral';
}

export class AlgoEngine {
    private tickCount: number = 0;
    private readonly TICK_BAR_SIZE = 1000;
    private bars: Bar[] = [];
    private currentBar: Bar | null = null;

    private ema20: number | null = null;
    private ema100: number | null = null;

    // ES Confluence Tracking
    private esPrices: number[] = [];
    private esEma20: number | null = null;

    private tradesTaken: number = 0;
    private readonly MAX_TRADES = 3;

    private onUpdate: (state: AlgoState) => void;
    private onSignal: (side: 'buy' | 'sell', reason: string) => void;

    constructor(
        onUpdate: (state: AlgoState) => void,
        onSignal: (side: 'buy' | 'sell', reason: string) => void
    ) {
        this.onUpdate = onUpdate;
        this.onSignal = onSignal;
    }

    public processTrade(price: number, volume: number) {
        this.updateBar(price, volume);
        this.checkSignal(price);
        this.broadcastState();
    }

    public processESQuote(price: number) {
        // Simple ES Momentum: Is price above its own 20-period moving average?
        // We'll keep a small buffer of ES prices to calc a rough EMA
        this.esPrices.push(price);
        if (this.esPrices.length > 200) this.esPrices.shift(); // Keep it manageable

        if (this.esPrices.length >= 20) {
            const sum = this.esPrices.slice(-20).reduce((a, b) => a + b, 0);
            this.esEma20 = sum / 20; // Simple MA for now as proxy, or implement EMA
        }
    }

    private updateBar(price: number, volume: number) {
        if (!this.currentBar) {
            this.currentBar = {
                time: Date.now(),
                open: price,
                high: price,
                low: price,
                close: price,
                volume: 0
            };
        }

        // Update High/Low
        this.currentBar.high = Math.max(this.currentBar.high, price);
        this.currentBar.low = Math.min(this.currentBar.low, price);
        this.currentBar.close = price;
        this.currentBar.volume += volume;
        this.tickCount += 1; // Count trades as ticks (simplified)

        // Close Bar?
        if (this.tickCount >= this.TICK_BAR_SIZE) {
            this.closeBar();
        }
    }

    private closeBar() {
        if (!this.currentBar) return;

        this.bars.push(this.currentBar);
        this.updateIndicators(this.currentBar.close);

        // Reset
        this.currentBar = null;
        this.tickCount = 0;
    }

    private updateIndicators(close: number) {
        // EMA Calculation
        // Multiplier: 2 / (N + 1)
        const k20 = 2 / (20 + 1);
        const k100 = 2 / (100 + 1);

        if (this.ema20 === null) {
            this.ema20 = close;
        } else {
            this.ema20 = (close - this.ema20) * k20 + this.ema20;
        }

        if (this.ema100 === null) {
            this.ema100 = close;
        } else {
            this.ema100 = (close - this.ema100) * k100 + this.ema100;
        }
    }

    private checkSignal(currentPrice: number) {
        if (this.tradesTaken >= this.MAX_TRADES) return;
        if (!this.ema20 || !this.ema100) return;

        // Time Window Check (8:30 - 11:30 EST)
        // Assuming server time is roughly aligned or we use local time
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeValue = hour + minute / 60;

        // 8:30 = 8.5, 11:30 = 11.5
        if (timeValue < 8.5 || timeValue > 11.5) return;

        // Logic: 20 EMA Cross 100 EMA
        // We need to detect the *crossover* event, not just the state
        // So we look at the previous bar's relationship vs current

        const isBullishCross = this.ema20 > this.ema100; // Simplified state check for now

        // Confluence: ES
        const isESBullish = this.esEma20 ? (this.esPrices[this.esPrices.length - 1] > this.esEma20) : true;

        // Retest Logic (Simplified):
        // If we are in a bullish trend (20 > 100) AND price dips near 20 EMA
        const distToEma20 = Math.abs(currentPrice - this.ema20);
        const isRetest = distToEma20 < (currentPrice * 0.0001); // Within 0.01%

        if (isBullishCross && isESBullish && isRetest) {
            // Trigger Buy
            // Debounce needed in real prod
            // this.onSignal('buy', "20/100 EMA Cross + ES Confluence + Retest");
        }
    }

    private broadcastState() {
        this.onUpdate({
            isThinking: true,
            lastThought: `Tracking ${this.tickCount}/1000 Ticks. EMA20: ${this.ema20?.toFixed(2)}`,
            confluenceScore: this.esEma20 ? 85 : 50,
            activeTrade: false,
            tradesTaken: this.tradesTaken,
            currentBar: this.currentBar,
            bars: this.bars,
            ema20: this.ema20,
            ema100: this.ema100,
            esMomentum: 'neutral'
        });
    }
}
