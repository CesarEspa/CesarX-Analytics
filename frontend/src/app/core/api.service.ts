import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AlertItem,
  AlertRequest,
  EtfResponse,
  LightQuote,
  NewsAnalysis,
  PortfolioPositionRequest,
  PortfolioPosition,
  PortfolioSummary,
  Prediction,
  PriceHistoryResponse,
  PriceQuote,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // --- ETFs ---
  getEtfs(): Observable<EtfResponse[]> {
    return this.http.get<EtfResponse[]>('/api/etfs');
  }

  // --- Market data ---
  getQuote(symbol: string): Observable<PriceQuote> {
    return this.http.get<PriceQuote>(`/api/market/quote/${symbol}`);
  }

  getHistory(symbol: string, range: string, interval = '1d'): Observable<PriceHistoryResponse> {
    const params = new HttpParams().set('range', range).set('interval', interval);
    return this.http.get<PriceHistoryResponse>(`/api/market/history/${symbol}`, { params });
  }

  getLightQuotes(): Observable<LightQuote[]> {
    return this.http.get<LightQuote[]>('/api/market/quotes');
  }

  // --- AI microservice (via backend proxy) ---
  getPrediction(symbol: string): Observable<Prediction> {
    return this.http.get<Prediction>(`/api/ai/predict/${symbol}`);
  }

  getNewsAnalysis(symbol: string): Observable<NewsAnalysis> {
    return this.http.get<NewsAnalysis>(`/api/ai/news/${symbol}`);
  }

  // --- Portfolio ---
  getPortfolio(): Observable<PortfolioSummary> {
    return this.http.get<PortfolioSummary>('/api/portfolio');
  }

  addPosition(request: PortfolioPositionRequest): Observable<PortfolioPosition> {
    return this.http.post<PortfolioPosition>('/api/portfolio', request);
  }

  deletePosition(id: number): Observable<void> {
    return this.http.delete<void>(`/api/portfolio/${id}`);
  }

  // --- Alerts ---
  getAlerts(): Observable<AlertItem[]> {
    return this.http.get<AlertItem[]>('/api/alerts');
  }

  createAlert(request: AlertRequest): Observable<AlertItem> {
    return this.http.post<AlertItem>('/api/alerts', request);
  }

  setAlertActive(id: number, active: boolean): Observable<AlertItem> {
    const params = new HttpParams().set('active', active);
    return this.http.patch<AlertItem>(`/api/alerts/${id}/active`, null, { params });
  }

  deleteAlert(id: number): Observable<void> {
    return this.http.delete<void>(`/api/alerts/${id}`);
  }
}
