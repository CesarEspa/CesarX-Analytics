package com.cesarx.analytics.dto.portfolio;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PortfolioPositionResponse(
        Long id,
        String symbol,
        String etfName,
        BigDecimal quantity,
        BigDecimal avgBuyPrice,
        LocalDate purchaseDate,
        BigDecimal currentPrice,
        BigDecimal marketValue,
        BigDecimal costBasis,
        BigDecimal gainLoss,
        BigDecimal gainLossPercent
) {
}
