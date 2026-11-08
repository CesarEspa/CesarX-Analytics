package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.market.PriceQuoteResponse;
import com.cesarx.analytics.dto.market.RecommendationSignal;
import com.cesarx.analytics.exception.MarketDataException;
import com.cesarx.analytics.model.entity.Alert;
import com.cesarx.analytics.model.entity.AlertType;
import com.cesarx.analytics.model.entity.Etf;
import com.cesarx.analytics.repository.AlertRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AlertCheckSchedulerTest {

    @Mock
    private AlertRepository alertRepository;
    @Mock
    private MarketDataService marketDataService;
    @InjectMocks
    private AlertCheckScheduler scheduler;

    private Alert alert(String symbol, AlertType type, String target) {
        Etf etf = Etf.builder().symbol(symbol).build();
        return Alert.builder().etf(etf).alertType(type).targetValue(new BigDecimal(target)).active(true).build();
    }

    private PriceQuoteResponse quote(String symbol, String price, String changePercent) {
        return new PriceQuoteResponse(symbol, new BigDecimal(price), null, null,
                changePercent == null ? null : new BigDecimal(changePercent),
                null, null, null, "USD", "REGULAR", Instant.now(), RecommendationSignal.HOLD, "");
    }

    @Test
    void priceAboveTriggersAtTarget() {
        Alert alert = alert("QQQ", AlertType.PRICE_ABOVE, "500");
        when(alertRepository.findByActiveTrue()).thenReturn(List.of(alert));
        when(marketDataService.getQuote("QQQ")).thenReturn(quote("QQQ", "500", null));

        scheduler.checkActiveAlerts();

        assertThat(alert.isActive()).isFalse();
        assertThat(alert.getTriggeredAt()).isNotNull();
        verify(alertRepository).save(alert);
    }

    @Test
    void priceBelowDoesNotTriggerWhileAboveTarget() {
        Alert alert = alert("QQQ", AlertType.PRICE_BELOW, "400");
        when(alertRepository.findByActiveTrue()).thenReturn(List.of(alert));
        when(marketDataService.getQuote("QQQ")).thenReturn(quote("QQQ", "450", null));

        scheduler.checkActiveAlerts();

        assertThat(alert.isActive()).isTrue();
        verify(alertRepository, never()).save(alert);
    }

    @Test
    void percentDropTriggersWhenChangeIsAtOrBelowTarget() {
        Alert alert = alert("VOO", AlertType.PERCENT_CHANGE_DOWN, "-2");
        when(alertRepository.findByActiveTrue()).thenReturn(List.of(alert));
        when(marketDataService.getQuote("VOO")).thenReturn(quote("VOO", "480", "-2.50"));

        scheduler.checkActiveAlerts();

        assertThat(alert.isActive()).isFalse();
    }

    @Test
    void percentAlertIgnoresMissingChange() {
        Alert alert = alert("VOO", AlertType.PERCENT_CHANGE_UP, "1");
        when(alertRepository.findByActiveTrue()).thenReturn(List.of(alert));
        when(marketDataService.getQuote("VOO")).thenReturn(quote("VOO", "480", null));

        scheduler.checkActiveAlerts();

        assertThat(alert.isActive()).isTrue();
    }

    @Test
    void oneFailingSymbolDoesNotStopTheOthers() {
        Alert broken = alert("BAD", AlertType.PRICE_ABOVE, "1");
        Alert working = alert("QQQ", AlertType.PRICE_ABOVE, "1");
        when(alertRepository.findByActiveTrue()).thenReturn(List.of(broken, working));
        when(marketDataService.getQuote("BAD")).thenThrow(new MarketDataException("sin datos"));
        when(marketDataService.getQuote("QQQ")).thenReturn(quote("QQQ", "10", null));

        scheduler.checkActiveAlerts();

        assertThat(broken.isActive()).isTrue();
        assertThat(working.isActive()).isFalse();
    }
}
