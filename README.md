# SIAMP — Dashboard

Visualiza **Temperatura del aire**, **Humedad**, **Temperatura del agua** y **Alimentación** desde Google Sheets (Hoja1).

## Funciones
- Filtros por **Año, Mes, Día, Hora, Minuto**; botones: **Hoy**, **Últimas 24h**, **Todo**.
- **Promediar por hora**, **Banda min–max (hora)**, **Promedio diario** con banda min–max.
- **KPIs** y **líneas de umbral** (agua) + **alerta** con mensaje.
- **Umbrales en vivo** (UI) con persistencia en `localStorage`.
- **Notificaciones** (EmailJS o Webhook para WhatsApp).
- **Historial de alertas** en la página.
- **Pan & Zoom** + **Reset Zoom**.
- **Auto-actualización cada 1 minuto** con indicador de “Última actualización” y preservando zoom.

## Conectar tu hoja
En `js/config.js` ya está la URL publicada. Si cambias la hoja, ajusta `SHEET_URL`.

## Notificaciones
Configura `ALERTS` en `js/config.js`. Hay ejemplo de Worker + Twilio para WhatsApp.

## Deploy
Sube esta carpeta a un repo y activa **GitHub Pages**.
