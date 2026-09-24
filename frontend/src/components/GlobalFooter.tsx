export default function GlobalFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-[80] border-t border-slate-200/80 bg-white/95 px-4 py-2 text-[10px] font-semibold text-slate-500 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-400">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1 max-w-[1600px] mx-auto">
        {/* Left: Dev credit */}
        <span className="shrink-0 flex items-center gap-1">
          <span className="text-slate-400 dark:text-zinc-500">Contact Dev:</span>
          <a
            href="https://wa.me/919502901416"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors"
          >
            Varshith Rallabandi
          </a>
        </span>

        {/* Center: Copyright */}
        <span className="shrink-0">
          A SERPHawk&apos;s Product &copy; {new Date().getFullYear()}
        </span>

        {/* Right: Contact links */}
        <span className="shrink-0 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-right">
          <span className="text-slate-400 dark:text-zinc-500">Contact Relation Manager:</span>
          <a
            href="https://wa.me/917348947492"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors"
          >
            V K Anjali
          </a>
          <span className="text-slate-300 dark:text-zinc-700">|</span>
          <span className="text-slate-400 dark:text-zinc-500">Contact Admin:</span>
          <a
            href="https://wa.me/919066003330"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            Gaurav Mehta
          </a>
          <span className="text-slate-300 dark:text-zinc-600">&amp;</span>
          <a
            href="https://wa.me/919538920004"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            Brajesh Kumar
          </a>
        </span>
      </div>
    </footer>
  );
}
