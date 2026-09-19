import re
import glob

# Remove api_tracker usage from main
with open('main.py', 'r') as f:
    main_code = f.read()
main_code = re.sub(r'^.*from modules\.api_tracker import.*$\n', '', main_code, flags=re.MULTILINE)
main_code = re.sub(r'^.*patch_openai\(.*$\n', '', main_code, flags=re.MULTILINE)
with open('main.py', 'w') as f:
    f.write(main_code)

print("Fixed modules")
