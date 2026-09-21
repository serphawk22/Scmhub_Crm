import re

with open("frontend/src/app/projects/[id]/page.tsx", "r") as f:
    content = f.read()

# Add imports
content = content.replace("import PageGuide from '@/components/PageGuide';", "import PageGuide from '@/components/PageGuide';\nimport KanbanTab from './KanbanTab';\nimport TeamTab from './TeamTab';")

# Add state
content = content.replace("const [allInterns, setAllInterns] = useState([]);", "const [allInterns, setAllInterns] = useState([]);\n  const [activeTab, setActiveTab] = useState<'overview' | 'kanban' | 'team'>('overview');")

# Wrap the main content with a Tab selector
tab_selector = """      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 mb-8 space-x-8">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('kanban')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'kanban' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'}`}
        >
          Kanban Board
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'team' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'}`}
        >
          Team & Access
        </button>
      </div>

      {activeTab === 'kanban' && <KanbanTab projectId={id as string} />}
      {activeTab === 'team' && <TeamTab projectId={id as string} onUpdate={fetchData} />}
      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
"""

content = content.replace("<div className=\"grid grid-cols-1 lg:grid-cols-3 gap-8\">", tab_selector)

# Close the overview tab wrapper at the end of the file
# Find the last closing tag of the main content.
# The main content ends right before: return ( <div ...> ... </div> ); wait no, it's inside the return.
# Let's just replace the final `</div>\n    </div>\n  );\n}` with `</div>\n      )}\n    </div>\n  );\n}`
content = re.sub(r"</div>\n    </div>\n  \);\n}$", "</div>\n      )}\n    </div>\n  );\n}", content)

with open("frontend/src/app/projects/[id]/page.tsx", "w") as f:
    f.write(content)
