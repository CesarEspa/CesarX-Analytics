import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/models';
import { environment } from '../../../environments/environment';

const HEALTH_TIMEOUT_MS = 90_000;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="logo">
          <span class="logo-mark">CX</span>
          <div>
            <h1>CesarX Analytics</h1>
            <p class="muted">ETF Intelligence Platform</p>
          </div>
        </div>

        <button class="btn demo" type="button" (click)="auth.startDemo()">Probar la demo sin registrarme</button>
        <p class="demo-note muted">Abre el panel con datos simulados. No necesita cuenta.</p>

        <div class="divider"><span>o entra con tu cuenta</span></div>

        <div class="tabs">
          <button class="tab" [class.active]="!isRegister()" (click)="isRegister.set(false)">Iniciar sesión</button>
          <button class="tab" [class.active]="isRegister()" (click)="isRegister.set(true)">Crear cuenta</button>
        </div>

        <form (ngSubmit)="submit()">
          <label>
            Usuario
            <input name="username" [(ngModel)]="username" required autocomplete="username" />
          </label>

          @if (isRegister()) {
            <label>
              Email
              <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" />
            </label>
          }

          <label>
            Contraseña
            <input name="password" type="password" [(ngModel)]="password" required
                   [attr.autocomplete]="isRegister() ? 'new-password' : 'current-password'" />
          </label>

          @if (error()) {
            <div class="error-box">{{ error() }}</div>
          }

          <button class="btn submit" type="submit" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner"></span>
            } @else {
              {{ isRegister() ? 'Registrarme' : 'Entrar' }}
            }
          </button>
        </form>

        <p class="server muted" [class.online]="server() === 'online'" role="status">
          <span class="server-dot"></span>
          @switch (server()) {
            @case ('checking') { Despertando el servidor. Puede tardar hasta un minuto. }
            @case ('online') { Servidor conectado. }
            @case ('offline') { El servidor no está disponible ahora. Puedes usar la demo. }
          }
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card { width: 100%; max-width: 400px; padding: 28px; }
    .logo { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
    .logo h1 { font-size: 20px; }
    .logo p { margin: 2px 0 0; font-size: 13px; }
    .logo-mark {
      background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      color: #fff; font-weight: 800; font-size: 18px;
      width: 46px; height: 46px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
    }
    .tabs {
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
      background: var(--bg-inset); border-radius: 12px; padding: 5px; margin-bottom: 20px;
    }
    .tab {
      background: transparent; border: none; color: var(--text-muted);
      padding: 9px; border-radius: 8px; font-size: 14px; font-weight: 600;
    }
    .tab.active { background: var(--bg-card); color: var(--text); box-shadow: var(--shadow); }
    form { display: flex; flex-direction: column; gap: 14px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; color: var(--text-muted); }
    .submit { margin-top: 6px; height: 42px; display: flex; align-items: center; justify-content: center; }
    .demo { width: 100%; height: 44px; }
    .demo-note { margin: 8px 0 0; font-size: 12.5px; text-align: center; }
    .divider { display: flex; align-items: center; gap: 10px; margin: 18px 0; color: var(--text-muted); font-size: 12.5px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .server { display: flex; align-items: center; gap: 8px; margin: 16px 0 0; font-size: 12.5px; }
    .server-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--amber); }
    .server.online .server-dot { background: var(--green); }
  `],
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isRegister = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly server = signal<'checking' | 'online' | 'offline'>('checking');

  username = '';
  email = '';
  password = '';

  ngOnInit(): void {
    fetch(`${environment.apiBaseUrl}/actuator/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
      .then((response) => this.server.set(response.ok ? 'online' : 'offline'))
      .catch(() => this.server.set('offline'));
  }

  submit(): void {
    if (!this.username || !this.password || (this.isRegister() && !this.email)) {
      this.error.set('Completa todos los campos.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const request$ = this.isRegister()
      ? this.auth.register(this.username, this.email, this.password)
      : this.auth.login(this.username, this.password);

    request$.subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const api = err.error as ApiError | undefined;
        const detail = api?.details?.length ? ` (${api.details.join(', ')})` : '';
        this.error.set((api?.message ?? 'No se pudo conectar con el servidor.') + detail);
      },
    });
  }
}
