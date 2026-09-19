import re

with open('main.py', 'r') as f:
    content = f.read()

# Remove lines like: session.execute(delete().where(.client_id == client_id))
content = re.sub(r'^[ \t]*session\.execute\(delete\(\)\.where\(\.[a-zA-Z_]+ == [a-zA-Z_]+\)\)\n', '', content, flags=re.MULTILINE)
content = re.sub(r'^[ \t]*session\.execute\(delete\(\)\.where\(\.[a-zA-Z_]+\.in_\([a-zA-Z_]+\)\)\)\n', '', content, flags=re.MULTILINE)

with open('main.py', 'w') as f:
    f.write(content)

print("Fixed syntax errors")
