import os

page_path = 'frontend/src/app/email-agent/page.tsx'
dest_dir = 'frontend/src/components/email-agent'
os.makedirs(dest_dir, exist_ok=True)
dest_path = os.path.join(dest_dir, 'ResultCard.tsx')

with open(page_path, 'r') as f:
    lines = f.readlines()

# Extract Types (Line 16 to 125 roughly)
types_start = -1
types_end = -1
for i, line in enumerate(lines):
    if line.startswith('interface SentEmail'):
        types_start = i
    if line.startswith('}'):
        if 'email_id?: number;' in lines[i-1] or 'error?: string;' in lines[i-1]:
            types_end = i

# Find ResultCard function
rc_start = -1
rc_end = -1
for i, line in enumerate(lines):
    if line.startswith('function ResultCard(') or line.startswith('export function ResultCard('):
        rc_start = i
    if line.startswith('export default function EmailAgentPage'):
        rc_end = i - 1
        break

# Go backwards from rc_end to find the closing brace
while rc_end > rc_start and lines[rc_end].strip() != '}':
    rc_end -= 1

if types_start != -1 and types_end != -1 and rc_start != -1 and rc_end != -1:
    types_lines = lines[types_start:types_end+1]
    
    # Prepend export to types
    for j in range(len(types_lines)):
        if types_lines[j].startswith('interface '):
            types_lines[j] = 'export ' + types_lines[j]
        if types_lines[j].startswith('type '):
            types_lines[j] = 'export ' + types_lines[j]

    rc_lines = lines[rc_start:rc_end+1]
    if rc_lines[0].startswith('function '):
        rc_lines[0] = 'export ' + rc_lines[0]

    imports = """import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Mail, Clock, User, Globe, ChevronDown, ChevronUp,
  CheckCircle, Building2, Briefcase, Target, AtSign, FileText, Copy, Check,
  TrendingUp, Zap, Package, UserPlus, Phone, Store, DollarSign, MessageCircle, Trash2, Youtube
} from "lucide-react";
"""
    with open(dest_path, 'w') as f:
        f.write(imports + '\n')
        f.writelines(types_lines)
        f.write('\n\n')
        f.writelines(rc_lines)

    # Now remove from page.tsx
    new_page_lines = lines[:types_start] + lines[types_end+1:rc_start] + lines[rc_end+1:]
    
    # Add imports to page.tsx
    import_statement = 'import { ResultCard, ResearchResultData, SendEmailResult } from "@/components/email-agent/ResultCard";\n'
    
    for i, line in enumerate(new_page_lines):
        if line.startswith('import PageGuide'):
            new_page_lines.insert(i+1, import_statement)
            break

    with open(page_path, 'w') as f:
        f.writelines(new_page_lines)
        
    print("Successfully extracted ResultCard and types to ResultCard.tsx!")
else:
    print(f"Failed to find bounds. types: {types_start}-{types_end}, rc: {rc_start}-{rc_end}")

