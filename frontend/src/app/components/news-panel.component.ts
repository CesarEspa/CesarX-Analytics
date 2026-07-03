import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NewsAnalysis, Sentiment } from '../core/models';

@Component({
  selector: 'app-news-panel',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="card">
      <div class="head">
        <h2>Noticias y sentimiento</h2>
        @if (analysis) {
          <span class="badge" [class]="badgeClass(analysis.overall_sentiment)">
            {{ sentimentLabel(analysis.overall_sentiment) }}
          </span>
        }
      </div>

      @if (loading) {
        <div class="loading"><span class="spinner"></span> <span class="muted analyzing">Claude está analizando las noticias…</span></div>
      } @else if (error) {
        <p class="muted err">{{ error }}</p>
      } @else if (analysis) {
        <div class="outlook">
          <span class="outlook-label">¿Qué podría pasar?</span>
          <p>{{ analysis.outlook }}</p>
        </div>

        @if (analysis.articles.length > 0) {
          <ul class="articles">
            @for (article of analysis.articles; track article.url) {
              <li>
                <span class="dot" [class]="dotClass(article.sentiment)" [title]="sentimentLabel(article.sentiment)"></span>
                <div class="article-body">
                  <a [href]="article.url" target="_blank" rel="noopener">{{ article.title }}</a>
                  @if (article.reason) {
                    <div class="reason muted">{{ article.reason }}</div>
                  }
                  <div class="meta muted">{{ article.source }} · {{ article.published_at | date: 'dd MMM HH:mm' }}</div>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="muted err">Sin noticias recientes.</p>
        }
      }
    </div>
  `,
  styles: [`
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 10px; }
    h2 { font-size: 17px; }
    .outlook {
      background: var(--accent-soft); border: 1px solid #d9775755;
      border-radius: 12px; padding: 12px 14px; margin-bottom: 14px;
    }
    .outlook-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent-strong); }
    .outlook p { margin: 6px 0 0; font-size: 14px; line-height: 1.5; }
    .articles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; max-height: 420px; overflow-y: auto; }
    li { display: flex; gap: 10px; align-items: flex-start; }
    .dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
    .dot.pos { background: var(--green); }
    .dot.neg { background: var(--red); }
    .dot.neu { background: var(--text-muted); }
    .article-body a { color: var(--text); text-decoration: none; font-size: 14px; line-height: 1.4; }
    .article-body a:hover { color: var(--accent); }
    .reason { font-size: 12.5px; margin-top: 2px; }
    .meta { font-size: 12px; margin-top: 2px; }
    .loading { padding: 16px 0; display: flex; align-items: center; gap: 10px; }
    .analyzing { font-size: 13.5px; }
    .err { font-size: 13.5px; }
  `],
})
export class NewsPanelComponent {
  @Input() analysis: NewsAnalysis | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

  sentimentLabel(sentiment: Sentiment): string {
    switch (sentiment) {
      case 'positive': return 'Positivo';
      case 'negative': return 'Negativo';
      default: return 'Neutral';
    }
  }

  badgeClass(sentiment: Sentiment): string {
    switch (sentiment) {
      case 'positive': return 'badge badge-buy';
      case 'negative': return 'badge badge-wait';
      default: return 'badge badge-hold';
    }
  }

  dotClass(sentiment: Sentiment): string {
    switch (sentiment) {
      case 'positive': return 'dot pos';
      case 'negative': return 'dot neg';
      default: return 'dot neu';
    }
  }
}
