# SIAMP — Dashboard (Google Sheets → Gráfico)

Panel web para visualizar **Temperatura del aire**, **Humedad**, **Temperatura del agua** y **Eventos de Alimentación** desde una Google Sheet (Hoja1).

## Conectar con tu Google Sheet
1. Hoja > **Archivo → Compartir → Publicar en la web**.
2. Verifica que la pestaña sea **Hoja1** o ajusta `js/config.js`.
3. Edita `js/config.js` con tu URL CSV.

## Funciones
- Filtros por **Año, Mes, Día, Hora y Minuto**.
- Botones rápidos: **Hoy**, **Últimas 24h**, **Todo**, **Promediar por hora**.
- Botones para mostrar/ocultar cada serie.
- Marcadores **scatter** para `¿Alimentó?` (puntos en el gráfico).
- KPIs: última lectura, temp aire, humedad, temp agua y conteo de alimentaciones del día.

## Deploy GitHub Pages
Publica el repo y activa Pages para servir `index.html`.


---

## 🔔 Notificaciones de alerta

Puedes enviar alertas cuando la **Temperatura del Agua** salga del rango.

### Opción A) EmailJS (sin servidor)
1. Crea una cuenta en **EmailJS** y configura un **Service** + **Template**.
2. En `js/config.js` completa:
   ```js
   ALERTS: {
     ENABLED: true,
     COOLDOWN_MINUTES: 10,
     PROVIDERS: {
       EMAILJS: {
         ENABLED: true,
         PUBLIC_KEY: "TU_PUBLIC_KEY",
         SERVICE_ID: "TU_SERVICE_ID",
         TEMPLATE_ID: "TU_TEMPLATE_ID",
         TO_EMAIL: "destino@correo.com",
         FROM_NAME: "SIAMP Dashboard"
       }
     }
   }
   ```
3. El template puede usar variables como: `subject`, `message`, `tempWater`, etc.

### Opción B) Webhook (WhatsApp con Twilio a través de Cloudflare Workers)
1. Crea un **Cloudflare Worker** y pega algo similar a:
   ```js
   export default {
     async fetch(req, env) {
       if (req.method !== "POST") return new Response("Only POST", { status: 405 });
       const body = await req.json();
       const { message, context } = body;

       const accountSid = env.TWILIO_SID;
       const authToken  = env.TWILIO_TOKEN;
       const fromWhats  = env.TWILIO_WHATSAPP_FROM; // ej: "whatsapp:+14155238886"
       const toWhats    = env.TO_WHATSAPP;          // ej: "whatsapp:+569XXXXXXXX"

       const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
       const msg = `${message} | Agua: ${context?.tempWater || "?"}°C`;

       const data = new URLSearchParams();
       data.append("From", fromWhats);
       data.append("To", toWhats);
       data.append("Body", msg);

       const resp = await fetch(url, {
         method: "POST",
         headers: {
           "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
           "Content-Type": "application/x-www-form-urlencoded"
         },
         body: data
       });
       const out = await resp.text();
       return new Response(out, { status: resp.status });
     }
   }
   ```
2. Define variables de entorno en el Worker: `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TO_WHATSAPP`.
3. En `js/config.js` activa el **WEBHOOK** con la URL del Worker:
   ```js
   WEBHOOK: { ENABLED: true, URL: "https://tu-worker.cloudflare.workers.dev/notify" }
   ```

### Prueba rápida
- En el panel, usa el botón **“Probar notificación”** para enviar un mensaje de test.
- Hay **anti‑spam** por contenido y tiempo (cooldown configurable).


### ✏️ Umbrales en vivo (persistentes)
En la sección de filtros verás **Umbral agua (mín/máx)** y **Modo de alerta**.
- Pulsa **Guardar umbrales** para aplicar y persistir en `localStorage`.
- **Restablecer** vuelve a los valores por defecto de `config.js`.
- Los cambios actualizan de inmediato el KPI, el banner y las **líneas de umbral** del gráfico principal.


## ✅ Mejoras añadidas
- **Persistencia de estado**: series visibles, filtros, promedio por hora y banda min–max.
- **Alertas con histéresis** y tiempo mínimo de permanencia antes de notificar.
- **Pan & Zoom** en el gráfico principal + botón **Reset Zoom**.
- **Historial de alertas** con nivel (warning/critical), mensaje, valor y timestamp (guardado en `localStorage`).
