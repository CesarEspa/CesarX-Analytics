package com.cesarx.analytics.controller;

import com.cesarx.analytics.dto.etf.EtfCreateRequest;
import com.cesarx.analytics.dto.etf.EtfResponse;
import com.cesarx.analytics.service.EtfService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/etfs")
@RequiredArgsConstructor
@Tag(name = "ETFs", description = "Catálogo de ETFs seguidos por la plataforma")
public class EtfController {

    private final EtfService etfService;

    @GetMapping
    @Operation(summary = "Listar todos los ETFs registrados")
    public ResponseEntity<List<EtfResponse>> findAll() {
        return ResponseEntity.ok(etfService.findAll());
    }

    @GetMapping("/{symbol}")
    @Operation(summary = "Obtener un ETF por su símbolo")
    public ResponseEntity<EtfResponse> findBySymbol(@PathVariable String symbol) {
        return ResponseEntity.ok(etfService.findBySymbol(symbol));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Registrar un nuevo ETF a seguir (solo admin)")
    public ResponseEntity<EtfResponse> create(@Valid @RequestBody EtfCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(etfService.create(request));
    }
}
