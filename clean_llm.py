import re

with open('modules/llm_engine.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the wrapper definition completely
code = re.sub(r'def tracked_chat_completion.*?return response\n', '', code, flags=re.DOTALL)
# Remove the imports
code = code.replace('import time\nfrom modules.api_tracker import track_api_call\n', '')

# Replace all tracked_chat_completion(client, 'endpoint', ...) with client.chat.completions.create(...)
code = re.sub(r'tracked_chat_completion\(client, \"[^\"]+\", ', 'client.chat.completions.create(', code)

with open('modules/llm_engine.py', 'w', encoding='utf-8') as f:
    f.write(code)
print('Done reverting llm_engine.py')
