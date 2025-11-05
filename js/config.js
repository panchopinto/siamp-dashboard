// config.js — SIAMP (USANDO URL PUBLICADA)
const CONFIG = {
  SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSFyErqMtfcctYi7_fOt8kYj0gePBXmMeE97ASpcyoiTtP0lk6fHrO85dZXKw7oeybf4qkor5D-CPdV/pub?gid=1518128511&single=true&output=csv",
  DATE_FORMATS: ["D/M/YYYY H:mm:ss", "DD/M/YYYY H:mm:ss", "D/M/YYYY HH:mm:ss", "DD/MM/YYYY HH:mm:ss"]

    ,
  // Umbrales de alerta para Temperatura del Agua (°C)
  WATER_ALERT_MIN: 14.0,
  WATER_ALERT_MAX: 18.0,
  // Modo de alerta: 'outside' (fuera del rango) o 'below'/'above'
  
      
WATER_ALERT_MODE: 'outside',
  // Histéresis (°C) para evitar flapping; y tiempo mínimo de permanencia para disparar alerta
  WATER_ALERT_HYSTERESIS: 0.3,
  WATER_ALERT_HOLD_MINUTES: 1
,
// Notificaciones (EmailJS / Webhook). Si usas WhatsApp (Twilio), configura un Webhook propio (Worker/Function).
ALERTS: {
  ENABLED: true,
  COOLDOWN_MINUTES: 10,
  PROVIDERS: {
    EMAILJS: {
      ENABLED: false,
      PUBLIC_KEY: "",
      SERVICE_ID: "",
      TEMPLATE_ID: "",
      TO_EMAIL: "",
      FROM_NAME: "SIAMP Dashboard"
    },
    WEBHOOK: {
      ENABLED: false,
      URL: "",
      SECRET: ""   // opcional
    }
  }
}

};

