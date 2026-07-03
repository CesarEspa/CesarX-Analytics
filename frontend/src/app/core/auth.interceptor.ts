import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { WakeUpService } from './wake-up.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const wakeUp = inject(WakeUpService);
  const token = auth.token;

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  wakeUp.requestStarted();

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthCall = req.url.includes('/api/auth/');
      if (error.status === 401 && !isAuthCall) {
        auth.logout();
      }
      return throwError(() => error);
    }),
    finalize(() => wakeUp.requestEnded())
  );
};
