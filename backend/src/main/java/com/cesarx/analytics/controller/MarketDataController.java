package com.cesarx.analytics.controller;

import com.cesarx.analytics.dto.market.LightQuoteResponse;
import com.cesarx.analytics.dto.market.PriceHistoryResponse;
import com.cesarx.analytics.dto.market.PriceQuoteResponse;
import com.cesarx.analytics.service.EtfService;
import com.cesarx.analytics.service.MarketDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
@Tag(name = "Market Data", description = "Precios en tiempo real e históricos vía Yahoo Finance")
public class MarketDataController {

    private final MarketDataService marketDataService;
    private final EtfService etfService;

    @GetMapping("/quotes")
    @Operation(summary = "Cotizaciones ligeras de todos los ETFs registrados (para actualización en tiempo real)")
    public List<LightQuoteResponse> getAllQuotes() {
        List<String> symbols = etfService.findAll().stream().map(e -> e.symbol()).toList();
        return marketDataService.getLightQuotes(symbols);
    }

    @GetMapping("/quote/{symbol}")
    @Operation(summary = "Cotización en tiempo real + señal técnica básica (SMA5 vs SMA20)")
    public PriceQuoteResponse getQuote(@PathVariable String symbol) {
        return marketDataService.getQuote(symbol);
    }

    @GetMapping("/history/{symbol}")
    @Operation(summary = "Histórico de precios (range: 1d, 1mo, 3mo, 6mo, 1y, 5y · interval: 5m, 15m, 1h, 1d)")
    public PriceHistoryResponse getHistory(@PathVariable String symbol,
                                            @RequestParam(defaultValue = "3mo") String range,
                                            @RequestParam(defaultValue = "1d") String interval) {
        return marketDataService.getHistory(symbol, range, interval);
    }

    @PostMapping("/cache/{symbol}")
    @Operation(summary = "Persistir el último mes de histórico en price_history")
    public String cacheHistory(@PathVariable String symbol) {
        int upserts = marketDataService.cacheRecentHistory(symbol);
        return "Cached " + upserts + " daily records for " + symbol.toUpperCase();
    }
}
