package com.cesarx.analytics.repository;

import com.cesarx.analytics.model.entity.PortfolioPosition;
import com.cesarx.analytics.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PortfolioPositionRepository extends JpaRepository<PortfolioPosition, Long> {

    List<PortfolioPosition> findByUserOrderByPurchaseDateDesc(User user);

    Optional<PortfolioPosition> findByIdAndUser(Long id, User user);
}
