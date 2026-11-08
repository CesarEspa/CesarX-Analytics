import { Component, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { resetDemoData } from '../core/demo-api';

@Component({
  selector: 'app-demo-badge',
  standalone: true,
  template: `
    @if (auth.isDemo()) {
      <div class="demo-badge" role="status">
        <span class="dot"></span>
        <span><strong>Modo demo</strong> · datos simulados, no es asesoría financiera</span>
        <button type="button" (click)="reset()">Reiniciar</button>
      </div>
    }
  `,
  styles: `
    .demo-badge {
      position: fixed; left: 12px; bottom: 12px; z-index: 900;
      max-width: calc(100vw - 24px);
      display: flex; align-items: center; gap: 8px;
      background: var(--text); color: #fff;
      padding: 8px 12px; border-radius: 10px;
      font-size: 12.5px; box-shadow: var(--shadow);
    }
    .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
    button {
      flex: none; background: transparent; color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 6px;
      padding: 3px 8px; font-size: 12px;
    }
  `,
})
export class DemoBadgeComponent {
  readonly auth = inject(AuthService);

  reset(): void {
    resetDemoData();
    location.reload();
  }
}
