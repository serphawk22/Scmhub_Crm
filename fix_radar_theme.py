import os
import re

files = [
    "frontend/src/app/admin/clients/[id]/competitors/page.tsx",
    "frontend/src/app/admin/radar/page.tsx"
]

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r") as f:
        content = f.read()
    
    # Replace hardcoded dark theme classes with responsive ones
    content = content.replace("bg-zinc-900", "bg-white dark:bg-zinc-900")
    content = content.replace("bg-zinc-950", "bg-gray-50 dark:bg-zinc-950")
    
    content = content.replace("border-zinc-800", "border-gray-200 dark:border-zinc-800")
    content = content.replace("border-zinc-700", "border-gray-300 dark:border-zinc-700")
    
    content = content.replace("text-zinc-400", "text-slate-500 dark:text-zinc-400")
    content = content.replace("text-zinc-300", "text-slate-700 dark:text-zinc-300")
    content = content.replace("text-zinc-100", "text-slate-900 dark:text-zinc-100")
    
    # Fix RadarMapLoader to check theme
    theme_code = """    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new g.Map(mapRef.current, {
        center, zoom: radiusKm <= 2 ? 15 : radiusKm <= 5 ? 14 : radiusKm <= 10 ? 13 : 12,
        styles: isDark ? darkStyles : [], mapTypeControl: false, streetViewControl: false,
      });"""
      
    content = re.sub(
        r"if \(\!mapInstanceRef\.current\) \{\s*mapInstanceRef\.current = new g\.Map\(mapRef\.current, \{\s*center, zoom:.*?\s*styles: darkStyles, mapTypeControl: false, streetViewControl: false,\s*\}\);\s*\}",
        theme_code,
        content,
        flags=re.DOTALL
    )

    with open(fpath, "w") as f:
        f.write(content)

print("Done fixing themes")
