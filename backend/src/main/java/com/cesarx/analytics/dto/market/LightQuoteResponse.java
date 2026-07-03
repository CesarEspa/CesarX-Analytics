package com.cesarx.analytics.dto.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Lightweight quote used by the frontend's real-time polling: fetched with a
 * 5-day chart request instead of the 6-month one behind the full quote.
 */
public record LightQuoteResponse(
        String symbol,
        BigDecimal currentPrice,
        BigDecimal previousClose,
        BigDecimal change,
        BigDecimal changePercent,
        Instant asOf
) {
}
