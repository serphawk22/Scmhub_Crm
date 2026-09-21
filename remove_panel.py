import re
import sys

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove FEATURES array
    content = re.sub(r'const FEATURES = \[.*?\];\n\n', '', content, flags=re.DOTALL)
    
    # Remove FloatingCard function
    content = re.sub(r'function FloatingCard.*?\}\n\n', '', content, flags=re.DOTALL)

    # Remove LEFT PANEL
    # Look for {/* ── LEFT PANEL – Visual branding ── */}
    # up to {/* ── RIGHT PANEL
    content = re.sub(r'\{\/\* ── LEFT PANEL – Visual branding ── \*\/\}.*?(?=\{\/\* ── RIGHT PANEL)', '', content, flags=re.DOTALL)

    # Change RIGHT PANEL text just to be clean
    content = content.replace('{/* ── RIGHT PANEL – Login form ── */}', '{/* ── Login form ── */}')
    content = content.replace('{/* ── RIGHT PANEL – Signup form ── */}', '{/* ── Signup form ── */}')

    # Make the right panel take full background
    content = content.replace('className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative"', 'className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative w-full"')

    with open(filepath, 'w') as f:
        f.write(content)

process_file('frontend/src/app/login/page.tsx')
process_file('frontend/src/app/signup/page.tsx')
