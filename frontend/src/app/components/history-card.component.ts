import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HistoryReading } from '../core/models';

@Component({
  selector: 'app-history-card',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="card">
      <div class="label">Datos reales</div>
      <h2>Qué dice el historial</h2>

      @if (loading) {
        <div class="loading"><span class="spinner"></span></div>
      } @else if (history) {
        <p class="summary">{{ history.summary }}</p>

        <div class="returns">
          @for (item of returns(); track item.label) {
            <div>
              <span class="label">{{ item.label }}</span>
              <strong class="mono" [class.positive]="(item.value ?? 0) >= 0" [class.negative]="(item.value ?? 0) < 0">
                {{ item.value === null ? '—' : ((item.value >= 0 ? '+' : '') + (item.value | number: '1.1-1') + '%') }}
              </strong>
            </div>
          }
        </div>

        <dl>
          <div><dt>Volatilidad anualizada</dt><dd class="mono">{{ history.volatility_pct | number: '1.1-1' }}% <small>normal {{ history.typical_volatility_pct | number: '1.1-1' }}%</small></dd></div>
          <div><dt>Caída desde máximo</dt><dd class="mono">{{ history.drawdown_pct | number: '1.1-1' }}%</dd></div>
          <div><dt>Rango de 52 semanas</dt><dd class="mono">{{ history.low_52w | number: '1.2-2' }} – {{ history.high_52w | number: '1.2-2' }}</dd></div>
          <div><dt>Media 50 / 200 días</dt><dd class="mono">{{ history.sma50 | number: '1.2-2' }} / {{ history.sma200 | number: '1.2-2' }}</dd></div>
          <div><dt>RSI 14</dt><dd class="mono">{{ history.rsi | number: '1.0-0' }}</dd></div>
        </dl>
      } @else {
        <p class="muted small">Disponible cuando cargue el análisis.</p>
      }
    </div>
  `,
  styles: [`
    h2 { font-size: 26px; margin-top: 6px; }
    .summary { font-size: 14.5px; margin: 14px 0 18px; }
    .returns { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 14px 0; border-block: 1px solid var(--border); }
    .returns > div { display: flex; flex-direction: column; gap: 3px; }
    .returns strong { font-size: 16px; }
    dl { margin: 12px 0 0; }
    dl > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--border); }
    dl > div:last-child { border-bottom: 0; }
    dt { color: var(--text-muted); font-size: 13px; }
    dd { margin: 0; font-size: 13px; text-align: right; }
    small { color: var(--text-dim); }
    .loading { padding: 24px 0; }
    .small { font-size: 13.5px; }
  `],
})
export class HistoryCardComponent {
  @Input() history: HistoryReading | null = null;
  @Input() loading = false;

  returns(): { label: string; value: number | null }[] {
    const h = this.history!;
    return [
      { label: '1 mes', value: h.return_1m_pct },
      { label: '3 meses', value: h.return_3m_pct },
      { label: '6 meses', value: h.return_6m_pct },
      { label: '1 año', value: h.return_1y_pct },
    ];
  }
}
