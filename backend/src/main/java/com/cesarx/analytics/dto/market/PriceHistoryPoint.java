package com.cesarx.analytics.dto.market;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PriceHistoryPoint(
        LocalDate date,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        Long volume
) {
}
