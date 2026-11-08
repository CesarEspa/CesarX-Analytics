import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertItem, AlertRequest, AlertType, EtfResponse } from '../core/models';

const ALERT_LABELS: Record<AlertType, string> = {
  PRICE_ABOVE: 'Precio sube de',
  PRICE_BELOW: 'Precio baja de',
  PERCENT_CHANGE_UP: 'Sube más de (%)',
  PERCENT_CHANGE_DOWN: 'Baja más de (%)',
};

@Component({
  selector: 'app-alerts-panel',
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  template: `
    <div class="card">
      <div class="panel-head">
        <h2>Alertas</h2>
        <button class="btn-ghost" (click)="showForm.set(!showForm())">
          {{ showForm() ? 'Cancelar' : '+ Nueva alerta' }}
        </button>
      </div>

      @if (showForm()) {
        <form class="add-form" (ngSubmit)="submit()">
          <select name="symbol" [(ngModel)]="form.symbol" required>
            <option value="" disabled>ETF</option>
            @for (etf of etfs; track etf.id) {
              <option [value]="etf.symbol">{{ etf.symbol }}</option>
            }
          </select>
          <select name="alertType" [(ngModel)]="form.alertType" required>
            <option value="PRICE_ABOVE">Precio sube de…</option>
            <option value="PRICE_BELOW">Precio baja de…</option>
            <option value="PERCENT_CHANGE_UP">Sube más de X%</option>
            <option value="PERCENT_CHANGE_DOWN">Baja más de X%</option>
          </select>
          <input name="targetValue" type="number" step="any" placeholder="Valor objetivo"
                 [(ngModel)]="form.targetValue" required />
          <button class="btn" type="submit">Crear</button>
        </form>
      }

      @if (alerts.length > 0) {
        <ul class="alert-list">
          @for (alert of alerts; track alert.id) {
            <li [class.inactive]="!alert.active && !alert.triggeredAt">
              <div class="alert-info">
                <strong>{{ alert.symbol }}</strong>
                <span class="muted">{{ label(alert.alertType) }} {{ alert.targetValue | number: '1.2-2' }}</span>
                @if (alert.triggeredAt) {
                  <span class="badge badge-buy">Disparada</span>
                } @else if (!alert.active) {
                  <span class="badge badge-hold">Pausada</span>
                }
              </div>
              <div class="alert-actions">
                @if (!alert.triggeredAt) {
                  <button class="btn-ghost" (click)="toggle.emit(alert)">
                    {{ alert.active ? 'Pausar' : 'Activar' }}
                  </button>
                }
                <button class="btn-danger" (click)="remove.emit(alert.id)">✕</button>
              </div>
            </li>
          }
        </ul>
      } @else {
        <p class="muted empty">Sin alertas. Crea una para recibir aviso cuando un ETF cruce tu precio objetivo.</p>
      }
    </div>
  `,
  styles: [`
    .panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    h2 { font-size: 26px; }
    .add-form { display: grid; grid-template-columns: 100px 1fr 1fr auto; gap: 10px; margin-bottom: 16px; }
    .alert-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    li {
      display: flex; justify-content: space-between; align-items: center; gap: 10px;
      padding: 11px 4px; border-bottom: 1px solid var(--border);
    }
    li:last-child { border-bottom: none; }
    li.inactive { opacity: 0.55; }
    .alert-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14px; }
    .alert-actions { display: flex; align-items: center; gap: 6px; }
    .empty { font-size: 14px; }
    @media (max-width: 720px) {
      .add-form { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class AlertsPanelComponent {
  @Input() alerts: AlertItem[] = [];
  @Input() etfs: EtfResponse[] = [];

  @Output() create = new EventEmitter<AlertRequest>();
  @Output() toggle = new EventEmitter<AlertItem>();
  @Output() remove = new EventEmitter<number>();

  readonly showForm = signal(false);

  form: { symbol: string; alertType: AlertType; targetValue: number | null } = {
    symbol: '',
    alertType: 'PRICE_ABOVE',
    targetValue: null,
  };

  label(type: AlertType): string {
    return ALERT_LABELS[type];
  }

  submit(): void {
    if (!this.form.symbol || this.form.targetValue === null) {
      return;
    }
    this.create.emit({
      symbol: this.form.symbol,
      alertType: this.form.alertType,
      targetValue: this.form.targetValue,
    });
    this.showForm.set(false);
    this.form = { symbol: '', alertType: 'PRICE_ABOVE', targetValue: null };
  }
}
