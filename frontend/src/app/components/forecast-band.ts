import { IChartApi, ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, SeriesType, Time } from 'lightweight-charts';

export interface BandPoint {
  time: Time;
  low: number;
  high: number;
}

interface MediaTarget {
  useMediaCoordinateSpace(draw: (scope: { context: CanvasRenderingContext2D; mediaSize: { height: number } }) => void): void;
}

/** Shaded uncertainty cone plus a "today" divider, drawn under the chart's series. */
export class ForecastBand implements ISeriesPrimitive<Time> {
  private points: BandPoint[] = [];
  private chart?: IChartApi;
  private series?: ISeriesApi<SeriesType>;
  private requestUpdate?: () => void;

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = undefined;
    this.series = undefined;
    this.requestUpdate = undefined;
  }

  setPoints(points: BandPoint[]): void {
    this.points = points;
    this.requestUpdate?.();
  }

  paneViews() {
    return [
      {
        zOrder: () => 'bottom' as const,
        renderer: () => ({ draw: (target: MediaTarget) => this.draw(target) }),
      },
    ];
  }

  private draw(target: MediaTarget): void {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series || this.points.length < 2) {
      return;
    }

    const coordinates = this.points.map((p) => ({
      x: chart.timeScale().timeToCoordinate(p.time),
      low: series.priceToCoordinate(p.low),
      high: series.priceToCoordinate(p.high),
    }));
    if (coordinates.some((c) => c.x === null || c.low === null || c.high === null)) {
      return;
    }

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];

      const fill = context.createLinearGradient(first.x!, 0, last.x!, 0);
      fill.addColorStop(0, 'rgba(242, 239, 235, 0.04)');
      fill.addColorStop(1, 'rgba(242, 239, 235, 0.16)');
      context.fillStyle = fill;
      context.beginPath();
      context.moveTo(first.x!, first.high!);
      coordinates.forEach((c) => context.lineTo(c.x!, c.high!));
      [...coordinates].reverse().forEach((c) => context.lineTo(c.x!, c.low!));
      context.closePath();
      context.fill();

      context.strokeStyle = 'rgba(227, 43, 60, 0.7)';
      context.lineWidth = 1;
      context.setLineDash([3, 4]);
      context.beginPath();
      context.moveTo(first.x!, 0);
      context.lineTo(first.x!, mediaSize.height);
      context.stroke();
      context.setLineDash([]);

      context.fillStyle = '#e32b3c';
      context.font = "700 10px Manrope, sans-serif";
      // Sits in the free strip between the candles and the volume bars; past
      // the divider when long projections leave no room on its left.
      const label = 'HOY  ·  PROYECCIÓN →';
      const fitsLeft = context.measureText(label).width + 6 <= first.x!;
      context.textAlign = fitsLeft ? 'right' : 'left';
      context.fillText(label, first.x! + (fitsLeft ? -6 : 6), mediaSize.height * 0.835);
    });
  }
}
