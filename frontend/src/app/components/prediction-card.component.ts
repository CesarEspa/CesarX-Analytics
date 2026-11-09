import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Prediction } from '../core/models';

@Component({
  selector: 'app-prediction-card',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="card">
      <div class="label red">Proyección validada</div>
      <h2>A {{ horizonLabel }}</h2>

      @if (loading) {
        <div class="loading"><span class="spinner"></span> <span class="muted small">Entrenando y validando modelos…</span></div>
      } @else if (error) {
        <p class="muted small">{{ error }}</p>
      } @else if (prediction; as p) {
        <div class="headline mono">
          <span class="target">{{ p.predicted_price | number: '1.2-2' }}</span>
          <span [class.positive]="p.predicted_return_pct >= 0" [class.negative]="p.predicted_return_pct < 0">
            {{ p.predicted_return_pct >= 0 ? '+' : '' }}{{ p.predicted_return_pct | number: '1.2-2' }}%
          </span>
        </div>
        <p class="muted small">Desde {{ p.current_price | number: '1.2-2' }} USD · {{ directionLabel() }}</p>

        <div class="range">
          <div><span class="label">Rango {{ p.interval.level }}%</span><strong class="mono">{{ p.interval.low_price | number: '1.2-2' }} – {{ p.interval.high_price | number: '1.2-2' }}</strong></div>
          <div><span class="label">Prob. de subir</span><strong class="mono">{{ p.prob_up_pct | number: '1.0-0' }}%</strong></div>
        </div>

        <div class="verdict">
          <span class="badge" [class]="confidenceClass()">Confianza {{ confidenceLabel() }}</span>
          <span class="muted model">Modelo: {{ p.model }}</span>
        </div>
        <p class="note">{{ verdictText() }}</p>

        <details>
          <summary>Cómo se validó</summary>
          <p class="muted small">
            @if (p.validation.enough_periods) {
              {{ p.validation.method }}. {{ p.trained_samples }} sesiones; los últimos {{ p.validation.independent_periods }} periodos sin solapar no se usaron para elegir el modelo.
              En esos periodos, el rango contuvo el {{ p.validation.interval_coverage_pct | number: '1.0-0' }}% de los resultados reales.
            } @else {
              Con {{ p.trained_samples }} sesiones solo quedan {{ p.validation.independent_periods }} periodos sin solapar a este plazo, muy pocos para validar un modelo. La cifra y el rango resumen lo ocurrido en esos años.
            }
          </p>
          <table>
            <thead><tr><th>Modelo</th><th>R²</th><th>Error</th><th>Acierto</th></tr></thead>
            <tbody>
              @for (c of p.candidates; track c.name) {
                <tr [class.chosen]="c.selected">
                  <td>{{ c.name }}</td>
                  <td class="mono">{{ c.r2_oos | number: '1.3-3' }}</td>
                  <td class="mono">{{ c.mae_pct | number: '1.1-1' }}%</td>
                  <td class="mono">{{ c.directional_accuracy_pct | number: '1.0-0' }}%</td>
                </tr>
              }
            </tbody>
          </table>
          @if (p.top_factors.length > 0) {
            <p class="label factors-title">Lo que más pesó en {{ p.best_candidate }}</p>
            <ul>
              @for (f of p.top_factors; track f.feature) {
                <li><span>{{ f.label }}</span><span class="mono">{{ f.weight_pct | number: '1.0-0' }}%</span></li>
              }
            </ul>
          }
        </details>

        <p class="muted disclaimer">Estimación estadística. No es asesoría financiera.</p>
      }
    </div>
  `,
  styles: [`
    h2 { font-size: 26px; margin-top: 6px; }
    .headline { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: 16px; font-size: 16px; font-weight: 700; }
    .target { font-family: var(--display); font-weight: 400; font-size: 54px; line-height: 1; }
    .small { font-size: 13px; margin: 6px 0 0; }
    .range { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 12px; margin-top: 16px; padding: 12px 0; border-block: 1px solid var(--border); }
    .range > div { display: flex; flex-direction: column; gap: 3px; }
    .range strong { font-size: 15px; }
    .verdict { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    .model { font-size: 12.5px; }
    .note { font-size: 13.5px; margin: 8px 0 0; }
    details { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 10px; }
    summary { cursor: pointer; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    summary:hover { color: var(--accent); }
    table { margin-top: 10px; font-size: 12.5px; }
    th, td { padding: 6px 4px; }
    .chosen td { color: var(--accent); font-weight: 700; }
    .factors-title { margin: 14px 0 4px; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 4px 0; }
    .disclaimer { font-size: 11.5px; margin: 14px 0 0; }
    .loading { padding: 24px 0; display: flex; align-items: center; gap: 10px; }
  `],
})
export class PredictionCardComponent {
  @Input() prediction: Prediction | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() horizonLabel = '1 semana';

  directionLabel(): string {
    switch (this.prediction?.direction) {
      case 'UP': return 'tendencia al alza';
      case 'DOWN': return 'tendencia a la baja';
      default: return 'tendencia lateral';
    }
  }

  verdictText(): string {
    const p = this.prediction!;
    if (!p.validation.enough_periods) {
      return 'A este plazo no hay datos suficientes para validar un modelo: es el promedio histórico, no una predicción.';
    }
    if (p.validation.reliable) {
      return 'El modelo superó a la media histórica con respaldo estadístico en datos que no vio.';
    }
    if (p.validation.beats_baseline) {
      return 'Superó por poco a la media histórica, pero la ventaja no es estadísticamente sólida.';
    }
    return `Ningún modelo superó a la media histórica en datos no vistos, así que se usa esa referencia.`;
  }

  confidenceLabel(): string {
    switch (this.prediction?.confidence) {
      case 'HIGH': return 'alta';
      case 'MEDIUM': return 'media';
      default: return 'baja';
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
