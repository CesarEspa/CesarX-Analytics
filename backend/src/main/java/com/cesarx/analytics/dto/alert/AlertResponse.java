package com.cesarx.analytics.dto.alert;

import com.cesarx.analytics.model.entity.AlertType;

import java.math.BigDecimal;
import java.time.Instant;

public record AlertResponse(
        Long id,
        String symbol,
        AlertType alertType,
        BigDecimal targetValue,
        boolean active,
        Instant triggeredAt,
        Instant createdAt
) {
}
