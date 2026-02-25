/**
 * Housing Stats Map – Interactive choropleth for Gibraltar housing data
 * Shows district-level statistics with dynamic filtering by attribute and tenure
 */

// ============================================================
// Configuration
// ============================================================
const COLORS = ['#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#E31A1C', '#BD0026', '#800026'];
const ZERO_COLOR = '#f0f0f0';

const DISTRICT_NAMES = [
  'East Side', 'North District', 'Reclamation Areas',
  'Town Area', 'Upper Town', 'Sandpits Area', 'South District'
];

const RENT_TENURES = ['Government rented', 'Private rented', 'Employer rented'];
const OWN_TENURES  = ['Owns outright', 'Owns with a mortgage', 'Co-ownership'];

// All standard tenures (present in every district)
const STANDARD_TENURES = [
  ...RENT_TENURES, ...OWN_TENURES, 'Rent free', 'Other'
];

// ============================================================
// State
// ============================================================
let housingData     = null;   // housing-stats.json
let districtsConfig = null;   // districts.json
let geoJsonRaw      = null;   // gibraltar.geojson (transformed)
let districtGeoJson = null;   // merged district FeatureCollection

let map          = null;
let geojsonLayer = null;
let legendControl = null;
let infoControl  = null;

let currentAttribute = 'Number of Persons';
let currentTenure    = 'All';
let colorBreaks      = [];

// ============================================================
// Initialisation
// ============================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  initMap();
  await loadAllData();
  buildDistrictGeoJson();
  setupControls();
  updateDisplay();
}

// ============================================================
// Map setup
// ============================================================
function initMap() {
  map = L.map('housing-map', {
    center: [36.140, -5.353],
    zoom: 14,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  // Info control (top-right) – hover display
  infoControl = L.control({ position: 'topright' });
  infoControl.onAdd = function () {
    this._div = L.DomUtil.create('div', 'housing-info');
    this.update();
    return this._div;
  };
  infoControl.update = function (districtName) {
    if (!districtName) {
      this._div.innerHTML = '<h4>Housing Stats</h4><span style="color:#999">Hover over a district</span>';
      return;
    }
    const value = getValue(districtName, currentAttribute, currentTenure);
    const total = getGibraltarTotal(currentAttribute, currentTenure);
    const pct   = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';

    this._div.innerHTML =
      '<h4>Housing Stats</h4>' +
      '<div class="district-name">' + districtName + '</div>' +
      '<div class="district-value">' + value.toLocaleString() + '</div>' +
      '<div class="district-share">' + pct + '% of Gibraltar</div>';
  };
  infoControl.addTo(map);

  // Legend control (bottom-right)
  legendControl = L.control({ position: 'bottomright' });
  legendControl.onAdd = function () {
    this._div = L.DomUtil.create('div', 'housing-legend');
    return this._div;
  };
  legendControl.addTo(map);
}

// ============================================================
// Data loading
// ============================================================
async function loadAllData() {
  const base = typeof SITE_BASE_URL !== 'undefined' ? SITE_BASE_URL : '/Observatory/';

  const [districts, geojson, housing] = await Promise.all([
    fetch(base + 'data/districts.json').then(r => r.json()),
    fetch(base + 'data/gibraltar.geojson').then(r => r.json()),
    fetch(base + 'data/housing-stats.json').then(r => r.json())
  ]);

  districtsConfig = districts;
  housingData     = housing;

  // Transform coordinates from EPSG:3857 → EPSG:4326
  geoJsonRaw = {
    ...geojson,
    features: geojson.features.map(feature => ({
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.coordinates.map(polygon =>
          polygon.map(ring =>
            ring.map(coord => {
              const lng = (coord[0] / 20037508.34) * 180;
              const lat = (Math.atan(Math.exp((coord[1] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
              return [lng, lat];
            })
          )
        )
      }
    }))
  };
}

// ============================================================
// Build merged district GeoJSON
// ============================================================
function buildDistrictGeoJson() {
  const features = [];

  Object.keys(districtsConfig).forEach(districtId => {
    const district = districtsConfig[districtId];

    // Collect EA features for this district
    const eaFeatures = district.enumeration_areas
      .map(eaNum => geoJsonRaw.features.find(f => f.properties.name === 'EA ' + eaNum))
      .filter(Boolean);

    if (eaFeatures.length === 0) return;

    // Union geometries using Turf.js
    let merged = null;
    try {
      merged = eaFeatures[0];
      for (let i = 1; i < eaFeatures.length; i++) {
        merged = turf.union(merged, eaFeatures[i]);
      }
    } catch (e) {
      // Fallback: MultiPolygon from all features
      const allCoords = [];
      eaFeatures.forEach(f => {
        if (f.geometry.type === 'Polygon') allCoords.push(f.geometry.coordinates);
        else if (f.geometry.type === 'MultiPolygon') allCoords.push(...f.geometry.coordinates);
      });
      merged = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: allCoords }, properties: {} };
    }

    if (merged) {
      features.push({
        type: 'Feature',
        properties: { name: district.name },
        geometry: merged.geometry
      });
    }
  });

  districtGeoJson = { type: 'FeatureCollection', features: features };
}

// ============================================================
// Data access helpers
// ============================================================
function getValue(districtName, attribute, tenure) {
  const d = housingData?.districts?.[districtName];
  if (!d) return 0;

  if (tenure === 'All') {
    return Object.keys(d).reduce((sum, t) => sum + (d[t]?.[attribute] || 0), 0);
  }
  if (tenure === 'All rented') {
    return RENT_TENURES.reduce((sum, t) => sum + (d[t]?.[attribute] || 0), 0);
  }
  if (tenure === 'All owned') {
    return OWN_TENURES.reduce((sum, t) => sum + (d[t]?.[attribute] || 0), 0);
  }
  return d[tenure]?.[attribute] || 0;
}

function getGibraltarTotal(attribute, tenure) {
  return DISTRICT_NAMES.reduce((sum, name) => sum + getValue(name, attribute, tenure), 0);
}

function getAllTenuresForDistrict(districtName) {
  const d = housingData?.districts?.[districtName];
  return d ? Object.keys(d) : [];
}

// ============================================================
// Color scale (dynamic equal-interval)
// ============================================================
function computeBreaks(values) {
  const nonZero = values.filter(v => v > 0);
  if (nonZero.length === 0) return [0];

  const max = Math.max(...nonZero);
  const steps = COLORS.length;
  const interval = max / steps;

  const breaks = [];
  for (let i = 0; i < steps; i++) {
    breaks.push(Math.round(interval * i));
  }
  return breaks;
}

function getColor(value) {
  if (value === 0) return ZERO_COLOR;
  for (let i = colorBreaks.length - 1; i >= 0; i--) {
    if (value >= colorBreaks[i]) return COLORS[i];
  }
  return COLORS[0];
}

// ============================================================
// Map rendering
// ============================================================
function styleFeature(feature) {
  const val = getValue(feature.properties.name, currentAttribute, currentTenure);
  return {
    fillColor: getColor(val),
    weight: 3,
    opacity: 1,
    color: '#444',
    fillOpacity: 0.75
  };
}

function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({ weight: 5, color: '#222', fillOpacity: 0.9 });
  layer.bringToFront();
  infoControl.update(layer.feature.properties.name);
}

function resetHighlight(e) {
  geojsonLayer.resetStyle(e.target);
  infoControl.update();
}

function zoomToFeature(e) {
  map.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: function (e) {
      zoomToFeature(e);
      layer.openPopup();
    }
  });
  layer.bindPopup(function () {
    return createPopupContent(feature.properties.name);
  }, { maxWidth: 320 });
}

function renderLayer() {
  // Compute color breaks from current data
  const values = DISTRICT_NAMES.map(name => getValue(name, currentAttribute, currentTenure));
  colorBreaks = computeBreaks(values);

  // Remove old layer
  if (geojsonLayer) map.removeLayer(geojsonLayer);

  // Add new layer
  geojsonLayer = L.geoJSON(districtGeoJson, {
    style: styleFeature,
    onEachFeature: onEachFeature
  }).addTo(map);

  map.fitBounds(geojsonLayer.getBounds());
}

// ============================================================
// Legend
// ============================================================
function updateLegend() {
  const div = legendControl._div;
  const values = DISTRICT_NAMES.map(name => getValue(name, currentAttribute, currentTenure));
  const max = Math.max(...values);

  if (max === 0) {
    div.innerHTML = '<strong>No data</strong><br><span style="color:#999">All values are 0 for this selection</span>';
    return;
  }

  let html = '<strong>' + currentAttribute + '</strong>';

  // Zero swatch
  html += '<div><i style="background:' + ZERO_COLOR + '"></i> 0</div>';

  for (let i = 0; i < colorBreaks.length; i++) {
    const from = colorBreaks[i];
    const to = colorBreaks[i + 1];
    if (from === 0 && i === 0) {
      // Skip duplicate zero, show ">0" instead
      html += '<div><i style="background:' + COLORS[i] + '"></i> 1' +
        (to !== undefined ? '&ndash;' + to.toLocaleString() : '+') + '</div>';
    } else {
      html += '<div><i style="background:' + COLORS[i] + '"></i> ' +
        from.toLocaleString() +
        (to !== undefined ? '&ndash;' + to.toLocaleString() : '+') + '</div>';
    }
  }

  div.innerHTML = html;
}

// ============================================================
// Summary bar
// ============================================================
function updateSummary() {
  const total = getGibraltarTotal(currentAttribute, currentTenure);
  document.getElementById('summary-value').textContent = total.toLocaleString();

  const tenureLabel = currentTenure === 'All' ? 'all property types' : currentTenure.toLowerCase();
  document.getElementById('summary-label').textContent = currentAttribute.toLowerCase() + ' (' + tenureLabel + ')';
}

// ============================================================
// Data table
// ============================================================
function updateTable() {
  const tbody = document.getElementById('housing-table-body');
  const total = getGibraltarTotal(currentAttribute, currentTenure);

  // Header label
  document.getElementById('th-value').textContent = currentAttribute;

  // Build rows sorted by value descending
  const rows = DISTRICT_NAMES.map(name => ({
    name: name,
    value: getValue(name, currentAttribute, currentTenure)
  })).sort((a, b) => b.value - a.value);

  const maxVal = rows.length > 0 ? rows[0].value : 1;

  tbody.innerHTML = '';

  rows.forEach((row, idx) => {
    const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : '0.0';
    const barWidth = maxVal > 0 ? ((row.value / maxVal) * 100).toFixed(1) : 0;
    const color = getColor(row.value);

    const tr = document.createElement('tr');
    tr.onclick = function () { flyToDistrict(row.name); };
    tr.innerHTML =
      '<td class="rank-cell">' + (idx + 1) + '</td>' +
      '<td><span class="color-swatch" style="background:' + color + '"></span>' + row.name + '</td>' +
      '<td class="numeric">' + row.value.toLocaleString() + '</td>' +
      '<td class="bar-cell"><div class="bar-wrapper"><div class="bar-fill" style="width:' + barWidth + '%; background:' + color + '"></div></div></td>' +
      '<td class="numeric share-cell">' + pct + '%</td>';
    tbody.appendChild(tr);
  });

  document.getElementById('table-total').textContent = total.toLocaleString();
}

function flyToDistrict(name) {
  if (!geojsonLayer) return;
  geojsonLayer.eachLayer(function (layer) {
    if (layer.feature.properties.name === name) {
      map.fitBounds(layer.getBounds());
      layer.openPopup();
    }
  });
}

// ============================================================
// Popup
// ============================================================
function createPopupContent(districtName) {
  const total = getValue(districtName, currentAttribute, 'All');
  const selectedValue = getValue(districtName, currentAttribute, currentTenure);
  const gibTotal = getGibraltarTotal(currentAttribute, currentTenure);
  const gibPct = gibTotal > 0 ? ((selectedValue / gibTotal) * 100).toFixed(1) : '0.0';

  let html = '<div class="popup-title">' + districtName + '</div>';
  html += '<div class="popup-main-value">' + selectedValue.toLocaleString() + '</div>';

  if (currentTenure === 'All') {
    html += '<div class="popup-main-label">' + currentAttribute + ' (all types)</div>';
  } else {
    html += '<div class="popup-main-label">' + currentAttribute + '<br>' + currentTenure + '</div>';
    if (total > 0) {
      const tenurePct = ((selectedValue / total) * 100).toFixed(1);
      html += '<div style="font-size:0.85em; color:#888; margin-bottom:8px">' +
        tenurePct + '% of district total (' + total.toLocaleString() + ')</div>';
    }
  }

  html += '<div style="font-size:0.85em; color:#888; margin-bottom:8px">' + gibPct + '% of Gibraltar total</div>';

  // Breakdown by tenure
  const tenures = getAllTenuresForDistrict(districtName);
  if (tenures.length > 0) {
    html += '<div class="popup-breakdown">';

    // Sort tenures by value descending
    const items = tenures.map(t => ({
      name: t,
      value: housingData.districts[districtName][t][currentAttribute] || 0
    })).sort((a, b) => b.value - a.value);

    items.forEach(item => {
      const isHighlighted = (currentTenure !== 'All' && currentTenure !== 'All rented' && currentTenure !== 'All owned' && item.name === currentTenure);
      const rowClass = isHighlighted ? 'popup-row highlighted' : 'popup-row';
      const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) + '%' : '—';
      html += '<div class="' + rowClass + '">' +
        '<span class="tenure-name">' + item.name + '</span>' +
        '<span class="tenure-value">' + item.value.toLocaleString() + ' <small style="color:#aaa">(' + pct + ')</small></span>' +
        '</div>';
    });

    html += '<div class="popup-total-row"><span>Total</span><span>' + total.toLocaleString() + '</span></div>';
    html += '</div>';
  }

  return html;
}

// ============================================================
// Controls
// ============================================================
function setupControls() {
  document.getElementById('attribute-select').addEventListener('change', function () {
    currentAttribute = this.value;
    updateDisplay();
  });

  document.getElementById('tenure-select').addEventListener('change', function () {
    currentTenure = this.value;
    updateDisplay();
  });
}

// ============================================================
// Master update
// ============================================================
function updateDisplay() {
  renderLayer();
  updateLegend();
  updateSummary();
  updateTable();
}
