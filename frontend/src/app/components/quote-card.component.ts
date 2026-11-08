import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PriceQuote } from '../core/models';

@Component({
  selector: 'app-quote-card',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="card quote-card" [class.selected]="selected" (click)="select.emit(symbol)">
      <div class="head">
        <div class="identity">
          <div class="symbol">{{ symbol }}</div>
          <div class="name muted">{{ name }}</div>
        </div>
        @if (quote) {
          <span class="badge" [class]="badgeClass()">{{ signalLabel() }}</span>
        }
      </div>

      @if (quote) {
        <div class="price-row">
          <span class="price">{{ quote.currentPrice | number: '1.2-2' }}</span>
          <span class="currency muted">{{ quote.currency }}</span>
        </div>
        <div class="change" [class.positive]="isUp()" [class.negative]="!isUp()">
          {{ isUp() ? '▲' : '▼' }}
          {{ quote.change | number: '1.2-2' }}
          ({{ quote.changePercent | number: '1.2-2' }}%)
        </div>
        <div class="range muted">
          Día: {{ quote.dayLow | number: '1.2-2' }} — {{ quote.dayHigh | number: '1.2-2' }}
        </div>
      } @else if (failed) {
        <div class="muted small">Sin datos de mercado</div>
      } @else {
        <div class="loading"><span class="spinner"></span></div>
      }
    </div>
  `,
  styles: [`
    .quote-card { cursor: pointer; transition: border-color 0.15s, transform 0.1s; }
    .quote-card:hover { border-color: var(--accent); }
    .quote-card.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .identity { min-width: 0; }
    .head .badge { flex: none; }
    .symbol { font-size: 18px; font-weight: 700; }
    .name { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .price-row { display: flex; align-items: baseline; gap: 6px; margin-top: 12px; }
    .price { font-size: 26px; font-weight: 700; }
    .currency { font-size: 13px; }
    .change { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .range { font-size: 12.5px; margin-top: 8px; }
    .small { font-size: 13px; margin-top: 12px; }
    .loading { margin-top: 14px; }
  `],
})
export class QuoteCardComponent {
  @Input({ required: true }) symbol!: string;
  @Input() name = '';
  @Input() quote: PriceQuote | null = null;
  @Input() failed = false;
  @Input() selected = false;

  @Output() select = new EventEmitter<string>();

  isUp(): boolean {
    return (this.quote?.change ?? 0) >= 0;
  }

  signalLabel(): string {
    switch (this.quote?.signal) {
      case 'BUY': return 'Comprar';
      case 'WAIT': return 'Esperar';
      default: return 'Mantener';
    }
  }

  badgeClass(): string {
    switch (this.quote?.signal) {
      case 'BUY': return 'badge badge-buy';
      case 'WAIT': return 'badge badge-wait';
      default: return 'badge badge-hold';
    }
  }
}
