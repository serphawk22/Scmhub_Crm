import json
import os
import sys
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from modules.llm_engine import get_openai_client

en_path = "frontend/src/locales/en/common.json"
es_path = "frontend/src/locales/es/common.json"

with open(en_path, "r", encoding="utf-8") as f:
    en_data = json.load(f)

with open(es_path, "r", encoding="utf-8") as f:
    es_data = json.load(f)

client = get_openai_client()

def generate_text(prompt, system_prompt):
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1
    )
    return res.choices[0].message.content

def traverse_and_translate(en_dict, es_dict, path=""):
    changes = 0
    for key, val in en_dict.items():
        if isinstance(val, dict):
            if key not in es_dict or not isinstance(es_dict[key], dict):
                es_dict[key] = {}
                changes += 1
            changes += traverse_and_translate(val, es_dict[key], path + key + ".")
        elif isinstance(val, str):
            if key not in es_dict or not es_dict[key]:
                print(f"Translating {path}{key}: '{val}'")
                prompt = f"Translate the following short UI text from English to Spanish. Return ONLY the Spanish text, nothing else. Text: '{val}'"
                translated = generate_text(prompt, system_prompt="You are a professional software translator. Return ONLY the translation, no quotes, no markdown, no extra text.").strip()
                if translated.startswith('"') and translated.endswith('"'):
                    translated = translated[1:-1]
                if translated.startswith("'") and translated.endswith("'"):
                    translated = translated[1:-1]
                es_dict[key] = translated
                changes += 1
    return changes

print("Starting translation sync...")
c = traverse_and_translate(en_data, es_data)

if c > 0:
    with open(es_path, "w", encoding="utf-8") as f:
        json.dump(es_data, f, ensure_ascii=False, indent=2)
    print(f"Translation sync complete. {c} items updated.")
else:
    print("Translation sync complete. No new items needed.")
