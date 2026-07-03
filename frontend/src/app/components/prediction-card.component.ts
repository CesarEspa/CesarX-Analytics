import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Prediction } from '../core/models';

@Component({
  selector: 'app-prediction-card',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="card">
      <div class="head">
        <h2>Predicción a 1 mes</h2>
        <span class="muted model-tag">scikit-learn</span>
      </div>

      @if (loading) {
        <div class="loading"><span class="spinner"></span></div>
      } @else if (error) {
        <p class="muted err">{{ error }}</p>
      } @else if (prediction) {
        <div class="main-row">
          <div class="arrow" [class]="directionClass()">
            {{ directionArrow() }}
          </div>
          <div>
            <div class="price-line">
              <span class="muted">{{ prediction.current_price | number: '1.2-2' }}</span>
              <span class="sep">→</span>
              <strong>{{ prediction.predicted_price | number: '1.2-2' }} USD</strong>
            </div>
            <div class="return" [class.positive]="prediction.predicted_return_pct >= 0"
                 [class.negative]="prediction.predicted_return_pct < 0">
              {{ prediction.predicted_return_pct >= 0 ? '+' : '' }}{{ prediction.predicted_return_pct | number: '1.2-2' }}%
              <span class="muted horizon">en ~30 días</span>
            </div>
          </div>
        </div>

        <div class="meta">
          <span class="badge" [class]="confidenceClass()">Confianza: {{ confidenceLabel() }}</span>
          <span class="muted samples">{{ prediction.trained_samples }} días de entrenamiento · R² {{ prediction.holdout_r2 }}</span>
        </div>

        <p class="muted disclaimer">
          Modelo estadístico simple ({{ prediction.model }}). No es asesoría financiera.
        </p>
      }
    </div>
  `,
  styles: [`
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    h2 { font-size: 17px; }
    .model-tag { font-size: 12px; border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
    .main-row { display: flex; align-items: center; gap: 16px; }
    .arrow {
      font-size: 34px; width: 62px; height: 62px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center; font-weight: 800;
    }
    .arrow.up { background: var(--green-soft); color: var(--green); }
    .arrow.down { background: var(--red-soft); color: var(--red); }
    .arrow.side { background: var(--amber-soft); color: var(--amber); }
    .price-line { font-size: 17px; display: flex; gap: 8px; align-items: baseline; }
    .price-line strong { font-size: 21px; }
    .sep { color: var(--text-muted); }
    .return { font-size: 15px; font-weight: 700; margin-top: 4px; }
    .horizon { font-weight: 400; font-size: 13px; }
    .meta { display: flex; align-items: center; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
    .samples { font-size: 12.5px; }
    .disclaimer { font-size: 12px; margin: 14px 0 0; }
    .loading { padding: 20px 0; }
    .err { font-size: 13.5px; }
  `],
})
export class PredictionCardComponent {
  @Input() prediction: Prediction | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

  directionArrow(): string {
    switch (this.prediction?.direction) {
      case 'UP': return '↗';
      case 'DOWN': return '↘';
      default: return '→';
    }
  }

  directionClass(): string {
    switch (this.prediction?.direction) {
      case 'UP': return 'arrow up';
      case 'DOWN': return 'arrow down';
      default: return 'arrow side';
    }
  }

  confidenceLabel(): string {
    switch (this.prediction?.confidence) {
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Media';
      default: return 'Baja';
    }
  }

  confidenceClass(): string {
    switch (this.prediction?.confidence) {
      case 'HIGH': return 'badge badge-buy';
      case 'MEDIUM': return 'badge badge-hold';
      default: return 'badge badge-wait';
    }
  }
}
