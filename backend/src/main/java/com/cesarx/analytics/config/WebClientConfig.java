package com.cesarx.analytics.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient yahooFinanceWebClient(@Value("${app.market-data.yahoo-finance-base-url}") String baseUrl) {
        return WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("User-Agent", "Mozilla/5.0 (compatible; CesarXAnalytics/1.0)")
                .build();
    }

    @Bean
    public WebClient aiServiceWebClient(@Value("${app.ai-service.base-url}") String baseUrl) {
        // Wired up in Phase 2 to talk to the Python sentiment-analysis microservice.
        return WebClient.builder()
                .baseUrl(baseUrl)
                .build();
    }
}
