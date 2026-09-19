import re

with open('main.py', 'r') as f:
    main_code = f.read()

main_code = re.sub(r'^.*from modules\.api_intelligence import.*$\n', '', main_code, flags=re.MULTILINE)
main_code = re.sub(r'^.*app\.include_router\(api_intelligence_router\).*$\n', '', main_code, flags=re.MULTILINE)

with open('main.py', 'w') as f:
    f.write(main_code)

print("Fixed modules 2")
