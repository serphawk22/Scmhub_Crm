import re
import os

page_path = 'frontend/src/app/email-agent/page.tsx'
dest_path = 'frontend/src/components/email-agent/ResultCard.tsx'

with open(page_path, 'r') as f:
    content = f.read()

# 1. Find types to extract
type_names = ['RecommendedService', 'ResearchResultData', 'SendEmailResult']
extracted_types = ""

# Very naive extraction (better to just copy the whole interface blocks by looking at the file)
