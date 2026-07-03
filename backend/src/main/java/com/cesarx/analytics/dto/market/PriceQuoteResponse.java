package com.cesarx.analytics.dto.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Real-time quote pulled from Yahoo Finance, enriched with a lightweight
 * technical signal (SMA5 vs SMA20 crossover). This signal is a Phase 1
 * placeholder — Phase 2 will blend it with news sentiment and Phase 4
 * will replace it with the scikit-learn trend model.
 */
public record PriceQuoteResponse(
        String symbol,
        BigDecimal currentPrice,
        BigDecimal previousClose,
        BigDecimal change,
        BigDecimal changePercent,
        BigDecimal dayHigh,
        BigDecimal dayLow,
        Long volume,
        String currency,
        String marketState,
        Instant asOf,
        RecommendationSignal signal,
        String signalReason
) {
}
