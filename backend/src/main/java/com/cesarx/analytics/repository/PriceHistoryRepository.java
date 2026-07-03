package com.cesarx.analytics.repository;

import com.cesarx.analytics.model.entity.Etf;
import com.cesarx.analytics.model.entity.PriceHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PriceHistoryRepository extends JpaRepository<PriceHistory, Long> {

    List<PriceHistory> findByEtfOrderByPriceDateAsc(Etf etf);

    List<PriceHistory> findByEtfAndPriceDateBetweenOrderByPriceDateAsc(Etf etf, LocalDate from, LocalDate to);

    Optional<PriceHistory> findByEtfAndPriceDate(Etf etf, LocalDate priceDate);

    Optional<PriceHistory> findTopByEtfOrderByPriceDateDesc(Etf etf);
}
