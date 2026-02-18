import json
from requests import Session
from pyproj import proj
from shapely.geometry import Polygon, MultiPolygon, mapping
from pyproj import Transformer
from pyproj.crs import CRS


country = "gibraltar"

s = Session()
req1 = s.get("https://www.citypopulation.de/en/{}/admin/".format(country))

# mode: ["adm1", "adm2"]
adm = s.get(
    "https://www.citypopulation.de/proc/retrieve_adminareas.php",
    params={
        "reqid": 1,
        "pageid": "{}-admin".format(country),
        "type": "adm1",
        "mode": "all",
        "objid": "",
        "cache": "",
    },
).json()


def decode_coordinates(geom_type, s, precision=None):
    def f(name, m, fn):
        def c(p, a, f, z):
            def g(z, d, t):
                c = 0
                for i in range(len(z)):
                    b = ord(z[i])
                    if b == 40:
                        b = 92
                    if b == 41:
                        b = 63
                    c = c * t + b - d
                return c

            k = None
            if "#" not in a:
                if "$" not in a:
                    if "%" not in a:
                        if "&" not in a:
                            return None
                        i = a.index("&")
                        k = [-1, -1]
                    else:
                        i = a.index("%")
                        k = [-1, 1]
                else:
                    i = a.index("$")
                    k = [1, -1]
            else:
                i = a.index("#")
                k = [1, 1]
            p.append(g(a[:i], f, z) * k[0])
            p.append(g(a[i + 1 :], f, z) * k[1])

        memo = []
        if not isinstance(m, list):
            e = m.split("!")
            m = []
            for i in range(len(e)):
                c(m, e[i], 47, 80)
        word = m[0]
        token = m[1]
        result = by_xy_res(word, token, name, fn)
        memo.append(result)
        for i in range(2, len(m), 2):
            word = word + m[i]
            token = token + m[i + 1]
            result = by_xy_res(word, token, name, fn)
            memo.append(result)
        return memo

    if precision is None:
        precision = 1e5
    coords = []
    geometry = None
    for index in range(len(s)):
        if "-" == s[index]:
            if geom_type == "poly":
                for part in coords:
                    part.append(part[0])
                polygon = Polygon([[p[0], p[1]] for poly in coords for p in poly])
                if geometry is None:
                    geometry = MultiPolygon([polygon])
                else:
                    geometry = MultiPolygon(
                        [geom for geom in geometry.geoms]
                        + [
                            polygon,
                        ]
                    )
                coords = []
        else:
            coords.append(f(precision, s[index], "EPSG:3857"))

    if geom_type == "poly":
        for part in coords:
            part.append(part[0])
        polygon = Polygon([[p[0], p[1]] for poly in coords for p in poly])
        if geometry is None:
            geometry = MultiPolygon([polygon])
        else:
            geometry = MultiPolygon(
                [geom for geom in geometry.geoms]
                + [
                    polygon,
                ]
            )
    return geometry


transformers = {
    "EPSG:3857": Transformer.from_crs(
        CRS.from_epsg(4326), CRS.from_epsg(3857), always_xy=True
    )
}


def by_xy_res(t, n, i, r):
    if i:
        t /= i
        n /= i
    return by_latlon(n, t, r)


def by_latlon(t, n, i):
    transformer = transformers[i]
    if i and i != "EPSG:4326":
        return transformer.transform(n, t)
    else:
        return [n, t]


features = []
for feature in adm["objs"]:
    print(feature["id"])
    geometry = decode_coordinates("poly", feature["c"])
    
    # Extract population data (typically 3 census years)
    pop_data = feature.get("pop", [None, None, None])
    
    # Create a proper GeoJSON feature with properties
    geojson_feature = {
        "type": "Feature",
        "properties": {
            "id": feature.get("id", ""),
            "name": feature.get("name", ""),
            "status": feature.get("status", ""),
            "area_km2": feature.get("area", None),
            "population_2001": pop_data[0] if len(pop_data) > 0 else None,
            "population_2012": pop_data[1] if len(pop_data) > 1 else None,
            "population_2022": pop_data[2] if len(pop_data) > 2 else None,
            "density_2022": None,  # Will calculate if area is available
            "longitude": feature.get("lng", None),
            "latitude": feature.get("lat", None),
        },
        "geometry": mapping(geometry)
    }
    
    # Calculate density if we have both population and area
    if geojson_feature["properties"]["population_2022"] and geojson_feature["properties"]["area_km2"]:
        geojson_feature["properties"]["density_2022"] = round(
            geojson_feature["properties"]["population_2022"] / geojson_feature["properties"]["area_km2"], 
            2
        )
    
    features.append(geojson_feature)


geojson = {
    "type": "FeatureCollection",
    "features": features
}

# Save as both .js and .geojson for different uses
with open("output.js", "w") as dst:
    json.dump(geojson, dst, indent=2)

with open("gibraltar.geojson", "w") as dst:
    json.dump(geojson, dst, indent=2)

print(f"\nGenerated {len(features)} features")
print("Files created:")
print("  - output.js (for web use)")
print("  - gibraltar.geojson (standard GeoJSON format)")
