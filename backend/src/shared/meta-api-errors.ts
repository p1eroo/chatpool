export function resolveMetaApiFailure(error: unknown): {
  code: string;
  message: string;
} {
  const detail = error instanceof Error ? error.message : "Error desconocido";

  if (/session has expired|expired on/i.test(detail)) {
    return {
      code: "META_TOKEN_EXPIRED",
      message:
        "El token de Meta expiró. Ve a Configuración → Integraciones, pega un token nuevo y vuelve a descargar.",
    };
  }

  if (/authentication error|invalid oauth|invalid access token/i.test(detail)) {
    return {
      code: "META_TOKEN_INVALID",
      message:
        "El token de Meta no es válido. Actualízalo en Configuración → Integraciones y reintenta.",
    };
  }

  return {
    code: "MEDIA_FETCH_FAILED",
    message: `No se pudo recuperar el archivo: ${detail}`,
  };
}

export function resolveMetaSendFailure(error: unknown): {
  code: string;
  message: string;
} {
  const detail = error instanceof Error ? error.message : "Error desconocido";

  if (/session has expired|expired on/i.test(detail)) {
    return {
      code: "META_TOKEN_EXPIRED",
      message:
        "El token de Meta expiró. Ve a Configuración → Integraciones, pega un token nuevo y reintenta el envío.",
    };
  }

  if (/authentication error|invalid oauth|invalid access token/i.test(detail)) {
    return {
      code: "META_TOKEN_INVALID",
      message:
        "El token de Meta no es válido. Actualízalo en Configuración → Integraciones y reintenta.",
    };
  }

  if (/\(131030\)|not in allowed list|recipient.*not.*allowed/i.test(detail)) {
    return {
      code: "META_RECIPIENT_NOT_ALLOWED",
      message:
        "Meta no permite enviar a ese número. En modo prueba, agrégalo como destinatario en developers.facebook.com → WhatsApp → API Setup.",
    };
  }

  if (/\(131047\)|24 hour|re-engagement|more than 24 hours/i.test(detail)) {
    return {
      code: "WHATSAPP_WINDOW_CLOSED",
      message:
        "La ventana de 24 horas está cerrada. El contacto debe escribirte primero o debes enviar una plantilla aprobada.",
    };
  }

  if (/\(131026\)|undeliverable|not a valid whatsapp/i.test(detail)) {
    return {
      code: "META_RECIPIENT_INVALID",
      message: "El número de destino no es una cuenta de WhatsApp válida.",
    };
  }

  return {
    code: "META_SEND_FAILED",
    message: `No se pudo enviar el mensaje por WhatsApp: ${detail}`,
  };
}
