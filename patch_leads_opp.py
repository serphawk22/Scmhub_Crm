import re
import os

filepath = 'frontend/src/app/leads/[id]/components/tabs/OpportunitiesTab.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# 1. Add imports
import_insert = """import { ResultCard, ResearchResultData } from "@/components/email-agent/ResultCard";
import { API_BASE_URL } from "@/config";
"""
content = content.replace('import { \n  Mail,', import_insert + 'import { \n  Mail,')

# 2. Add state and fetch logic
state_insert = """
  const [researchData, setResearchData] = useState<ResearchResultData | null>(null);

  useEffect(() => {
    if (lead?.id && activeSubTab === 'emails') {
      fetch(`${API_BASE_URL}/leads/${lead.id}/research`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.email_agent_data) {
            try {
              const parsed = JSON.parse(data.email_agent_data);
              setResearchData(parsed);
            } catch (e) {
              console.error("Failed to parse research data", e);
            }
          }
        })
        .catch(console.error);
    }
  }, [lead?.id, activeSubTab]);
"""
# insert before "const handleSendWhatsApp"
content = content.replace('const handleSendWhatsApp', state_insert + '\n  const handleSendWhatsApp')

# 3. Add UI rendering inside the "emails" tab
# Look for <div className="space-y-6"> and {/* Outbound Emails / Round 1 */}
ui_target = """{/* Outbound Emails / Round 1 */}"""
ui_insert = """
          {/* Research Data (ResultCard) */}
          {researchData && (
            <div className="mb-8">
              <ResultCard
                historyId="research"
                result={researchData}
                companyName={lead?.company_name || ""}
                companyUrl={lead?.website || ""}
                onSendManually={async () => { throw new Error("Not implemented here"); }}
                onSendAutomatically={async () => { throw new Error("Not implemented here"); }}
                onSaveFollowUp={async () => { return true; }}
                onRemove={() => setResearchData(null)}
              />
            </div>
          )}

          {/* Outbound Emails / Round 1 */}"""
content = content.replace(ui_target, ui_insert)

with open(filepath, 'w') as f:
    f.write(content)

print("Success patching Leads OpportunitiesTab")
