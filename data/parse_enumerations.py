import json
import re

# Read the markdown file
with open('enumerations.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse enumeration areas
enumerations = {}

# Find all ENUMERATION AREA sections
pattern = r'ENUMERATION AREA (?:No\.|NO\.|NOS\.)\s*(\d+(?:,\s*\d+)*)\s+(.*?)(?=ENUMERATION AREA|$)'
matches = re.finditer(pattern, content, re.DOTALL)

for match in matches:
    ea_numbers = match.group(1).strip()
    locations_text = match.group(2).strip()
    
    # Handle multiple EA numbers (like "80, 81, 82, 83, 84, 85, 86, 87")
    if ',' in ea_numbers:
        ea_list = [num.strip() for num in ea_numbers.split(',')]
    else:
        ea_list = [ea_numbers]
    
    # Clean up locations text - remove extra whitespace and newlines
    locations_text = re.sub(r'\s+', ' ', locations_text)
    
    # Keep the full text as a single location description
    # This preserves the structure including parenthetical additions
    
    # Assign to all EA numbers
    for ea_num in ea_list:
        ea_key = f"EA {ea_num}"
        enumerations[ea_key] = {
            "description": locations_text
        }

# Write to JSON
with open('enumeration_locations.json', 'w', encoding='utf-8') as f:
    json.dump(enumerations, f, indent=2, ensure_ascii=False)

print(f"Created enumeration_locations.json with {len(enumerations)} enumeration areas")

# Print first few for verification
for i, (key, value) in enumerate(list(enumerations.items())[:3]):
    print(f"\n{key}: {value['description'][:100]}...")
