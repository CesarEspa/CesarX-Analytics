import { Injectable, signal } from '@angular/core';

const WAKE_UP_THRESHOLD_MS = 5000;

/**
 * Tracks whether a request has been pending long enough that it's probably
 * the free-tier Render backend cold-starting (~30-50s), not a normal delay.
 * Used to show a "waking up..." banner instead of a silent/broken-looking UI.
 */
@Injectable({ providedIn: 'root' })
export class WakeUpService {
  readonly isWaking = signal(false);

  private pendingRequests = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  requestStarted(): void {
    this.pendingRequests++;
    if (this.timer === null) {
      this.timer = setTimeout(() => this.isWaking.set(true), WAKE_UP_THRESHOLD_MS);
    }
  }

  requestEnded(): void {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) {
      if (this.timer !== null) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.isWaking.set(false);
    }
  }
}
