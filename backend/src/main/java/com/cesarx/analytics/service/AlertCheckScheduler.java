package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.market.PriceQuoteResponse;
import com.cesarx.analytics.model.entity.Alert;
import com.cesarx.analytics.model.entity.AlertType;
import com.cesarx.analytics.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Polls active alerts against live Yahoo Finance quotes and marks them as
 * triggered once their condition is met. Quotes are fetched once per ETF
 * symbol per run to keep the number of upstream calls low.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AlertCheckScheduler {

    private final AlertRepository alertRepository;
    private final MarketDataService marketDataService;

    @Scheduled(fixedDelayString = "${app.alerts.check-interval-ms:300000}")
    @Transactional
    public void checkActiveAlerts() {
        List<Alert> activeAlerts = alertRepository.findByActiveTrue();
        if (activeAlerts.isEmpty()) {
            return;
        }

        Map<String, List<Alert>> alertsBySymbol = activeAlerts.stream()
                .collect(Collectors.groupingBy(alert -> alert.getEtf().getSymbol()));

        alertsBySymbol.forEach((symbol, alerts) -> {
            try {
                PriceQuoteResponse quote = marketDataService.getQuote(symbol);
                alerts.forEach(alert -> evaluate(alert, quote));
            } catch (Exception e) {
                log.warn("Skipping alert check for {} — quote unavailable: {}", symbol, e.getMessage());
            }
        });
    }

    private void evaluate(Alert alert, PriceQuoteResponse quote) {
        if (quote.currentPrice() == null) {
            return;
        }

        boolean triggered = switch (alert.getAlertType()) {
            case PRICE_ABOVE -> quote.currentPrice().compareTo(alert.getTargetValue()) >= 0;
            case PRICE_BELOW -> quote.currentPrice().compareTo(alert.getTargetValue()) <= 0;
            case PERCENT_CHANGE_UP -> percentChangeMeets(quote, alert.getTargetValue(), true);
            case PERCENT_CHANGE_DOWN -> percentChangeMeets(quote, alert.getTargetValue(), false);
        };

        if (triggered) {
            alert.setActive(false);
            alert.setTriggeredAt(Instant.now());
            alertRepository.save(alert);
            log.info("Alert #{} triggered for {} ({}) at price {}", alert.getId(),
                    alert.getEtf().getSymbol(), alert.getAlertType(), quote.currentPrice());
        }
    }

    private boolean percentChangeMeets(PriceQuoteResponse quote, BigDecimal target, boolean upward) {
        if (quote.changePercent() == null) {
            return false;
        }
        return upward ? quote.changePercent().compareTo(target) >= 0
                      : quote.changePercent().compareTo(target) <= 0;
    }
}
