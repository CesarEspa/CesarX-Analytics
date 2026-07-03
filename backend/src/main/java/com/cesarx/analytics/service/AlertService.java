package com.cesarx.analytics.service;

import com.cesarx.analytics.dto.alert.AlertRequest;
import com.cesarx.analytics.dto.alert.AlertResponse;
import com.cesarx.analytics.exception.ResourceNotFoundException;
import com.cesarx.analytics.model.entity.Alert;
import com.cesarx.analytics.model.entity.Etf;
import com.cesarx.analytics.model.entity.User;
import com.cesarx.analytics.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository alertRepository;
    private final EtfService etfService;

    @Transactional(readOnly = true)
    public List<AlertResponse> findAllForUser(User user) {
        return alertRepository.findByUserOrderByCreatedAtDesc(user).stream().map(this::toResponse).toList();
    }

    @Transactional
    public AlertResponse create(User user, AlertRequest request) {
        Etf etf = etfService.getEtfOrThrow(request.symbol());

        Alert alert = Alert.builder()
                .user(user)
                .etf(etf)
                .alertType(request.alertType())
                .targetValue(request.targetValue())
                .active(true)
                .build();

        return toResponse(alertRepository.save(alert));
    }

    @Transactional
    public void delete(User user, Long alertId) {
        Alert alert = alertRepository.findByIdAndUser(alertId, user)
                .orElseThrow(() -> new ResourceNotFoundException("Alert not found: " + alertId));
        alertRepository.delete(alert);
    }

    @Transactional
    public AlertResponse setActive(User user, Long alertId, boolean active) {
        Alert alert = alertRepository.findByIdAndUser(alertId, user)
                .orElseThrow(() -> new ResourceNotFoundException("Alert not found: " + alertId));
        alert.setActive(active);
        return toResponse(alertRepository.save(alert));
    }

    private AlertResponse toResponse(Alert alert) {
        return new AlertResponse(
                alert.getId(),
                alert.getEtf().getSymbol(),
                alert.getAlertType(),
                alert.getTargetValue(),
                alert.isActive(),
                alert.getTriggeredAt(),
                alert.getCreatedAt()
        );
    }
}
