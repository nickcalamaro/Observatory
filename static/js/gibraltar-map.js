// Initialize the map centered on Gibraltar
const map = L.map('map').setView([36.14, -5.35], 13);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

// Store enumeration locations data
let enumerationLocations = {};
let districtsData = {};
let geoJsonData = null;
let districtGeoJsonData = null;
let currentView = 'enumeration'; // 'enumeration' or 'district'
let geojsonLayer = null;

// Load enumeration locations
fetch('/Observatory/data/enumeration_locations.json')
  .then(response => response.json())
  .then(data => {
    enumerationLocations = data;
  })
  .catch(error => {
    console.error('Error loading enumeration locations:', error);
  });

// Load districts data
fetch('/Observatory/data/districts.json')
  .then(response => response.json())
  .then(data => {
    districtsData = data;
  })
  .catch(error => {
    console.error('Error loading districts:', error);
  });

// Color scale for population density
function getColor(density) {
  return density > 50000 ? '#800026' :
         density > 30000 ? '#BD0026' :
         density > 20000 ? '#E31A1C' :
         density > 10000 ? '#FC4E2A' :
         density > 5000  ? '#FD8D3C' :
         density > 2000  ? '#FEB24C' :
         density > 1000  ? '#FED976' :
                           '#FFEDA0';
}

// Style function for each feature
function style(feature) {
  // In district view, use solid boundaries between districts only
  // In enumeration view, show all EA boundaries
  const isDistrictView = currentView === 'district';
  
  return {
    fillColor: getColor(feature.properties.density_2022),
    weight: isDistrictView ? 3 : 2,
    opacity: 1,
    color: isDistrictView ? '#333' : 'white',
    dashArray: isDistrictView ? '' : '3',
    fillOpacity: 0.7
  };
}

// Highlight feature on hover
function highlightFeature(e) {
  const layer = e.target;
  
  layer.setStyle({
    weight: 5,
    color: '#666',
    dashArray: '',
    fillOpacity: 0.9
  });
  
  layer.bringToFront();
}

// Reset highlight
function resetHighlight(e) {
  geojsonLayer.resetStyle(e.target);
}

// Zoom to feature on click
function zoomToFeature(e) {
  map.fitBounds(e.target.getBounds());
}

// Create popup content
function createPopupContent(properties) {
  const popChange2001_2022 = properties.population_2001 && properties.population_2022 
    ? ((properties.population_2022 - properties.population_2001) / properties.population_2001 * 100).toFixed(1)
    : 'N/A';
  
  const popChange2012_2022 = properties.population_2012 && properties.population_2022 
    ? ((properties.population_2022 - properties.population_2012) / properties.population_2012 * 100).toFixed(1)
    : 'N/A';
  
  let html = `
    <div class="popup-title">${properties.name}</div>
    <div class="popup-section">`;
  
  // If this is a district, show the enumeration areas it contains
  if (properties.enumeration_areas) {
    html += `
      <div class="popup-row">
        <span class="popup-label">Enumeration Areas:</span>
        <span class="popup-value">${properties.enumeration_areas.join(', ')}</span>
      </div>`;
  }
  
  html += `
      <div class="popup-row">
        <span class="popup-label">Population 2022:</span>
        <span class="popup-value">${properties.population_2022?.toLocaleString() || 'N/A'}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Population 2012:</span>
        <span class="popup-value">${properties.population_2012?.toLocaleString() || 'N/A'}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Population 2001:</span>
        <span class="popup-value">${properties.population_2001?.toLocaleString() || 'N/A'}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Change (2012-2022):</span>
        <span class="popup-value" style="color: ${popChange2012_2022 >= 0 ? '#27ae60' : '#c0392b'}">${popChange2012_2022}%</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Change (2001-2022):</span>
        <span class="popup-value" style="color: ${popChange2001_2022 >= 0 ? '#27ae60' : '#c0392b'}">${popChange2001_2022}%</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Area:</span>
        <span class="popup-value">${properties.area_km2?.toFixed(2) || 'N/A'} km²</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Density:</span>
        <span class="popup-value">${properties.density_2022?.toLocaleString() || 'N/A'} /km²</span>
      </div>
    </div>
  `;
  
  // Get location description if available (only for enumeration areas)
  if (!properties.enumeration_areas) {
    const locationInfo = enumerationLocations[properties.name];
    const locationDescription = locationInfo ? locationInfo.description : null;
    
    // Add locations if available
    if (locationDescription) {
      // Remove all parenthetical content for cleaner display
      const cleanedDescription = locationDescription
        .replace(/\([^)]*\)/g, '')
        .replace(/\s+,/g, ',')
        .replace(/,\s+/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();
      
      html += `
      <div class="popup-section locations-section">
        <div class="popup-label" style="margin-bottom: 4px;">Locations:</div>
        <div class="location-text">${cleanedDescription}</div>
      </div>
      `;
    }
  }
  
  return html;
}

// Attach events to each feature
function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: zoomToFeature
  });
  
  // Bind popup with district information
  layer.bindPopup(createPopupContent(feature.properties));
}

// Load GeoJSON data
// The file is served from the static/data folder
fetch('/Observatory/data/gibraltar.geojson')
  .then(response => response.json())
  .then(data => {
    // Transform coordinates from EPSG:3857 to EPSG:4326 (lat/lng)
    // Leaflet expects [lat, lng] format
    const transformedData = {
      ...data,
      features: data.features.map(feature => {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map(polygon => 
              polygon.map(ring => 
                ring.map(coord => {
                  // Convert from Web Mercator (EPSG:3857) to WGS84 (EPSG:4326)
                  const lng = (coord[0] / 20037508.34) * 180;
                  const lat = (Math.atan(Math.exp((coord[1] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
                  return [lng, lat];
                })
              )
            )
          }
        };
      })
    };
    
    // Store the data
    geoJsonData = transformedData;
    
    // Display initial view
    updateMapDisplay();
    
    // Populate table
    populateTable();
  })
  .catch(error => {
    console.error('Error loading GeoJSON:', error);
    document.getElementById('map').innerHTML = '<div class="loading">Error loading map data. Please check that gibraltar.geojson is available.</div>';
  });

// Add legend
const legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'legend');
  const grades = [0, 1000, 2000, 5000, 10000, 20000, 30000, 50000];
  const labels = ['<strong>Population Density<br>(people/km²)</strong>'];
  
  for (let i = 0; i < grades.length; i++) {
    labels.push(
      '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
      grades[i].toLocaleString() + (grades[i + 1] ? '&ndash;' + grades[i + 1].toLocaleString() : '+')
    );
  }
  
  div.innerHTML = labels.join('<br>');
  return div;
};


// Parse location description to separate main locations from parenthetical content
function parseLocations(description) {
  const parts = [];
  let current = '';
  let inParens = false;
  let parenContent = '';
  
  for (let i = 0; i < description.length; i++) {
    const char = description[i];
    
    if (char === '(') {
      inParens = true;
      parenContent = '';
    } else if (char === ')') {
      inParens = false;
      // Add the accumulated text before parentheses with tooltip
      if (current.trim()) {
        parts.push({ text: current.trim(), tooltip: parenContent.trim() });
        current = '';
      }
    } else if (char === ',' && !inParens) {
      if (current.trim()) {
        parts.push({ text: current.trim(), tooltip: null });
        current = '';
      }
    } else {
      if (inParens) {
        parenContent += char;
      } else {
        current += char;
      }
    }
  }
  
  // Add any remaining text
  if (current.trim()) {
    parts.push({ text: current.trim().replace(/\.$/, ''), tooltip: null });
  }
  
  return parts;
}

// Populate the enumeration areas table
function populateTable() {
  if (currentView === 'enumeration') {
    populateEnumerationTable();
  } else {
    populateDistrictTable();
  }
}

// Create district GeoJSON by merging enumeration areas
function createDistrictGeoJSON() {
  if (!geoJsonData || !districtsData) return null;
  
  const districtFeatures = [];
  
  Object.keys(districtsData).forEach(districtId => {
    const district = districtsData[districtId];
    
    // Find all EA features for this district
    const eaFeatures = district.enumeration_areas.map(eaNum => {
      return geoJsonData.features.find(f => f.properties.name === `EA ${eaNum}`);
    }).filter(f => f); // Remove any undefined
    
    if (eaFeatures.length === 0) return;
    
    // Aggregate statistics
    let totalPop2001 = 0;
    let totalPop2012 = 0;
    let totalPop2022 = 0;
    let totalArea = 0;
    
    eaFeatures.forEach(feature => {
      totalPop2001 += feature.properties.population_2001 || 0;
      totalPop2012 += feature.properties.population_2012 || 0;
      totalPop2022 += feature.properties.population_2022 || 0;
      totalArea += feature.properties.area_km2 || 0;
    });
    
    const density = totalArea ? (totalPop2022 / totalArea) : 0;
    
    // Union all EA polygons using Turf.js
    let mergedGeometry = null;
    
    console.log('Merging', eaFeatures.length, 'features for', district.name);
    
    try {
      // Start with the first feature
      if (eaFeatures.length > 0) {
        mergedGeometry = eaFeatures[0];
        console.log('Starting with EA', eaFeatures[0].properties.name);
        
        // Union each subsequent feature
        for (let i = 1; i < eaFeatures.length; i++) {
          console.log('Unioning with EA', eaFeatures[i].properties.name);
          const nextFeature = eaFeatures[i];
          mergedGeometry = turf.union(mergedGeometry, nextFeature);
        }
        console.log('Final merged geometry type:', mergedGeometry.geometry.type);
      }
    } catch (e) {
      console.error('Failed to union geometries for', district.name, ':', e);
      // Fallback: create a MultiPolygon from all features
      const allCoordinates = [];
      eaFeatures.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          allCoordinates.push(feature.geometry.coordinates);
        } else if (feature.geometry.type === 'MultiPolygon') {
          allCoordinates.push(...feature.geometry.coordinates);
        }
      });
      mergedGeometry = {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: allCoordinates
        },
        properties: {}
      };
    }
    
    if (mergedGeometry) {
      districtFeatures.push({
        type: 'Feature',
        properties: {
          name: district.name,
          districtId: districtId,
          enumeration_areas: district.enumeration_areas,
          population_2001: totalPop2001,
          population_2012: totalPop2012,
          population_2022: totalPop2022,
          area_km2: totalArea,
          density_2022: density
        },
        geometry: mergedGeometry.geometry
      });
    }
  });
  
  return {
    type: 'FeatureCollection',
    features: districtFeatures
  };
}

// Update map display based on current view
function updateMapDisplay() {
  console.log('updateMapDisplay called, currentView:', currentView);
  
  // Remove existing layer if it exists
  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }
  
  let dataToDisplay;
  
  if (currentView === 'enumeration') {
    dataToDisplay = geoJsonData;
  } else {
    // Create district GeoJSON on the fly
    dataToDisplay = createDistrictGeoJSON();
  }
  
  if (!dataToDisplay) {
    console.error('No data to display');
    return;
  }
  
  console.log('Displaying', dataToDisplay.features.length, 'features');
  
  // Add new layer
  geojsonLayer = L.geoJSON(dataToDisplay, {
    style: style,
    onEachFeature: onEachFeature
  }).addTo(map);
  
  // Fit map to show all features
  map.fitBounds(geojsonLayer.getBounds());
}

// Show modal with EA details
function showModal(eaName) {
  const feature = geoJsonData.features.find(f => f.properties.name === eaName);
  if (!feature) return;
  
  const modal = document.getElementById('ea-modal');
  const modalBody = document.getElementById('modal-body');
  
  // Reuse the createPopupContent function
  modalBody.innerHTML = createPopupContent(feature.properties);
  modal.style.display = 'block';
}

// Close modal
const modal = document.getElementById('ea-modal');
const closeBtn = document.getElementsByClassName('close')[0];

closeBtn.onclick = function() {
  modal.style.display = 'none';
}

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = 'none';
  }
}

// Switch between enumeration and district view
function switchView(view) {
  console.log('switchView called with:', view);
  currentView = view;
  
  // Update button states on page
  const pageEnumBtn = document.getElementById('btn-enumeration');
  const pageDistBtn = document.getElementById('btn-district');
  if (pageEnumBtn && pageDistBtn) {
    pageEnumBtn.classList.toggle('active', view === 'enumeration');
    pageDistBtn.classList.toggle('active', view === 'district');
  }
  
  // Update button states on map control
  const mapEnumBtn = document.getElementById('leaflet-btn-enumeration');
  const mapDistBtn = document.getElementById('leaflet-btn-district');
  if (mapEnumBtn && mapDistBtn) {
    if (view === 'enumeration') {
      mapEnumBtn.style.background = '#3498db';
      mapEnumBtn.style.color = 'white';
      mapEnumBtn.style.borderColor = '#3498db';
      mapDistBtn.style.background = 'white';
      mapDistBtn.style.color = '#333';
      mapDistBtn.style.borderColor = '#ddd';
    } else {
      mapDistBtn.style.background = '#3498db';
      mapDistBtn.style.color = 'white';
      mapDistBtn.style.borderColor = '#3498db';
      mapEnumBtn.style.background = 'white';
      mapEnumBtn.style.color = '#333';
      mapEnumBtn.style.borderColor = '#ddd';
    }
  }
  
  // Update map display
  updateMapDisplay();
  
  // Update table
  if (view === 'enumeration') {
    populateEnumerationTable();
  } else {
    populateDistrictTable();
  }
}

// Populate enumeration areas table
function populateEnumerationTable() {
  console.log('populateEnumerationTable called');
  
  // Check if we're still in enumeration view
  if (currentView !== 'enumeration') {
    console.log('Not in enumeration view, skipping');
    return;
  }
  
  const tableBody = document.getElementById('ea-table-body');
  const tableTitle = document.getElementById('table-title');
  const headerArea = document.getElementById('table-header-area');
  
  console.log('Table elements:', { tableBody, tableTitle, headerArea });
  
  tableTitle.textContent = 'Enumeration Areas';
  headerArea.textContent = 'Area';
  
  if (!geoJsonData || Object.keys(enumerationLocations).length === 0) {
    console.log('Data not ready, retrying...');
    setTimeout(populateEnumerationTable, 100);
    return;
  }
  
  console.log('Populating enumeration table with', geoJsonData.features.length, 'features');
  
  tableBody.innerHTML = '';
  
  // Get all EA numbers and sort them
  const eaNumbers = geoJsonData.features
    .map(f => parseInt(f.properties.name.replace('EA ', '')))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  
  eaNumbers.forEach(num => {
    const eaName = `EA ${num}`;
    const locationInfo = enumerationLocations[eaName];
    
    if (!locationInfo) return;
    
    const row = document.createElement('tr');
    
    // EA Name cell (clickable)
    const nameCell = document.createElement('td');
    const nameLink = document.createElement('a');
    nameLink.className = 'ea-name';
    nameLink.href = '#';
    nameLink.textContent = eaName;
    nameLink.onclick = (e) => {
      e.preventDefault();
      showModal(eaName);
    };
    nameCell.appendChild(nameLink);
    
    // Locations cell with tooltips
    const locCell = document.createElement('td');
    const locations = parseLocations(locationInfo.description);
    
    locations.forEach((loc, idx) => {
      if (loc.tooltip) {
        const span = document.createElement('span');
        span.className = 'location-item';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'location-tooltip';
        textSpan.textContent = loc.text;
        
        const tooltipSpan = document.createElement('span');
        tooltipSpan.className = 'tooltip-text';
        tooltipSpan.textContent = loc.tooltip;
        
        span.appendChild(textSpan);
        span.appendChild(tooltipSpan);
        locCell.appendChild(span);
      } else {
        locCell.appendChild(document.createTextNode(loc.text));
      }
      
      if (idx < locations.length - 1) {
        locCell.appendChild(document.createTextNode(', '));
      }
    });
    
    row.appendChild(nameCell);
    row.appendChild(locCell);
    tableBody.appendChild(row);
  });
}

// Populate districts table
function populateDistrictTable() {
  console.log('populateDistrictTable called');
  
  // Check if we're still in district view
  if (currentView !== 'district') {
    console.log('Not in district view, skipping');
    return;
  }
  
  const tableBody = document.getElementById('ea-table-body');
  const tableTitle = document.getElementById('table-title');
  const headerArea = document.getElementById('table-header-area');
  
  console.log('Table elements:', { tableBody, tableTitle, headerArea });
  
  console.log('Setting title to Districts');
  tableTitle.textContent = 'Districts';
  headerArea.textContent = 'District';
  console.log('Title after setting:', tableTitle.textContent, 'Header:', headerArea.textContent);
  
  if (!geoJsonData || Object.keys(districtsData).length === 0) {
    console.log('Data not ready, retrying...');
    setTimeout(populateDistrictTable, 100);
    return;
  }
  
  console.log('Populating district table with', Object.keys(districtsData).length, 'districts');
  
  console.log('Clearing table body');
  tableBody.innerHTML = '';
  console.log('Table body cleared, children count:', tableBody.children.length);
  
  // Sort districts by name
  const districtKeys = Object.keys(districtsData).sort((a, b) => 
    districtsData[a].name.localeCompare(districtsData[b].name)
  );
  
  districtKeys.forEach(districtId => {
    const district = districtsData[districtId];
    const row = document.createElement('tr');
    
    // District Name cell (clickable)
    const nameCell = document.createElement('td');
    const nameLink = document.createElement('a');
    nameLink.className = 'ea-name';
    nameLink.href = '#';
    nameLink.textContent = district.name;
    nameLink.onclick = (e) => {
      e.preventDefault();
      showDistrictModal(districtId);
    };
    nameCell.appendChild(nameLink);
    
    // EA list cell
    const eaCell = document.createElement('td');
    eaCell.textContent = `Enumeration Areas: ${district.enumeration_areas.join(', ')}`;
    
    row.appendChild(nameCell);
    row.appendChild(eaCell);
    tableBody.appendChild(row);
    console.log('Added district row:', district.name);
  });
  
  console.log('District table population complete. Total rows:', tableBody.children.length);
}
// Show modal with district aggregate data
function showDistrictModal(districtId) {
  const district = districtsData[districtId];
  if (!district) return;
  
  const modal = document.getElementById('ea-modal');
  const modalBody = document.getElementById('modal-body');
  const modalTitle = document.getElementById('modal-title');
  
  modalTitle.textContent = district.name;
  
  // Aggregate population data for all EAs in this district
  let totalPop2001 = 0;
  let totalPop2012 = 0;
  let totalPop2022 = 0;
  let totalArea = 0;
  const eaList = [];
  
  district.enumeration_areas.forEach(eaNum => {
    const feature = geoJsonData.features.find(f => f.properties.name === `EA ${eaNum}`);
    if (feature) {
      totalPop2001 += feature.properties.population_2001 || 0;
      totalPop2012 += feature.properties.population_2012 || 0;
      totalPop2022 += feature.properties.population_2022 || 0;
      totalArea += feature.properties.area_km2 || 0;
      eaList.push(`EA ${eaNum}`);
    }
  });
  
  const popChange2001_2022 = totalPop2001 ? ((totalPop2022 - totalPop2001) / totalPop2001 * 100).toFixed(1) : 'N/A';
  const popChange2012_2022 = totalPop2012 ? ((totalPop2022 - totalPop2012) / totalPop2012 * 100).toFixed(1) : 'N/A';
  const density = totalArea ? (totalPop2022 / totalArea).toFixed(2) : 'N/A';
  
  modalBody.innerHTML = `
    <div class="popup-section">
      <div class="popup-row">
        <span class="popup-label">Enumeration Areas:</span>
        <span class="popup-value">${eaList.join(', ')}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Total Population 2022:</span>
        <span class="popup-value">${totalPop2022.toLocaleString()}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Total Population 2012:</span>
        <span class="popup-value">${totalPop2012.toLocaleString()}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Total Population 2001:</span>
        <span class="popup-value">${totalPop2001.toLocaleString()}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Change (2012-2022):</span>
        <span class="popup-value" style="color: ${popChange2012_2022 >= 0 ? '#27ae60' : '#c0392b'}">${popChange2012_2022}%</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Change (2001-2022):</span>
        <span class="popup-value" style="color: ${popChange2001_2022 >= 0 ? '#27ae60' : '#c0392b'}">${popChange2001_2022}%</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Total Area:</span>
        <span class="popup-value">${totalArea.toFixed(3)} km²</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Average Density:</span>
        <span class="popup-value">${typeof density === 'number' ? density.toLocaleString() : density} /km²</span>
      </div>
    </div>
  `;
  
  modal.style.display = 'block';
}
legend.addTo(map);

// Add view toggle control to map
L.Control.ViewToggle = L.Control.extend({
  onAdd: function(map) {
    const div = L.DomUtil.create('div', 'leaflet-control-view-toggle');
    div.style.background = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '4px';
    div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    
    div.innerHTML = `
      <div style="text-align: center;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #555; font-size: 12px;">View by:</div>
        <button id="leaflet-btn-enumeration" style="padding: 6px 12px; margin: 2px; border: 2px solid #3498db; background: #3498db; color: white; cursor: pointer; border-radius: 4px; font-weight: 500; font-size: 11px;">Enumeration Area</button>
        <button id="leaflet-btn-district" style="padding: 6px 12px; margin: 2px; border: 2px solid #ddd; background: white; color: #333; cursor: pointer; border-radius: 4px; font-weight: 500; font-size: 11px;">District</button>
      </div>
    `;
    
    // Prevent map interactions when clicking the control
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    
    return div;
  },
  
  onRemove: function(map) {
    // Nothing to do here
  }
});

L.control.viewToggle = function(opts) {
  return new L.Control.ViewToggle(opts);
}

L.control.viewToggle({ position: 'topright' }).addTo(map);

// Add click handlers after control is added
setTimeout(() => {
  const enumBtn = document.getElementById('leaflet-btn-enumeration');
  const distBtn = document.getElementById('leaflet-btn-district');
  
  if (enumBtn && distBtn) {
    enumBtn.addEventListener('click', function() {
      console.log('Enumeration button clicked');
      switchView('enumeration');
    });
    
    distBtn.addEventListener('click', function() {
      console.log('District button clicked');
      switchView('district');
    });
  }
}, 100);
