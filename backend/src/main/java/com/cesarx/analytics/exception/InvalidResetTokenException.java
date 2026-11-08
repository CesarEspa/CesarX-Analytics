package com.cesarx.analytics.exception;

public class InvalidResetTokenException extends RuntimeException {

    public InvalidResetTokenException() {
        super("El enlace no es válido o ya venció. Solicita uno nuevo.");
    }
}
