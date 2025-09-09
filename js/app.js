// app.js — SIAMP
let rawRows = [];
let filteredRows = [];
let chart;
let showTemp = true;
let showHum = true;
let showWater = true;
let showFeed = true;
let averagePerHour = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  bindUI();
  document.querySelector('.year')?.setAttribute('data-year', new Date().getFullYear());
});

function bindUI(){
  $('#btnShowTemp').addEventListener('click', () => { showTemp = !showTemp; renderChart(); toggleActive('#btnShowTemp', showTemp); });
  $('#btnShowHum').addEventListener('click', () => { showHum = !showHum; renderChart(); toggleActive('#btnShowHum', showHum); });
  $('#btnShowWater').addEventListener('click', () => { showWater = !showWater; renderChart(); toggleActive('#btnShowWater', showWater); });
  $('#btnShowFeed').addEventListener('click', () => { showFeed = !showFeed; renderChart(); toggleActive('#btnShowFeed', showFeed); });
  $('#btnAvgHour').addEventListener('click', () => { averagePerHour = !averagePerHour; renderChart(); toggleActive('#btnAvgHour', averagePerHour); });

  $('#applyFilters').addEventListener('click', () => applyFilters());
  $('#resetFilters').addEventListener('click', () => { resetFilters(); filteredRows = rawRows.slice(); render(); });
  $('#showAll').addEventListener('click', () => { resetFilters(); filteredRows = rawRows.slice(); render(); });
  $('#last24').addEventListener('click', () => quickLast24h());
  $('#today').addEventListener('click', () => quickToday());
}

function toggleActive(selector, isActive){
  const el = document.querySelector(selector);
  if(!el) return;
  el.style.filter = isActive ? 'none' : 'grayscale(100%) brightness(0.85)';
  el.style.opacity = isActive ? '1' : '0.7';
}

function loadData(){
  Papa.parse(CONFIG.SHEET_URL, {
    download:true, header:true, dynamicTyping:false, skipEmptyLines:true,
    complete: (res)=>{
      rawRows = res.data.map(cleanRow).filter(Boolean);
      rawRows.sort((a,b)=> a.date - b.date);
      filteredRows = rawRows.slice();
      hydrateFilters(rawRows);
      render();
    },
    error: (err)=>{
      alert("No se pudo leer datos. Revisa que la publicación en la web esté activa.\n" + err);
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
    fed: ['si','sí','yes','true','1'].includes(fedStr) ? 1 : (fedStr==='no' ? 0 : 0),
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
  const y = document.querySelector('#fYear').value;
  const m = document.querySelector('#fMonth').value;
  const d = document.querySelector('#fDay').value;
  const h = document.querySelector('#fHour').value;
  const mi = document.querySelector('#fMinute').value;

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
  ['#fYear','#fMonth','#fDay','#fHour','#fMinute'].forEach(sel => document.querySelector(sel).value = '');
}

function quickToday(){
  const now = dayjs();
  document.querySelector('#fYear').value = now.year();
  document.querySelector('#fMonth').value = now.month()+1;
  document.querySelector('#fDay').value = now.date();
  document.querySelector('#fHour').value = '';
  document.querySelector('#fMinute').value = '';
  applyFilters();
}

function quickLast24h(){
  const limit = dayjs().subtract(24, 'hour');
  filteredRows = rawRows.filter(r => dayjs(r.date).isAfter(limit));
  render();
}

function render(){
  if(filteredRows.length){
    const last = filteredRows[filteredRows.length-1];
    document.querySelector('#kpiTemp').textContent = isFinite(last.tempAir) ? `${last.tempAir.toFixed(1)} °C` : '--';
    document.querySelector('#kpiHum').textContent = isFinite(last.hum) ? `${last.hum.toFixed(0)} %` : '--';
    document.querySelector('#kpiWater').textContent = isFinite(last.tempWater) ? `${last.tempWater.toFixed(2)} °C` : '--';
    document.querySelector('#kpiTime').textContent = last.label;
    const dayKey = dayjs(last.date).format('YYYY-MM-DD');
    const sumFeed = filteredRows.filter(r => dayjs(r.date).format('YYYY-MM-DD')===dayKey)
                        .reduce((acc,r)=> acc + (r.fed?1:0), 0);
    document.querySelector('#kpiFeed').textContent = sumFeed.toString();
  }else{
    ['#kpiTemp','#kpiHum','#kpiWater','#kpiTime','#kpiFeed'].forEach(sel => document.querySelector(sel).textContent = '--');
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
  if(showTemp){
    datasets.push({
      label:'Temp aire (°C)',
      data: tempAir,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, .15)',
      tension:.25,
      yAxisID:'y'
    });
  }
  if(showWater){
    datasets.push({
      label:'Temp agua (°C)',
      data: tempWater,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, .15)',
      borderDash:[6,4],
      tension:.25,
      yAxisID:'y'
    });
  }
  if(showHum){
    datasets.push({
      label:'Humedad (%)',
      data: hum,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, .15)',
      tension:.25,
      yAxisID:'y1'
    });
  }
  if(showFeed){
    datasets.push({
      type:'scatter',
      label:'¿Alimentó? (marcadores)',
      data: feedEvents,
      yAxisID:'y',
      pointRadius: feedEvents.map(v=> v!==null ? 5 : 0),
      showLine:false,
      borderColor:'#ec4899',
      backgroundColor:'rgba(236,72,153,.9)',
      tooltip: { callbacks:{ label: (ctx)=> 'Evento de alimentación' } }
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
        tooltip:{ callbacks:{ title:(ctx)=> ctx[0]?.label || '' } }
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
