package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.market.LightQuoteResponse;
import com.cesarx.analytics.dto.market.PriceQuoteResponse;
import com.cesarx.analytics.dto.market.RecommendationSignal;
import com.cesarx.analytics.exception.MarketDataException;
import com.cesarx.analytics.repository.EtfRepository;
import com.cesarx.analytics.repository.PriceHistoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MarketDataServiceTest {

    private final AtomicInteger yahooCalls = new AtomicInteger();
    private final AtomicReference<HttpStatus> status = new AtomicReference<>(HttpStatus.OK);
    private final AtomicReference<String> body = new AtomicReference<>();

    private final MarketDataService service = new MarketDataService(
            WebClient.builder()
                    .baseUrl("https://yahoo.test")
                    .exchangeFunction(request -> {
                        yahooCalls.incrementAndGet();
                        return Mono.just(ClientResponse.create(status.get())
                                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                                .body(body.get())
                                .build());
                    })
                    .build(),
            new ObjectMapper(),
            Mockito.mock(EtfRepository.class),
            Mockito.mock(PriceHistoryRepository.class));

    /** closes[i] = start + i * step; regularMarketPrice = last close. */
    private String chart(int days, double start, double step) {
        List<Double> closes = IntStream.range(0, days).mapToObj(i -> start + i * step).toList();
        return chart(closes, closes.get(closes.size() - 1));
    }

    private String chart(List<Double> closes, double marketPrice) {
        String timestamps = IntStream.range(0, closes.size())
                .mapToObj(i -> String.valueOf(1_700_000_000L + i * 86_400L))
                .collect(Collectors.joining(","));
        String values = closes.stream().map(String::valueOf).collect(Collectors.joining(","));
        return """
                {"chart":{"error":null,"result":[{
                  "meta":{"regularMarketPrice":%s,"currency":"USD","marketState":"REGULAR"},
                  "timestamp":[%s],
                  "indicators":{"quote":[{"open":[%s],"high":[%s],"low":[%s],"close":[%s],"volume":[%s]}]}
                }]}}""".formatted(marketPrice, timestamps, values, values, values, values,
                closes.stream().map(c -> "1000").collect(Collectors.joining(",")));
    }

    @Test
    void risingPricesProduceBuySignal() {
        body.set(chart(30, 100, 2));

        assertThat(service.getQuote("qqq").signal()).isEqualTo(RecommendationSignal.BUY);
    }

    @Test
    void fallingPricesProduceWaitSignal() {
        body.set(chart(30, 200, -2));

        assertThat(service.getQuote("QQQ").signal()).isEqualTo(RecommendationSignal.WAIT);
    }

    @Test
    void flatPricesProduceHoldSignal() {
        body.set(chart(30, 100, 0));

        assertThat(service.getQuote("QQQ").signal()).isEqualTo(RecommendationSignal.HOLD);
    }

    @Test
    void lessThanTwentySessionsIsHoldEvenIfRising() {
        body.set(chart(19, 100, 5));

        PriceQuoteResponse quote = service.getQuote("QQQ");

        assertThat(quote.signal()).isEqualTo(RecommendationSignal.HOLD);
        assertThat(quote.signalReason()).contains("histórico");
    }

    @Test
    void changeIsMeasuredAgainstThePreviousSession() {
        body.set(chart(List.of(90.0, 100.0, 104.0), 110.0));

        PriceQuoteResponse quote = service.getQuote("VOO");

        assertThat(quote.symbol()).isEqualTo("VOO");
        assertThat(quote.previousClose()).isEqualByComparingTo("100");
        assertThat(quote.change()).isEqualByComparingTo("10");
        assertThat(quote.changePercent()).isEqualByComparingTo("10.00");
    }

    @Test
    void upstreamFailureWithoutCachedDataIsReported() {
        status.set(HttpStatus.TOO_MANY_REQUESTS);
        body.set("{}");

        assertThatThrownBy(() -> service.getQuote("QQQ")).isInstanceOf(MarketDataException.class);
    }

    @Test
    void unknownSymbolIsReported() {
        body.set("{\"chart\":{\"error\":null,\"result\":[]}}");

        assertThatThrownBy(() -> service.getQuote("NOPE"))
                .isInstanceOf(MarketDataException.class)
                .hasMessageContaining("NOPE");
    }

    @Test
    void repeatedLookupsShareOneUpstreamCall() {
        body.set(chart(30, 100, 1));

        service.getQuote("QQQ");
        service.getQuote("qqq");

        assertThat(yahooCalls).hasValue(1);
    }

    @Test
    void lastKnownDataIsServedWhenYahooFails() {
        ReflectionTestUtils.setField(service, "cacheTtlMs", 0L);
        body.set(chart(30, 100, 2));
        PriceQuoteResponse fresh = service.getQuote("QQQ");

        status.set(HttpStatus.TOO_MANY_REQUESTS);
        body.set("{}");
        PriceQuoteResponse stale = service.getQuote("QQQ");

        assertThat(yahooCalls).hasValue(2);
        assertThat(stale.currentPrice()).isEqualByComparingTo(fresh.currentPrice());
    }

    @Test
    void lightQuotesSkipSymbolsThatFail() {
        status.set(HttpStatus.BAD_GATEWAY);
        body.set("{}");

        List<LightQuoteResponse> quotes = service.getLightQuotes(List.of("QQQ", "VOO"));

        assertThat(quotes).isEmpty();
    }
}
