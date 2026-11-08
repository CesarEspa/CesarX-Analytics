package com.cesarx.analytics.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

/**
 * Sends the reset link through Brevo's HTTPS API: Render's free plan blocks
 * outbound SMTP. The call is fire-and-forget so response time does not reveal
 * whether an address has an account.
 */
@Service
@Slf4j
public class PasswordResetMailer {

    private static final String BREVO_URL = "https://api.brevo.com/v3/smtp/email";

    private final WebClient webClient;
    private final String apiKey;
    private final String fromAddress;
    private final String resetPageUrl;

    public PasswordResetMailer(WebClient.Builder builder,
                               @Value("${app.mail.brevo-api-key:}") String apiKey,
                               @Value("${app.mail.from:}") String fromAddress,
                               @Value("${app.mail.reset-page-url}") String resetPageUrl) {
        this.webClient = builder.build();
        this.apiKey = apiKey;
        this.fromAddress = fromAddress;
        this.resetPageUrl = resetPageUrl;
    }

    public void send(String email, String username, String token) {
        if (apiKey.isBlank() || fromAddress.isBlank()) {
            log.warn("Correo sin configurar: define BREVO_API_KEY y MAIL_FROM para enviar enlaces de recuperación");
            return;
        }

        String link = UriComponentsBuilder.fromHttpUrl(resetPageUrl).queryParam("token", token).toUriString();
        String safeName = HtmlUtils.htmlEscape(username);
        String html = """
                <p>Hola %s:</p>
                <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de CesarX Analytics. Tu usuario es <strong>%s</strong>.</p>
                <p><a href="%s">Crear una contraseña nueva</a></p>
                <p>El enlace sirve una sola vez y vence en 30 minutos. Si no lo pediste, ignora este correo.</p>
                """.formatted(safeName, safeName, HtmlUtils.htmlEscape(link));

        Map<String, Object> body = Map.of(
                "sender", Map.of("name", "CesarX Analytics", "email", fromAddress),
                "to", List.of(Map.of("email", email)),
                "subject", "Restablece tu contraseña de CesarX Analytics",
                "htmlContent", html
        );

        webClient.post()
                .uri(BREVO_URL)
                .header("api-key", apiKey)
                .bodyValue(body)
                .retrieve()
                .toBodilessEntity()
                .subscribe(ok -> { }, error -> log.warn("No se pudo enviar el correo de recuperación: {}", error.getMessage()));
    }
}
