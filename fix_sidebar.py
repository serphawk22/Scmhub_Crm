import re

with open('frontend/src/components/Sidebar.tsx', 'r') as f:
    content = f.read()

# We want to remove unwanted items from the defaultSidebarSections array
unwanted_items = [
    "item-projects", "item-meetings", "item-calls", "item-inventory",
    "item-products", "item-orders", "item-billing", "item-proposals",
    "item-marketplace", "item-import", "item-api-intelligence", "item-demo-accounts"
]

for item in unwanted_items:
    content = re.sub(r'^[ \t]*\{ id: "' + item + r'",.*$\n', '', content, flags=re.MULTILINE)

# We can also drop the INVENTORY and SYSTEM sections entirely if they are empty, but the dynamic rendering handles empty sections gracefully.
# Wait, let's also remove them from DEFAULT_HEADINGS if we want.
content = content.replace('"INVENTORY", ', '')
content = content.replace('"SYSTEM", ', '')
content = content.replace('"PROJECTS & ACTIVITIES"', '"ACTIVITIES"')

with open('frontend/src/components/Sidebar.tsx', 'w') as f:
    f.write(content)

print("Fixed sidebar")
