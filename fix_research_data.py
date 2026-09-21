import re
import os

paths = [
    'frontend/src/app/admin/clients/[id]/components/tabs/OpportunitiesTab.tsx',
    'frontend/src/app/leads/[id]/components/tabs/OpportunitiesTab.tsx'
]

for p in paths:
    if not os.path.exists(p): continue
    
    with open(p, 'r') as f:
        content = f.read()
    
    # We need to insert a parsed researchData definition.
    # We can do this right inside the component body, or use a state.
    # Since it's a synchronous parse, just deriving it is fine.
    
    # Let's see if we can find a good spot. 
    # Usually right below "export default function OpportunitiesTab"
    
    # Find "export default function OpportunitiesTab({ "
    if 'const [researchData, setResearchData]' not in content:
        insert_code = """
  // Parse research data
  const [researchData, setResearchData] = React.useState<any>(null);
  React.useEffect(() => {
    if (research?.email_agent_data) {
      try {
        setResearchData(typeof research.email_agent_data === 'string' ? JSON.parse(research.email_agent_data) : research.email_agent_data);
      } catch (e) {
        console.error("Failed to parse research data", e);
      }
    }
  }, [research]);
"""
        # Let's insert it after activeSubTab state
        content = content.replace("const [activeSubTab, setActiveSubTab] = React.useState('email_agent');", "const [activeSubTab, setActiveSubTab] = React.useState('email_agent');\n" + insert_code)
        
        with open(p, 'w') as f:
            f.write(content)
        print(f"Fixed {p}")

