"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FolderKanban, Calendar, CheckCircle2, Clock3 } from "lucide-react";

const projectMap: Record<string, any> = {
  "1": {
    id: 1,
    name: "Website Rebuild",
    status: "Active",
    progress: 72,
    description: "Modernize the SEO site, improve conversion paths, and ship the updated content stack.",
    owner: "Alicia",
    updatedAt: "2026-09-15",
    tasks: ["Refine homepage experience", "Rebuild lead capture funnel", "Launch content migration"],
  },
  "2": {
    id: 2,
    name: "International PPC Sprint",
    status: "Planning",
    progress: 18,
    description: "Audit campaign structure across key regions and build a launch plan for priority markets.",
    owner: "Nina",
    updatedAt: "2026-09-12",
    tasks: ["Perform channel audit", "Select market list", "Build launch calendar"],
  },
  "3": {
    id: 3,
    name: "Content Hub Refresh",
    status: "Completed",
    progress: 100,
    description: "Publish the refreshed pillar and cluster content architecture with performance optimization.",
    owner: "Chris",
    updatedAt: "2026-09-10",
    tasks: ["Migration complete", "Performance review complete", "Client sign-off received"],
  },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const project = projectMap[String(params?.id ?? "")] ?? null;

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-black text-slate-900 dark:text-white">Project not found.</p>
        <Link href="/projects" className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Back to projects</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/projects" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 dark:border-zinc-700 dark:text-zinc-200">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="rounded-full bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">{project.status}</div>
        </div>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Project</p>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{project.name}</h1>
            </div>
          </div>
          <div className="text-right text-sm text-slate-500 dark:text-zinc-400">
            <div className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" /> {project.updatedAt}</div>
            <div className="mt-1">Owner: {project.owner}</div>
          </div>
        </div>

        <p className="mb-8 text-base text-slate-600 dark:text-zinc-300">{project.description}</p>

        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            <span>Progress</span>
            <span>{project.progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-800/60">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Deliverables
          </div>
          <ul className="space-y-3 text-sm text-slate-700 dark:text-zinc-200">
            {project.tasks.map((task: string) => (
              <li key={task} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {task}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
