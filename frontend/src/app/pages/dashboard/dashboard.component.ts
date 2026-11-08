import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { ApiService } from '../../core/api.service';
import {
  AlertItem,
  AlertRequest,
  EtfResponse,
  NewsAnalysis,
  PortfolioPositionRequest,
  PortfolioSummary,
  Prediction,
  PriceHistoryPoint,
  PriceQuote,
} from '../../core/models';
import { QuoteCardComponent } from '../../components/quote-card.component';
import { CandleChartComponent } from '../../components/candle-chart.component';
import { PortfolioPanelComponent } from '../../components/portfolio-panel.component';
import { AlertsPanelComponent } from '../../components/alerts-panel.component';
import { PredictionCardComponent } from '../../components/prediction-card.component';
import { NewsPanelComponent } from '../../components/news-panel.component';
import { HistoryCardComponent } from '../../components/history-card.component';

interface RangeOption {
  value: string;
  label: string;
  interval: string;
  intraday: boolean;
}

const RANGES: RangeOption[] = [
  { value: '1d', label: '1D · 5min', interval: '5m', intraday: true },
  { value: '5d', label: '5D · 15min', interval: '15m', intraday: true },
  { value: '1mo', label: '1M', interval: '1d', intraday: false },
  { value: '3mo', label: '3M', interval: '1d', intraday: false },
  { value: '6mo', label: '6M', interval: '1d', intraday: false },
  { value: '1y', label: '1A', interval: '1d', intraday: false },
  { value: '5y', label: '5A', interval: '1wk', intraday: false },
];

const LIVE_REFRESH_MS = 20_000;
const CHART_REFRESH_MS = 5 * 60_000; // intraday candles change every 5 minutes

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    HistoryCardComponent,
    QuoteCardComponent,
    CandleChartComponent,
    PortfolioPanelComponent,
    AlertsPanelComponent,
    PredictionCardComponent,
    NewsPanelComponent,
  ],
  template: `
    <header class="topbar">
      <a class="brand" href="https://cesarespa.github.io/CesarEspana-Portafolio/" title="Volver al portafolio">
        <span class="logo">CesarX</span>
        <span class="label">Analytics</span>
      </a>
      <div class="user">
        @if (lastUpdate()) {
          <span class="live-dot" title="Actualización en tiempo real"></span>
          <span class="muted live-text mono">{{ lastUpdate() | date: 'HH:mm:ss' }}</span>
        }
        <span class="muted name">{{ auth.username() }}</span>
        <button class="btn-ghost" (click)="auth.logout()">Salir</button>
      </div>
    </header>

    <main class="content">
      @if (error()) {
        <div class="error-box">{{ error() }}</div>
      }

      <section class="quotes-grid" aria-label="Cotizaciones">
        @for (etf of etfs(); track etf.id) {
          <app-quote-card
            [symbol]="etf.symbol"
            [name]="etf.name"
            [quote]="quoteFor(etf.symbol)"
            [failed]="failedQuotes().includes(etf.symbol)"
            [selected]="selectedSymbol() === etf.symbol"
            (select)="selectSymbol($event)"
          />
        }
      </section>

      <section class="hero">
        <div>
          <div class="label red">Activo seleccionado</div>
          <h1>{{ selectedSymbol() }}</h1>
          @if (selectedQuote(); as quote) {
            <p class="muted signal-reason">{{ quote.signalReason }}</p>
          }
        </div>
        @if (selectedQuote(); as quote) {
          <div class="hero-price mono">
            <strong>{{ quote.currentPrice | number: '1.2-2' }}</strong>
            <span [class.positive]="(quote.change ?? 0) >= 0" [class.negative]="(quote.change ?? 0) < 0">
              {{ (quote.change ?? 0) >= 0 ? '+' : '' }}{{ quote.change | number: '1.2-2' }} ({{ quote.changePercent | number: '1.2-2' }}%)
            </span>
          </div>
        }
      </section>

      @if (reading(); as text) {
        <section class="reading">
          <span class="label red">Lectura conjunta</span>
          <p>{{ text }}</p>
        </section>
      }

      <section class="market">
        <div class="card chart-card">
          <div class="chart-head">
            <div class="legend">
              <span><i class="candle"></i> Precio real</span>
              @if (!selectedRange().intraday) {
                <span><i class="ma20"></i> Media 20</span>
                <span><i class="ma50"></i> Media 50</span>
              }
              @if (showsForecast()) {
                <span><i class="dash"></i> Proyección</span>
                <span><i class="band"></i> Rango 80%</span>
              } @else {
                <span class="muted">La proyección se ve desde 1M</span>
              }
            </div>
            <div class="ranges">
              @for (range of ranges; track range.value) {
                <button class="btn-ghost" [class.active]="selectedRange().value === range.value" (click)="selectRange(range)">
                  {{ range.label }}
                </button>
              }
            </div>
          </div>

          @if (historyLoading()) {
            <div class="chart-loading"><span class="spinner"></span></div>
          } @else {
            <app-candle-chart
              [points]="historyPoints()"
              [intraday]="selectedRange().intraday"
              [forecast]="prediction()?.forecast_path ?? []"
              [forecastStep]="selectedRange().value === '5y' ? 5 : 1"
            />
          }
        </div>

        <app-prediction-card
          [prediction]="prediction()"
          [loading]="predictionLoading()"
          [error]="predictionError()"
        />
      </section>

      <section class="panels even">
        <app-history-card [history]="prediction()?.history ?? null" [loading]="predictionLoading()" />
        <app-news-panel
          [analysis]="news()"
          [loading]="newsLoading()"
          [error]="newsError()"
        />
      </section>

      <section class="panels">
        <app-portfolio-panel
          [summary]="portfolio()"
          [etfs]="etfs()"
          (add)="addPosition($event)"
          (remove)="deletePosition($event)"
        />
        <app-alerts-panel
          [alerts]="alerts()"
          [etfs]="etfs()"
          (create)="createAlert($event)"
          (toggle)="toggleAlert($event)"
          (remove)="deleteAlert($event)"
        />
      </section>
    </main>
  `,
  styles: [`
    .topbar {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 14px clamp(16px, 3.8vw, 68px); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; background: rgba(9, 9, 9, 0.88); backdrop-filter: blur(10px); z-index: 10;
    }
    .brand { display: flex; align-items: baseline; gap: 10px; text-decoration: none; }
    .logo { font-family: var(--display); font-size: 26px; line-height: 1; text-transform: uppercase; }
    .brand:hover .logo { color: var(--accent); }
    .user { display: flex; align-items: center; gap: 12px; font-size: 13px; min-width: 0; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .content {
      max-width: 1500px; margin: 0 auto; padding: 18px clamp(16px, 3.8vw, 68px) 72px;
      display: flex; flex-direction: column; gap: 22px;
    }
    .quotes-grid {
      display: grid; grid-template-columns: repeat(10, minmax(140px, 1fr)); gap: 1px;
      overflow-x: auto; scrollbar-width: thin; background: var(--border); border: 1px solid var(--border);
    }
    .hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; padding-top: 14px; }
    .hero h1 { font-size: clamp(72px, 11vw, 150px); line-height: 0.95; margin-top: 8px; }
    .signal-reason { font-size: 14px; margin: 10px 0 0; max-width: 60ch; }
    .hero-price { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 15px; font-weight: 700; }
    .hero-price strong { font-family: var(--display); font-weight: 400; font-size: clamp(44px, 6vw, 76px); line-height: 1; }
    .reading { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 24px; align-items: baseline; padding: 14px 0; border-block: 1px solid var(--border); }
    .reading p { margin: 0; font-size: 15px; }
    .market { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(320px, 1fr); gap: 18px; align-items: start; }
    .chart-card { min-width: 0; }
    .chart-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
    .legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; }
    .legend span { display: inline-flex; align-items: center; gap: 7px; }
    .legend i { display: inline-block; width: 18px; height: 0; border-top: 2px solid; }
    .legend .candle { width: 8px; height: 12px; border: 0; background: var(--green); }
    .legend .dash { border-top-style: dashed; color: var(--text); }
    .legend .band { height: 10px; border: 1px dotted var(--text-muted); background: rgba(242, 239, 235, 0.1); }
    .legend .ma20 { color: var(--amber); }
    .legend .ma50 { color: #7f93a8; }
    .ranges { display: flex; flex-wrap: wrap; gap: 6px; }
    .chart-loading { height: 460px; display: flex; align-items: center; justify-content: center; }
    .panels { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 18px; align-items: start; }
    .panels.even { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); display: inline-block; animation: pulse 2s ease-in-out infinite; }
    .live-text { font-size: 12px; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    @media (max-width: 1100px) {
      .market, .panels, .panels.even { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 640px) {
      .reading { grid-template-columns: minmax(0, 1fr); }
      .hero-price { align-items: flex-start; }
      .live-text { display: none; }
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly ranges = RANGES;

  readonly etfs = signal<EtfResponse[]>([]);
  readonly quotes = signal<Record<string, PriceQuote>>({});
  readonly failedQuotes = signal<string[]>([]);
  readonly selectedSymbol = signal<string>('VGT');
  readonly selectedRange = signal<RangeOption>(RANGES[3]);
  readonly historyPoints = signal<PriceHistoryPoint[]>([]);
  readonly historyLoading = signal(false);
  readonly portfolio = signal<PortfolioSummary | null>(null);
  readonly alerts = signal<AlertItem[]>([]);
  readonly error = signal<string | null>(null);
  readonly lastUpdate = signal<Date | null>(null);

  readonly prediction = signal<Prediction | null>(null);
  readonly predictionLoading = signal(false);
  readonly predictionError = signal<string | null>(null);
  readonly news = signal<NewsAnalysis | null>(null);
  readonly newsLoading = signal(false);
  readonly newsError = signal<string | null>(null);

  readonly showsForecast = computed(() => !this.selectedRange().intraday && (this.prediction()?.forecast_path.length ?? 0) > 0);

  /** History and forecast are validated data; news is a separate, current signal that never enters the model. */
  readonly reading = computed(() => {
    const prediction = this.prediction();
    const news = this.news();
    if (!prediction) {
      return null;
    }

    const trend = { bullish: 'alcista', bearish: 'bajista', mixed: 'mixto' }[prediction.history.trend];
    const direction = { UP: 'al alza', DOWN: 'a la baja', SIDEWAYS: 'lateral' }[prediction.direction];
    const start = `Historial ${trend} y proyección ${direction}`;
    if (!news || news.analysis_method === 'none') {
      return `${start}. Sin noticias recientes para contrastar.`;
    }

    const tone = { positive: 'positivo', negative: 'negativo', neutral: 'neutral' }[news.overall_sentiment];
    const toneSign = { positive: 1, negative: -1, neutral: 0 }[news.overall_sentiment];
    const forecastSign = { UP: 1, DOWN: -1, SIDEWAYS: 0 }[prediction.direction];
    const agreement =
      toneSign === 0 || forecastSign === 0
        ? 'Las noticias no contradicen la proyección.'
        : toneSign === forecastSign
          ? 'Las noticias van en la misma dirección que la proyección.'
          : 'Las noticias van en contra de la proyección: conviene más cautela.';
    return `${start}, con tono ${tone} en las noticias. ${agreement} Las noticias se leen aparte porque no hay un historial con el que validarlas.`;
  });

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private chartTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadEtfs();
    this.loadPortfolio();
    this.loadAlerts();
    this.refreshTimer = setInterval(() => this.refreshLiveQuotes(), LIVE_REFRESH_MS);
    // Intraday candles get a new bar every 5 minutes — refresh the chart
    // silently (no spinner) so the view stays current without flicker.
    this.chartTimer = setInterval(() => {
      if (this.selectedRange().intraday) {
        this.loadHistory(true);
      }
    }, CHART_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
    }
    if (this.chartTimer !== null) {
      clearInterval(this.chartTimer);
    }
  }

  selectedQuote(): PriceQuote | null {
    return this.quoteFor(this.selectedSymbol());
  }

  quoteFor(symbol: string): PriceQuote | null {
    const quote = this.quotes()[symbol] as PriceQuote | undefined;
    return quote ?? null;
  }

  selectSymbol(symbol: string): void {
    this.selectedSymbol.set(symbol);
    this.loadHistory();
    this.loadAiAnalysis();
  }

  selectRange(range: RangeOption): void {
    this.selectedRange.set(range);
    this.loadHistory();
  }

  /**
   * Real-time refresh: one cheap batch request that updates price and daily
   * change on every card without re-computing signals or history.
   */
  private refreshLiveQuotes(): void {
    this.api.getLightQuotes().subscribe({
      next: (lightQuotes) => {
        this.quotes.update((current) => {
          const next = { ...current };
          for (const lq of lightQuotes) {
            const existing = next[lq.symbol] as PriceQuote | undefined;
            if (existing) {
              next[lq.symbol] = {
                ...existing,
                currentPrice: lq.currentPrice,
                previousClose: lq.previousClose,
                change: lq.change,
                changePercent: lq.changePercent,
                asOf: lq.asOf,
              };
            }
          }
          return next;
        });
        this.lastUpdate.set(new Date());
      },
      error: () => {
        // silent: next tick will retry
      },
    });
  }

  private loadAiAnalysis(): void {
    const symbol = this.selectedSymbol();

    this.predictionLoading.set(true);
    this.predictionError.set(null);
    this.prediction.set(null);
    this.api.getPrediction(symbol).subscribe({
      next: (prediction) => {
        this.prediction.set(prediction);
        this.predictionLoading.set(false);
      },
      error: (err) => {
        this.predictionLoading.set(false);
        this.predictionError.set(err?.error?.message ?? 'Predicción no disponible.');
      },
    });

    this.newsLoading.set(true);
    this.newsError.set(null);
    this.news.set(null);
    this.api.getNewsAnalysis(symbol).subscribe({
      next: (analysis) => {
        this.news.set(analysis);
        this.newsLoading.set(false);
      },
      error: (err) => {
        this.newsLoading.set(false);
        this.newsError.set(err?.error?.message ?? 'Análisis de noticias no disponible.');
      },
    });
  }

  addPosition(request: PortfolioPositionRequest): void {
    this.api.addPosition(request).subscribe({
      next: () => this.loadPortfolio(),
      error: () => this.error.set('No se pudo agregar la posición.'),
    });
  }

  deletePosition(id: number): void {
    this.api.deletePosition(id).subscribe({
      next: () => this.loadPortfolio(),
      error: () => this.error.set('No se pudo eliminar la posición.'),
    });
  }

  createAlert(request: AlertRequest): void {
    this.api.createAlert(request).subscribe({
      next: () => this.loadAlerts(),
      error: () => this.error.set('No se pudo crear la alerta.'),
    });
  }

  toggleAlert(alert: AlertItem): void {
    this.api.setAlertActive(alert.id, !alert.active).subscribe({
      next: () => this.loadAlerts(),
      error: () => this.error.set('No se pudo actualizar la alerta.'),
    });
  }

  deleteAlert(id: number): void {
    this.api.deleteAlert(id).subscribe({
      next: () => this.loadAlerts(),
      error: () => this.error.set('No se pudo eliminar la alerta.'),
    });
  }

  private loadEtfs(): void {
    this.api.getEtfs().subscribe({
      next: (etfs) => {
        this.etfs.set(etfs);
        if (etfs.length > 0 && !etfs.some((e) => e.symbol === this.selectedSymbol())) {
          this.selectedSymbol.set(etfs[0].symbol);
        }
        etfs.forEach((etf) => this.loadQuote(etf.symbol));
        this.loadHistory();
        this.loadAiAnalysis();
      },
      error: () => this.error.set('No se pudo cargar el catálogo de ETFs. Intenta de nuevo en un momento.'),
    });
  }

  private loadQuote(symbol: string): void {
    this.api.getQuote(symbol).subscribe({
      next: (quote) => this.quotes.update((current) => ({ ...current, [symbol]: quote })),
      error: () => this.failedQuotes.update((current) => [...current, symbol]),
    });
  }

  private loadHistory(silent = false): void {
    const range = this.selectedRange();
    if (!silent) {
      this.historyLoading.set(true);
    }
    this.api.getHistory(this.selectedSymbol(), range.value, range.interval).subscribe({
      next: (history) => {
        this.historyPoints.set(history.points);
        this.historyLoading.set(false);
      },
      error: () => {
        if (!silent) {
          this.historyPoints.set([]);
          this.historyLoading.set(false);
        }
      },
    });
  }

  private loadPortfolio(): void {
    this.api.getPortfolio().subscribe({
      next: (summary) => this.portfolio.set(summary),
      error: () => this.error.set('No se pudo cargar el portfolio.'),
    });
  }

  private loadAlerts(): void {
    this.api.getAlerts().subscribe({
      next: (alerts) => this.alerts.set(alerts),
      error: () => this.error.set('No se pudieron cargar las alertas.'),
    });
  }
}
