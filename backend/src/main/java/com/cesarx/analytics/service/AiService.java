package com.cesarx.analytics.service;

import com.cesarx.analytics.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriBuilder;
import reactor.util.retry.Retry;

import java.net.URI;
import java.time.Duration;
import java.util.Set;
import java.util.function.Function;

/**
 * Thin proxy to the Python AI microservice (FastAPI). The JSON payloads are
 * passed through as-is; this service only translates transport failures into
 * a friendly 503 for the frontend.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiService {

    private static final Set<String> HORIZONS = Set.of("1w", "15d", "1m", "6m", "1y");
    private static final Set<Integer> WAKE_UP_STATUSES = Set.of(502, 503, 504);
    private static final int WAKE_UP_RETRIES = 8;

    private final WebClient aiServiceWebClient;

    /** A sleeping free-tier instance needs about 45 seconds to start. */
    Duration wakeUpDelay = Duration.ofSeconds(8);

    public JsonNode getPrediction(String symbol, String horizon) {
        if (!HORIZONS.contains(horizon)) {
            throw new IllegalArgumentException("Plazo no válido: " + horizon);
        }
        return get(symbol, uri -> uri.path("/predict/{symbol}").queryParam("horizon", horizon).build(symbol.toUpperCase()));
    }

    public JsonNode getNewsAnalysis(String symbol) {
        return get(symbol, uri -> uri.path("/news/{symbol}").build(symbol.toUpperCase()));
    }

    private JsonNode get(String symbol, Function<UriBuilder, URI> uri) {
        try {
            return aiServiceWebClient.get()
                    .uri(uri)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .retryWhen(Retry.fixedDelay(WAKE_UP_RETRIES, wakeUpDelay)
                            .filter(this::isWakingUp)
                            .onRetryExhaustedThrow((spec, signal) -> signal.failure()))
                    .block();
        } catch (WebClientResponseException e) {
            String detail = detailOf(e);
            String message = detail != null ? detail : "AI service error: " + e.getStatusCode();
            log.warn("AI service returned {} for {}: {}", e.getStatusCode(), symbol, message);
            throw new AiServiceException(message);
        } catch (WebClientRequestException e) {
            throw new AiServiceException(
                    "El servicio de IA no está disponible en este momento. Intenta de nuevo en un minuto.", e);
        }
    }

    /** Errors raised by the service itself carry a JSON detail; the hosting platform's do not. */
    private boolean isWakingUp(Throwable error) {
        if (error instanceof WebClientRequestException) {
            return true;
        }
        return error instanceof WebClientResponseException e
                && WAKE_UP_STATUSES.contains(e.getStatusCode().value())
                && detailOf(e) == null;
    }

    private String detailOf(WebClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            if (body != null && body.hasNonNull("detail")) {
                return body.get("detail").asText();
            }
        } catch (Exception ignored) {
            // not JSON: the error did not come from the AI service
        }
        return null;
    }
}
