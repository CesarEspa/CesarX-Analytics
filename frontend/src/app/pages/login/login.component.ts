import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/models';
import { environment } from '../../../environments/environment';

const HEALTH_TIMEOUT_MS = 90_000;

type Mode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-wrap">
      <section class="intro">
        <a class="back label" href="https://cesarespa.github.io/CesarEspana-Portafolio/">← Portafolio</a>
        <div>
          <div class="label red">Full-stack · IA aplicada a ETFs</div>
          <h1>CesarX<br>Analytics</h1>
          <p class="lead">Precios reales, proyección validada con ciencia de datos y noticias del día, en un solo panel.</p>
        </div>
        <p class="server label" [class.online]="server() === 'online'" role="status">
          <i></i>
          @switch (server()) {
            @case ('checking') { Despertando el servidor. Puede tardar hasta un minuto. }
            @case ('online') { Servidor conectado }
            @case ('offline') { Servidor no disponible. Puedes usar la demo. }
          }
        </p>
      </section>

      <section class="panel">
        @if (mode() === 'forgot') {
          <h2>Recuperar acceso</h2>
          <p class="muted hint">Por seguridad tu contraseña se guarda cifrada y nadie puede verla, ni siquiera el administrador. Te enviamos un enlace para crear una nueva y te recordamos tu usuario.</p>

          @if (sent()) {
            <div class="ok-box">Si ese correo tiene una cuenta, recibirás el enlace en unos minutos. Revisa también la carpeta de spam.</div>
          } @else {
            <form (ngSubmit)="sendReset()">
              <label>
                Email de tu cuenta
                <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" />
              </label>
              @if (error()) {
                <div class="error-box">{{ error() }}</div>
              }
              <button class="btn submit" type="submit" [disabled]="loading()">
                @if (loading()) { <span class="spinner"></span> } @else { Enviar enlace }
              </button>
            </form>
          }
          <button class="link-btn back-link" type="button" (click)="setMode('login')">Volver a iniciar sesión</button>
        } @else {
          <button class="btn demo" type="button" (click)="auth.startDemo()">Probar la demo sin registrarme</button>
          <p class="demo-note muted">Datos simulados. No necesita cuenta.</p>

          <div class="divider"><span>o con tu cuenta</span></div>

          <div class="tabs">
            <button class="tab" type="button" [class.active]="mode() === 'login'" (click)="setMode('login')">Iniciar sesión</button>
            <button class="tab" type="button" [class.active]="mode() === 'register'" (click)="setMode('register')">Crear cuenta</button>
          </div>

          <form (ngSubmit)="submit()">
            <label>
              Usuario
              <input name="username" [(ngModel)]="username" required autocomplete="username" />
            </label>

            @if (mode() === 'register') {
              <label>
                Email
                <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" />
              </label>
            }

            <label>
              Contraseña
              <span class="password">
                <input name="password" [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" required
                       [attr.autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'" />
                <button class="toggle" type="button" (click)="showPassword.set(!showPassword())"
                        [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  {{ showPassword() ? 'Ocultar' : 'Ver' }}
                </button>
              </span>
            </label>

            @if (mode() === 'login') {
              <button class="link-btn forgot" type="button" (click)="setMode('forgot')">¿Olvidaste tu contraseña?</button>
            }

            @if (error()) {
              <div class="error-box">{{ error() }}</div>
            }

            <button class="btn submit" type="submit" [disabled]="loading()">
              @if (loading()) { <span class="spinner"></span> } @else { {{ mode() === 'register' ? 'Registrarme' : 'Entrar' }} }
            </button>
          </form>
        }
      </section>
    </div>
  `,
  styles: [`
    .login-wrap { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
    .intro {
      display: flex; flex-direction: column; justify-content: space-between; gap: 48px;
      padding: clamp(24px, 4vw, 64px); border-right: 1px solid var(--border);
    }
    .back { text-decoration: none; }
    .back:hover { color: var(--accent); }
    h1 { font-size: clamp(64px, 10.5vw, 168px); line-height: 0.92; margin-top: 16px; }
    .lead { max-width: 46ch; font-size: clamp(16px, 1.4vw, 20px); margin: 22px 0 0; color: var(--text-muted); }
    .server { display: flex; align-items: center; gap: 8px; margin: 0; }
    .server i { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--amber); }
    .server.online i { background: var(--green); }
    .panel { display: flex; flex-direction: column; justify-content: center; padding: clamp(24px, 4vw, 64px); }
    .panel > * { width: 100%; max-width: 420px; margin-inline: auto; }
    h2 { font-size: 40px; }
    .hint { font-size: 14px; margin-top: 10px; margin-bottom: 18px; }
    .tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--border-strong); margin-bottom: 20px; }
    .tab {
      background: transparent; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px;
      color: var(--text-muted); padding: 10px; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
    }
    .tab.active { color: var(--text); border-bottom-color: var(--accent); }
    form { display: flex; flex-direction: column; gap: 14px; }
    label { display: grid; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
    label input { letter-spacing: normal; text-transform: none; font-weight: 500; }
    .password { position: relative; display: block; }
    .password input { padding-right: 76px; }
    .toggle {
      position: absolute; top: 50%; right: 10px; transform: translateY(-50%);
      background: none; border: 0; color: var(--text-muted); font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
    }
    .toggle:hover { color: var(--accent); }
    .forgot { align-self: flex-end; margin-top: -6px; }
    .submit { height: 46px; display: flex; align-items: center; justify-content: center; }
    .demo { height: 46px; }
    .demo-note { margin: 8px auto 0; font-size: 12.5px; text-align: center; }
    .divider { display: flex; align-items: center; gap: 10px; margin: 20px auto; color: var(--text-dim); font-size: 12px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .back-link { margin-top: 16px; text-align: left; }
    @media (max-width: 860px) {
      .login-wrap { grid-template-columns: minmax(0, 1fr); }
      .intro { border-right: 0; border-bottom: 1px solid var(--border); gap: 28px; }
      h1 { font-size: clamp(56px, 18vw, 110px); }
    }
  `],
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<Mode>('login');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);
  readonly showPassword = signal(false);
  readonly server = signal<'checking' | 'online' | 'offline'>('checking');

  username = '';
  email = '';
  password = '';

  ngOnInit(): void {
    fetch(`${environment.apiBaseUrl}/actuator/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
      .then((response) => this.server.set(response.ok ? 'online' : 'offline'))
      .catch(() => this.server.set('offline'));
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.sent.set(false);
  }

  submit(): void {
    const registering = this.mode() === 'register';
    if (!this.username || !this.password || (registering && !this.email)) {
      this.error.set('Completa todos los campos.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const request$ = registering
      ? this.auth.register(this.username, this.email, this.password)
      : this.auth.login(this.username, this.password);

    request$.subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => this.fail(err),
    });
  }

  sendReset(): void {
    if (!this.email) {
      this.error.set('Escribe el email de tu cuenta.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.auth.forgotPassword(this.email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (err: HttpErrorResponse) => this.fail(err),
    });
  }

  private fail(err: HttpErrorResponse): void {
    this.loading.set(false);
    const api = err.error as ApiError | undefined;
    const detail = api?.details?.length ? ` (${api.details.join(', ')})` : '';
    this.error.set((api?.message ?? 'No se pudo conectar con el servidor.') + detail);
  }
}
