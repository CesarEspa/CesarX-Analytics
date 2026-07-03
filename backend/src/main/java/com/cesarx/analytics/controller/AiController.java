package com.cesarx.analytics.controller;

import com.cesarx.analytics.service.AiService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Tag(name = "AI", description = "Predicción de tendencia (scikit-learn) y sentimiento de noticias (Claude)")
public class AiController {

    private final AiService aiService;

    @GetMapping("/predict/{symbol}")
    @Operation(summary = "Predicción de tendencia a 1 mes para un ETF")
    public JsonNode predict(@PathVariable String symbol) {
        return aiService.getPrediction(symbol);
    }

    @GetMapping("/news/{symbol}")
    @Operation(summary = "Noticias recientes con análisis de sentimiento por Claude")
    public JsonNode news(@PathVariable String symbol) {
        return aiService.getNewsAnalysis(symbol);
    }
}
