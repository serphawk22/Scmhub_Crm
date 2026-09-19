import re
import json

with open("frontend/src/app/admin/api-intelligence/page.tsx", "r") as f:
    content = f.read()

keys = re.findall(r'api_intelligence\.([a-zA-Z0-9_]+)', content)
keys = set(keys)

with open("frontend/src/locales/en/common.json", "r") as f:
    data = json.load(f)

if "api_intelligence" not in data:
    data["api_intelligence"] = {}

for k in keys:
    if k not in data["api_intelligence"]:
        # generate a casual human readable string
        words = k.split('_')
        casual = " ".join([w.capitalize() for w in words])
        data["api_intelligence"][k] = casual

# specific overrides for casual terms
data["api_intelligence"]["title"] = "AI Usage Tracker"
data["api_intelligence"]["subtitle"] = "Keep an eye on your AI usage and costs"
data["api_intelligence"]["tab_overview"] = "Overview"
data["api_intelligence"]["tab_models"] = "AI Models"
data["api_intelligence"]["tab_sales_team"] = "Team Usage"
data["api_intelligence"]["tab_clients"] = "Client Usage"
data["api_intelligence"]["tab_endpoints"] = "Features Used"

with open("frontend/src/locales/en/common.json", "w") as f:
    json.dump(data, f, indent=2)

print("Translations added!")
