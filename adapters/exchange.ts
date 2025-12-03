/**
 * Exchange Adapter for Blockkoin Exchange API
 * Handles conversion of fiat/crypto to USDT
 */

export interface ConversionQuote {
  usdtAmount: string; // USDT amount (numeric string for precision)
  fxRate: string; // Exchange rate
  fee: string; // Fee in USDT
  tradeId?: string; // Trade identifier
  expiresAt: number; // Unix timestamp when quote expires
}

export interface ConversionResult {
  usdtAmount: string;
  fxRate: string;
  fee: string;
  tradeId: string; // Required after execution
  executedAt: number; // Unix timestamp
  sourceAmount: string;
  sourceCurrency: string;
}

export interface ExchangeConfig {
  apiBase: string;
  apiKey: string;
  apiSecret?: string;
}

export class ExchangeAdapter {
  private config: ExchangeConfig;

  constructor(config: ExchangeConfig) {
    this.config = config;
  }

  /**
   * Get a conversion quote for fiat/crypto → USDT
   */
  async getConversionQuote(
    amount: string,
    currency: string
  ): Promise<ConversionQuote> {
    try {
      const response = await fetch(
        `${this.config.apiBase}/v1/convert/quote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
          },
          body: JSON.stringify({
            fromCurrency: currency.toUpperCase(),
            toCurrency: 'USDT',
            amount,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Exchange API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        usdtAmount: data.toAmount || '0',
        fxRate: data.rate || '0',
        fee: data.fee || '0',
        tradeId: data.quoteId,
        expiresAt: data.expiresAt || Date.now() + 30000, // 30s default
      };
    } catch (error) {
      console.error('Exchange quote error:', error);
      throw new Error('Failed to get conversion quote');
    }
  }

  /**
   * Execute conversion: fiat/crypto → USDT
   */
  async convertToUSDT(
    amount: string,
    currency: string,
    quoteId?: string
  ): Promise<ConversionResult> {
    try {
      const response = await fetch(
        `${this.config.apiBase}/v1/convert/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
          },
          body: JSON.stringify({
            fromCurrency: currency.toUpperCase(),
            toCurrency: 'USDT',
            amount,
            quoteId, // Optional: use existing quote
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Exchange execution error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        usdtAmount: data.toAmount || '0',
        fxRate: data.rate || '0',
        fee: data.fee || '0',
        tradeId: data.tradeId || data.id,
        executedAt: data.executedAt || Date.now(),
        sourceAmount: amount,
        sourceCurrency: currency.toUpperCase(),
      };
    } catch (error) {
      console.error('Exchange conversion error:', error);
      throw error;
    }
  }

  /**
   * Sell USDT for fiat (for charity payouts)
   */
  async sellUSDTForFiat(
    usdtAmount: string,
    targetCurrency: string
  ): Promise<ConversionResult> {
    try {
      const response = await fetch(
        `${this.config.apiBase}/v1/convert/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
          },
          body: JSON.stringify({
            fromCurrency: 'USDT',
            toCurrency: targetCurrency.toUpperCase(),
            amount: usdtAmount,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Exchange sell error: ${response.status}`);
      }

      const data = await response.json();

      return {
        usdtAmount: usdtAmount,
        fxRate: data.rate || '0',
        fee: data.fee || '0',
        tradeId: data.tradeId || data.id,
        executedAt: data.executedAt || Date.now(),
        sourceAmount: usdtAmount,
        sourceCurrency: 'USDT',
      };
    } catch (error) {
      console.error('Exchange sell error:', error);
      throw error;
    }
  }

  /**
   * Get supported currencies for conversion
   */
  async getSupportedCurrencies(): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.config.apiBase}/v1/currencies`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch currencies: ${response.status}`);
      }

      const data = await response.json();
      return data.currencies || [];
    } catch (error) {
      console.error('Failed to get supported currencies:', error);
      return ['USDT', 'BTC', 'ETH', 'ZAR', 'USD', 'EUR', 'GBP']; // Fallback
    }
  }
}

/**
 * Demo Exchange Adapter for testing without API credentials
 */
export class DemoExchangeAdapter {
  // Mock exchange rates
  private rates: Record<string, number> = {
    'ZAR': 0.053, // ZAR to USD
    'USD': 1.0,
    'EUR': 1.08,
    'GBP': 1.27,
    'BTC': 95000,
    'ETH': 3500,
    'USDT': 1.0,
  };

  async getConversionQuote(
    amount: string,
    currency: string
  ): Promise<ConversionQuote> {
    const rate = this.rates[currency.toUpperCase()] || 1;
    const amountNum = parseFloat(amount);
    const usdtAmount = (amountNum * rate).toFixed(6);
    const fee = (parseFloat(usdtAmount) * 0.001).toFixed(6); // 0.1% fee

    return {
      usdtAmount,
      fxRate: rate.toString(),
      fee,
      tradeId: `demo_quote_${Date.now()}`,
      expiresAt: Date.now() + 30000,
    };
  }

  async convertToUSDT(
    amount: string,
    currency: string,
    quoteId?: string
  ): Promise<ConversionResult> {
    const quote = await this.getConversionQuote(amount, currency);
    
    return {
      ...quote,
      tradeId: `demo_trade_${Date.now()}`,
      executedAt: Date.now(),
      sourceAmount: amount,
      sourceCurrency: currency.toUpperCase(),
    };
  }

  async sellUSDTForFiat(
    usdtAmount: string,
    targetCurrency: string
  ): Promise<ConversionResult> {
    const rate = this.rates[targetCurrency.toUpperCase()] || 1;
    const amountNum = parseFloat(usdtAmount);
    const fiatAmount = (amountNum / rate).toFixed(2);
    const fee = (parseFloat(usdtAmount) * 0.001).toFixed(6); // 0.1% fee

    return {
      usdtAmount,
      fxRate: (1 / rate).toString(),
      fee,
      tradeId: `demo_sell_${Date.now()}`,
      executedAt: Date.now(),
      sourceAmount: usdtAmount,
      sourceCurrency: 'USDT',
    };
  }

  async getSupportedCurrencies(): Promise<string[]> {
    return Object.keys(this.rates);
  }
}

/**
 * Factory function to create Exchange Adapter (real or demo)
 */
export function createExchangeAdapter(): ExchangeAdapter | DemoExchangeAdapter {
  const apiKey = process.env.BLOCKKOIN_EXCHANGE_API_KEY;
  const apiBase = process.env.EXCHANGE_API_BASE || 'https://api.blockkoin.exchange';

  if (!apiKey) {
    console.warn('[Exchange] No API key configured. Using DEMO mode with mock rates.');
    return new DemoExchangeAdapter();
  }

  return new ExchangeAdapter({
    apiBase,
    apiKey,
    apiSecret: process.env.BLOCKKOIN_EXCHANGE_API_SECRET,
  });
}
