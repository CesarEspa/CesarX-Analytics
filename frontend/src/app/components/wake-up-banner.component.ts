import { Component, inject } from '@angular/core';
import { WakeUpService } from '../core/wake-up.service';

@Component({
  selector: 'app-wake-up-banner',
  standalone: true,
  template: `
    @if (wakeUp.isWaking()) {
      <div class="banner">
        <span class="spinner"></span>
        Despertando el servidor... puede tardar hasta 50 segundos (plan gratuito).
      </div>
    }
  `,
  styles: `
    .banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      background: var(--accent); color: #fff;
      padding: 10px 16px; font-size: 13.5px; font-weight: 600;
    }
    .spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: #fff;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `,
})
export class WakeUpBannerComponent {
  readonly wakeUp = inject(WakeUpService);
}
