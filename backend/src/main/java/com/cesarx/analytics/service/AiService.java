package com.cesarx.analytics.service;

import com.cesarx.analytics.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * Thin proxy to the Python AI microservice (FastAPI). The JSON payloads are
 * passed through as-is; this service only translates transport failures into
 * a friendly 503 for the frontend.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiService {

    private final WebClient aiServiceWebClient;

    public JsonNode getPrediction(String symbol) {
        return get("/predict/{symbol}", symbol);
    }

    public JsonNode getNewsAnalysis(String symbol) {
        return get("/news/{symbol}", symbol);
    }

    private JsonNode get(String path, String symbol) {
        try {
            return aiServiceWebClient.get()
                    .uri(path, symbol.toUpperCase())
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();
        } catch (WebClientResponseException e) {
            String detail = extractDetail(e);
            log.warn("AI service returned {} for {}: {}", e.getStatusCode(), symbol, detail);
            throw new AiServiceException(detail);
        } catch (WebClientRequestException e) {
            throw new AiServiceException(
                    "El servicio de IA no está disponible en este momento. Intenta de nuevo en un minuto.", e);
        }
    }

    private String extractDetail(WebClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            if (body != null && body.hasNonNull("detail")) {
                return body.get("detail").asText();
            }
        } catch (Exception ignored) {
            // fall through to the generic message
        }
        return "AI service error: " + e.getStatusCode();
    }
}
