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
  @Input() intraday = false;

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
        textColor: '#82807a',
      },
      grid: {
        vertLines: { color: '#e3e0d580' },
        horzLines: { color: '#e3e0d580' },
      },
      rightPriceScale: { borderColor: '#e3e0d5' },
      timeScale: { borderColor: '#e3e0d5' },
      crosshair: { mode: 0 },
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#1a7f5a',
      downColor: '#bf4d43',
      borderUpColor: '#1a7f5a',
      borderDownColor: '#bf4d43',
      wickUpColor: '#1a7f5a',
      wickDownColor: '#bf4d43',
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
    if ((changes['points'] || changes['intraday']) && this.chart) {
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

    // Epoch timestamps support both daily and intraday candles; the axis
    // shows times only on intraday views.
    this.chart?.applyOptions({
      timeScale: { timeVisible: this.intraday, secondsVisible: false },
    });

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
        color: i > 0 && p.close < arr[i - 1].close ? '#bf4d4340' : '#1a7f5a40',
      }));

    this.candleSeries.setData(candles);
    this.volumeSeries.setData(volumes);
    this.chart?.timeScale().fitContent();
  }
}
