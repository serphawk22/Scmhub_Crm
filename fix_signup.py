import re

with open("frontend/src/app/signup/page.tsx", "r") as f:
    content = f.read()

# Make root dark
content = content.replace(
    '<div className="min-h-screen flex overflow-hidden font-sans">',
    '<div className="min-h-screen flex overflow-hidden font-sans bg-[#0a0a0a] text-zinc-100 selection:bg-indigo-500/30">'
)

# Make right panel dark
content = content.replace(
    'style={{ background: "#ffffff" }}',
    ''
)
content = content.replace(
    'className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative"',
    'className="flex-1 flex flex-col justify-center relative z-20 px-6 sm:px-12 lg:px-24 xl:px-32"'
)

# Change text colors
content = content.replace('text-slate-900', 'text-white')
content = content.replace('text-gray-900', 'text-white')
content = content.replace('text-slate-500', 'text-zinc-400')
content = content.replace('text-slate-400', 'text-zinc-500')
content = content.replace('text-slate-600', 'text-zinc-400')
content = content.replace('text-gray-500', 'text-zinc-400')

# Change borders and backgrounds
content = content.replace('bg-white', 'bg-[#0a0a0a]')
content = content.replace('bg-slate-50', 'bg-zinc-900')
content = content.replace('bg-slate-100', 'bg-zinc-800')
content = content.replace('border-slate-200', 'border-zinc-800')
content = content.replace('border-slate-100', 'border-zinc-800')
content = content.replace('hover:bg-slate-50', 'hover:bg-zinc-900')
content = content.replace('hover:border-slate-200', 'hover:border-zinc-700')
content = content.replace('focus:bg-slate-50', 'focus:bg-zinc-900')

with open("frontend/src/app/signup/page.tsx", "w") as f:
    f.write(content)

print("Signup updated to dark theme!")
