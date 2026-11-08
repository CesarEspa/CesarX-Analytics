import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse } from './models';
import { DEMO_TOKEN, DEMO_USERNAME, isDemoSession } from './demo-api';

const TOKEN_KEY = 'cesarx.token';
const USERNAME_KEY = 'cesarx.username';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.apiBaseUrl;

  readonly username = signal<string | null>(localStorage.getItem(USERNAME_KEY));
  readonly isDemo = computed(() => this.username() !== null && isDemoSession());

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get isLoggedIn(): boolean {
    return this.token !== null;
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/auth/login`, { username, password })
      .pipe(tap((res) => this.storeSession(res)));
  }

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/auth/register`, { username, email, password })
      .pipe(tap((res) => this.storeSession(res)));
  }

  /** Opens the dashboard with simulated data: needs neither an account nor the backend. */
  startDemo(): void {
    this.storeSession({ token: DEMO_TOKEN, tokenType: 'Bearer', username: DEMO_USERNAME, role: 'USER', expiresInMs: 0 });
    this.router.navigate(['/']);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    this.username.set(null);
    this.router.navigate(['/login']);
  }

  private storeSession(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USERNAME_KEY, res.username);
    this.username.set(res.username);
  }
}
