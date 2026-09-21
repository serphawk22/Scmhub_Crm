import re

with open('frontend/src/app/email-agent/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove video tag
content = re.sub(r'<video[^>]+src=\"/emailagentanimation.mp4\"[^>]*/>', '', content, flags=re.DOTALL)

# Replace dark/glass themes with light themes
replacements = {
    'bg-black/60 backdrop-blur-md border border-white/20': 'bg-white border border-slate-200',
    'bg-white/10 backdrop-blur-md border border-white/20': 'bg-white border border-slate-200',
    'bg-black/60 backdrop-blur-md': 'bg-white',
    'bg-black/40': 'bg-slate-50 border-slate-200',
    'bg-white/5': 'bg-slate-50',
    'bg-white/10': 'bg-white border border-slate-200',
    'bg-white/20': 'bg-slate-100',
    'border-white/10': 'border-slate-100',
    'border-white/20': 'border-slate-200',
    'border-white/30': 'border-slate-300',
    'text-white': 'text-slate-800',
    'text-gray-300': 'text-slate-500',
    'text-gray-400': 'text-slate-400',
    'text-gray-200': 'text-slate-600',
    'bg-transparent': 'bg-slate-50',
    'shadow-2xl': 'shadow-sm',
    'shadow-xl': 'shadow-sm',
    'text-[10px] font-black text-white': 'text-[10px] font-black text-slate-800',
    # Specific fixes
    'placeholder:text-gray-400': 'placeholder:text-slate-400',
    'placeholder-gray-400': 'placeholder-slate-400',
}

for k, v in replacements.items():
    content = content.replace(k, v)

with open('frontend/src/app/email-agent/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
