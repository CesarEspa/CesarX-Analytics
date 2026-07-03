// Tipos espejo de los DTOs del backend Spring Boot.

export interface AuthResponse {
  token: string;
  tokenType: string;
  username: string;
  role: string;
  expiresInMs: number;
}

export interface EtfResponse {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  exchange: string | null;
  currency: string;
}

export type RecommendationSignal = 'BUY' | 'HOLD' | 'WAIT';

export interface PriceQuote {
  symbol: string;
  currentPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string | null;
  marketState: string | null;
  asOf: string;
  signal: RecommendationSignal;
  signalReason: string;
}

export interface PriceHistoryPoint {
  date: string; // yyyy-MM-dd
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export interface PriceHistoryResponse {
  symbol: string;
  range: string;
  points: PriceHistoryPoint[];
}

export interface PortfolioPosition {
  id: number;
  symbol: string;
  etfName: string;
  quantity: number;
  avgBuyPrice: number;
  purchaseDate: string;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  positions: PortfolioPosition[];
}

export interface PortfolioPositionRequest {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  purchaseDate: string;
}

export type AlertType = 'PRICE_ABOVE' | 'PRICE_BELOW' | 'PERCENT_CHANGE_UP' | 'PERCENT_CHANGE_DOWN';

export interface AlertItem {
  id: number;
  symbol: string;
  alertType: AlertType;
  targetValue: number;
  active: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

export interface AlertRequest {
  symbol: string;
  alertType: AlertType;
  targetValue: number;
}

export interface LightQuote {
  symbol: string;
  currentPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  asOf: string;
}

export interface Prediction {
  symbol: string;
  horizon_days: number;
  current_price: number;
  predicted_price: number;
  predicted_return_pct: number;
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  model: string;
  holdout_r2: number;
  trained_samples: number;
  as_of: string;
}

export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface NewsArticle {
  title: string;
  description: string;
  source: string;
  url: string;
  published_at: string;
  sentiment: Sentiment;
  reason: string;
}

export interface NewsAnalysis {
  symbol: string;
  overall_sentiment: Sentiment;
  outlook: string;
  articles: NewsArticle[];
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  details: string[] | null;
}
