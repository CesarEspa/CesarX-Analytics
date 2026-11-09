package com.cesarx.analytics.service;

import com.cesarx.analytics.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiServiceTest {

    private final List<ClientRequest> requests = new ArrayList<>();

    private static ClientResponse platformError() {
        return ClientResponse.create(HttpStatus.BAD_GATEWAY)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_HTML_VALUE)
                .body("<html>waking up</html>")
                .build();
    }

    private static ClientResponse json(HttpStatus status, String body) {
        return ClientResponse.create(status)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .body(body)
                .build();
    }

    private AiService serviceAnswering(ClientResponse... answers) {
        Deque<ClientResponse> queue = new ArrayDeque<>(Arrays.asList(answers));
        WebClient client = WebClient.builder()
                .baseUrl("http://ai.test")
                .exchangeFunction(request -> {
                    requests.add(request);
                    return Mono.just(queue.size() > 1 ? queue.poll() : queue.peek());
                })
                .build();
        AiService service = new AiService(client);
        service.wakeUpDelay = Duration.ofMillis(1);
        return service;
    }

    @Test
    void waitsWhileTheHostingPlatformIsWakingTheService() {
        AiService service = serviceAnswering(platformError(), platformError(), json(HttpStatus.OK, "{\"model\":\"Ridge\"}"));

        JsonNode result = service.getPrediction("vgt", "1m");

        assertThat(result.get("model").asText()).isEqualTo("Ridge");
        assertThat(requests).hasSize(3);
        assertThat(requests.get(2).url().toString()).isEqualTo("http://ai.test/predict/VGT?horizon=1m");
    }

    @Test
    void doesNotRetryAnErrorReportedByTheService() {
        AiService service = serviceAnswering(json(HttpStatus.BAD_GATEWAY, "{\"detail\":\"Prediction failed\"}"));

        assertThatThrownBy(() -> service.getPrediction("VGT", "1w"))
                .isInstanceOf(AiServiceException.class)
                .hasMessage("Prediction failed");
        assertThat(requests).hasSize(1);
    }

    @Test
    void reportsTheFailureWhenTheServiceNeverWakes() {
        AiService service = serviceAnswering(platformError());

        assertThatThrownBy(() -> service.getNewsAnalysis("VGT")).isInstanceOf(AiServiceException.class);
        assertThat(requests).hasSize(9);
    }

    @Test
    void rejectsAnUnknownHorizonWithoutCallingTheService() {
        AiService service = serviceAnswering(json(HttpStatus.OK, "{}"));

        assertThatThrownBy(() -> service.getPrediction("VGT", "2y")).isInstanceOf(IllegalArgumentException.class);
        assertThat(requests).isEmpty();
    }
}
