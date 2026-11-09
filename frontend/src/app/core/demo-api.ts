import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { delay, of, throwError } from 'rxjs';
import {
  AlertItem,
  AlertRequest,
  EtfResponse,
  ForecastPoint,
  LightQuote,
  NewsAnalysis,
  PortfolioPosition,
  PortfolioPositionRequest,
  PortfolioSummary,
  HorizonKey,
  Prediction,
  PriceHistoryPoint,
  PriceHistoryResponse,
  PriceQuote,
  RecommendationSignal,
} from './models';

/**
 * Demo sin servidor: responde en el navegador los mismos contratos que el backend.
 * Todos los precios, noticias y predicciones son simulados y se generan con una
 * semilla por símbolo. Las posiciones y alertas se guardan en localStorage.
 */
export const DEMO_TOKEN = 'demo.local';
export const DEMO_USERNAME = 'Invitado';

const STORE_KEY = 'cesarx.demo.v1';
const TOKEN_KEY = 'cesarx.token';
const DAY_SECONDS = 86_400;
const SESSIONS = 1_300;

export function isDemoSession(): boolean {
  return localStorage.getItem(TOKEN_KEY) === DEMO_TOKEN;
}

export function resetDemoData(): void {
  localStorage.removeItem(STORE_KEY);
}

interface Seed extends EtfResponse {
  lastPrice: number;
}

const CATALOG: Seed[] = [
  ['VGT', 'Vanguard Information Technology ETF', 'Technology', 'NYSEARCA', 108],
  ['QQQ', 'Invesco QQQ Trust', 'Technology', 'NASDAQ', 656],
  ['VOO', 'Vanguard S&P 500 ETF', 'Broad Market', 'NYSEARCA', 676],
  ['NVDA', 'NVIDIA Corporation', 'Semiconductors', 'NASDAQ', 187],
  ['SPY', 'SPDR S&P 500 ETF Trust', 'Broad Market', 'NYSEARCA', 735],
  ['VTI', 'Vanguard Total Stock Market ETF', 'Broad Market', 'NYSEARCA', 362],
  ['DIA', 'SPDR Dow Jones Industrial Average', 'Broad Market', 'NYSEARCA', 512],
  ['IWM', 'iShares Russell 2000 ETF', 'Small Cap', 'NYSEARCA', 274],
  ['SMH', 'VanEck Semiconductor ETF', 'Semiconductors', 'NASDAQ', 464],
  ['GLD', 'SPDR Gold Shares', 'Commodities', 'NYSEARCA', 372],
].map(([symbol, name, sector, exchange, lastPrice], index) => ({
  id: index + 1,
  symbol: symbol as string,
  name: name as string,
  sector: sector as string,
  exchange: exchange as string,
  currency: 'USD',
  lastPrice: lastPrice as number,
}));

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isoDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

function lastSessionMidnight(): number {
  const day = Math.floor(Date.now() / 1000 / DAY_SECONDS) * DAY_SECONDS;
  const weekday = new Date(day * 1000).getUTCDay();
  if (weekday === 6) return day - DAY_SECONDS;
  if (weekday === 0) return day - 2 * DAY_SECONDS;
  return day;
}

/** Closes are built backwards so that every series ends on its catalog price. */
function makeBars(symbol: string, lastPrice: number, count: number, stepSeconds: number, end: number, volatility: number, drift: number): PriceHistoryPoint[] {
  const next = random(hash(`${symbol}:${stepSeconds}:${end}`));
  const volumeBase = 1_000_000 + (hash(symbol) % 40_000_000);
  const reversed: PriceHistoryPoint[] = [];
  let close = lastPrice;
  let timestamp = end;

  for (let i = 0; i < count; i++) {
    const move = (next() - 0.5 + (next() - 0.5)) * volatility;
    const open = close / (1 + move);
    const spread = Math.abs(move) * 0.5 + volatility * 0.2 * next();
    reversed.push({
      date: isoDate(timestamp),
      timestamp,
      open: round(open),
      high: round(Math.max(open, close) * (1 + spread)),
      low: round(Math.min(open, close) * (1 - spread)),
      close: round(close),
      volume: Math.round(volumeBase * (0.6 + next() * 0.9)),
    });
    close = open / (1 + drift);
    timestamp -= stepSeconds;
    if (stepSeconds === DAY_SECONDS) {
      const weekday = new Date(timestamp * 1000).getUTCDay();
      if (weekday === 6) timestamp -= DAY_SECONDS;
      if (weekday === 0) timestamp -= 2 * DAY_SECONDS;
    }
  }

  return reversed.reverse();
}

const dailyCache = new Map<string, PriceHistoryPoint[]>();

function daily(etf: Seed): PriceHistoryPoint[] {
  const end = lastSessionMidnight() + 20 * 3600;
  const key = `${etf.symbol}:${end}`;
  let bars = dailyCache.get(key);
  if (!bars) {
    bars = makeBars(etf.symbol, etf.lastPrice, SESSIONS, DAY_SECONDS, end, 0.024, 0.0006);
    dailyCache.set(key, bars);
  }
  return bars;
}

function weekly(bars: PriceHistoryPoint[]): PriceHistoryPoint[] {
  const result: PriceHistoryPoint[] = [];
  for (let end = bars.length; end > 0; end -= 5) {
    const week = bars.slice(Math.max(0, end - 5), end);
    result.unshift({
      date: week[week.length - 1].date,
      timestamp: week[week.length - 1].timestamp,
      open: week[0].open,
      high: Math.max(...week.map((b) => b.high ?? b.close)),
      low: Math.min(...week.map((b) => b.low ?? b.close)),
      close: week[week.length - 1].close,
      volume: week.reduce((sum, b) => sum + (b.volume ?? 0), 0),
    });
  }
  return result;
}

function history(etf: Seed, range: string): PriceHistoryPoint[] {
  const close = daily(etf)[SESSIONS - 1].close;
  const sessionClose = lastSessionMidnight() + 20 * 3600;
  switch (range) {
    case '1d':
      return makeBars(etf.symbol, close, 78, 300, sessionClose, 0.0028, 0);
    case '5d':
      return makeBars(etf.symbol, close, 130, 900, sessionClose, 0.0045, 0);
    case '1mo':
      return daily(etf).slice(-22);
    case '3mo':
      return daily(etf).slice(-63);
    case '6mo':
      return daily(etf).slice(-126);
    case '1y':
      return daily(etf).slice(-252);
    default:
      return weekly(daily(etf));
  }
}

function livePrice(etf: Seed): number {
  const close = daily(etf)[SESSIONS - 1].close;
  const phase = Date.now() / 45_000 + (hash(etf.symbol) % 100);
  return round(close * (1 + 0.0015 * Math.sin(phase) + 0.0007 * Math.sin(phase * 3.1)));
}

function lightQuote(etf: Seed): LightQuote {
  const currentPrice = livePrice(etf);
  const previousClose = daily(etf)[SESSIONS - 2].close;
  const change = round(currentPrice - previousClose);
  return {
    symbol: etf.symbol,
    currentPrice,
    previousClose,
    change,
    changePercent: round((change / previousClose) * 100),
    asOf: new Date().toISOString(),
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Same SMA5 / SMA20 rule as MarketDataService in the backend. */
function signalFor(bars: PriceHistoryPoint[]): { signal: RecommendationSignal; signalReason: string } {
  const closes = bars.slice(-20).map((b) => b.close);
  const sma20 = average(closes);
  const sma5 = average(closes.slice(-5));
  if (sma5 > sma20 * 1.01) {
    return { signal: 'BUY', signalReason: 'La media de 5 días está por encima de la de 20 días (tendencia alcista de corto plazo)' };
  }
  if (sma5 < sma20 * 0.99) {
    return { signal: 'WAIT', signalReason: 'La media de 5 días está por debajo de la de 20 días (tendencia bajista de corto plazo)' };
  }
  return { signal: 'HOLD', signalReason: 'El precio consolida cerca de su media de 20 días' };
}

function quote(etf: Seed): PriceQuote {
  const light = lightQuote(etf);
  const today = daily(etf)[SESSIONS - 1];
  return {
    ...light,
    dayHigh: Math.max(today.high ?? today.close, light.currentPrice ?? 0),
    dayLow: Math.min(today.low ?? today.close, light.currentPrice ?? Infinity),
    volume: today.volume,
    currency: 'USD',
    marketState: 'REGULAR',
    ...signalFor(daily(etf)),
  };
}

const DEMO_HORIZONS: Record<HorizonKey, { sessions: number; days: number; label: string }> = {
  '1w': { sessions: 5, days: 7, label: '1 semana' },
  '15d': { sessions: 10, days: 15, label: '15 días' },
  '1m': { sessions: 21, days: 30, label: '1 mes' },
  '6m': { sessions: 126, days: 182, label: '6 meses' },
  '1y': { sessions: 252, days: 365, label: '1 año' },
};

function prediction(etf: Seed, horizon: HorizonKey): Prediction {
  const plan = DEMO_HORIZONS[horizon];
  const HORIZON = plan.sessions;
  const enoughPeriods = HORIZON < 63;
  const h = hash(`prediction:${etf.symbol}`);
  const returnPct = round(((h % 500) / 100 - 1.8) * (HORIZON / 5) ** 0.75);
  const bars = daily(etf);
  const current = bars[SESSIONS - 1].close;
  const margin = Math.sqrt(HORIZON / 5);
  const low = round(returnPct - 3.6 * margin);
  const high = round(returnPct + 3 * margin);
  const r2 = round((h % 8) / 100);

  const change = (days: number) => round((current / bars[SESSIONS - 1 - days].close - 1) * 100);
  const closes = bars.map((b) => b.close);
  const sma50 = round(average(closes.slice(-50)));
  const sma200 = round(average(closes.slice(-200)));
  const year = closes.slice(-252);
  const high52 = Math.max(...year);
  const trend = current > sma50 && sma50 > sma200 ? 'bullish' : current < sma50 && sma50 < sma200 ? 'bearish' : 'mixed';
  const trendText = { bullish: 'alcista', bearish: 'bajista', mixed: 'mixta' }[trend];

  const lastTimestamp = bars[SESSIONS - 1].timestamp;
  const forecast_path: ForecastPoint[] = [];
  let timestamp = lastTimestamp;
  for (let step = 1; step <= HORIZON; step++) {
    timestamp += DAY_SECONDS;
    while ([0, 6].includes(new Date(timestamp * 1000).getUTCDay())) timestamp += DAY_SECONDS;
    const fraction = step / HORIZON;
    const root = Math.sqrt(fraction);
    forecast_path.push({
      date: isoDate(timestamp),
      timestamp,
      expected: round(current * (1 + (returnPct / 100) * fraction)),
      low: round(current * (1 + (returnPct / 100) * fraction + ((low - returnPct) / 100) * root)),
      high: round(current * (1 + (returnPct / 100) * fraction + ((high - returnPct) / 100) * root)),
    });
  }

  return {
    symbol: etf.symbol,
    horizon,
    horizon_label: plan.label,
    horizon_sessions: HORIZON,
    horizon_days: plan.days,
    current_price: current,
    predicted_price: forecast_path[HORIZON - 1].expected,
    predicted_return_pct: returnPct,
    direction: returnPct > margin ? 'UP' : returnPct < -margin ? 'DOWN' : 'SIDEWAYS',
    confidence: 'LOW',
    model: 'Simulado',
    best_candidate: 'Simulado',
    holdout_r2: r2,
    trained_samples: SESSIONS,
    prob_up_pct: Math.min(85, Math.max(20, 58 + returnPct * 3)),
    interval: {
      level: 80,
      low_price: forecast_path[HORIZON - 1].low,
      high_price: forecast_path[HORIZON - 1].high,
      low_return_pct: low,
      high_return_pct: high,
    },
    validation: {
      method: 'Valores simulados del modo demo',
      holdout_rows: 500,
      independent_periods: Math.floor(500 / HORIZON),
      enough_periods: enoughPeriods,
      beats_baseline: r2 > 0,
      reliable: false,
      interval_coverage_pct: enoughPeriods ? 80 : null,
      baseline_directional_accuracy_pct: 60,
    },
    candidates: [
      { name: 'Media histórica', r2_oos: 0, mae_pct: 2.1, directional_accuracy_pct: 60, selected: false },
      { name: 'Simulado', r2_oos: r2, mae_pct: 2, directional_accuracy_pct: 61, selected: true },
    ],
    top_factors: [
      { feature: 'dist_sma200', label: 'Distancia a la media de 200 días', weight_pct: 34 },
      { feature: 'volatility_21', label: 'Volatilidad de 1 mes', weight_pct: 26 },
    ],
    history: {
      trend,
      summary: `Datos simulados. Tendencia ${trendText} frente a las medias de 50 y 200 días.`,
      return_1m_pct: change(21),
      return_3m_pct: change(63),
      return_6m_pct: change(126),
      return_1y_pct: change(252),
      volatility_pct: 24,
      typical_volatility_pct: 22,
      drawdown_pct: round((current / high52 - 1) * 100),
      high_52w: round(high52),
      low_52w: round(Math.min(...year)),
      sma50,
      sma200,
      rsi: 52,
    },
    forecast_path,
    explanation: {
      headline: `Ejemplo a ${plan.label}: de ${current.toFixed(2)} a ${forecast_path[HORIZON - 1].expected.toFixed(2)}, con cifras simuladas.`,
      reasons: [
        { source: 'Modelo', effect: returnPct >= 0 ? 'up' : 'down', text: `Texto de ejemplo: con una cuenta real, aquí se indica qué modelo se usó para ${plan.label} y si superó al promedio histórico.` },
        { source: 'Historial', effect: 'up', text: 'Texto de ejemplo: con una cuenta real, aquí aparece cuántas veces subió el activo en ventanas de este mismo plazo.' },
        { source: 'Gráfica', effect: trend === 'bullish' ? 'up' : trend === 'bearish' ? 'down' : 'neutral', text: `Datos simulados. Tendencia ${trendText} frente a las medias de 50 y 200 días.` },
        { source: 'Noticias', effect: 'neutral', text: 'Texto de ejemplo: con una cuenta real, aquí se citan los titulares del día y su tono.' },
      ],
      caveat: 'Datos simulados del modo demo. Ningún método puede dar el precio exacto. No es asesoría financiera.',
    },
    as_of: new Date().toISOString(),
  };
}

function news(etf: Seed): NewsAnalysis {
  const now = Date.now();
  const article = (index: number, sentiment: 'positive' | 'negative' | 'neutral', title: string, reason: string) => ({
    title: `Ejemplo: ${title}`,
    description: 'Titular de ejemplo generado para la demo.',
    source: 'Datos simulados',
    url: `https://finance.yahoo.com/quote/${etf.symbol}#ejemplo-${index}`,
    published_at: new Date(now - (index + 1) * 5 * 3_600_000).toISOString(),
    sentiment,
    reason,
  });

  return {
    symbol: etf.symbol,
    overall_sentiment: 'neutral',
    analysis_method: 'demo',
    outlook: `Texto de ejemplo: con la API real, Claude resume aquí el tono de las noticias de ${etf.symbol} y qué podría significar a corto plazo para quien tiene la posición.`,
    articles: [
      article(0, 'positive', `resultados del sector impulsan a ${etf.symbol}`, 'Una mejora de resultados suele favorecer al tenedor.'),
      article(1, 'neutral', `el mercado espera nuevos datos de inflación`, 'El efecto dependerá del dato publicado.'),
      article(2, 'negative', `analistas advierten por valoraciones altas en ${etf.sector}`, 'Valoraciones exigentes aumentan el riesgo de corrección.'),
    ],
  };
}

interface DemoStore {
  nextId: number;
  positions: { id: number; symbol: string; quantity: number; avgBuyPrice: number; purchaseDate: string }[];
  alerts: AlertItem[];
}

function defaultStore(): DemoStore {
  const now = new Date();
  return {
    nextId: 6,
    positions: [
      { id: 1, symbol: 'QQQ', quantity: 4, avgBuyPrice: 561.4, purchaseDate: '2025-03-14' },
      { id: 2, symbol: 'VOO', quantity: 3, avgBuyPrice: 602.75, purchaseDate: '2025-06-02' },
      { id: 3, symbol: 'NVDA', quantity: 10, avgBuyPrice: 152.3, purchaseDate: '2025-08-21' },
    ],
    alerts: [
      { id: 4, symbol: 'QQQ', alertType: 'PRICE_ABOVE', targetValue: 720, active: true, triggeredAt: null, createdAt: now.toISOString() },
      { id: 5, symbol: 'NVDA', alertType: 'PRICE_BELOW', targetValue: 200, active: false, triggeredAt: now.toISOString(), createdAt: now.toISOString() },
    ],
  };
}

function loadStore(): DemoStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as DemoStore;
  } catch {
    /* corrupted demo data: start again */
  }
  return defaultStore();
}

function saveStore(store: DemoStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function portfolio(): PortfolioSummary {
  const positions: PortfolioPosition[] = loadStore().positions.map((position) => {
    const etf = findEtf(position.symbol)!;
    const currentPrice = livePrice(etf);
    const marketValue = round(currentPrice * position.quantity);
    const costBasis = round(position.avgBuyPrice * position.quantity);
    const gainLoss = round(marketValue - costBasis);
    return {
      ...position,
      etfName: etf.name,
      currentPrice,
      marketValue,
      costBasis,
      gainLoss,
      gainLossPercent: costBasis === 0 ? 0 : round((gainLoss / costBasis) * 100),
    };
  });

  const totalMarketValue = round(positions.reduce((sum, p) => sum + p.marketValue, 0));
  const totalCostBasis = round(positions.reduce((sum, p) => sum + p.costBasis, 0));
  const totalGainLoss = round(totalMarketValue - totalCostBasis);
  return {
    totalMarketValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPercent: totalCostBasis === 0 ? 0 : round((totalGainLoss / totalCostBasis) * 100),
    positions,
  };
}

function findEtf(symbol: string): Seed | undefined {
  return CATALOG.find((etf) => etf.symbol === symbol.toUpperCase());
}

function publicEtf({ lastPrice, ...etf }: Seed): EtfResponse {
  return etf;
}

function notFound(url: string, message: string) {
  return throwError(
    () =>
      new HttpErrorResponse({
        status: 404,
        url,
        error: { status: 404, error: 'Not Found', message, path: url, details: null },
      }),
  );
}

function respond(req: HttpRequest<unknown>) {
  const path = new URL(req.urlWithParams, location.origin).pathname.replace(/^.*\/api\//, '');
  const parts = path.split('/').filter(Boolean);
  const [resource, action, id] = parts;
  const ok = (body: unknown) => of(new HttpResponse({ status: 200, body })).pipe(delay(120));

  if (resource === 'etfs') return ok(CATALOG.map(publicEtf));

  if (resource === 'market' && action === 'quotes') return ok(CATALOG.map(lightQuote));

  if ((resource === 'market' && id) || (resource === 'ai' && id)) {
    const etf = findEtf(id);
    if (!etf) return notFound(req.url, `No hay datos para ${id}`);
    if (action === 'quote') return ok(quote(etf));
    if (action === 'history') {
      const range = req.params.get('range') ?? '3mo';
      return ok({ symbol: etf.symbol, range, points: history(etf, range) } satisfies PriceHistoryResponse);
    }
    if (action === 'predict') return ok(prediction(etf, (req.params.get('horizon') ?? '1w') as HorizonKey));
    if (action === 'news') return ok(news(etf));
  }

  if (resource === 'portfolio') {
    if (req.method === 'GET') return ok(portfolio());

    const store = loadStore();
    if (req.method === 'POST') {
      const body = req.body as PortfolioPositionRequest;
      if (!findEtf(body.symbol)) return notFound(req.url, `ETF desconocido: ${body.symbol}`);
      const created = { ...body, symbol: body.symbol.toUpperCase(), id: store.nextId++ };
      store.positions.unshift(created);
      saveStore(store);
      return ok(portfolio().positions.find((p) => p.id === created.id));
    }
    if (req.method === 'DELETE') {
      store.positions = store.positions.filter((p) => p.id !== Number(action));
      saveStore(store);
      return ok(null);
    }
  }

  if (resource === 'alerts') {
    const store = loadStore();
    if (req.method === 'GET') return ok(store.alerts);
    if (req.method === 'POST') {
      const body = req.body as AlertRequest;
      if (!findEtf(body.symbol)) return notFound(req.url, `ETF desconocido: ${body.symbol}`);
      const created: AlertItem = {
        ...body,
        symbol: body.symbol.toUpperCase(),
        id: store.nextId++,
        active: true,
        triggeredAt: null,
        createdAt: new Date().toISOString(),
      };
      store.alerts.unshift(created);
      saveStore(store);
      return ok(created);
    }
    if (req.method === 'PATCH') {
      const alert = store.alerts.find((a) => a.id === Number(action));
      if (!alert) return notFound(req.url, 'Alerta no encontrada');
      alert.active = req.params.get('active') === 'true';
      saveStore(store);
      return ok(alert);
    }
    if (req.method === 'DELETE') {
      store.alerts = store.alerts.filter((a) => a.id !== Number(action));
      saveStore(store);
      return ok(null);
    }
  }

  return notFound(req.url, 'Ruta no disponible en la demo');
}

export const demoInterceptor: HttpInterceptorFn = (req, next) =>
  isDemoSession() && !req.url.includes('/api/auth/') ? respond(req) : next(req);
