package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.market.LightQuoteResponse;
import com.cesarx.analytics.dto.market.PriceHistoryPoint;
import com.cesarx.analytics.dto.market.PriceHistoryResponse;
import com.cesarx.analytics.dto.market.PriceQuoteResponse;
import com.cesarx.analytics.dto.market.RecommendationSignal;
import com.cesarx.analytics.exception.MarketDataException;
import com.cesarx.analytics.model.entity.Etf;
import com.cesarx.analytics.model.entity.PriceHistory;
import com.cesarx.analytics.repository.EtfRepository;
import com.cesarx.analytics.repository.PriceHistoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalDouble;

/**
 * Pulls real-time and historical quotes from Yahoo Finance's public chart
 * endpoint (the same data source the `yfinance` Python library wraps).
 * A simple SMA5/SMA20 crossover produces a placeholder Buy/Hold/Wait signal —
 * Phase 2 will blend this with news sentiment and Phase 4 will replace it
 * with the scikit-learn trend model.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketDataService {

    private static final int SHORT_WINDOW = 5;
    private static final int LONG_WINDOW = 20;

    private final WebClient yahooFinanceWebClient;
    private final ObjectMapper objectMapper;
    private final EtfRepository etfRepository;
    private final PriceHistoryRepository priceHistoryRepository;

    public PriceQuoteResponse getQuote(String symbol) {
        JsonNode result = fetchChart(symbol, "6mo", "1d");
        JsonNode meta = result.path("meta");
        List<PriceHistoryPoint> points = extractPoints(result);

        BigDecimal currentPrice = decimalOf(meta, "regularMarketPrice");
        // meta.previousClose is unreliable in the chart endpoint (often the close
        // at the start of the requested range), so prefer the second-to-last
        // daily candle: with the market open the last candle is today's live one,
        // and with it closed the last candle is the latest session — in both
        // cases the previous session's close is the second-to-last point.
        BigDecimal previousClose = points.size() >= 2
                ? points.get(points.size() - 2).close()
                : decimalOf(meta, "previousClose");

        BigDecimal change = null;
        BigDecimal changePercent = null;
        if (currentPrice != null && previousClose != null && previousClose.compareTo(BigDecimal.ZERO) != 0) {
            change = currentPrice.subtract(previousClose).setScale(4, RoundingMode.HALF_UP);
            changePercent = change.divide(previousClose, 6, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        TechnicalSignal technicalSignal = computeSignal(points);

        return new PriceQuoteResponse(
                symbol.toUpperCase(),
                currentPrice,
                previousClose,
                change,
                changePercent,
                decimalOf(meta, "regularMarketDayHigh"),
                decimalOf(meta, "regularMarketDayLow"),
                longValueOf(meta, "regularMarketVolume"),
                meta.path("currency").asText(null),
                meta.path("marketState").asText(null),
                Instant.now(),
                technicalSignal.signal(),
                technicalSignal.reason()
        );
    }

    /**
     * Cheap quote for real-time polling: one 5-day daily chart call per symbol.
     * Symbols whose upstream call fails are skipped instead of failing the batch.
     */
    public List<LightQuoteResponse> getLightQuotes(List<String> symbols) {
        List<LightQuoteResponse> quotes = new ArrayList<>();

        for (String symbol : symbols) {
            try {
                JsonNode result = fetchChart(symbol, "5d", "1d");
                JsonNode meta = result.path("meta");
                List<PriceHistoryPoint> points = extractPoints(result);

                BigDecimal currentPrice = decimalOf(meta, "regularMarketPrice");
                BigDecimal previousClose = points.size() >= 2 ? points.get(points.size() - 2).close() : null;

                BigDecimal change = null;
                BigDecimal changePercent = null;
                if (currentPrice != null && previousClose != null && previousClose.compareTo(BigDecimal.ZERO) != 0) {
                    change = currentPrice.subtract(previousClose).setScale(4, RoundingMode.HALF_UP);
                    changePercent = change.divide(previousClose, 6, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                            .setScale(2, RoundingMode.HALF_UP);
                }

                quotes.add(new LightQuoteResponse(symbol.toUpperCase(), currentPrice, previousClose,
                        change, changePercent, Instant.now()));
            } catch (Exception e) {
                log.warn("Skipping light quote for {}: {}", symbol, e.getMessage());
            }
        }

        return quotes;
    }

    public PriceHistoryResponse getHistory(String symbol, String range) {
        return getHistory(symbol, range, "1d");
    }

    public PriceHistoryResponse getHistory(String symbol, String range, String interval) {
        JsonNode result = fetchChart(symbol, range, interval);
        return new PriceHistoryResponse(symbol.toUpperCase(), range, extractPoints(result));
    }

    /**
     * Fetches a month of history and upserts it into price_history so the
     * database keeps a persisted record (used later by Power BI and the
     * scikit-learn trend model) independent of Yahoo Finance availability.
     */
    @Transactional
    public int cacheRecentHistory(String symbol) {
        Etf etf = etfRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new MarketDataException("ETF not tracked yet: " + symbol));

        PriceHistoryResponse history = getHistory(symbol, "1mo");
        int upserts = 0;

        for (PriceHistoryPoint point : history.points()) {
            PriceHistory record = priceHistoryRepository.findByEtfAndPriceDate(etf, point.date())
                    .orElseGet(() -> PriceHistory.builder().etf(etf).priceDate(point.date()).build());

            record.setOpenPrice(point.open());
            record.setHighPrice(point.high());
            record.setLowPrice(point.low());
            record.setClosePrice(point.close());
            record.setVolume(point.volume());

            priceHistoryRepository.save(record);
            upserts++;
        }

        return upserts;
    }

    private JsonNode fetchChart(String symbol, String range, String interval) {
        try {
            String body = yahooFinanceWebClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/v8/finance/chart/{symbol}")
                            .queryParam("range", range)
                            .queryParam("interval", interval)
                            .build(symbol.toUpperCase()))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(body);
            JsonNode chartError = root.path("chart").path("error");
            if (!chartError.isNull() && !chartError.isMissingNode()) {
                throw new MarketDataException("Yahoo Finance reported an error for " + symbol + ": " + chartError);
            }

            JsonNode results = root.path("chart").path("result");
            if (!results.isArray() || results.isEmpty()) {
                throw new MarketDataException("No market data found for symbol: " + symbol);
            }

            return results.get(0);
        } catch (WebClientResponseException e) {
            log.warn("Yahoo Finance call failed for {}: {}", symbol, e.getMessage());
            throw new MarketDataException("Failed to fetch market data for " + symbol, e);
        } catch (MarketDataException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error fetching market data for {}", symbol, e);
            throw new MarketDataException("Unexpected error fetching market data for " + symbol, e);
        }
    }

    private List<PriceHistoryPoint> extractPoints(JsonNode result) {
        JsonNode timestamps = result.path("timestamp");
        JsonNode quoteArray = result.path("indicators").path("quote");
        List<PriceHistoryPoint> points = new ArrayList<>();

        if (!timestamps.isArray() || !quoteArray.isArray() || quoteArray.isEmpty()) {
            return points;
        }

        JsonNode quote = quoteArray.get(0);

        for (int i = 0; i < timestamps.size(); i++) {
            BigDecimal close = decimalAt(quote.path("close"), i);
            if (close == null) {
                continue; // market holiday / no trade that session
            }

            long epochSeconds = timestamps.get(i).asLong();
            LocalDate date = Instant.ofEpochSecond(epochSeconds).atZone(ZoneOffset.UTC).toLocalDate();

            points.add(new PriceHistoryPoint(
                    date,
                    epochSeconds,
                    decimalAt(quote.path("open"), i),
                    decimalAt(quote.path("high"), i),
                    decimalAt(quote.path("low"), i),
                    close,
                    longAt(quote.path("volume"), i)
            ));
        }

        return points;
    }

    private TechnicalSignal computeSignal(List<PriceHistoryPoint> points) {
        if (points.size() < LONG_WINDOW) {
            return new TechnicalSignal(RecommendationSignal.HOLD, "Not enough historical data for a technical read yet");
        }

        List<PriceHistoryPoint> tail = points.subList(points.size() - LONG_WINDOW, points.size());

        double sma20 = average(tail);
        double sma5 = average(tail.subList(tail.size() - SHORT_WINDOW, tail.size()));

        if (sma5 > sma20 * 1.01) {
            return new TechnicalSignal(RecommendationSignal.BUY,
                    "5-day average is above the 20-day average (short-term uptrend)");
        }
        if (sma5 < sma20 * 0.99) {
            return new TechnicalSignal(RecommendationSignal.WAIT,
                    "5-day average is below the 20-day average (short-term downtrend)");
        }
        return new TechnicalSignal(RecommendationSignal.HOLD,
                "Price is consolidating close to its 20-day average");
    }

    private double average(List<PriceHistoryPoint> points) {
        OptionalDouble avg = points.stream().mapToDouble(p -> p.close().doubleValue()).average();
        return avg.orElse(0);
    }

    private BigDecimal decimalOf(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return (value.isMissingNode() || value.isNull()) ? null : BigDecimal.valueOf(value.asDouble()).setScale(4, RoundingMode.HALF_UP);
    }

    private Long longValueOf(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return (value.isMissingNode() || value.isNull()) ? null : value.asLong();
    }

    private BigDecimal decimalAt(JsonNode arrayNode, int index) {
        if (!arrayNode.isArray() || index >= arrayNode.size()) {
            return null;
        }
        JsonNode value = arrayNode.get(index);
        return (value == null || value.isNull()) ? null : BigDecimal.valueOf(value.asDouble()).setScale(4, RoundingMode.HALF_UP);
    }

    private Long longAt(JsonNode arrayNode, int index) {
        if (!arrayNode.isArray() || index >= arrayNode.size()) {
            return null;
        }
        JsonNode value = arrayNode.get(index);
        return (value == null || value.isNull()) ? null : value.asLong();
    }

    private record TechnicalSignal(RecommendationSignal signal, String reason) {
    }
}
