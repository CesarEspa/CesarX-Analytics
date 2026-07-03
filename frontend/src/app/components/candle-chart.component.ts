import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  CandlestickData,
  HistogramData,
  IChartApi,
  ISeriesApi,
  Time,
  createChart,
} from 'lightweight-charts';
import { PriceHistoryPoint } from '../core/models';

@Component({
  selector: 'app-candle-chart',
  standalone: true,
  template: `<div #container class="chart-container"></div>`,
  styles: [`
    .chart-container { width: 100%; height: 380px; }
  `],
})
export class CandleChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() points: PriceHistoryPoint[] = [];

  @ViewChild('container', { static: true }) container!: ElementRef<HTMLDivElement>;

  private chart?: IChartApi;
  private candleSeries?: ISeriesApi<'Candlestick'>;
  private volumeSeries?: ISeriesApi<'Histogram'>;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const element = this.container.nativeElement;

    this.chart = createChart(element, {
      width: element.clientWidth,
      height: element.clientHeight,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8b9bb4',
      },
      grid: {
        vertLines: { color: '#1f2a4455' },
        horzLines: { color: '#1f2a4455' },
      },
      rightPriceScale: { borderColor: '#1f2a44' },
      timeScale: { borderColor: '#1f2a44' },
      crosshair: { mode: 0 },
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    this.volumeSeries = this.chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    this.chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    this.renderData();

    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.applyOptions({ width: element.clientWidth });
    });
    this.resizeObserver.observe(element);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['points'] && this.chart) {
      this.renderData();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.remove();
  }

  private renderData(): void {
    if (!this.candleSeries || !this.volumeSeries) {
      return;
    }

    const candles: CandlestickData[] = this.points
      .filter((p) => p.open !== null && p.high !== null && p.low !== null)
      .map((p) => ({
        time: p.date as Time,
        open: p.open!,
        high: p.high!,
        low: p.low!,
        close: p.close,
      }));

    const volumes: HistogramData[] = this.points
      .filter((p) => p.volume !== null)
      .map((p, i, arr) => ({
        time: p.date as Time,
        value: p.volume!,
        color: i > 0 && p.close < arr[i - 1].close ? '#ef444455' : '#22c55e55',
      }));

    this.candleSeries.setData(candles);
    this.volumeSeries.setData(volumes);
    this.chart?.timeScale().fitContent();
  }
}
