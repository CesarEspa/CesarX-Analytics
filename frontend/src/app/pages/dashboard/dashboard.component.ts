import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
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

const RANGES = ['1mo', '3mo', '6mo', '1y', '5y'] as const;
const LIVE_REFRESH_MS = 20_000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    QuoteCardComponent,
    CandleChartComponent,
    PortfolioPanelComponent,
    AlertsPanelComponent,
    PredictionCardComponent,
    NewsPanelComponent,
  ],
  template: `
    <header class="topbar">
      <div class="brand">
        <span class="logo-mark">CX</span>
        <div>
          <h1>CesarX Analytics</h1>
          <span class="muted subtitle">ETF Intelligence Platform</span>
        </div>
      </div>
      <div class="user">
        @if (lastUpdate()) {
          <span class="live-dot" title="Actualización en tiempo real"></span>
          <span class="muted live-text">{{ lastUpdate() | date: 'HH:mm:ss' }}</span>
        }
        <span class="muted">{{ auth.username() }}</span>
        <button class="btn-ghost" (click)="auth.logout()">Salir</button>
      </div>
    </header>

    <main class="content">
      @if (error()) {
        <div class="error-box">{{ error() }}</div>
      }

      <!-- Cotizaciones -->
      <section class="quotes-grid">
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

      <!-- Gráfico de velas -->
      <section class="card chart-card">
        <div class="chart-head">
          <div>
            <h2>{{ selectedSymbol() }}</h2>
            @if (selectedQuote(); as quote) {
              <span class="muted signal-reason">{{ quote.signalReason }}</span>
            }
          </div>
          <div class="ranges">
            @for (range of ranges; track range) {
              <button class="btn-ghost" [class.active]="selectedRange() === range" (click)="selectRange(range)">
                {{ range }}
              </button>
            }
          </div>
        </div>

        @if (historyLoading()) {
          <div class="chart-loading"><span class="spinner"></span></div>
        } @else {
          <app-candle-chart [points]="historyPoints()" />
        }
      </section>

      <!-- Análisis IA: predicción + noticias -->
      <section class="panels ai-panels">
        <app-prediction-card
          [prediction]="prediction()"
          [loading]="predictionLoading()"
          [error]="predictionError()"
        />
        <app-news-panel
          [analysis]="news()"
          [loading]="newsLoading()"
          [error]="newsError()"
        />
      </section>

      <!-- Portfolio y alertas -->
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
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 26px; border-bottom: 1px solid var(--border);
      position: sticky; top: 0; background: #0b0f1aee; backdrop-filter: blur(8px); z-index: 10;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand h1 { font-size: 17px; }
    .subtitle { font-size: 12px; }
    .logo-mark {
      background: linear-gradient(135deg, var(--accent), #8b5cf6);
      color: #fff; font-weight: 800; font-size: 15px;
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
    .content {
      max-width: 1200px; margin: 0 auto; padding: 22px 26px 60px;
      display: flex; flex-direction: column; gap: 18px;
    }
    .quotes-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px;
    }
    .chart-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12px; margin-bottom: 12px; flex-wrap: wrap;
    }
    .chart-head h2 { font-size: 19px; }
    .signal-reason { font-size: 13px; }
    .ranges { display: flex; gap: 6px; }
    .chart-loading { height: 380px; display: flex; align-items: center; justify-content: center; }
    .panels { display: grid; grid-template-columns: 3fr 2fr; gap: 18px; align-items: start; }
    .ai-panels { grid-template-columns: 2fr 3fr; }
    .live-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--green);
      display: inline-block; animation: pulse 2s ease-in-out infinite;
    }
    .live-text { font-size: 12.5px; font-variant-numeric: tabular-nums; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    @media (max-width: 960px) {
      .panels, .ai-panels { grid-template-columns: 1fr; }
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
  readonly selectedRange = signal<string>('6mo');
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

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadEtfs();
    this.loadPortfolio();
    this.loadAlerts();
    this.refreshTimer = setInterval(() => this.refreshLiveQuotes(), LIVE_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
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

  selectRange(range: string): void {
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
      error: () => this.error.set('No se pudo cargar el catálogo de ETFs. ¿Está corriendo el backend en el puerto 8080?'),
    });
  }

  private loadQuote(symbol: string): void {
    this.api.getQuote(symbol).subscribe({
      next: (quote) => this.quotes.update((current) => ({ ...current, [symbol]: quote })),
      error: () => this.failedQuotes.update((current) => [...current, symbol]),
    });
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.api.getHistory(this.selectedSymbol(), this.selectedRange()).subscribe({
      next: (history) => {
        this.historyPoints.set(history.points);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyPoints.set([]);
        this.historyLoading.set(false);
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
