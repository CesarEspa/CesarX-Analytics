import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PriceQuote } from '../core/models';

@Component({
  selector: 'app-quote-card',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <button type="button" class="quote" [class.selected]="selected" [attr.aria-pressed]="selected" (click)="select.emit(symbol)">
      <span class="head">
        <span class="symbol">{{ symbol }}</span>
        @if (quote) {
          <span class="badge" [class]="badgeClass()">{{ signalLabel() }}</span>
        }
      </span>
      <span class="name">{{ name }}</span>

      @if (quote) {
        <span class="price mono">{{ quote.currentPrice | number: '1.2-2' }}</span>
        <span class="change mono" [class.positive]="isUp()" [class.negative]="!isUp()">
          {{ isUp() ? '+' : '' }}{{ quote.changePercent | number: '1.2-2' }}%
        </span>
      } @else if (failed) {
        <span class="name failed">Sin datos de mercado</span>
      } @else {
        <span class="loading"><span class="spinner"></span></span>
      }
    </button>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .quote {
      display: flex; flex-direction: column; width: 100%; height: 100%; text-align: left;
      background: var(--bg-card); color: var(--text); border: 0; border-top: 2px solid var(--border);
      padding: 12px 14px; transition: border-color 0.2s, background 0.2s;
    }
    .quote:hover { border-top-color: var(--text); background: var(--bg-inset); }
    .quote.selected { border-top-color: var(--accent); background: var(--bg-inset); }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .symbol { font-family: var(--display); font-size: 22px; line-height: 1.1; }
    .name { color: var(--text-dim); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .failed { margin-top: 10px; }
    .price { font-size: 19px; font-weight: 700; margin-top: 10px; }
    .change { font-size: 12.5px; font-weight: 700; }
    .loading { margin-top: 12px; }
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
      case 'BUY': return 'Alza';
      case 'WAIT': return 'Baja';
      default: return 'Neutral';
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
