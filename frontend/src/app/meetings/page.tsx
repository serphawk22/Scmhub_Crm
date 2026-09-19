"use client";

import { useMemo, useState } from "react";
import { Calendar, Clock3, Filter, MapPin, Plus, Search, Users, Video, CheckCircle2 } from "lucide-react";

const meetingsSeed = [
  {
    id: 1,
    title: "Weekly growth sync",
    type: "Meeting",
    status: "Scheduled",
    date: "2026-09-22T10:00:00",
    duration: 45,
    location: "Zoom",
    attendees: ["Alicia", "Nina", "Chris"],
  },
  {
    id: 2,
    title: "SEO demo review",
    type: "Demo",
    status: "Completed",
    date: "2026-09-18T15:30:00",
    duration: 60,
    location: "HQ Boardroom",
    attendees: ["Alicia", "Client Team"],
  },
  {
    id: 3,
    title: "Discovery call",
    type: "Discovery",
    status: "Scheduled",
    date: "2026-09-24T13:00:00",
    duration: 30,
    location: "Phone",
    attendees: ["Nina", "Prospect"],
  },
];

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState(meetingsSeed);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "Meeting",
    status: "Scheduled",
    date: "",
    duration: 30,
    location: "",
    attendees: "",
  });

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      const matchesStatus = status === "All" || meeting.status === status;
      const haystack = `${meeting.title} ${meeting.location} ${meeting.attendees.join(" ")}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      return matchesStatus && matchesQuery;
    });
  }, [meetings, query, status]);

  const handleCreate = () => {
    if (!form.title.trim()) return;
    setMeetings((current) => [
      {
        id: Date.now(),
        title: form.title,
        type: form.type,
        status: form.status,
        date: form.date || new Date().toISOString(),
        duration: Number(form.duration),
        location: form.location || "TBD",
        attendees: form.attendees ? form.attendees.split(",").map((item) => item.trim()).filter(Boolean) : [],
      },
      ...current,
    ]);
    setForm({ title: "", type: "Meeting", status: "Scheduled", date: "", duration: 30, location: "", attendees: "" });
    setShowModal(false);
  };

  const stats = [
    { label: "Total", value: meetings.length, color: "text-indigo-600 bg-indigo-500/10" },
    { label: "Scheduled", value: meetings.filter((m) => m.status === "Scheduled").length, color: "text-blue-600 bg-blue-500/10" },
    { label: "Completed", value: meetings.filter((m) => m.status === "Completed").length, color: "text-emerald-600 bg-emerald-500/10" },
    { label: "This week", value: meetings.filter((m) => new Date(m.date).getTime() > Date.now() - 7 * 86400000).length, color: "text-violet-600 bg-violet-500/10" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-500">Meetings</p>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">Activity calendar</h1>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Schedule meeting
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className={`inline-flex rounded-xl px-2.5 py-2 text-xs font-bold ${stat.color}`}>{stat.label}</div>
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
                placeholder="Search meetings"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              {['All', 'Scheduled', 'Completed'].map((value) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${status === value ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredMeetings.map((meeting) => (
            <div key={meeting.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                  {meeting.type === "Demo" ? <Video className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                </div>
                <div className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${meeting.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'}`}>
                  {meeting.status}
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">{meeting.title}</h2>
              </div>

              <div className="space-y-2 text-sm text-slate-600 dark:text-zinc-300">
                <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" /> {new Date(meeting.date).toLocaleString()}</div>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {meeting.location}</div>
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /> {meeting.attendees.join(", ")}</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-slate-400" /> {meeting.type} • {meeting.duration} min</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">New meeting</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Schedule an activity</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500 dark:bg-zinc-800 dark:text-zinc-300">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Quarterly strategy session"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option>Meeting</option>
                    <option>Demo</option>
                    <option>Discovery</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option>Scheduled</option>
                    <option>Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Date</label>
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Duration</label>
                  <input
                    type="number"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 30 })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Zoom / office / phone"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Attendees</label>
                <input
                  value={form.attendees}
                  onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Alicia, Nina, Client Team"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-zinc-700 dark:text-zinc-200">Cancel</button>
              <button onClick={handleCreate} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
