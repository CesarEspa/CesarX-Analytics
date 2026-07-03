package com.cesarx.analytics.dto.market;

import java.util.List;

public record PriceHistoryResponse(
        String symbol,
        String range,
        List<PriceHistoryPoint> points
) {
}
