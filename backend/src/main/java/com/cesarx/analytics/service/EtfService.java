package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.etf.EtfCreateRequest;
import com.cesarx.analytics.dto.etf.EtfResponse;
import com.cesarx.analytics.exception.DuplicateResourceException;
import com.cesarx.analytics.exception.ResourceNotFoundException;
import com.cesarx.analytics.model.entity.Etf;
import com.cesarx.analytics.repository.EtfRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EtfService {

    private final EtfRepository etfRepository;

    @Transactional(readOnly = true)
    public List<EtfResponse> findAll() {
        return etfRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public EtfResponse findBySymbol(String symbol) {
        return toResponse(getEtfOrThrow(symbol));
    }

    @Transactional(readOnly = true)
    public Etf getEtfOrThrow(String symbol) {
        return etfRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new ResourceNotFoundException("ETF not found: " + symbol));
    }

    @Transactional
    public EtfResponse create(EtfCreateRequest request) {
        if (etfRepository.existsBySymbolIgnoreCase(request.symbol())) {
            throw new DuplicateResourceException("ETF already registered: " + request.symbol());
        }

        Etf etf = Etf.builder()
                .symbol(request.symbol().toUpperCase())
                .name(request.name())
                .sector(request.sector())
                .exchange(request.exchange())
                .currency(request.currency() != null ? request.currency() : "USD")
                .build();

        return toResponse(etfRepository.save(etf));
    }

    private EtfResponse toResponse(Etf etf) {
        return new EtfResponse(etf.getId(), etf.getSymbol(), etf.getName(), etf.getSector(),
                etf.getExchange(), etf.getCurrency());
    }
}
