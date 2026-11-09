import { Component, Input } from '@angular/core';
import { ForecastExplanation } from '../core/models';

const EFFECTS = { up: 'A favor', down: 'En contra', neutral: 'Neutral' };

@Component({
  selector: 'app-forecast-explanation',
  standalone: true,
  template: `
    <section class="card" aria-live="polite">
      <div class="label red">Por qué se podría mover así</div>
      @if (loading) {
        <div class="loading"><span class="spinner"></span> <span class="muted">Calculando este plazo…</span></div>
      } @else if (explanation; as e) {
        <p class="headline">{{ e.headline }}</p>
        <ul>
          @for (reason of e.reasons; track reason.source) {
            <li>
              <div class="tag">
                <strong>{{ reason.source }}</strong>
                <span class="effect" [class]="'effect ' + reason.effect">{{ effects[reason.effect] }}</span>
              </div>
              <p>{{ reason.text }}</p>
            </li>
          }
        </ul>
        <p class="muted caveat">{{ e.caveat }}</p>
      } @else {
        <p class="muted">Disponible cuando cargue la proyección.</p>
      }
    </section>
  `,
  styles: [`
    .headline { font-size: 18px; font-weight: 700; line-height: 1.4; margin: 10px 0 6px; max-width: 80ch; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 32px; }
    li { padding: 13px 0; border-top: 1px solid var(--border); min-width: 0; }
    .tag { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .tag strong { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .effect { font-size: 12px; color: var(--text-muted); }
    .effect.up { color: var(--green); }
    .effect.down { color: var(--accent); }
    li p { margin: 6px 0 0; font-size: 14px; line-height: 1.55; overflow-wrap: anywhere; }
    .caveat { font-size: 12.5px; margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--border); }
    .loading { padding: 24px 0; display: flex; align-items: center; gap: 10px; font-size: 13.5px; }
    @media (max-width: 760px) {
      ul { grid-template-columns: minmax(0, 1fr); }
      .headline { font-size: 16px; }
    }
  `],
})
export class ForecastExplanationComponent {
  @Input() explanation: ForecastExplanation | null = null;
  @Input() loading = false;

  readonly effects = EFFECTS;
}
