import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
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
  private readonly baseUrl = environment.apiBaseUrl;

  // --- ETFs ---
  getEtfs(): Observable<EtfResponse[]> {
    return this.http.get<EtfResponse[]>(`${this.baseUrl}/api/etfs`);
  }

  // --- Market data ---
  getQuote(symbol: string): Observable<PriceQuote> {
    return this.http.get<PriceQuote>(`${this.baseUrl}/api/market/quote/${symbol}`);
  }

  getHistory(symbol: string, range: string, interval = '1d'): Observable<PriceHistoryResponse> {
    const params = new HttpParams().set('range', range).set('interval', interval);
    return this.http.get<PriceHistoryResponse>(`${this.baseUrl}/api/market/history/${symbol}`, { params });
  }

  getLightQuotes(): Observable<LightQuote[]> {
    return this.http.get<LightQuote[]>(`${this.baseUrl}/api/market/quotes`);
  }

  // --- AI microservice (via backend proxy) ---
  getPrediction(symbol: string): Observable<Prediction> {
    return this.http.get<Prediction>(`${this.baseUrl}/api/ai/predict/${symbol}`);
  }

  getNewsAnalysis(symbol: string): Observable<NewsAnalysis> {
    return this.http.get<NewsAnalysis>(`${this.baseUrl}/api/ai/news/${symbol}`);
  }

  // --- Portfolio ---
  getPortfolio(): Observable<PortfolioSummary> {
    return this.http.get<PortfolioSummary>(`${this.baseUrl}/api/portfolio`);
  }

  addPosition(request: PortfolioPositionRequest): Observable<PortfolioPosition> {
    return this.http.post<PortfolioPosition>(`${this.baseUrl}/api/portfolio`, request);
  }

  deletePosition(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/portfolio/${id}`);
  }

  // --- Alerts ---
  getAlerts(): Observable<AlertItem[]> {
    return this.http.get<AlertItem[]>(`${this.baseUrl}/api/alerts`);
  }

  createAlert(request: AlertRequest): Observable<AlertItem> {
    return this.http.post<AlertItem>(`${this.baseUrl}/api/alerts`, request);
  }

  setAlertActive(id: number, active: boolean): Observable<AlertItem> {
    const params = new HttpParams().set('active', active);
    return this.http.patch<AlertItem>(`${this.baseUrl}/api/alerts/${id}/active`, null, { params });
  }

  deleteAlert(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/alerts/${id}`);
  }
}
