package com.cesarx.analytics.dto.etf;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EtfCreateRequest(
        @NotBlank @Size(max = 15) String symbol,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 100) String sector,
        @Size(max = 50) String exchange,
        @Size(max = 10) String currency
) {
}
