package com.cesarx.analytics.dto.portfolio;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PortfolioPositionRequest(
        @NotBlank String symbol,
        @NotNull @DecimalMin(value = "0.000001") BigDecimal quantity,
        @NotNull @DecimalMin(value = "0.0001") BigDecimal avgBuyPrice,
        @NotNull @PastOrPresent LocalDate purchaseDate
) {
}
