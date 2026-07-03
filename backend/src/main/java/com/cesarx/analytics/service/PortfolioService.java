package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.market.PriceQuoteResponse;
import com.cesarx.analytics.dto.portfolio.PortfolioPositionRequest;
import com.cesarx.analytics.dto.portfolio.PortfolioPositionResponse;
import com.cesarx.analytics.dto.portfolio.PortfolioSummaryResponse;
import com.cesarx.analytics.exception.ResourceNotFoundException;
import com.cesarx.analytics.model.entity.Etf;
import com.cesarx.analytics.model.entity.PortfolioPosition;
import com.cesarx.analytics.model.entity.User;
import com.cesarx.analytics.repository.PortfolioPositionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioService {

    private final PortfolioPositionRepository portfolioPositionRepository;
    private final EtfService etfService;
    private final MarketDataService marketDataService;

    @Transactional(readOnly = true)
    public PortfolioSummaryResponse getPortfolio(User user) {
        List<PortfolioPositionResponse> positions = portfolioPositionRepository.findByUserOrderByPurchaseDateDesc(user)
                .stream()
                .map(this::toResponse)
                .toList();

        BigDecimal totalMarketValue = sum(positions, PortfolioPositionResponse::marketValue);
        BigDecimal totalCostBasis = sum(positions, PortfolioPositionResponse::costBasis);
        BigDecimal totalGainLoss = totalMarketValue.subtract(totalCostBasis);
        BigDecimal totalGainLossPercent = totalCostBasis.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : totalGainLoss.divide(totalCostBasis, 6, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);

        return new PortfolioSummaryResponse(totalMarketValue, totalCostBasis, totalGainLoss, totalGainLossPercent, positions);
    }

    @Transactional
    public PortfolioPositionResponse addPosition(User user, PortfolioPositionRequest request) {
        Etf etf = etfService.getEtfOrThrow(request.symbol());

        PortfolioPosition position = PortfolioPosition.builder()
                .user(user)
                .etf(etf)
                .quantity(request.quantity())
                .avgBuyPrice(request.avgBuyPrice())
                .purchaseDate(request.purchaseDate())
                .build();

        return toResponse(portfolioPositionRepository.save(position));
    }

    @Transactional
    public void deletePosition(User user, Long positionId) {
        PortfolioPosition position = portfolioPositionRepository.findByIdAndUser(positionId, user)
                .orElseThrow(() -> new ResourceNotFoundException("Position not found: " + positionId));
        portfolioPositionRepository.delete(position);
    }

    private PortfolioPositionResponse toResponse(PortfolioPosition position) {
        String symbol = position.getEtf().getSymbol();
        BigDecimal currentPrice = position.getAvgBuyPrice();

        try {
            PriceQuoteResponse quote = marketDataService.getQuote(symbol);
            if (quote.currentPrice() != null) {
                currentPrice = quote.currentPrice();
            }
        } catch (Exception e) {
            log.warn("Could not fetch live price for {}, falling back to avg buy price: {}", symbol, e.getMessage());
        }

        BigDecimal marketValue = currentPrice.multiply(position.getQuantity()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal costBasis = position.getAvgBuyPrice().multiply(position.getQuantity()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal gainLoss = marketValue.subtract(costBasis);
        BigDecimal gainLossPercent = costBasis.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : gainLoss.divide(costBasis, 6, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);

        return new PortfolioPositionResponse(
                position.getId(),
                symbol,
                position.getEtf().getName(),
                position.getQuantity(),
                position.getAvgBuyPrice(),
                position.getPurchaseDate(),
                currentPrice,
                marketValue,
                costBasis,
                gainLoss,
                gainLossPercent
        );
    }

    private BigDecimal sum(List<PortfolioPositionResponse> positions, java.util.function.Function<PortfolioPositionResponse, BigDecimal> extractor) {
        return positions.stream().map(extractor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
