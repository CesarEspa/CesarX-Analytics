import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DemoBadgeComponent } from './components/demo-badge.component';
import { WakeUpBannerComponent } from './components/wake-up-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, WakeUpBannerComponent, DemoBadgeComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
}
