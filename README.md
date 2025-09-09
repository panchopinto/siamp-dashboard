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
