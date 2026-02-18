# Population Data Extraction

This directory contains tools to extract geographic and population data from citypopulation.de.

## citypopulation.py

A Python script that extracts district boundaries and population data from citypopulation.de and generates GeoJSON files.

### Features

- Extracts geographic boundaries for enumeration areas
- Includes population data for multiple census years (2001, 2012, 2022)
- Calculates population density
- Outputs both `.js` and `.geojson` formats

### Usage

```bash
python citypopulation.py
```

### Configuration

Change the `country` variable at the top of the script to extract data for different regions:

```python
country = "gibraltar"  # Change this to extract different regions
```

### Output Files

- **output.js** - GeoJSON format for web use
- **gibraltar.geojson** - Standard GeoJSON file that can be edited in GIS tools

### GeoJSON Properties

Each feature includes:
- `id` - Enumeration Area ID
- `name` - District name (e.g., "EA 1", "EA 2")
- `status` - Area classification (e.g., "Enumeration Area")
- `area_km2` - Area in square kilometers
- `population_2001` - Population from 2001 census
- `population_2012` - Population from 2012 census
- `population_2022` - Population from 2022 census
- `density_2022` - Population density per km² (calculated)
- `longitude` - Center longitude coordinate
- `latitude` - Center latitude coordinate

### Dependencies

```bash
pip install requests shapely pyproj
```

### Example Feature

```json
{
  "type": "Feature",
  "properties": {
    "id": "065",
    "name": "EA 65",
    "status": "Enumeration Area",
    "area_km2": 0.032,
    "population_2001": 2434,
    "population_2012": 2383,
    "population_2022": 2226,
    "density_2022": 69562.5,
    "longitude": -5.355991,
    "latitude": 36.145306
  },
  "geometry": { ... }
}
```

## Viewing the GeoJSON

You can view and edit the generated GeoJSON files using:
- [geojson.io](https://geojson.io) - Web-based viewer/editor
- QGIS - Desktop GIS application
- Any text editor to manually edit properties
- Web mapping libraries like Leaflet or Mapbox

## Notes

- Coordinates are in EPSG:3857 (Web Mercator) projection
- The script automatically converts coordinates from the citypopulation.de format
- Population data corresponds to census years available on the source website
