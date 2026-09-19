with open("frontend/src/app/signup/page.tsx", "r") as f:
    content = f.read()

# Fix Inputs
content = content.replace(
    'className="w-full py-3.5 pl-12 pr-4 bg-[#0a0a0a] border-2 border-zinc-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium placeholder:text-zinc-500"',
    'className="w-full h-full py-3 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg pl-10 pr-10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder:text-zinc-600"'
)
content = content.replace(
    'className="w-full py-3.5 pl-12 pr-12 bg-[#0a0a0a] border-2 border-zinc-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium placeholder:text-zinc-500"',
    'className="w-full h-full py-3 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg pl-10 pr-10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder:text-zinc-600"'
)
content = content.replace(
    'className="w-full py-3.5 pl-4 pr-10 bg-[#0a0a0a] border-2 border-zinc-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium appearance-none"',
    'className="w-full py-3 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg pl-4 pr-10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors appearance-none"'
)
content = content.replace(
    'className="w-full py-3.5 pl-12 pr-4 bg-[#0a0a0a] border border-zinc-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium placeholder:text-zinc-500"',
    'className="w-full h-full py-3 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg pl-10 pr-10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder:text-zinc-600"'
)

# Fix Buttons
content = content.replace(
    'className="w-full relative py-4 rounded-xl font-bold text-white overflow-hidden shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-70"',
    'className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-4"'
)
content = content.replace(
    'className="w-full relative py-3.5 rounded-xl font-bold text-slate-700 bg-[#0a0a0a] border border-slate-300 hover:bg-zinc-900 text-[15px] flex items-center justify-center gap-3 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"',
    'className="w-full py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"'
)
content = content.replace(
    'className="relative w-full h-full py-4 rounded-xl font-bold text-slate-700 bg-[#0a0a0a] border-2 border-zinc-800 hover:border-slate-300 hover:bg-zinc-900 text-[15px] flex items-center justify-center gap-2.5 transition-all shadow-sm"',
    'className="w-full h-full py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center"'
)

# Replace remaining text-slate-*
content = content.replace('text-slate-700', 'text-zinc-300')
content = content.replace('text-slate-800', 'text-zinc-200')
content = content.replace('text-slate-900', 'text-zinc-100')
content = content.replace('border-slate-300', 'border-zinc-800')
content = content.replace('text-blue-600', 'text-indigo-400')
content = content.replace('hover:text-blue-700', 'hover:text-indigo-300')

with open("frontend/src/app/signup/page.tsx", "w") as f:
    f.write(content)
print("Signup inputs and buttons updated!")
