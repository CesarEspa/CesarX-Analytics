import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/models';

const MIN_LENGTH = 8;

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="wrap">
      <div class="label red">CesarX Analytics</div>
      <h1>Nueva contraseña</h1>

      @if (done()) {
        <div class="ok-box">Listo. Ya puedes entrar con tu contraseña nueva.</div>
        <a class="btn go" routerLink="/login">Iniciar sesión</a>
      } @else if (!token) {
        <div class="error-box">Este enlace está incompleto. Solicita uno nuevo desde la página de inicio de sesión.</div>
        <a class="link-btn go-link" routerLink="/login">Volver</a>
      } @else {
        <form (ngSubmit)="submit()">
          <label>
            Contraseña nueva
            <input name="password" type="password" [(ngModel)]="password" required autocomplete="new-password" />
          </label>
          <label>
            Repítela
            <input name="confirm" type="password" [(ngModel)]="confirm" required autocomplete="new-password" />
          </label>
          <p class="muted hint">Mínimo {{ minLength }} caracteres.</p>
          @if (error()) {
            <div class="error-box">{{ error() }}</div>
          }
          <button class="btn submit" type="submit" [disabled]="loading()">
            @if (loading()) { <span class="spinner"></span> } @else { Guardar contraseña }
          </button>
        </form>
      }
    </main>
  `,
  styles: [`
    .wrap { min-height: 100vh; max-width: 460px; margin: 0 auto; padding: 24px 16px; display: flex; flex-direction: column; justify-content: center; }
    h1 { font-size: clamp(48px, 9vw, 72px); margin: 10px 0 24px; }
    form { display: flex; flex-direction: column; gap: 14px; }
    label { display: grid; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
    .hint { font-size: 13px; margin: 0; }
    .submit { height: 46px; display: flex; align-items: center; justify-content: center; }
    .go { margin-top: 16px; text-align: center; text-decoration: none; }
    .go-link { margin-top: 16px; }
  `],
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  readonly minLength = MIN_LENGTH;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal(false);

  password = '';
  confirm = '';

  submit(): void {
    if (this.password.length < MIN_LENGTH) {
      this.error.set(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.token!, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.done.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set((err.error as ApiError | undefined)?.message ?? 'No se pudo conectar con el servidor.');
      },
    });
  }
}
