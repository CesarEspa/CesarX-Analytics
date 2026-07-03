package com.cesarx.analytics.repository;

import com.cesarx.analytics.model.entity.Etf;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EtfRepository extends JpaRepository<Etf, Long> {

    Optional<Etf> findBySymbolIgnoreCase(String symbol);

    boolean existsBySymbolIgnoreCase(String symbol);
}
