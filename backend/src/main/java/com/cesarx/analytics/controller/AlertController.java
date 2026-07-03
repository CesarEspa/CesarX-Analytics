package com.cesarx.analytics.controller;

import com.cesarx.analytics.dto.alert.AlertRequest;
import com.cesarx.analytics.dto.alert.AlertResponse;
import com.cesarx.analytics.security.UserPrincipal;
import com.cesarx.analytics.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@Tag(name = "Alerts", description = "Alertas configurables por precio o cambio porcentual")
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    @Operation(summary = "Listar mis alertas")
    public ResponseEntity<List<AlertResponse>> findAll(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(alertService.findAllForUser(principal.getUser()));
    }

    @PostMapping
    @Operation(summary = "Crear una alerta")
    public ResponseEntity<AlertResponse> create(@AuthenticationPrincipal UserPrincipal principal,
                                                  @Valid @RequestBody AlertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(alertService.create(principal.getUser(), request));
    }

    @PatchMapping("/{id}/active")
    @Operation(summary = "Activar o desactivar una alerta")
    public ResponseEntity<AlertResponse> setActive(@AuthenticationPrincipal UserPrincipal principal,
                                                     @PathVariable Long id,
                                                     @RequestParam boolean active) {
        return ResponseEntity.ok(alertService.setActive(principal.getUser(), id, active));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar una alerta")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        alertService.delete(principal.getUser(), id);
        return ResponseEntity.noContent().build();
    }
}
