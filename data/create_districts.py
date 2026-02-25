import json

# District to enumeration area mapping
districts = {
    "EAST SIDE": {
        "name": "East Side",
        "enumeration_areas": [1]
    },
    "NORTH DISTRICT": {
        "name": "North District",
        "enumeration_areas": [2, 3, 4, 5, 6, 7, 8, 9, 12]
    },
    "RECLAMATION AREAS": {
        "name": "Reclamation Areas",
        "enumeration_areas": [64, 65, 66, 67, 68, 69, 70]
    },
    "TOWN AREA": {
        "name": "Town Area",
        "enumeration_areas": [10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33]
    },
    "UPPER TOWN": {
        "name": "Upper Town",
        "enumeration_areas": [11, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]
    },
    "SANDPITS AREA": {
        "name": "Sandpits Area",
        "enumeration_areas": [46, 48, 49, 50, 51, 63]
    },
    "SOUTH DISTRICT": {
        "name": "South District",
        "enumeration_areas": [47, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64]
    }
}

# Write to JSON
with open('../static/data/districts.json', 'w', encoding='utf-8') as f:
    json.dump(districts, f, indent=2, ensure_ascii=False)

print(f"Created districts.json with {len(districts)} districts")

# Print summary
for district_id, district in districts.items():
    ea_count = len(district['enumeration_areas'])
    print(f"{district['name']}: {ea_count} enumeration areas")
