// app.js — SIAMP
let rawRows = [];
let filteredRows = [];
let chart;
let chartDaily;
let showTemp = true;
let showHum = true;
let showWater = true;
let showFeed = true;
let averagePerHour = false;
let showHourlyBand = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Persistencia de UI
const STATE_KEY = 'siamp_ui_state';
function saveUIState(){
  try{
    const state = {
      showTemp, showHum, showWater, showFeed,
      averagePerHour, showHourlyBand,
      filters: {
        year: $('#fYear')?.value || '',
        month: $('#fMonth')?.value || '',
        day: $('#fDay')?.value || '',
        hour: $('#fHour')?.value || '',
        minute: $('#fMinute')?.value || ''
      }
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }catch(e){}
}
function loadUIState(){
  try{
    const raw = localStorage.getItem(STATE_KEY);
    if(!raw) return;
    const s = JSON.parse(raw);
    if(typeof s.showTemp === 'boolean') showTemp = s.showTemp;
    if(typeof s.showHum === 'boolean') showHum = s.showHum;
    if(typeof s.showWater === 'boolean') showWater = s.showWater;
    if(typeof s.showFeed === 'boolean') showFeed = s.showFeed;
    if(typeof s.averagePerHour === 'boolean') averagePerHour = s.averagePerHour;
    if(typeof s.showHourlyBand === 'boolean') showHourlyBand = s.showHourlyBand;
    if(s.filters){
      const set = (id,v)=>{ const el = $(id); if(el && typeof v !== 'undefined') el.value = v; };
      set('#fYear', s.filters.year);
      set('#fMonth', s.filters.month);
      set('#fDay', s.filters.day);
      set('#fHour', s.filters.hour);
      set('#fMinute', s.filters.minute);
    }
  }catch(e){}
}

// Thresholds persistentes
const TH_KEY = 'siamp_thresholds';
const DEFAULT_THRESHOLDS = {
  min: CONFIG.WATER_ALERT_MIN,
  max: CONFIG.WATER_ALERT_MAX,
  mode: CONFIG.WATER_ALERT_MODE
};
function parseNumLocal(v){
  if(v===undefined || v===null) return NaN;
  return parseFloat(v.toString().replace(',', '.'));
}
function loadThresholdsFromStorage(){
  try{
    const raw = localStorage.getItem(TH_KEY);
    if(!raw) return;
    const obj = JSON.parse(raw);
    if(typeof obj.min === 'number') CONFIG.WATER_ALERT_MIN = obj.min;
    if(typeof obj.max === 'number') CONFIG.WATER_ALERT_MAX = obj.max;
    if(typeof obj.mode === 'string') CONFIG.WATER_ALERT_MODE = obj.mode;
  }catch(e){ console.warn('No thresholds in storage'); }
}
function initThresholdUI(){
  loadThresholdsFromStorage();
  const minEl = $('#thMin');
  const maxEl = $('#thMax');
  const modeEl = $('#thMode');
  const errEl = $('#thError');
  if(!minEl || !maxEl || !modeEl) return;
  minEl.value = CONFIG.WATER_ALERT_MIN;
  maxEl.value = CONFIG.WATER_ALERT_MAX;
  modeEl.value = (CONFIG.WATER_ALERT_MODE||'outside').toLowerCase();

  const save = ()=>{
    errEl.style.display = 'none'; errEl.textContent = '';
    const min = parseNumLocal(minEl.value);
    const max = parseNumLocal(maxEl.value);
    const mode = (modeEl.value||'outside').toLowerCase();
    if(!isFinite(min) || !isFinite(max)){
      errEl.textContent = 'Ingresa valores numéricos válidos.'; errEl.style.display='block'; return;
    }
    if(min >= max && mode==='outside'){
      errEl.textContent = 'El mínimo debe ser menor que el máximo en modo "fuera del rango".'; errEl.style.display='block'; return;
    }
    localStorage.setItem(TH_KEY, JSON.stringify({min, max, mode}));
    CONFIG.WATER_ALERT_MIN = min;
    CONFIG.WATER_ALERT_MAX = max;
    CONFIG.WATER_ALERT_MODE = mode;
    render();
    alert('Umbrales guardados ✅');
  };
  const reset = ()=>{
    localStorage.removeItem(TH_KEY);
    CONFIG.WATER_ALERT_MIN = DEFAULT_THRESHOLDS.min;
    CONFIG.WATER_ALERT_MAX = DEFAULT_THRESHOLDS.max;
    CONFIG.WATER_ALERT_MODE = DEFAULT_THRESHOLDS.mode;
    minEl.value = CONFIG.WATER_ALERT_MIN;
    maxEl.value = CONFIG.WATER_ALERT_MAX;
    modeEl.value = (CONFIG.WATER_ALERT_MODE||'outside').toLowerCase();
    render();
    alert('Umbrales restablecidos a valores por defecto.');
  };
  $('#thSave')?.addEventListener('click', save);
  $('#thReset')?.addEventListener('click', reset);
  [minEl, maxEl].forEach(el => el.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter'){ save(); }}));
}

// Auto refresh each 1 min with zoom preservation
const AUTO_REFRESH_MS = 60 * 1000;
let autoRefreshTimer = null;
function getXRange(){
  try{
    if(!chart || !chart.scales || !chart.scales.x) return null;
    return { min: chart.scales.x.min, max: chart.scales.x.max };
  }catch(e){ return null; }
}
function setXRange(range){
  try{
    if(!chart || !range) return;
    if(range.min != null) chart.options.scales.x.min = range.min;
    if(range.max != null) chart.options.scales.x.max = range.max;
    chart.update('none');
  }catch(e){}
}
function updateRefreshStatus(){
  const el = $('#refreshStatus');
  if(!el) return;
  const t = new Date();
  const hh = String(t.getHours()).padStart(2,'0');
  const mm = String(t.getMinutes()).padStart(2,'0');
  const ss = String(t.getSeconds()).padStart(2,'0');
  el.textContent = `Última actualización: ${hh}:${mm}:${ss}`;
}
function startAutoRefresh(){
  if(autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(()=>{
    const xr = getXRange();
    loadData({silent:true, preserveZoom:xr});
  }, AUTO_REFRESH_MS);
}

// Alert log
const LOG_KEY = 'siamp_alert_log';
function appendAlertLog(entry){
  try{
    const list = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    list.push(entry);
    while(list.length > 200) list.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(list));
    renderAlertLog();
  }catch(e){}
}
function clearAlertLog(){
  localStorage.removeItem(LOG_KEY);
  renderAlertLog();
}
function renderAlertLog(){
  const tbody = $('#alertLog tbody');
  if(!tbody) return;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); }catch(e){}
  tbody.innerHTML = '';
  list.slice(-200).reverse().forEach(it=>{
    const tr = document.createElement('tr');
    const when = new Date(it.ts||Date.now()).toLocaleString();
    const badge = it.level==='critical' ? '<span class="badge-crit">CRITICAL</span>' : (it.level==='warning' ? '<span class="badge-warn">WARN</span>' : '');
    tr.innerHTML = `<td>${when}</td><td>${badge}</td><td>${it.message||''}</td><td>${(it.value??'')}</td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  bindUI();
  initThresholdUI();
  renderAlertLog();
  $('.year')?.setAttribute('data-year', new Date().getFullYear());
  startAutoRefresh();
  updateRefreshStatus();
});

function bindUI(){
  $('#btnShowTemp').addEventListener('click', () => { showTemp = !showTemp; renderChart(); toggleActive('#btnShowTemp', showTemp); saveUIState(); });
  $('#btnShowHum').addEventListener('click', () => { showHum = !showHum; renderChart(); toggleActive('#btnShowHum', showHum); saveUIState(); });
  $('#btnShowWater').addEventListener('click', () => { showWater = !showWater; renderChart(); toggleActive('#btnShowWater', showWater); saveUIState(); });
  $('#btnShowFeed').addEventListener('click', () => { showFeed = !showFeed; renderChart(); toggleActive('#btnShowFeed', showFeed); saveUIState(); });
  $('#btnAvgHour').addEventListener('click', () => { averagePerHour = !averagePerHour; renderChart(); toggleActive('#btnAvgHour', averagePerHour); saveUIState(); });
  $('#btnBandHour').addEventListener('click', () => { showHourlyBand = !showHourlyBand; renderChart(); toggleActive('#btnBandHour', showHourlyBand); saveUIState(); });
  $('#btnAvgDay').addEventListener('click', () => { renderDailyChart(); toggleActive('#btnAvgDay', true); });

  $('#applyFilters').addEventListener('click', () => { applyFilters(); saveUIState(); });
  $('#resetFilters').addEventListener('click', () => { resetFilters(); filteredRows = rawRows.slice(); render(); saveUIState(); });
  $('#showAll').addEventListener('click', () => { resetFilters(); filteredRows = rawRows.slice(); render(); saveUIState(); });
  $('#last24').addEventListener('click', () => { quickLast24h(); saveUIState(); });
  $('#today').addEventListener('click', () => { quickToday(); saveUIState(); });

  $('#resetZoom').addEventListener('click', () => { if(chart) chart.resetZoom(); });
  $('#clearLog').addEventListener('click', clearAlertLog);
  $('#btnTestNotify').addEventListener('click', ()=>{
    notifyAlert('Prueba de notificación desde SIAMP Dashboard', { demo: true, when: new Date().toLocaleString() });
    alert('Se envió notificación de prueba (revisa tu proveedor configurado).');
  });
}

function toggleActive(selector, isActive){
  const el = document.querySelector(selector);
  if(!el) return;
  el.style.filter = isActive ? 'none' : 'grayscale(100%) brightness(0.85)';
  el.style.opacity = isActive ? '1' : '0.7';
}

function loadData(opts={}){
  Papa.parse(CONFIG.SHEET_URL, {
    download:true, header:true, dynamicTyping:false, skipEmptyLines:true,
    complete: (res)=>{
      rawRows = res.data.map(cleanRow).filter(Boolean);
      rawRows.sort((a,b)=> a.date - b.date);
      filteredRows = rawRows.slice();
      hydrateFilters(rawRows);
      loadUIState();
      applyFilters();
      render();
      updateRefreshStatus();
      if(opts && opts.preserveZoom){ setXRange(opts.preserveZoom); }
    },
    error: (err)=>{
      if(!(opts && opts.silent)){
        alert("No se pudo leer datos. ¿Publicaste la hoja como 'Publicar en la web'?\n" + err);
      } else {
        console.warn('Auto-refresh falló', err);
      }
    }
  });
}

function cleanRow(row){
  const dateStr = (row['Fecha / Hora'] || '').trim();
  const tempAirStr = (row['Temperatura Ambiente (ºC)'] || '').toString().replace(',', '.').trim();
  const humStr  = (row['Humedad Ambiente (%)'] || row['Humedad Ambiente  (%)'] || '').toString().replace(',', '.').trim();
  const tempWaterStr = (row['Temperatura del Agua (ºC)'] || '').toString().replace(',', '.').trim();
  const feedCountStr = (row['Alimentaciones Hoy'] || '0').toString().trim();
  const fedStr = (row['¿Alimentó?'] || row['?Alimentó?'] || row['Alimentó'] || '').toString().trim().toLowerCase();

  const d = parseDate(dateStr);
  if(!d.isValid()) return null;

  const year = parseInt(row['AÑO'] || d.year());
  const month = parseInt(row['MES'] || d.month()+1);
  const day = parseInt(row['DIA'] || d.date());
  const hour = parseInt(row['HORA'] || d.hour());
  const minute = parseInt(row['MINUTOS'] || d.minute());

  return {
    date: d.toDate(),
    label: d.format('DD/MM/YYYY HH:mm:ss'),
    tempAir: parseFloat(tempAirStr),
    hum: parseFloat(humStr),
    tempWater: parseFloat(tempWaterStr),
    feedCount: parseInt(feedCountStr) || 0,
    fed: ['si','sí','yes','true','1','alimentó','ok'].includes(fedStr) ? 1 : (fedStr==='no' ? 0 : 0),
    year, month, day, hour, minute
  };
}

function parseDate(s){
  for(const f of CONFIG.DATE_FORMATS){
    const d = dayjs(s, f, true);
    if(d.isValid()) return d;
  }
  return dayjs(s);
}

function hydrateFilters(rows){
  const uniq = (arr)=> [...new Set(arr)].sort((a,b)=> a-b);
  fillSelect('#fYear',   uniq(rows.map(r=>r.year)));
  fillSelect('#fMonth',  uniq(rows.map(r=>r.month)));
  fillSelect('#fDay',    uniq(rows.map(r=>r.day)));
  fillSelect('#fHour',   uniq(rows.map(r=>r.hour)));
  fillSelect('#fMinute', uniq(rows.map(r=>r.minute)));
}

function fillSelect(sel, values){
  const el = document.querySelector(sel);
  const current = el.value;
  el.options.length = 1;
  values.forEach(v=>{
    const op = document.createElement('option');
    op.value = v;
    op.textContent = v;
    el.appendChild(op);
  });
  el.value = current;
}

function applyFilters(){
  const y = $('#fYear').value;
  const m = $('#fMonth').value;
  const d = $('#fDay').value;
  const h = $('#fHour').value;
  const mi = $('#fMinute').value;

  filteredRows = rawRows.filter(r =>
    (y? r.year==y : true) &&
    (m? r.month==m : true) &&
    (d? r.day==d : true) &&
    (h? r.hour==h : true) &&
    (mi? r.minute==mi : true)
  );
  render();
}

function resetFilters(){
  ['#fYear','#fMonth','#fDay','#fHour','#fMinute'].forEach(sel => $(sel).value = '');
}

function quickToday(){
  const now = dayjs();
  $('#fYear').value = now.year();
  $('#fMonth').value = now.month()+1;
  $('#fDay').value = now.date();
  $('#fHour').value = '';
  $('#fMinute').value = '';
  applyFilters();
}

function quickLast24h(){
  const limit = dayjs().subtract(24, 'hour');
  filteredRows = rawRows.filter(r => dayjs(r.date).isAfter(limit));
  render();
}

const ALERT_LEVELS = { NORMAL: 'normal', WARNING: 'warning', CRITICAL: 'critical' };
let lastAlertState = { level: 'normal', enteredAt: 0 };

function render(){
  if(filteredRows.length){
    const last = filteredRows[filteredRows.length-1];
    $('#kpiTemp').textContent = isFinite(last.tempAir) ? `${last.tempAir.toFixed(1)} °C` : '--';
    $('#kpiHum').textContent = isFinite(last.hum) ? `${last.hum.toFixed(0)} %` : '--';
    $('#kpiWater').textContent = isFinite(last.tempWater) ? `${last.tempWater.toFixed(2)} °C` : '--';
    $('#kpiTime').textContent = last.label;
    const dayKey = dayjs(last.date).format('YYYY-MM-DD');
    const sumFeed = filteredRows.filter(r => dayjs(r.date).format('YYYY-MM-DD')===dayKey)
                        .reduce((acc,r)=> acc + (r.fed?1:0), 0);
    $('#kpiFeed').textContent = sumFeed.toString();
    checkWaterAlert(last.tempWater);
  }else{
    ['#kpiTemp','#kpiHum','#kpiWater','#kpiTime','#kpiFeed'].forEach(sel => $(sel).textContent = '--');
  }
  renderChart();
}

function renderChart(){
  const rows = averagePerHour ? groupByHour(filteredRows) : filteredRows;

  const labels = rows.map(r=>r.label);
  const tempAir = rows.map(r=>r.tempAir);
  const hum  = rows.map(r=>r.hum);
  const tempWater = rows.map(r=>r.tempWater);
  const feedEvents = rows.map(r=> r.fed ? r.tempAir : null);

  const ctx = document.getElementById('chart').getContext('2d');
  if(chart) chart.destroy();

  const datasets = [];
  // Líneas de umbral agua
  if(labels.length){
    const minLine = labels.map(()=> CONFIG.WATER_ALERT_MIN);
    const maxLine = labels.map(()=> CONFIG.WATER_ALERT_MAX);
    datasets.push({ label:'Umbral min agua', data:minLine, borderColor:'#ef4444', borderDash:[8,6], pointRadius:0, yAxisID:'y' });
    datasets.push({ label:'Umbral max agua', data:maxLine, borderColor:'#ef4444', borderDash:[8,6], pointRadius:0, yAxisID:'y' });
  }

  // Banda min–max por hora
  let hourAgg = null;
  if(showHourlyBand){
    hourAgg = groupByHourExt(filteredRows);
    datasets.push({
      label:'Temp aire máx (hora)',
      data: hourAgg.maxAir, borderColor:'rgba(245,158,11,0)', backgroundColor:'rgba(245,158,11,.10)', pointRadius:0, fill:'-1', yAxisID:'y'
    });
    datasets.push({
      label:'Temp aire mín (hora)',
      data: hourAgg.minAir, borderColor:'rgba(245,158,11,0)', backgroundColor:'rgba(245,158,11,.10)', pointRadius:0, yAxisID:'y'
    });
    datasets.push({
      label:'Humedad máx (hora)',
      data: hourAgg.maxHum, borderColor:'rgba(59,130,246,0)', backgroundColor:'rgba(59,130,246,.10)', pointRadius:0, fill:'-1', yAxisID:'y1'
    });
    datasets.push({
      label:'Humedad mín (hora)',
      data: hourAgg.minHum, borderColor:'rgba(59,130,246,0)', backgroundColor:'rgba(59,130,246,.10)', pointRadius:0, yAxisID:'y1'
    });
  }

  if(showTemp){
    datasets.push({ label:'Temp aire (°C)', data: tempAir, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, .15)', tension:.25, yAxisID:'y' });
  }
  if(showWater){
    datasets.push({ label:'Temp agua (°C)', data: tempWater, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, .15)', borderDash:[6,4], tension:.25, yAxisID:'y' });
  }
  if(showHum){
    datasets.push({ label:'Humedad (%)', data: hum, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, .15)', tension:.25, yAxisID:'y1' });
  }
  if(showFeed){
    datasets.push({
      type:'scatter', label:'¿Alimentó? (marcadores)', data: feedEvents, yAxisID:'y',
      pointRadius: feedEvents.map(v=> v!==null ? 5 : 0), showLine:false, borderColor:'#ec4899', backgroundColor:'rgba(236,72,153,.9)',
      tooltip:{ callbacks:{ label: (ctx)=> 'Evento de alimentación' } }
    });
  }

  chart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets },
    options:{
      responsive:true,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ labels:{ color:'#dbeafe' } },
        title:{ display:true, text: averagePerHour ? 'SIAMP — Promedio por hora' : 'SIAMP — Señales en tiempo', color:'#e5e7eb' },
        tooltip:{ callbacks:{ title:(ctx)=> ctx[0]?.label || '' } },
        zoom:{ pan:{ enabled:true, mode:'x' }, zoom:{ wheel:{enabled:true}, pinch:{enabled:true}, mode:'x' } }
      },
      scales:{
        x:{ ticks:{ color:'#cbd5e1' } },
        y:{ position:'left', grid:{ color:'#ffffff15' }, ticks:{ color:'#fde68a' } },
        y1:{ position:'right', grid:{ drawOnChartArea:false, color:'#ffffff15' }, ticks:{ color:'#bfdbfe' } }
      }
    }
  });
}

function renderDailyChart(){
  const dayMap = new Map();
  filteredRows.forEach(r=>{
    const key = dayjs(r.date).format('YYYY-MM-DD');
    if(!dayMap.has(key)) dayMap.set(key, {date: dayjs(r.date).startOf('day'), air:[], hum:[], water:[]});
    const o = dayMap.get(key);
    if(isFinite(r.tempAir)) o.air.push(r.tempAir);
    if(isFinite(r.hum)) o.hum.push(r.hum);
    if(isFinite(r.tempWater)) o.water.push(r.tempWater);
  });
  const rows = Array.from(dayMap.values()).map(v=>{
    const avg = a=> a.length? a.reduce((x,y)=>x+y,0)/a.length : null;
    const mn  = a=> a.length? Math.min(...a) : null;
    const mx  = a=> a.length? Math.max(...a) : null;
    return {
      label: v.date.format('DD/MM/YYYY'),
      date: v.date.toDate(),
      airAvg: avg(v.air), airMin: mn(v.air), airMax: mx(v.air),
      humAvg: avg(v.hum), humMin: mn(v.hum), humMax: mx(v.hum),
      waterAvg: avg(v.water), waterMin: mn(v.water), waterMax: mx(v.water)
    };
  }).sort((a,b)=> a.date - b.date);

  const labels = rows.map(r=>r.label);
  const airAvg = rows.map(r=>r.airAvg);
  const airMin = rows.map(r=>r.airMin);
  const airMax = rows.map(r=>r.airMax);
  const humAvg = rows.map(r=>r.humAvg);

  const ctx = document.getElementById('chartDaily').getContext('2d');
  if(chartDaily) chartDaily.destroy();

  chartDaily = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Temp aire máx (día)', data: airMax, borderColor:'rgba(245,158,11,.0)', backgroundColor:'rgba(245,158,11,.10)', pointRadius:0, fill:'-1', yAxisID:'y' },
        { label:'Temp aire mín (día)', data: airMin, borderColor:'rgba(245,158,11,.0)', backgroundColor:'rgba(245,158,11,.10)', pointRadius:0, yAxisID:'y' },
        { label:'Temp aire (promedio día)', data: airAvg, borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,.15)', tension:.25, yAxisID:'y' },
        { label:'Humedad (promedio día)', data: humAvg, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,.15)', tension:.25, yAxisID:'y1' }
      ]
    },
    options:{
      responsive:true,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ labels:{ color:'#dbeafe' } },
        title:{ display:true, text:'Promedio diario con banda min–max', color:'#e5e7eb' }
      },
      scales:{
        x:{ ticks:{ color:'#cbd5e1' } },
        y:{ position:'left', grid:{ color:'#ffffff15' }, ticks:{ color:'#fde68a' } },
        y1:{ position:'right', grid:{ drawOnChartArea:false, color:'#ffffff15' }, ticks:{ color:'#bfdbfe' } }
      }
    }
  });
}

function groupByHour(rows){
  const map = new Map();
  rows.forEach(r=>{
    const key = dayjs(r.date).format('YYYY-MM-DD HH:00');
    if(!map.has(key)) map.set(key, {air:[], hum:[], water:[], fed:[], date: dayjs(r.date).startOf('hour')});
    const o = map.get(key);
    if(isFinite(r.tempAir)) o.air.push(r.tempAir);
    if(isFinite(r.hum)) o.hum.push(r.hum);
    if(isFinite(r.tempWater)) o.water.push(r.tempWater);
    o.fed.push(r.fed?1:0);
  });
  const out = [];
  for(const [k,v] of map){
    const avg = (arr)=> arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
    out.push({
      label: v.date.format('DD/MM/YYYY HH:mm'),
      date: v.date.toDate(),
      tempAir: avg(v.air),
      hum: avg(v.hum),
      tempWater: avg(v.water),
      fed: v.fed.some(x=>x===1) ? 1 : 0
    });
  }
  out.sort((a,b)=> a.date - b.date);
  return out;
}

function groupByHourExt(rows){
  const map = new Map();
  rows.forEach(r=>{
    const key = dayjs(r.date).format('YYYY-MM-DD HH:00');
    if(!map.has(key)) map.set(key, {date: dayjs(r.date).startOf('hour'), air:[], hum:[]});
    const o = map.get(key);
    if(isFinite(r.tempAir)) o.air.push(r.tempAir);
    if(isFinite(r.hum)) o.hum.push(r.hum);
  });
  const sorted = Array.from(map.values()).sort((a,b)=> a.date - b.date);
  return {
    labels: sorted.map(v=> v.date.format('DD/MM/YYYY HH:mm')),
    minAir: sorted.map(v=> v.air.length? Math.min(...v.air): null),
    maxAir: sorted.map(v=> v.air.length? Math.max(...v.air): null),
    minHum: sorted.map(v=> v.hum.length? Math.min(...v.hum): null),
    maxHum: sorted.map(v=> v.hum.length? Math.max(...v.hum): null)
  };
}

// Notifier
function notifyAlert(message, context){
  const cfg = CONFIG.ALERTS || {};
  if(!cfg.ENABLED) return;

  const key = 'siamp_alert_last';
  let last = null;
  try { last = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){}
  const now = Date.now();
  const cooldown = (cfg.COOLDOWN_MINUTES || 10) * 60 * 1000;
  if(last && last.msg === message && (now - last.ts) < cooldown){
    return;
  }

  if(cfg.PROVIDERS?.EMAILJS?.ENABLED && window.emailjs){
    try{
      emailjs.init(cfg.PROVIDERS.EMAILJS.PUBLIC_KEY);
      emailjs.send(cfg.PROVIDERS.EMAILJS.SERVICE_ID, cfg.PROVIDERS.EMAILJS.TEMPLATE_ID, {
        to_email: cfg.PROVIDERS.EMAILJS.TO_EMAIL,
        subject: "Alerta SIAMP — Temperatura del Agua",
        message,
        ...context,
      });
    }catch(e){ console.warn('EMAILJS error', e); }
  }

  if(cfg.PROVIDERS?.WEBHOOK?.ENABLED && cfg.PROVIDERS.WEBHOOK.URL){
    try{
      fetch(cfg.PROVIDERS.WEBHOOK.URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'X-Secret': cfg.PROVIDERS.WEBHOOK.SECRET || '' },
        body: JSON.stringify({ type:'SIAMP_ALERT', message, context, ts: new Date().toISOString() })
      }).catch(()=>{});
    }catch(e){ console.warn('Webhook error', e); }
  }
  localStorage.setItem(key, JSON.stringify({ts: now, msg: message}));
}

function checkWaterAlert(water){
  const el = document.getElementById('alertWater');
  const kpi = document.querySelector('.metric.water');
  const valEl = document.querySelector('#kpiWater');
  if(!el || !kpi || !valEl){ return; }

  el.classList.add('hidden');
  kpi.classList.remove('danger');
  valEl.classList.remove('warn','danger');

  if(!isFinite(water)) return;

  const min = CONFIG.WATER_ALERT_MIN;
  const max = CONFIG.WATER_ALERT_MAX;
  const mode = (CONFIG.WATER_ALERT_MODE||'outside').toLowerCase();

  let trigger = false;
  let msg = '';
  let level = 'normal';

  if(mode === 'outside'){
    if(water < min){ trigger = true; msg = `Temperatura del agua ${water.toFixed(2)}°C por debajo del mínimo ${min}°C`; }
    else if(water > max){ trigger = true; msg = `Temperatura del agua ${water.toFixed(2)}°C por sobre el máximo ${max}°C`; }
  }else if(mode === 'below'){
    if(water < min){ trigger = true; msg = `Temperatura del agua ${water.toFixed(2)}°C por debajo del umbral ${min}°C`; }
  }else if(mode === 'above'){
    if(water > max){ trigger = true; msg = `Temperatura del agua ${water.toFixed(2)}°C por sobre el umbral ${max}°C`; }
  }

  const h = CONFIG.WATER_ALERT_HYSTERESIS || 0.3;
  const nearMin = Math.abs(water - min) <= h;
  const nearMax = Math.abs(water - max) <= h;
  if(trigger){ level = 'critical'; }
  else if((mode==='outside' && (nearMin || nearMax)) || (mode==='below' && nearMin) || (mode==='above' && nearMax)){
    level = 'warning';
  }

  const holdMin = (CONFIG.WATER_ALERT_HOLD_MINUTES || 0) * 60 * 1000;
  const nowTs = Date.now();
  if(trigger){
    if(lastAlertState.level !== 'critical'){
      lastAlertState = { level: 'critical', enteredAt: nowTs };
    }
    if(nowTs - lastAlertState.enteredAt >= holdMin){
      el.innerHTML = `<span class="badge">ALERTA</span> ${msg}`;
      el.classList.remove('hidden');
      kpi.classList.add('danger');
      valEl.classList.add('danger');
      notifyAlert(msg, { tempWater: water.toFixed(2), level: 'critical' });
      appendAlertLog({ ts: nowTs, level:'critical', message: msg, value: water });
    }
  }else{
    if(Math.abs(water - min) <= h || Math.abs(water - max) <= h){
      valEl.classList.add('warn');
      if(lastAlertState.level !== 'warning'){
        lastAlertState = { level: 'warning', enteredAt: Date.now() };
      }
      appendAlertLog({ ts: Date.now(), level:'warning', message:`Cercano a umbral (${water.toFixed(2)}°C)`, value: water });
    }else{
      lastAlertState = { level: 'normal', enteredAt: Date.now() };
    }
  }
}
