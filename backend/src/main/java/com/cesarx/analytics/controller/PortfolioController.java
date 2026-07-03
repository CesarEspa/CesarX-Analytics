package com.cesarx.analytics.controller;

import com.cesarx.analytics.dto.portfolio.PortfolioPositionRequest;
import com.cesarx.analytics.dto.portfolio.PortfolioPositionResponse;
import com.cesarx.analytics.dto.portfolio.PortfolioSummaryResponse;
import com.cesarx.analytics.security.UserPrincipal;
import com.cesarx.analytics.service.PortfolioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/portfolio")
@RequiredArgsConstructor
@Tag(name = "Portfolio", description = "Portfolio personal con valorización en tiempo real")
public class PortfolioController {

    private final PortfolioService portfolioService;

    @GetMapping
    @Operation(summary = "Ver mis posiciones con precio, valor de mercado y rendimiento actuales")
    public ResponseEntity<PortfolioSummaryResponse> getPortfolio(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(portfolioService.getPortfolio(principal.getUser()));
    }

    @PostMapping
    @Operation(summary = "Agregar una posición a mi portfolio")
    public ResponseEntity<PortfolioPositionResponse> addPosition(@AuthenticationPrincipal UserPrincipal principal,
                                                                   @Valid @RequestBody PortfolioPositionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(portfolioService.addPosition(principal.getUser(), request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar una posición de mi portfolio")
    public ResponseEntity<Void> deletePosition(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        portfolioService.deletePosition(principal.getUser(), id);
        return ResponseEntity.noContent().build();
    }
}
