package com.cesarx.analytics.dto.portfolio;

import java.math.BigDecimal;
import java.util.List;

public record PortfolioSummaryResponse(
        BigDecimal totalMarketValue,
        BigDecimal totalCostBasis,
        BigDecimal totalGainLoss,
        BigDecimal totalGainLossPercent,
        List<PortfolioPositionResponse> positions
) {
}
