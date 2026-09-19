import re

with open('showcase/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove ai-agent-badge divs (GPT-4o, Gemini Vision, Multi-scrape, WA Business API)
content = re.sub(r'\s*<div class="ai-agent-badge">[^<]+</div>', '', content)

# Remove the 5-steps pipeline div block (lines 421-437)
content = re.sub(
    r'<!-- Pipeline -->.*?</div>\s*\n\s*\n(?=<!-- )',
    '',
    content,
    flags=re.DOTALL
)

# Remove emoji characters using unicode ranges
emoji_pattern = re.compile(
    "["
    u"\U0001F600-\U0001F64F"  # emoticons
    u"\U0001F300-\U0001F5FF"  # symbols & pictographs
    u"\U0001F680-\U0001F6FF"  # transport & map
    u"\U0001F1E0-\U0001F1FF"  # flags
    u"\U00002702-\U000027B0"  # dingbats
    u"\U000024C2-\U0001F251"
    u"\U0001F900-\U0001F9FF"  # supplemental symbols
    u"\U00002600-\U000026FF"  # misc symbols
    u"\U0000FE0F"              # variation selector
    u"\U0001FA00-\U0001FA6F"  # chess / symbols ext-a
    u"\U0001FA70-\U0001FAFF"  # symbols ext-b
    "]+",
    flags=re.UNICODE
)
content = emoji_pattern.sub('', content)

# Remove ✦ bullet markers
content = content.replace('✦', '')
# Remove → arrow that was used in pipeline (but keep → in regular text)
# Actually leave arrows as they may be in text

# Clean up any double-spaces left by removed emojis
content = re.sub(r'  +', ' ', content)
# Clean leftover lines that are now just whitespace
content = re.sub(r'\n[ \t]+\n', '\n\n', content)

with open('showcase/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Cleaned showcase/index.html")
