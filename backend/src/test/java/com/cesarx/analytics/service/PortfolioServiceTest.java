package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.market.PriceQuoteResponse;
import com.cesarx.analytics.dto.market.RecommendationSignal;
import com.cesarx.analytics.dto.portfolio.PortfolioPositionResponse;
import com.cesarx.analytics.dto.portfolio.PortfolioSummaryResponse;
import com.cesarx.analytics.exception.MarketDataException;
import com.cesarx.analytics.exception.ResourceNotFoundException;
import com.cesarx.analytics.model.entity.Etf;
import com.cesarx.analytics.model.entity.PortfolioPosition;
import com.cesarx.analytics.model.entity.User;
import com.cesarx.analytics.repository.PortfolioPositionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioServiceTest {

    @Mock
    private PortfolioPositionRepository repository;
    @Mock
    private EtfService etfService;
    @Mock
    private MarketDataService marketDataService;
    @InjectMocks
    private PortfolioService service;

    private final User user = User.builder().username("cesar").build();

    private PortfolioPosition position(String symbol, String quantity, String avgPrice) {
        return PortfolioPosition.builder()
                .user(user)
                .etf(Etf.builder().symbol(symbol).name(symbol + " ETF").build())
                .quantity(new BigDecimal(quantity))
                .avgBuyPrice(new BigDecimal(avgPrice))
                .purchaseDate(LocalDate.of(2025, 1, 15))
                .build();
    }

    private PriceQuoteResponse quote(String symbol, String price) {
        return new PriceQuoteResponse(symbol, new BigDecimal(price), null, null, null, null, null, null,
                "USD", "REGULAR", Instant.now(), RecommendationSignal.HOLD, "");
    }

    @Test
    void totalsAndReturnsAreCalculatedFromLivePrices() {
        when(repository.findByUserOrderByPurchaseDateDesc(user))
                .thenReturn(List.of(position("QQQ", "2", "100"), position("VOO", "1", "200")));
        when(marketDataService.getQuote("QQQ")).thenReturn(quote("QQQ", "150"));
        when(marketDataService.getQuote("VOO")).thenReturn(quote("VOO", "100"));

        PortfolioSummaryResponse summary = service.getPortfolio(user);

        assertThat(summary.totalMarketValue()).isEqualByComparingTo("400");
        assertThat(summary.totalCostBasis()).isEqualByComparingTo("400");
        assertThat(summary.totalGainLoss()).isEqualByComparingTo("0");
        assertThat(summary.totalGainLossPercent()).isEqualByComparingTo("0");

        PortfolioPositionResponse qqq = summary.positions().get(0);
        assertThat(qqq.gainLoss()).isEqualByComparingTo("100");
        assertThat(qqq.gainLossPercent()).isEqualByComparingTo("50.00");
    }

    @Test
    void emptyPortfolioDoesNotDivideByZero() {
        when(repository.findByUserOrderByPurchaseDateDesc(user)).thenReturn(List.of());

        PortfolioSummaryResponse summary = service.getPortfolio(user);

        assertThat(summary.totalMarketValue()).isEqualByComparingTo("0");
        assertThat(summary.totalGainLossPercent()).isEqualByComparingTo("0");
    }

    @Test
    void unavailableQuoteFallsBackToBuyPrice() {
        when(repository.findByUserOrderByPurchaseDateDesc(user)).thenReturn(List.of(position("QQQ", "3", "120")));
        when(marketDataService.getQuote("QQQ")).thenThrow(new MarketDataException("429"));

        PortfolioPositionResponse response = service.getPortfolio(user).positions().get(0);

        assertThat(response.currentPrice()).isEqualByComparingTo("120");
        assertThat(response.gainLoss()).isEqualByComparingTo("0");
    }

    @Test
    void cannotDeleteAPositionOfAnotherUser() {
        when(repository.findByIdAndUser(9L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deletePosition(user, 9L)).isInstanceOf(ResourceNotFoundException.class);
        verify(repository, never()).delete(any(PortfolioPosition.class));
    }
}
