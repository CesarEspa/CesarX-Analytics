package com.cesarx.analytics.repository;

import com.cesarx.analytics.model.entity.Alert;
import com.cesarx.analytics.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByUserOrderByCreatedAtDesc(User user);

    Optional<Alert> findByIdAndUser(Long id, User user);

    List<Alert> findByActiveTrue();
}
