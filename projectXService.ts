import { HubConnectionBuilder, HttpTransportType, HubConnection } from '@microsoft/signalr';

// --- Types ---
export interface ProjectXAuthResponse {
    token: string;
    success: boolean;
    errorCode: number;
    errorMessage: string | null;
}

export interface ProjectXAccount {
    id: number;
    name: string;
    balance: number;
    canTrade: boolean;
    isVisible: boolean;
    simulated: boolean;
}

export interface ProjectXAccountSearchResponse {
    accounts: ProjectXAccount[];
    success: boolean;
    errorCode: number;
    errorMessage: string | null;
}

// --- Service ---
export class ProjectXService {
    private static API_URL = 'https://api.topstepx.com';
    private static USER_HUB_URL = 'https://rtc.topstepx.com/hubs/user';
    private static connection: HubConnection | null = null;

    static async login(userName: string, apiKey: string): Promise<ProjectXAuthResponse> {
        try {
            const response = await fetch(`${this.API_URL}/api/Auth/loginKey`, {
                method: 'POST',
                headers: {
                    'accept': 'text/plain',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userName, apiKey })
            });

            if (!response.ok) {
                throw new Error(`Login failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error("ProjectX Login Error:", error);
            throw error;
        }
    }

    static async searchAccounts(token: string): Promise<ProjectXAccount[]> {
        try {
            const response = await fetch(`${this.API_URL}/api/Account/search`, {
                method: 'POST',
                headers: {
                    'accept': 'text/plain',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ onlyActiveAccounts: true })
            });

            if (!response.ok) {
                throw new Error(`Account search failed: ${response.statusText}`);
            }

            const data: ProjectXAccountSearchResponse = await response.json();
            if (data.success) {
                return data.accounts;
            } else {
                throw new Error(data.errorMessage || "Unknown error fetching accounts");
            }
        } catch (error) {
            console.error("ProjectX Account Search Error:", error);
            throw error;
        }
    }

    static async searchTrades(token: string, accountId: number, startTimestamp: string): Promise<any[]> {
        try {
            const response = await fetch(`${this.API_URL}/api/Trade/search`, {
                method: 'POST',
                headers: {
                    'accept': 'text/plain',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    accountId,
                    startTimestamp
                })
            });

            if (!response.ok) {
                throw new Error(`Trade search failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                return data.trades;
            } else {
                throw new Error(data.errorMessage || "Unknown error fetching trades");
            }
        } catch (error) {
            console.error("ProjectX Trade Search Error:", error);
            throw error;
        }
    }

    static async connectSignalR(
        token: string,
        accountId: number,
        onAccountUpdate: (data: any) => void,
        onTradeUpdate: (data: any) => void
    ): Promise<void> {
        if (this.connection) {
            await this.connection.stop();
        }

        this.connection = new HubConnectionBuilder()
            .withUrl(`${this.USER_HUB_URL}?access_token=${token}`, {
                skipNegotiation: true,
                transport: HttpTransportType.WebSockets,
                accessTokenFactory: () => token,
                timeout: 10000
            })
            .withAutomaticReconnect()
            .build();

        this.connection.on('GatewayUserAccount', (data) => {
            console.log('GatewayUserAccount', data);
            if (data.id === accountId) {
                onAccountUpdate(data);
            }
        });

        this.connection.on('GatewayUserTrade', (data) => {
            console.log('GatewayUserTrade', data);
            if (data.accountId === accountId) {
                onTradeUpdate(data);
            }
        });

        try {
            await this.connection.start();
            console.log("SignalR Connected");

            // Subscribe
            await this.connection.invoke('SubscribeAccounts');
            await this.connection.invoke('SubscribeTrades', accountId);
            // We can also subscribe to orders/positions if needed
            await this.connection.invoke('SubscribeOrders', accountId);
            await this.connection.invoke('SubscribePositions', accountId);

        } catch (err) {
            console.error('Error starting SignalR connection:', err);
            throw err;
        }
    }

    static async disconnectSignalR(accountId?: number) {
        if (this.connection) {
            if (accountId) {
                try {
                    await this.connection.invoke('UnsubscribeAccounts');
                    await this.connection.invoke('UnsubscribeTrades', accountId);
                    await this.connection.invoke('UnsubscribeOrders', accountId);
                    await this.connection.invoke('UnsubscribePositions', accountId);
                } catch (e) {
                    console.warn("Error unsubscribing:", e);
                }
            }
            await this.connection.stop();
            this.connection = null;
        }
    }
}
