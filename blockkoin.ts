/**
 * Blockkoin Freedom Tag - Crypto Exchange Integration
 * 
 * Features:
 * - Auto-create Blockkoin accounts on Freedom Tag signup
 * - Link existing Blockkoin accounts
 * - Support all Blockkoin cryptocurrencies (USDT, BTC, ETH, etc.)
 * - Auto-convert crypto to fiat based on user preferences
 * - $50 transaction limit (under = frictionless, over = KYC required)
 */

interface BlockkoinConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}

interface BlockkoinAccount {
  id: string;
  email: string;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  wallets: {
    currency: string;
    address: string;
    balance: number;
  }[];
}

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

interface CryptoPayment {
  id: string;
  amount: number;
  currency: string;
  targetCurrency?: string; // For auto-conversion
  address: string;
  status: 'pending' | 'completed' | 'failed';
  autoConvert?: boolean;
}

export class BlockkoinClient {
  private config: BlockkoinConfig;
  private demoMode: boolean;

  constructor() {
    const apiKey = process.env.BLOCKKOIN_API_KEY;
    const apiSecret = process.env.BLOCKKOIN_API_SECRET;
    
    this.demoMode = !apiKey || !apiSecret;
    
    this.config = {
      apiKey: apiKey || 'demo_key',
      apiSecret: apiSecret || 'demo_secret',
      baseUrl: 'https://api.blockkoin.com/v1', // Update with actual Blockkoin API URL
    };

    if (this.demoMode) {
      console.log('[Blockkoin DEMO API] Running in DEMO mode - using simulated API calls for development');
    }
  }

  /**
   * Create a Blockkoin account automatically when user signs up for Freedom Tag
   */
  async createAccount(email: string, fullName: string, country?: string): Promise<BlockkoinAccount> {
    if (this.demoMode) {
      // Demo mode simulation
      return {
        id: `bk_${Math.random().toString(36).substring(7)}`,
        email,
        kycStatus: 'none',
        wallets: [
          { currency: 'USDT', address: `usdt_${Math.random().toString(36).substring(7)}`, balance: 0 },
          { currency: 'BTC', address: `btc_${Math.random().toString(36).substring(7)}`, balance: 0 },
          { currency: 'ETH', address: `eth_${Math.random().toString(36).substring(7)}`, balance: 0 },
        ],
      };
    }

    // Real API call
    const response = await fetch(`${this.config.baseUrl}/accounts/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Secret': this.config.apiSecret,
      },
      body: JSON.stringify({
        email,
        fullName,
        country,
        source: 'freedom_tag',
      }),
    });

    if (!response.ok) {
      throw new Error(`Blockkoin account creation failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Check if user already has a Blockkoin account and link it
   */
  async findExistingAccount(email: string): Promise<BlockkoinAccount | null> {
    if (this.demoMode) {
      // In demo mode, pretend no existing account
      return null;
    }

    const response = await fetch(`${this.config.baseUrl}/accounts/find?email=${encodeURIComponent(email)}`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-API-Secret': this.config.apiSecret,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Blockkoin account lookup failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get real-time exchange rates for all supported cryptocurrencies
   */
  async getExchangeRates(targetCurrency: string = 'ZAR'): Promise<ExchangeRate[]> {
    if (this.demoMode) {
      // Demo rates (in cents)
      if (targetCurrency === 'USD') {
        // Crypto to USD rates (cents)
        return [
          { from: 'USDT', to: 'USD', rate: 100, timestamp: Date.now() }, // 1 USDT = $1.00
          { from: 'BTC', to: 'USD', rate: 6500000, timestamp: Date.now() }, // 1 BTC = $65,000
          { from: 'ETH', to: 'USD', rate: 300000, timestamp: Date.now() }, // 1 ETH = $3,000
          { from: 'USDC', to: 'USD', rate: 100, timestamp: Date.now() }, // 1 USDC = $1.00
          { from: 'DAI', to: 'USD', rate: 100, timestamp: Date.now() }, // 1 DAI = $1.00
        ];
      }
      
      // Crypto to ZAR rates (cents) - default
      return [
        { from: 'USDT', to: targetCurrency, rate: 1850, timestamp: Date.now() }, // 1 USDT = R18.50
        { from: 'BTC', to: targetCurrency, rate: 120000000, timestamp: Date.now() }, // 1 BTC = R1,200,000
        { from: 'ETH', to: targetCurrency, rate: 5500000, timestamp: Date.now() }, // 1 ETH = R55,000
        { from: 'USDC', to: targetCurrency, rate: 1850, timestamp: Date.now() },
        { from: 'DAI', to: targetCurrency, rate: 1850, timestamp: Date.now() },
      ];
    }

    const response = await fetch(`${this.config.baseUrl}/exchange/rates?target=${targetCurrency}`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create a crypto payment with optional auto-conversion
   */
  async createPayment(params: {
    amount: number;
    currency: string;
    toAddress: string;
    autoConvert?: boolean;
    targetCurrency?: string;
  }): Promise<CryptoPayment> {
    if (this.demoMode) {
      return {
        id: `pay_${Math.random().toString(36).substring(7)}`,
        amount: params.amount,
        currency: params.currency,
        targetCurrency: params.targetCurrency,
        address: params.toAddress,
        status: 'pending',
        autoConvert: params.autoConvert,
      };
    }

    const response = await fetch(`${this.config.baseUrl}/payments/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Secret': this.config.apiSecret,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Payment creation failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Initiate KYC verification for transactions over $50
   */
  async initiateKYC(accountId: string, userId: string): Promise<{ kycUrl: string; status: string }> {
    if (this.demoMode) {
      return {
        kycUrl: `/demo-verification?accountId=${accountId}`,
        status: 'pending',
      };
    }

    const response = await fetch(`${this.config.baseUrl}/kyc/initiate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Secret': this.config.apiSecret,
      },
      body: JSON.stringify({
        accountId,
        userId,
        source: 'freedom_tag',
      }),
    });

    if (!response.ok) {
      throw new Error(`KYC initiation failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Check KYC status for an account
   */
  async checkKYCStatus(accountId: string): Promise<'none' | 'pending' | 'verified' | 'rejected'> {
    if (this.demoMode) {
      return 'none';
    }

    const response = await fetch(`${this.config.baseUrl}/kyc/status/${accountId}`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-API-Secret': this.config.apiSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`KYC status check failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.status;
  }

  /**
   * Get supported cryptocurrencies from Blockkoin
   */
  async getSupportedCurrencies(): Promise<string[]> {
    if (this.demoMode) {
      return ['USDT', 'BTC', 'ETH', 'USDC', 'DAI', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE'];
    }

    const response = await fetch(`${this.config.baseUrl}/currencies`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch currencies: ${response.statusText}`);
    }

    const data = await response.json();
    return data.currencies;
  }

  /**
   * Check if transaction requires KYC based on $50 threshold
   */
  requiresKYC(amountUSD: number, kycStatus: string): boolean {
    return amountUSD > 50 && kycStatus !== 'verified';
  }

  /**
   * Buy cryptocurrency (convert fiat to crypto)
   */
  async buyCrypto(params: {
    accountId: string;
    amount: number; // Amount in cents (fiat)
    currency: string; // Target crypto currency (e.g., 'USDT')
    fiatCurrency: string; // Source fiat currency (e.g., 'ZAR')
  }): Promise<{ transactionId: string; cryptoAmount: number; fee: number; blockchainHash?: string }> {
    if (this.demoMode) {
      // Demo mode simulation
      const rates = await this.getExchangeRates(params.fiatCurrency);
      const rate = rates.find(r => r.from === params.currency)?.rate || 1850; // Default USDT rate
      const cryptoAmount = Math.floor((params.amount / rate) * 100000000) / 100000000; // 8 decimal precision
      const fee = Math.floor(params.amount * 0.01); // 1% fee
      
      return {
        transactionId: `buy_${Math.random().toString(36).substring(7)}`,
        cryptoAmount,
        fee,
        blockchainHash: `0x${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      };
    }

    const response = await fetch(`${this.config.baseUrl}/exchange/buy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Secret': this.config.apiSecret,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Crypto buy failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Sell cryptocurrency (convert crypto to fiat)
   */
  async sellCrypto(params: {
    accountId: string;
    cryptoAmount: number; // Amount of crypto to sell
    currency: string; // Source crypto currency (e.g., 'USDT')
    fiatCurrency: string; // Target fiat currency (e.g., 'ZAR')
  }): Promise<{ transactionId: string; fiatAmount: number; fee: number; blockchainHash?: string }> {
    if (this.demoMode) {
      // Demo mode simulation
      const rates = await this.getExchangeRates(params.fiatCurrency);
      const rate = rates.find(r => r.from === params.currency)?.rate || 1850; // Default USDT rate
      const grossFiatAmount = Math.floor(params.cryptoAmount * rate); // Gross amount (before fees)
      const fee = Math.floor(grossFiatAmount * 0.01); // 1% fee on gross
      
      return {
        transactionId: `sell_${Math.random().toString(36).substring(7)}`,
        fiatAmount: grossFiatAmount, // Return GROSS amount (endpoint will calculate net)
        fee,
        blockchainHash: `0x${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      };
    }

    const response = await fetch(`${this.config.baseUrl}/exchange/sell`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Secret': this.config.apiSecret,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Crypto sell failed: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Singleton instance
export const blockkoinClient = new BlockkoinClient();
