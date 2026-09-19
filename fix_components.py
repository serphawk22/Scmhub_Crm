import glob

files = glob.glob('frontend/src/app/leads/[id]/components/*.tsx')
for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    content = content.replace("client.", "lead.")
    content = content.replace("client?", "lead?")
    content = content.replace("client:", "lead:")
    content = content.replace("client={", "lead={")
    content = content.replace("client_id", "lead_id")
    
    with open(file, 'w') as f:
        f.write(content)

print("Fixed component files.")
