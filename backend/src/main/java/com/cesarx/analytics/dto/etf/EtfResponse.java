package com.cesarx.analytics.dto.etf;

public record EtfResponse(
        Long id,
        String symbol,
        String name,
        String sector,
        String exchange,
        String currency
) {
}
