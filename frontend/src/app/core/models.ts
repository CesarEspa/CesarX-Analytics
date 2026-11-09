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
  timestamp: number; // epoch seconds (needed for intraday candles)
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

export type HorizonKey = '1w' | '15d' | '1m' | '6m' | '1y';

export interface ExplanationReason {
  source: string;
  effect: 'up' | 'down' | 'neutral';
  text: string;
}

export interface ForecastExplanation {
  headline: string;
  reasons: ExplanationReason[];
  caveat: string;
}

export interface Prediction {
  symbol: string;
  horizon: HorizonKey;
  horizon_label: string;
  horizon_sessions: number;
  horizon_days: number;
  current_price: number;
  predicted_price: number;
  predicted_return_pct: number;
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  model: string;
  best_candidate: string;
  holdout_r2: number;
  trained_samples: number;
  prob_up_pct: number;
  interval: {
    level: number;
    low_price: number;
    high_price: number;
    low_return_pct: number;
    high_return_pct: number;
  };
  validation: {
    method: string;
    holdout_rows: number;
    independent_periods: number;
    enough_periods: boolean;
    beats_baseline: boolean;
    reliable: boolean;
    interval_coverage_pct: number | null;
    baseline_directional_accuracy_pct: number;
  };
  candidates: ModelCandidate[];
  top_factors: { feature: string; label: string; weight_pct: number }[];
  history: HistoryReading;
  forecast_path: ForecastPoint[];
  explanation: ForecastExplanation;
  as_of: string;
}

export interface ModelCandidate {
  name: string;
  r2_oos: number;
  mae_pct: number;
  directional_accuracy_pct: number;
  selected: boolean;
}

export interface ForecastPoint {
  date: string;
  timestamp: number;
  expected: number;
  low: number;
  high: number;
}

export interface HistoryReading {
  trend: 'bullish' | 'bearish' | 'mixed';
  summary: string;
  return_1m_pct: number | null;
  return_3m_pct: number | null;
  return_6m_pct: number | null;
  return_1y_pct: number | null;
  volatility_pct: number;
  typical_volatility_pct: number;
  drawdown_pct: number;
  high_52w: number;
  low_52w: number;
  sma50: number;
  sma200: number;
  rsi: number;
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
  analysis_method: 'claude' | 'keywords' | 'none' | 'demo';
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
