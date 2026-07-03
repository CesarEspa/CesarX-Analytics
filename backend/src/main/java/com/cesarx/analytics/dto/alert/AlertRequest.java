package com.cesarx.analytics.dto.alert;

import com.cesarx.analytics.model.entity.AlertType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AlertRequest(
        @NotBlank String symbol,
        @NotNull AlertType alertType,
        @NotNull BigDecimal targetValue
) {
}
