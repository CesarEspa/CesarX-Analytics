import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  CandlestickData,
  CrosshairMode,
  HistogramData,
  IChartApi,
  ISeriesApi,
  LineData,
  LineStyle,
  MouseEventParams,
  Time,
  createChart,
} from 'lightweight-charts';
import { ForecastPoint, PriceHistoryPoint } from '../core/models';
import { BandPoint, ForecastBand } from './forecast-band';

const UP = '#3ddc84';
const DOWN = '#e32b3c';
const INK = '#f2efeb';
const MUTED = '#a09c9a';
const GRID = '#1b1818';
const AXIS = '#262121';
const MA_SHORT = '#e0a94a';
const MA_LONG = '#7f93a8';
const PHONE_WIDTH = 560;
const PHONE_BARS = 26;

interface Readout {
  label: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  changePct?: number;
  volume?: number | null;
  expected?: number;
  rangeLow?: number;
  rangeHigh?: number;
}

@Component({
  selector: 'app-candle-chart',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="chart-wrap">
      @if (readout(); as r) {
        <div class="readout mono" aria-live="off">
          <span class="date">{{ r.label }}</span>
          @if (r.expected !== undefined) {
            <span>Esperado <b>{{ r.expected | number: '1.2-2' }}</b></span>
            <span>Rango <b>{{ r.rangeLow | number: '1.2-2' }} – {{ r.rangeHigh | number: '1.2-2' }}</b></span>
          } @else {
            <span>A <b>{{ r.open | number: '1.2-2' }}</b></span>
            <span>M <b>{{ r.high | number: '1.2-2' }}</b></span>
            <span>B <b>{{ r.low | number: '1.2-2' }}</b></span>
            <span>C <b>{{ r.close | number: '1.2-2' }}</b></span>
            <span [class.positive]="(r.changePct ?? 0) >= 0" [class.negative]="(r.changePct ?? 0) < 0">
              {{ (r.changePct ?? 0) >= 0 ? '+' : '' }}{{ r.changePct | number: '1.2-2' }}%
            </span>
            @if (r.volume) {
              <span class="volume">Vol <b>{{ r.volume | number: '1.0-0' }}</b></span>
            }
          }
        </div>
      }
      <div #container class="chart-container"></div>
    </div>
  `,
  styles: [`
    .chart-wrap { position: relative; }
    .readout {
      position: absolute; top: 2px; left: 4px; right: 70px; z-index: 3; pointer-events: none;
      display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 11px; color: var(--text-muted);
    }
    .readout b { color: var(--text); font-weight: 500; }
    .readout .date { color: var(--text); font-weight: 700; }
    .chart-container { width: 100%; height: 460px; }
    @media (max-width: 640px) {
      .chart-container { height: 340px; }
      .readout .volume { display: none; }
    }
  `],
})
export class CandleChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() points: PriceHistoryPoint[] = [];
  @Input() intraday = false;
  @Input() forecast: ForecastPoint[] = [];
  /** Every Nth forecast day, so the projection matches weekly candles. */
  @Input() forecastStep = 1;

  @ViewChild('container', { static: true }) container!: ElementRef<HTMLDivElement>;

  readonly readout = signal<Readout | null>(null);

  private chart?: IChartApi;
  private candleSeries?: ISeriesApi<'Candlestick'>;
  private volumeSeries?: ISeriesApi<'Histogram'>;
  private maShortSeries?: ISeriesApi<'Line'>;
  private maLongSeries?: ISeriesApi<'Line'>;
  private expectedSeries?: ISeriesApi<'Line'>;
  private lowSeries?: ISeriesApi<'Line'>;
  private highSeries?: ISeriesApi<'Line'>;
  private resizeObserver?: ResizeObserver;
  private readonly band = new ForecastBand();

  private byTime = new Map<number, PriceHistoryPoint>();
  private forecastByTime = new Map<number, ForecastPoint>();

  private readonly onCrosshair = (param: MouseEventParams<Time>) => {
    const time = param.time as number | undefined;
    const projected = time === undefined ? undefined : this.forecastByTime.get(time);
    if (projected) {
      this.readout.set({
        label: this.formatTime(projected.timestamp),
        expected: projected.expected,
        rangeLow: projected.low,
        rangeHigh: projected.high,
      });
      return;
    }
    const point = time === undefined ? undefined : this.byTime.get(time);
    this.showCandle(point ?? this.points[this.points.length - 1]);
  };

  ngAfterViewInit(): void {
    const element = this.container.nativeElement;

    this.chart = createChart(element, {
      width: element.clientWidth,
      height: element.clientHeight,
      layout: {
        background: { color: 'transparent' },
        textColor: MUTED,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      localization: { locale: 'es-CO' },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: GRID },
      },
      rightPriceScale: { borderColor: AXIS, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: AXIS, rightOffset: 2 },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: MUTED, style: LineStyle.Dashed, labelBackgroundColor: AXIS },
        horzLine: { color: MUTED, style: LineStyle.Dashed, labelBackgroundColor: AXIS },
      },
    });

    this.volumeSeries = this.chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    this.chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.86, bottom: 0 },
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceLineColor: MUTED,
      priceLineStyle: LineStyle.Dotted,
    });

    const average = { lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as const;
    this.maShortSeries = this.chart.addLineSeries({ ...average, color: MA_SHORT });
    this.maLongSeries = this.chart.addLineSeries({ ...average, color: MA_LONG });

    const edge = { color: MUTED, lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, crosshairMarkerVisible: false } as const;
    this.lowSeries = this.chart.addLineSeries(edge);
    this.highSeries = this.chart.addLineSeries(edge);
    this.expectedSeries = this.chart.addLineSeries({
      color: INK,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      crosshairMarkerRadius: 3,
    });
    this.expectedSeries.attachPrimitive(this.band);

    this.chart.subscribeCrosshairMove(this.onCrosshair);
    this.renderData();

    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.applyOptions({ width: element.clientWidth, height: element.clientHeight });
    });
    this.resizeObserver.observe(element);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['points'] || changes['intraday'] || changes['forecast'] || changes['forecastStep']) && this.chart) {
      this.renderData();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.unsubscribeCrosshairMove(this.onCrosshair);
    this.chart?.remove();
  }

  private renderData(): void {
    if (!this.candleSeries || !this.volumeSeries) {
      return;
    }

    // Epoch timestamps support both daily and intraday candles; the axis
    // shows times only on intraday views.
    this.chart?.applyOptions({
      timeScale: { timeVisible: this.intraday, secondsVisible: false },
    });

    this.byTime = new Map(this.points.map((p) => [p.timestamp, p]));

    const candles: CandlestickData[] = this.points
      .filter((p) => p.open !== null && p.high !== null && p.low !== null)
      .map((p) => ({
        time: p.timestamp as Time,
        open: p.open!,
        high: p.high!,
        low: p.low!,
        close: p.close,
      }));

    const volumes: HistogramData[] = this.points
      .filter((p) => p.volume !== null)
      .map((p, i, arr) => ({
        time: p.timestamp as Time,
        value: p.volume!,
        color: i > 0 && p.close < arr[i - 1].close ? '#e32b3c33' : '#3ddc8433',
      }));

    this.candleSeries.setData(candles);
    this.volumeSeries.setData(volumes);
    this.maShortSeries?.setData(this.intraday ? [] : this.movingAverage(20));
    this.maLongSeries?.setData(this.intraday ? [] : this.movingAverage(50));
    const futureBars = this.renderForecast();
    this.fitView(candles.length + futureBars, futureBars);
    this.showCandle(this.points[this.points.length - 1]);
  }

  /** On phones, older candles stay a swipe away so the projection remains readable. */
  private fitView(totalBars: number, futureBars: number): void {
    const timeScale = this.chart?.timeScale();
    timeScale?.fitContent();
    const visibleBars = Math.max(PHONE_BARS, Math.ceil(futureBars * 1.8));
    if (!this.intraday && this.container.nativeElement.clientWidth < PHONE_WIDTH && totalBars > visibleBars) {
      timeScale?.setVisibleLogicalRange({ from: totalBars - visibleBars, to: totalBars + 1 });
    }
  }

  private movingAverage(window: number): LineData[] {
    const result: LineData[] = [];
    let sum = 0;
    this.points.forEach((point, i) => {
      sum += point.close;
      if (i >= window) {
        sum -= this.points[i - window].close;
      }
      if (i >= window - 1) {
        result.push({ time: point.timestamp as Time, value: sum / window });
      }
    });
    return result;
  }

  private renderForecast(): number {
    const last = this.points[this.points.length - 1];
    const future =
      this.intraday || !last
        ? []
        : this.forecast.filter(
            (p, i, all) => p.timestamp > last.timestamp && ((i + 1) % this.forecastStep === 0 || i === all.length - 1),
          );

    this.forecastByTime = new Map(future.map((p) => [p.timestamp, p]));

    const line = (value: (p: ForecastPoint) => number): LineData[] =>
      future.length === 0
        ? []
        : [{ time: last.timestamp as Time, value: last.close }, ...future.map((p) => ({ time: p.timestamp as Time, value: value(p) }))];

    this.expectedSeries?.setData(line((p) => p.expected));
    this.lowSeries?.setData(line((p) => p.low));
    this.highSeries?.setData(line((p) => p.high));

    const band: BandPoint[] =
      future.length === 0
        ? []
        : [
            { time: last.timestamp as Time, low: last.close, high: last.close },
            ...future.map((p) => ({ time: p.timestamp as Time, low: p.low, high: p.high })),
          ];
    this.band.setPoints(band);
    return future.length;
  }

  private showCandle(point: PriceHistoryPoint | undefined): void {
    if (!point || point.open === null || point.high === null || point.low === null) {
      this.readout.set(null);
      return;
    }
    this.readout.set({
      label: this.formatTime(point.timestamp),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      changePct: point.open === 0 ? 0 : (point.close / point.open - 1) * 100,
      volume: point.volume,
    });
  }

  private formatTime(timestamp: number): string {
    const options: Intl.DateTimeFormatOptions = this.intraday
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(timestamp * 1000).toLocaleString('es-CO', options);
  }
}
