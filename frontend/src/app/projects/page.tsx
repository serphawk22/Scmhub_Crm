"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Search, Zap, Calendar, CheckCircle2, Clock3, Filter, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useRole } from "@/context/RoleContext";

const initialProjects = [
  {
    id: 1,
    name: "Website Rebuild",
    status: "Active",
    progress: 72,
    description: "Modernize the SEO site, improve conversion paths, and ship the updated content stack.",
    updatedAt: "2026-09-15",
    owner: "Alicia",
  },
  {
    id: 2,
    name: "International PPC Sprint",
    status: "Planning",
    progress: 18,
    description: "Audit campaign structure across key regions and build a launch plan for priority markets.",
    updatedAt: "2026-09-12",
    owner: "Nina",
  },
  {
    id: 3,
    name: "Content Hub Refresh",
    status: "Completed",
    progress: 100,
    description: "Publish the refreshed pillar and cluster content architecture with performance optimization.",
    updatedAt: "2026-09-10",
    owner: "Chris",
  },
];

export default function ProjectsPage() {
  const { t } = useLanguage();
  const { role } = useRole();
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "Planning",
    progress: 20,
  });

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query.toLowerCase()) ||
        project.description.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "All" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, query, statusFilter]);

  const handleCreate = () => {
    if (!form.name.trim()) return;
    setProjects((current) => [
      {
        id: Date.now(),
        name: form.name,
        description: form.description || "New project created in the CRM.",
        status: form.status,
        progress: Number(form.progress),
        updatedAt: new Date().toISOString().slice(0, 10),
        owner: role || "Admin",
      },
      ...current,
    ]);
    setForm({ name: "", description: "", status: "Planning", progress: 20 });
    setShowCreate(false);
  };

  const stats = [
    { label: "Total", value: projects.length, color: "bg-indigo-500/10 text-indigo-600" },
    { label: "Active", value: projects.filter((p) => p.status === "Active").length, color: "bg-blue-500/10 text-blue-600" },
    { label: "Planning", value: projects.filter((p) => p.status === "Planning").length, color: "bg-amber-500/10 text-amber-600" },
    { label: "Completed", value: projects.filter((p) => p.status === "Completed").length, color: "bg-emerald-500/10 text-emerald-600" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-500">Projects</p>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{t("projects.title")}</h1>
            </div>
          </div>

          {(role === "Admin" || role === "Employee" || role === "Demo") && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 dark:bg-white dark:text-slate-900"
            >
              <Plus className="h-4 w-4" />
              {t("projects.new_project")}
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className={`inline-flex rounded-xl px-2.5 py-2 text-xs font-bold ${stat.color}`}>
                {stat.label}
              </div>
              <div className="mt-4 text-3xl font-black text-slate-900 dark:text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              {['All', 'Active', 'Planning', 'Completed'].map((value) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${statusFilter === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {project.status}
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">{project.name}</h2>
                <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-600" />
              </div>

              <p className="min-h-[60px] text-sm text-slate-600 dark:text-zinc-300">{project.description}</p>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {project.updatedAt}</span>
                <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> {project.owner}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">New project</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Create project</h3>
              </div>
              <button onClick={() => setShowCreate(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500 dark:bg-zinc-800 dark:text-zinc-300">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Project name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Client migration"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Short summary of the work and goals"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option>Planning</option>
                    <option>Active</option>
                    <option>Completed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Progress</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-zinc-700 dark:text-zinc-200">Cancel</button>
              <button onClick={handleCreate} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white">Create project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
