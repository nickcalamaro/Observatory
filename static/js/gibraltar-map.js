// Initialize the map centered on Gibraltar
const map = L.map('map').setView([36.14, -5.35], 13);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

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
  return {
    fillColor: getColor(feature.properties.density_2022),
    weight: 2,
    opacity: 1,
    color: 'white',
    dashArray: '3',
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
  
  return `
    <div class="popup-title">${properties.name}</div>
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
      <span class="popup-value">${properties.area_km2} km²</span>
    </div>
    <div class="popup-row">
      <span class="popup-label">Density:</span>
      <span class="popup-value">${properties.density_2022?.toLocaleString() || 'N/A'} /km²</span>
    </div>
  `;
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

// Store geojson layer globally for reset functionality
let geojsonLayer;

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
    
    // Add GeoJSON layer to map
    geojsonLayer = L.geoJSON(transformedData, {
      style: style,
      onEachFeature: onEachFeature
    }).addTo(map);
    
    // Fit map to show all features
    map.fitBounds(geojsonLayer.getBounds());
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

legend.addTo(map);
