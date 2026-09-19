import re

with open('main.py', 'r') as f:
    content = f.read()

# Fix trailing comma issues in imports
content = re.sub(r',\s*\n', '\n', content)

with open('main.py', 'w') as f:
    f.write(content)

print("Fixed syntax errors 2")
