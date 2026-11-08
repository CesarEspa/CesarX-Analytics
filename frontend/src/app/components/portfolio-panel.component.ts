import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EtfResponse, PortfolioPositionRequest, PortfolioSummary } from '../core/models';

@Component({
  selector: 'app-portfolio-panel',
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  template: `
    <div class="card">
      <div class="panel-head">
        <h2>Mi portfolio</h2>
        <button class="btn-ghost" (click)="showForm.set(!showForm())">
          {{ showForm() ? 'Cancelar' : '+ Agregar posición' }}
        </button>
      </div>

      @if (summary) {
        <div class="totals">
          <div class="total">
            <span class="muted">Valor de mercado</span>
            <strong>{{ summary.totalMarketValue | number: '1.2-2' }} USD</strong>
          </div>
          <div class="total">
            <span class="muted">Invertido</span>
            <strong>{{ summary.totalCostBasis | number: '1.2-2' }} USD</strong>
          </div>
          <div class="total">
            <span class="muted">Ganancia / Pérdida</span>
            <strong [class.positive]="summary.totalGainLoss >= 0" [class.negative]="summary.totalGainLoss < 0">
              {{ summary.totalGainLoss >= 0 ? '+' : '' }}{{ summary.totalGainLoss | number: '1.2-2' }}
              ({{ summary.totalGainLossPercent | number: '1.2-2' }}%)
            </strong>
          </div>
        </div>
      }

      @if (showForm()) {
        <form class="add-form" (ngSubmit)="submit()">
          <select name="symbol" [(ngModel)]="form.symbol" required>
            <option value="" disabled>ETF</option>
            @for (etf of etfs; track etf.id) {
              <option [value]="etf.symbol">{{ etf.symbol }}</option>
            }
          </select>
          <input name="quantity" type="number" step="any" min="0.000001" placeholder="Cantidad"
                 [(ngModel)]="form.quantity" required />
          <input name="avgBuyPrice" type="number" step="any" min="0.0001" placeholder="Precio compra"
                 [(ngModel)]="form.avgBuyPrice" required />
          <input name="purchaseDate" type="date" [(ngModel)]="form.purchaseDate" required />
          <button class="btn" type="submit">Guardar</button>
        </form>
      }

      @if (summary && summary.positions.length > 0) {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ETF</th>
                <th>Cantidad</th>
                <th>P. compra</th>
                <th>P. actual</th>
                <th>Valor</th>
                <th>G/P</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (pos of summary.positions; track pos.id) {
                <tr>
                  <td>
                    <strong>{{ pos.symbol }}</strong>
                    <div class="muted small">{{ pos.purchaseDate }}</div>
                  </td>
                  <td>{{ pos.quantity | number: '1.0-6' }}</td>
                  <td>{{ pos.avgBuyPrice | number: '1.2-2' }}</td>
                  <td>{{ pos.currentPrice | number: '1.2-2' }}</td>
                  <td>{{ pos.marketValue | number: '1.2-2' }}</td>
                  <td [class.positive]="pos.gainLoss >= 0" [class.negative]="pos.gainLoss < 0">
                    {{ pos.gainLoss >= 0 ? '+' : '' }}{{ pos.gainLoss | number: '1.2-2' }}
                    <div class="small">({{ pos.gainLossPercent | number: '1.2-2' }}%)</div>
                  </td>
                  <td><button class="btn-danger" (click)="remove.emit(pos.id)">✕</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (summary) {
        <p class="muted empty">Aún no tienes posiciones. Agrega tus compras reales de eToro para seguirlas aquí.</p>
      } @else {
        <div class="loading-row"><span class="spinner"></span></div>
      }
    </div>
  `,
  styles: [`
    .panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    h2 { font-size: 26px; }
    .totals {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px; margin-bottom: 16px;
    }
    .total {
      background: var(--bg-inset); border: 1px solid var(--border); border-radius: 2px;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
    }
    .total span { font-size: 12.5px; }
    .total strong { font-size: 17px; }
    .add-form {
      display: grid; grid-template-columns: 110px 1fr 1fr 1fr auto;
      gap: 10px; margin-bottom: 16px;
    }
    .table-wrap { overflow-x: auto; }
    .small { font-size: 12px; }
    .empty { font-size: 14px; }
    .loading-row { padding: 14px 0; }
    @media (max-width: 720px) {
      .add-form { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class PortfolioPanelComponent {
  @Input() summary: PortfolioSummary | null = null;
  @Input() etfs: EtfResponse[] = [];

  @Output() add = new EventEmitter<PortfolioPositionRequest>();
  @Output() remove = new EventEmitter<number>();

  readonly showForm = signal(false);

  form: { symbol: string; quantity: number | null; avgBuyPrice: number | null; purchaseDate: string } = {
    symbol: '',
    quantity: null,
    avgBuyPrice: null,
    purchaseDate: '',
  };

  submit(): void {
    if (!this.form.symbol || !this.form.quantity || !this.form.avgBuyPrice || !this.form.purchaseDate) {
      return;
    }
    this.add.emit({
      symbol: this.form.symbol,
      quantity: this.form.quantity,
      avgBuyPrice: this.form.avgBuyPrice,
      purchaseDate: this.form.purchaseDate,
    });
    this.showForm.set(false);
    this.form = { symbol: '', quantity: null, avgBuyPrice: null, purchaseDate: '' };
  }
}
