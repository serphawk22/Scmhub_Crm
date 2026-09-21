import re
with open("src/app/leads/[id]/components/tabs/OpportunitiesTab.tsx", "r") as f:
    content = f.read()

# 1. Update imports
if "ResultCard" not in content:
    content = content.replace(
        "import { useLanguage } from '@/context/LanguageContext';",
        "import { useLanguage } from '@/context/LanguageContext';\nimport { ResultCard } from '@/components/email-agent/ResultCard';"
    )

# 2. Change activeSubTab default to 'presales'
content = content.replace("React.useState('email_agent')", "React.useState('presales')")

# 3. Replace the tabs array
old_tabs_array = """        {[
          { id: 'email_agent', label: language === 'es' ? 'Análisis del Agente IA' : 'AI Agent Analysis', icon: Target },
          { id: 'presales', label: language === 'es' ? 'Investigación Pre-Ventas' : 'Pre-Sales Research', icon: Brain },
          { id: 'emails', label: language === 'es' ? 'Correos Salientes' : 'Outbound Emails', icon: Mail },
          { id: 'radar', label: language === 'es' ? 'Gráfico de Descubrimiento' : 'Discovery Graph', icon: Radar },
        ].map(t => ("""
new_tabs_array = """        {[
          { id: 'presales', label: language === 'es' ? 'Análisis del Agente IA' : 'AI Agent Analysis', icon: Brain },
          { id: 'emails', label: language === 'es' ? 'Correos Salientes' : 'Outbound Emails', icon: Mail },
        ].map(t => ("""
content = content.replace(old_tabs_array, new_tabs_array)

# 4. Remove 'email_agent' tab section
email_agent_tab = re.search(r"\{activeSubTab === 'email_agent' && \([\s\S]*?\)\}\n\n      \{activeSubTab === 'presales'", content)
if email_agent_tab:
    content = content.replace(email_agent_tab.group(0), "{activeSubTab === 'presales'")

# 5. Remove 'radar' tab section
radar_tab = re.search(r"\{activeSubTab === 'radar' && \([\s\S]*?\}\)\}\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*\}", content)
if radar_tab:
    content = content.replace(radar_tab.group(0), "    </div>\n  );\n}")

# 6. Add ResultCard inside 'emails' tab
emails_tab_header = "{activeSubTab === 'emails' && (\n        <div className=\"space-y-6\">"
result_card_snippet = """{activeSubTab === 'emails' && (
        <div className="space-y-6">
          
          {/* Research Data (ResultCard & PDF Download) */}
          {researchData && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-black text-slate-800 dark:text-zinc-100 dark:text-white">AI Agent Output</h4>
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>AI Investigation Report - ${lead?.company_name || 'Lead'}</title>
                          <style>
                            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                            h1 { color: #4f46e5; margin-bottom: 8px; font-size: 28px; }
                            .meta { color: #64748b; font-size: 14px; margin-bottom: 40px; }
                            h2 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 40px; font-size: 20px; }
                            h3 { color: #334155; font-size: 16px; margin-top: 24px; }
                            p { color: #334155; font-size: 14px; }
                            ul { font-size: 14px; color: #334155; padding-left: 20px; }
                            li { margin-bottom: 8px; }
                            .badge { display: inline-block; padding: 4px 8px; background: #f1f5f9; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
                            .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-top: 16px; }
                          </style>
                        </head>
                        <body>
                          <h1>AI Deep Investigation Report</h1>
                          <div class="meta">Generated for ${lead?.company_name || 'Lead'} • ${new Date().toLocaleDateString()}</div>
                          
                          <h2>⚡ Executive Verdict</h2>
                          <p>${researchData?.executive_verdict || research?.company_overview || 'N/A'}</p>
                          
                          <h2>📦 Product & Service Portfolio</h2>
                          ${(researchData?.product_portfolio || []).map((p: any) => `
                            <div class="box">
                              <h3>${p.name}</h3>
                              <p>${p.description}</p>
                              ${p.pricing_tier ? `<span class="badge">${p.pricing_tier}</span>` : ''}
                              ${p.target_customer ? `<span class="badge">${p.target_customer}</span>` : ''}
                            </div>
                          `).join('')}

                          <h2>🎯 Ideal Customer Profiles (ICPs)</h2>
                          ${(researchData?.ideal_customer_profiles || []).map((icp: any) => `
                            <div class="box">
                              <h3>${icp.name}</h3>
                              <p><strong>Pain:</strong> ${icp.pain}</p>
                              <p><strong>Desire:</strong> ${icp.desire}</p>
                              <p><strong>Hook:</strong> ${icp.hook}</p>
                            </div>
                          `).join('')}

                          <h2>⚔️ Competitive Landscape</h2>
                          <p>${researchData?.competitive_landscape?.summary || 'N/A'}</p>
                          ${(researchData?.competitive_landscape?.top_competitors || []).map((c: any) => `
                            <div class="box">
                              <h3>${c.name}</h3>
                              <p><strong>Their Edge:</strong> ${c.their_edge}</p>
                              <p><strong>Where to Attack:</strong> ${c.where_they_are_weak}</p>
                            </div>
                          `).join('')}
                          
                          <script>
                            setTimeout(() => {
                              window.print();
                            }, 500);
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
                >
                  <FileText size={16} />
                  Download PDF Report
                </button>
              </div>
              <ResultCard
                historyId="research"
                result={researchData}
                companyName={lead?.company_name || ""}
                companyUrl={lead?.website || ""}
                onSendManually={async () => { throw new Error("Not implemented here"); }}
                onSendAutomatically={async () => { throw new Error("Not implemented here"); }}
                onSaveFollowUp={async () => { return true; }}
                onRemove={() => {}}
              />
            </div>
          )}
"""
content = content.replace(emails_tab_header, result_card_snippet)

with open("src/app/leads/[id]/components/tabs/OpportunitiesTab.tsx", "w") as f:
    f.write(content)
print("PATCH APPLIED")
