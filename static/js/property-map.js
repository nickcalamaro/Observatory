/**
 * Property Profile – Interactive choropleth + ECharts visualisations
 * Datasets: bedroom distribution by tenure, property sale prices
 */

// ============================================================
// Configuration
// ============================================================
const MAP_COLORS = ['#FFEDA0','#FED976','#FEB24C','#FD8D3C','#FC4E2A','#E31A1C','#BD0026','#800026'];
const ZERO_COLOR = '#f0f0f0';
const NO_DATA_COLOR = '#d9d9d9';

const DISTRICTS = [
  'East Side','North District','Reclamation Areas',
  'Town Area','Upper Town','Sandpits Area','South District'
];

const BED_KEYS = ['0','1','2','3','4','5','6+'];
const BED_LABELS = { '0':'Studio','1':'1 Bed','2':'2 Bed','3':'3 Bed','4':'4 Bed','5':'5 Bed','6+':'6+' };

const BED_COLORS = {
  '0':'#c0c0c0','1':'#5470c6','2':'#91cc75','3':'#fac858',
  '4':'#ee6666','5':'#73c0de','6+':'#9a60b4'
};

const TENURES = [
  'Government rented','Private rented','Employer rented',
  'Owns outright','Owns with a mortgage','Co-ownership',
  'Rent free','Other'
];

const TENURE_COLORS = {
  'Government rented':'#5470c6', 'Private rented':'#91cc75',
  'Employer rented':'#fac858', 'Owns outright':'#ee6666',
  'Owns with a mortgage':'#73c0de', 'Co-ownership':'#3ba272',
  'Rent free':'#fc8452', 'Other':'#9a60b4'
};

const RENT_TENURES = ['Government rented','Private rented','Employer rented'];
const OWN_TENURES  = ['Owns outright','Owns with a mortgage','Co-ownership'];

// ============================================================
// State
// ============================================================
let propData = null;          // property-data.json
let districtsConfig = null;   // districts.json
let geoJsonRaw = null;        // transformed geojson
let districtGeoJson = null;   // merged district FeatureCollection

let map = null, geojsonLayer = null, legendCtrl = null, infoCtrl = null;
let priceChart = null, bedroomChart = null, tenureChart = null;

let curMetric  = 'households';
let curBed     = 'all';
let curTenure  = 'All';
let colorBreaks = [];

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  initMap();
  await loadAllData();
  buildDistrictGeoJson();
  initCharts();
  setupControls();
  setupHouseViz();
  updateAll();
  updateHouseViz();
}

// ============================================================
// Map setup
// ============================================================
function initMap() {
  map = L.map('property-map', { center: [36.140, -5.353], zoom: 14 });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  // Info control
  infoCtrl = L.control({ position: 'topright' });
  infoCtrl.onAdd = function () {
    this._div = L.DomUtil.create('div', 'prop-info');
    this.update();
    return this._div;
  };
  infoCtrl.update = function (name) {
    if (!name) {
      this._div.innerHTML = '<h4>Property Profile</h4><span style="color:#999">Hover over a district</span>';
      return;
    }
    const val = getMapValue(name);
    const isPrice = curMetric !== 'households';
    if (val === null) {
      this._div.innerHTML = '<h4>Property Profile</h4>' +
        '<div class="district-name">' + name + '</div>' +
        '<div class="district-sub" style="margin-top:4px">No price data available</div>';
      return;
    }
    const formatted = isPrice ? '£' + val.toLocaleString() : val.toLocaleString();
    const total = getTotal();
    const pctStr = (!isPrice && total > 0) ? ((val / total) * 100).toFixed(1) + '% of Gibraltar' : '';
    this._div.innerHTML = '<h4>Property Profile</h4>' +
      '<div class="district-name">' + name + '</div>' +
      '<div class="district-value">' + formatted + '</div>' +
      (pctStr ? '<div class="district-sub">' + pctStr + '</div>' : '');
  };
  infoCtrl.addTo(map);

  // Legend control
  legendCtrl = L.control({ position: 'bottomright' });
  legendCtrl.onAdd = function () {
    this._div = L.DomUtil.create('div', 'prop-legend');
    return this._div;
  };
  legendCtrl.addTo(map);
}

// ============================================================
// Data loading
// ============================================================
async function loadAllData() {
  const base = typeof SITE_BASE_URL !== 'undefined' ? SITE_BASE_URL : '/Observatory/';
  const [districts, geojson, prop] = await Promise.all([
    fetch(base + 'data/districts.json').then(r => r.json()),
    fetch(base + 'data/gibraltar.geojson').then(r => r.json()),
    fetch(base + 'data/property-data.json').then(r => r.json())
  ]);
  districtsConfig = districts;
  propData = prop;

  // Transform EPSG:3857 → EPSG:4326
  geoJsonRaw = {
    ...geojson,
    features: geojson.features.map(f => ({
      ...f,
      geometry: {
        ...f.geometry,
        coordinates: f.geometry.coordinates.map(poly =>
          poly.map(ring =>
            ring.map(c => {
              const lng = (c[0] / 20037508.34) * 180;
              const lat = (Math.atan(Math.exp((c[1] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
              return [lng, lat];
            })
          )
        )
      }
    }))
  };
}

// ============================================================
// Build merged district GeoJSON (same pattern as population map)
// ============================================================
function buildDistrictGeoJson() {
  const features = [];
  Object.keys(districtsConfig).forEach(id => {
    const d = districtsConfig[id];
    const eas = d.enumeration_areas
      .map(n => geoJsonRaw.features.find(f => f.properties.name === 'EA ' + n))
      .filter(Boolean);
    if (!eas.length) return;

    let merged = null;
    try {
      merged = eas[0];
      for (let i = 1; i < eas.length; i++) merged = turf.union(merged, eas[i]);
    } catch (_) {
      const coords = [];
      eas.forEach(f => {
        if (f.geometry.type === 'Polygon') coords.push(f.geometry.coordinates);
        else if (f.geometry.type === 'MultiPolygon') coords.push(...f.geometry.coordinates);
      });
      merged = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: coords }, properties: {} };
    }
    if (merged) features.push({ type: 'Feature', properties: { name: d.name }, geometry: merged.geometry });
  });
  districtGeoJson = { type: 'FeatureCollection', features };
}

// ============================================================
// Data access helpers
// ============================================================
function getHouseholds(district, bed, tenure) {
  const d = propData.bedrooms[district];
  if (!d) return 0;

  const beds = (bed === 'all') ? BED_KEYS : [bed];
  let sum = 0;
  beds.forEach(b => {
    const obj = d[b];
    if (!obj) return;
    if (tenure === 'All') {
      Object.values(obj).forEach(v => sum += v);
    } else if (tenure === 'All rented') {
      RENT_TENURES.forEach(t => sum += (obj[t] || 0));
    } else if (tenure === 'All owned') {
      OWN_TENURES.forEach(t => sum += (obj[t] || 0));
    } else {
      sum += (obj[tenure] || 0);
    }
  });
  return sum;
}

function getPrice(district, bed, priceType) {
  const dp = propData.prices[district];
  if (!dp) return null;

  const key = priceType.replace('-price', ''); // 'avg','min','max'

  if (bed === 'all') {
    // Average of all available room-count averages
    const rooms = Object.keys(dp);
    if (rooms.length === 0) return null;
    let sum = 0;
    rooms.forEach(r => sum += dp[r][key]);
    return Math.round(sum / rooms.length);
  }

  if (!dp[bed]) return null;
  return dp[bed][key];
}

function getMapValue(district) {
  if (curMetric === 'households') return getHouseholds(district, curBed, curTenure);
  return getPrice(district, curBed, curMetric);
}

function getTotal() {
  if (curMetric !== 'households') return null; // no meaningful "total" for prices
  return DISTRICTS.reduce((s, d) => s + getHouseholds(d, curBed, curTenure), 0);
}

function isPrice() { return curMetric !== 'households'; }

// ============================================================
// Color scale helpers (nice-number breaks, same as housing page)
// ============================================================
function niceStep(raw) {
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / mag;
  let nice;
  if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 2.5) nice = 2.5;
  else if (frac <= 5) nice = 5;
  else nice = 10;
  return nice * mag;
}

function computeBreaks(values) {
  const valid = values.filter(v => v !== null && v > 0);
  if (!valid.length) return [0];
  const max = Math.max(...valid);
  const step = niceStep(max / MAP_COLORS.length);
  const breaks = [];
  for (let i = 0; i < MAP_COLORS.length; i++) breaks.push(Math.round(step * i));
  return breaks;
}

function getColor(val) {
  if (val === null) return NO_DATA_COLOR;
  if (val === 0) return ZERO_COLOR;
  for (let i = colorBreaks.length - 1; i >= 0; i--) {
    if (val >= colorBreaks[i]) return MAP_COLORS[i];
  }
  return MAP_COLORS[0];
}

// ============================================================
// Map rendering
// ============================================================
function styleFeature(f) {
  const val = getMapValue(f.properties.name);
  return { fillColor: getColor(val), weight: 3, opacity: 1, color: '#444', fillOpacity: 0.75 };
}

function highlightFeature(e) {
  e.target.setStyle({ weight: 5, color: '#222', fillOpacity: 0.9 });
  e.target.bringToFront();
  infoCtrl.update(e.target.feature.properties.name);
}

function resetHighlight(e) {
  geojsonLayer.resetStyle(e.target);
  infoCtrl.update();
}

function onEachFeature(f, layer) {
  layer.on({ mouseover: highlightFeature, mouseout: resetHighlight, click: function (e) {
    map.fitBounds(e.target.getBounds());
    layer.openPopup();
  }});
  layer.bindPopup(function () { return buildPopup(f.properties.name); }, { maxWidth: 340 });
}

function renderMap() {
  const vals = DISTRICTS.map(d => getMapValue(d));
  colorBreaks = computeBreaks(vals);
  if (geojsonLayer) map.removeLayer(geojsonLayer);
  geojsonLayer = L.geoJSON(districtGeoJson, { style: styleFeature, onEachFeature }).addTo(map);
  map.fitBounds(geojsonLayer.getBounds());
}

// ============================================================
// Legend
// ============================================================
function updateLegend() {
  const div = legendCtrl._div;
  const vals = DISTRICTS.map(d => getMapValue(d)).filter(v => v !== null);
  const max = vals.length ? Math.max(...vals) : 0;
  const priceMode = isPrice();
  const fmt = v => priceMode ? '£' + v.toLocaleString() : v.toLocaleString();

  if (max === 0 && !vals.length) {
    div.innerHTML = '<strong>No data</strong>';
    return;
  }

  let html = '<strong>' + (priceMode ? 'Sale Price (£)' : 'Households') + '</strong>';

  if (priceMode) {
    html += '<div><i style="background:' + NO_DATA_COLOR + '"></i> No data</div>';
  }
  html += '<div><i style="background:' + ZERO_COLOR + '"></i> 0</div>';

  for (let i = 0; i < colorBreaks.length; i++) {
    const from = colorBreaks[i];
    const to = colorBreaks[i + 1];
    if (from === 0 && i === 0) {
      html += '<div><i style="background:' + MAP_COLORS[i] + '"></i> ' + fmt(1) +
        (to !== undefined ? '–' + fmt(to) : '+') + '</div>';
    } else {
      html += '<div><i style="background:' + MAP_COLORS[i] + '"></i> ' + fmt(from) +
        (to !== undefined ? '–' + fmt(to) : '+') + '</div>';
    }
  }
  div.innerHTML = html;
}

// ============================================================
// Popup
// ============================================================
function buildPopup(district) {
  const val = getMapValue(district);
  const priceMode = isPrice();
  let html = '<div class="popup-title">' + district + '</div>';

  if (val === null) {
    html += '<div class="popup-label" style="color:#aaa">No price data available for this district</div>';
  } else {
    html += '<div class="popup-hero">' + (priceMode ? '£' + val.toLocaleString() : val.toLocaleString()) + '</div>';
    const bedLabel = curBed === 'all' ? 'all bedrooms' : BED_LABELS[curBed];
    if (priceMode) {
      const typeLabel = curMetric.replace('-', ' ').replace('avg','average').replace('min','minimum').replace('max','maximum');
      html += '<div class="popup-label">' + typeLabel + ' · ' + bedLabel + '</div>';
    } else {
      const tenureLabel = curTenure === 'All' ? 'all tenures' : curTenure.toLowerCase();
      html += '<div class="popup-label">households · ' + bedLabel + ' · ' + tenureLabel + '</div>';
    }
  }

  // Bedroom breakdown (always useful)
  html += '<div class="popup-grid">';
  BED_KEYS.forEach(b => {
    const count = getHouseholds(district, b, curTenure);
    if (count === 0 && curBed !== b) return; // skip zero rows unless it's the selected bed
    const hl = (curBed === b) ? ' pg-highlight' : '';
    html += '<span class="pg-label' + hl + '">' + BED_LABELS[b] + '</span>' +
            '<span class="pg-value' + hl + '">' + count.toLocaleString() + '</span>';
  });
  const totalHH = getHouseholds(district, 'all', curTenure);
  html += '<span class="pg-label" style="border-top:1px solid #ddd;padding-top:4px;font-weight:700">Total</span>' +
          '<span class="pg-value" style="border-top:1px solid #ddd;padding-top:4px;font-weight:700">' + totalHH.toLocaleString() + '</span>';
  html += '</div>';

  // Price info if available
  const dp = propData.prices[district];
  if (dp) {
    html += '<div style="border-top:1px solid #eee;margin-top:8px;padding-top:8px;font-size:0.85em;color:#555">';
    html += '<strong style="color:#333">Sale Prices</strong><br>';
    Object.keys(dp).sort().forEach(r => {
      const p = dp[r];
      html += r + '-bed: £' + p.avg.toLocaleString() +
        ' <span style="color:#aaa">(£' + p.min.toLocaleString() + ' – £' + p.max.toLocaleString() + ')</span><br>';
    });
    html += '</div>';
  }

  return html;
}

// ============================================================
// Summary bar
// ============================================================
function updateSummary() {
  const priceMode = isPrice();
  const total = getTotal();
  const bedLabel = curBed === 'all' ? 'all bedrooms' : BED_LABELS[curBed];

  if (priceMode) {
    // Show average across districts that have data
    const vals = DISTRICTS.map(d => getPrice(d, curBed, curMetric)).filter(v => v !== null);
    if (vals.length) {
      const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
      document.getElementById('summary-value').textContent = '£' + avg.toLocaleString();
    } else {
      document.getElementById('summary-value').textContent = '—';
    }
    const typeLabel = curMetric.replace('-price','').replace('avg','average').replace('min','minimum').replace('max','maximum');
    document.getElementById('summary-label').textContent = typeLabel + ' sale price · ' + bedLabel + ' (across ' + DISTRICTS.filter(d => getPrice(d, curBed, curMetric) !== null).length + ' areas)';
  } else {
    document.getElementById('summary-value').textContent = total.toLocaleString();
    const tenureLabel = curTenure === 'All' ? 'all tenures' : curTenure.toLowerCase();
    document.getElementById('summary-label').textContent = 'households · ' + bedLabel + ' · ' + tenureLabel;
  }
}

// ============================================================
// Data table
// ============================================================
function updateTable() {
  const tbody = document.getElementById('prop-table-body');
  const priceMode = isPrice();
  const total = getTotal();

  document.getElementById('th-value').textContent = priceMode ? 'Price (£)' : 'Households';

  const rows = DISTRICTS.map(d => ({ name: d, value: getMapValue(d) }));
  rows.sort((a, b) => {
    if (a.value === null && b.value === null) return 0;
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });

  const maxVal = rows.reduce((m, r) => (r.value !== null && r.value > m) ? r.value : m, 1);

  tbody.innerHTML = '';
  rows.forEach((r, i) => {
    const noData = r.value === null;
    const fmt = noData ? '—' : (priceMode ? '£' + r.value.toLocaleString() : r.value.toLocaleString());
    const barW = noData ? 0 : ((r.value / maxVal) * 100).toFixed(1);
    const pct = (!priceMode && total > 0 && !noData) ? ((r.value / total) * 100).toFixed(1) + '%' : (noData ? '—' : '');
    const color = getColor(r.value);

    const tr = document.createElement('tr');
    if (!noData) tr.onclick = function () { flyTo(r.name); };
    tr.innerHTML =
      '<td style="color:#aaa;font-weight:600;width:40px">' + (i + 1) + '</td>' +
      '<td><span class="color-swatch" style="background:' + color + '"></span>' + r.name + '</td>' +
      '<td class="numeric">' + fmt + '</td>' +
      '<td class="bar-cell"><div class="bar-wrapper"><div class="bar-fill" style="width:' + barW + '%;background:' + color + '"></div></div></td>' +
      '<td class="numeric share-cell">' + pct + '</td>';
    tbody.appendChild(tr);
  });

  // Footer
  const foot = document.getElementById('prop-table-foot');
  if (priceMode) {
    foot.style.display = 'none';
  } else {
    foot.style.display = '';
    document.getElementById('table-total').textContent = total.toLocaleString();
  }
}

function flyTo(name) {
  if (!geojsonLayer) return;
  geojsonLayer.eachLayer(function (l) {
    if (l.feature.properties.name === name) { map.fitBounds(l.getBounds()); l.openPopup(); }
  });
}

// ============================================================
// ECharts: Initialise
// ============================================================
function initCharts() {
  priceChart   = echarts.init(document.getElementById('price-chart'));
  bedroomChart = echarts.init(document.getElementById('bedroom-chart'));
  tenureChart  = echarts.init(document.getElementById('tenure-chart'));

  window.addEventListener('resize', () => {
    priceChart.resize();
    bedroomChart.resize();
    tenureChart.resize();
  });
}

// ============================================================
// ECharts: Property Prices (grouped bar)
// ============================================================
function updatePriceChart() {
  const zones = Object.keys(propData.prices);
  // All room counts present across all zones
  const allRooms = new Set();
  zones.forEach(z => Object.keys(propData.prices[z]).forEach(r => allRooms.add(r)));
  const rooms = Array.from(allRooms).sort();

  const series = rooms.map(r => ({
    name: r + ' Bed',
    type: 'bar',
    barGap: '10%',
    data: zones.map(z => {
      const p = propData.prices[z]?.[r];
      return p ? p.avg : null;
    }),
    itemStyle: { borderRadius: [3, 3, 0, 0] },
    label: {
      show: false
    }
  }));

  // Custom tooltip showing min/avg/max
  priceChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        let html = '<strong>' + params[0].axisValue + '</strong><br>';
        params.forEach(p => {
          if (p.value === null || p.value === undefined) return;
          const zone = zones[p.dataIndex];
          const room = rooms[p.seriesIndex];
          const priceObj = propData.prices[zone]?.[room];
          html += p.marker + ' ' + p.seriesName + ': <strong>£' + p.value.toLocaleString() + '</strong>';
          if (priceObj) {
            html += ' <span style="color:#aaa;font-size:0.9em">(£' + priceObj.min.toLocaleString() + ' – £' + priceObj.max.toLocaleString() + ')</span>';
          }
          html += '<br>';
        });
        return html;
      }
    },
    legend: { data: rooms.map(r => r + ' Bed'), bottom: 0 },
    grid: { left: 80, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: zones, axisLabel: { fontSize: 11, interval: 0, rotate: zones.length > 4 ? 15 : 0 } },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: function (v) { return v >= 1000000 ? '£' + (v / 1000000).toFixed(1) + 'M' : '£' + (v / 1000).toFixed(0) + 'K'; } }
    },
    series: series,
    color: ['#5470c6','#91cc75','#fac858','#ee6666']
  }, true);
}

// ============================================================
// ECharts: Bedroom Distribution (stacked bar)
// ============================================================
function updateBedroomChart() {
  const series = BED_KEYS.map(b => ({
    name: BED_LABELS[b],
    type: 'bar',
    stack: 'total',
    emphasis: { focus: 'series' },
    itemStyle: { color: BED_COLORS[b] },
    data: DISTRICTS.map(d => getHouseholds(d, b, curTenure))
  }));

  bedroomChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        let total = 0;
        params.forEach(p => total += (p.value || 0));
        let html = '<strong>' + params[0].axisValue + '</strong> — Total: ' + total.toLocaleString() + '<br>';
        params.filter(p => p.value > 0).forEach(p => {
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
          html += p.marker + ' ' + p.seriesName + ': <strong>' + p.value.toLocaleString() + '</strong> (' + pct + '%)<br>';
        });
        return html;
      }
    },
    legend: { data: BED_KEYS.map(b => BED_LABELS[b]), bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 60, right: 20, top: 20, bottom: 55 },
    xAxis: { type: 'category', data: DISTRICTS, axisLabel: { fontSize: 10, interval: 0, rotate: 25 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    series: series
  }, true);
}

// ============================================================
// ECharts: Tenure Composition (100% stacked horizontal bar)
// ============================================================
function updateTenureChart() {
  // Compute totals for percentage
  const totals = DISTRICTS.map(d => getHouseholds(d, curBed, 'All'));

  const series = TENURES.map(t => ({
    name: t,
    type: 'bar',
    stack: 'total',
    emphasis: { focus: 'series' },
    itemStyle: { color: TENURE_COLORS[t] },
    data: DISTRICTS.map((d, i) => {
      const count = getHouseholds(d, curBed, t);
      return totals[i] > 0 ? parseFloat(((count / totals[i]) * 100).toFixed(1)) : 0;
    })
  }));

  tenureChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        const idx = params[0].dataIndex;
        const district = DISTRICTS[idx];
        const total = totals[idx];
        let html = '<strong>' + district + '</strong> — ' + total.toLocaleString() + ' households<br>';
        params.filter(p => p.value > 0).forEach(p => {
          const count = getHouseholds(district, curBed, p.seriesName);
          html += p.marker + ' ' + p.seriesName + ': <strong>' + count.toLocaleString() + '</strong> (' + p.value + '%)<br>';
        });
        return html;
      }
    },
    legend: {
      data: TENURES,
      bottom: 0,
      textStyle: { fontSize: 10 },
      type: 'scroll'
    },
    grid: { left: 110, right: 20, top: 20, bottom: 65 },
    yAxis: { type: 'category', data: DISTRICTS, axisLabel: { fontSize: 10 } },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', fontSize: 11 }
    },
    series: series
  }, true);
}

// ============================================================
// Controls
// ============================================================
function setupControls() {
  const metricSel = document.getElementById('metric-select');
  const bedSel    = document.getElementById('bed-select');
  const tenureSel = document.getElementById('tenure-select');

  metricSel.addEventListener('change', function () {
    curMetric = this.value;
    // Disable tenure when showing prices
    tenureSel.disabled = isPrice();
    if (isPrice()) { curTenure = 'All'; tenureSel.value = 'All'; }
    updateAll();
  });

  bedSel.addEventListener('change', function () {
    curBed = this.value;
    updateAll();
  });

  tenureSel.addEventListener('change', function () {
    curTenure = this.value;
    updateAll();
  });
}

// ============================================================
// Master update
// ============================================================
function updateAll() {
  renderMap();
  updateLegend();
  updateSummary();
  updateTable();
  updatePriceChart();
  updateBedroomChart();
  updateTenureChart();
}

// ============================================================
// House Tenure Visualisation
// ============================================================
function setupHouseViz() {
  document.getElementById('house-district-select').addEventListener('change', updateHouseViz);

  // Event-delegation for legend ↔ band hover
  var legend = document.getElementById('house-legend');
  legend.addEventListener('mouseover', function (e) {
    var item = e.target.closest('.house-legend-item[data-tenure]');
    if (item) highlightTenure(item.dataset.tenure);
  });
  legend.addEventListener('mouseout', function (e) {
    var item = e.target.closest('.house-legend-item[data-tenure]');
    if (item) clearTenureHighlight();
  });
}

function updateHouseViz() {
  var district = document.getElementById('house-district-select').value;

  // Compute tenure totals
  var tenureTotals = {};
  var grandTotal = 0;
  TENURES.forEach(function (t) {
    var count = 0;
    if (district === 'All') {
      DISTRICTS.forEach(function (d) { count += getHouseholds(d, 'all', t); });
    } else {
      count = getHouseholds(district, 'all', t);
    }
    tenureTotals[t] = count;
    grandTotal += count;
  });

  // Sort descending — largest tenure at the bottom (foundation)
  var sorted = TENURES
    .filter(function (t) { return tenureTotals[t] > 0; })
    .sort(function (a, b) { return tenureTotals[b] - tenureTotals[a]; });

  // ---- SVG bands ----
  var yTop = 15, yBottom = 395;
  var totalHeight = yBottom - yTop;
  var bandsGroup = document.getElementById('house-bands');
  bandsGroup.innerHTML = '';

  var currentY = yBottom;
  sorted.forEach(function (tenure) {
    var pct = grandTotal > 0 ? tenureTotals[tenure] / grandTotal : 0;
    var bandHeight = pct * totalHeight;
    if (bandHeight < 0.5) return;

    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', String(currentY - bandHeight));
    rect.setAttribute('width', '300');
    rect.setAttribute('height', String(bandHeight));
    rect.setAttribute('fill', TENURE_COLORS[tenure]);
    rect.setAttribute('data-tenure', tenure);

    rect.addEventListener('mouseenter', (function (t) {
      return function () { highlightTenure(t); };
    })(tenure));
    rect.addEventListener('mouseleave', function () { clearTenureHighlight(); });

    bandsGroup.appendChild(rect);
    currentY -= bandHeight;
  });

  // ---- Legend ----
  var legendDiv = document.getElementById('house-legend');
  var html = '';
  sorted.forEach(function (tenure) {
    var count = tenureTotals[tenure];
    var pct = grandTotal > 0 ? ((count / grandTotal) * 100).toFixed(1) : '0.0';
    html += '<div class="house-legend-item" data-tenure="' + tenure + '">' +
      '<div class="house-legend-swatch" style="background:' + TENURE_COLORS[tenure] + '"></div>' +
      '<span class="house-legend-label">' + tenure + '</span>' +
      '<span class="house-legend-count">' + count.toLocaleString() + '</span>' +
      '<span class="house-legend-pct">' + pct + '%</span>' +
      '</div>';
  });

  html += '<div class="house-legend-item house-legend-total">' +
    '<div class="house-legend-swatch" style="background:transparent"></div>' +
    '<span class="house-legend-label" style="font-weight:700;color:#2c3e50">Total</span>' +
    '<span class="house-legend-count" style="font-weight:700">' + grandTotal.toLocaleString() + '</span>' +
    '<span class="house-legend-pct" style="font-weight:700">100%</span>' +
    '</div>';

  legendDiv.innerHTML = html;
}

function highlightTenure(tenure) {
  document.querySelectorAll('#house-bands rect').forEach(function (r) {
    r.classList.toggle('dimmed', r.getAttribute('data-tenure') !== tenure);
  });
  document.querySelectorAll('.house-legend-item[data-tenure]').forEach(function (item) {
    item.classList.toggle('highlight', item.getAttribute('data-tenure') === tenure);
  });
}

function clearTenureHighlight() {
  document.querySelectorAll('#house-bands rect').forEach(function (r) {
    r.classList.remove('dimmed');
  });
  document.querySelectorAll('.house-legend-item').forEach(function (item) {
    item.classList.remove('highlight');
  });
}
