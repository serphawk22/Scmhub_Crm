import { createRoot } from "react-dom/client";
import { API_BASE_URL } from "@/config";

export interface EmailConfirmRequest {
  to?: string[] | string | null;
  subject?: string | null;
  note?: string;
}

// ─── Detection: which outbound requests trigger an email ─────────────────────
function parseBody(config?: RequestInit): Record<string, any> {
  try {
    if (config?.body && typeof config.body === "string") {
      return JSON.parse(config.body);
    }
  } catch {}
  return {};
}

function hasConfirmedHeader(config?: RequestInit): boolean {
  const headers = (config?.headers || {}) as Record<string, string>;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "x-email-confirmed" && String(v) === "1") return true;
  }
  return false;
}

export function emailTriggerInfo(
  resource: string | Request,
  config?: RequestInit
): EmailConfirmRequest | null {
  if (hasConfirmedHeader(config)) return null;
  let url = "";
  if (typeof resource === "string") url = resource;
  else if (resource instanceof Request) url = resource.url;
  url = url.replace(API_BASE_URL, "");
  const path = url.split("?")[0];
  const method = (config?.method || "GET").toUpperCase();
  const body = parseBody(config);

  const nim = (v: any) => (v === null || v === undefined ? null : String(v).trim() || null);

  let to: EmailConfirmRequest["to"] = null;
  let subject: EmailConfirmRequest["subject"] = null;
  let note: EmailConfirmRequest["note"];

  if (method === "POST" && path === "/send-manual") {
    if (body.skip_send) return null;
    to = nim(body.to_email);
    subject = nim(body.subject);
    note = "Manually send this email from the Email Agent.";
  } else if (method === "POST" && path === "/generate") {
    if (body.manual === true) return null;
    to = nim(body.to_email);
    subject = nim(body.subject);
    note = "Send the generated AI email.";
  } else if (method === "POST" && path === "/auth/forgot-password") {
    to = nim(body.email);
    subject = null;
    note = "Send the password-reset link to this email.";
  } else if (method === "POST" && path === "/scheduled-calls") {
    if (!body.entity_email) return null;
    to = nim(body.entity_email);
    note = "Notify the contact about the scheduled call.";
  } else if (method === "POST" && path === "/invoices") {
    if (!body.client_id && !body.lead_id && !body.contact_id) return null;
    note = "Send this invoice to the linked client/lead.";
  } else if (method === "PUT" && /^\/invoices\/\d+$/.test(path)) {
    if (body.status !== "Sent") return null;
    note = "Marking this invoice as Sent emails it to the linked client.";
  } else if (method === "PUT" && /^\/milestones\/\d+$/.test(path)) {
    if (body.status !== "Achieved") return null;
    note = "Marking this milestone Achieved emails the linked client.";
  } else if (method === "PUT" && /^\/proposals\/\d+$/.test(path)) {
    if (body.status !== "Sent") return null;
    note = "Marking this proposal as Sent emails it to the linked client.";
  } else if (method === "POST" && path === "/proposals") {
    if (body.status !== "Sent") return null;
    note = "Create & send this proposal to the linked client.";
  } else if (method === "POST" && path === "/meetings") {
    const attrs =
      typeof body.attendees === "string"
        ? body.attendees.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean)
        : Array.isArray(body.attendees)
          ? body.attendees.filter(Boolean)
          : [];
    const linked = body.client_id || body.lead_id || body.contact_id;
    if (attrs.length === 0 && !linked) return null;
    to = attrs;
    note = "Send meeting invites to the attendees / linked client or lead.";
  } else if (method === "POST" && path === "/quotes") {
    if (body.send_email !== true) return null;
    note = "Send this quote to the linked client/lead.";
  } else if (method === "POST" && /^\/quotes\/\d+\/send-email$/.test(path)) {
    to = null;
    subject = nim(body.subject);
    note = "Send the quote by email to the linked client/lead.";
  } else if (method === "POST" && /(sales-orders|purchase-orders|inventory|products)\/export-pdf$/.test(path)) {
    if (!body.email) return null;
    to = nim(body.email);
    note = "Export the document as PDF and email it.";
  } else if (method === "POST" && /^\/inventory\/suppliers\/\d+\/send-credentials$/.test(path)) {
    note = "Send portal login credentials to the supplier.";
  } else if (method === "POST" && path === "/email-otp/send") {
    to = nim(body.email);
    note = "Send a one-time passcode to this email.";
  } else {
    return null;
  }

  return { to, subject, note };
}

// ─── Global confirmation modal ───────────────────────────────────────────────
let hostEl: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function ensureHost() {
  if (typeof window === "undefined") return null;
  if (!hostEl) {
    hostEl = document.createElement("div");
    hostEl.id = "email-confirm-host";
    document.body.appendChild(hostEl);
    root = createRoot(hostEl);
  }
  return root;
}

function renderModal(req: EmailConfirmRequest) {
  const r = ensureHost();
  if (!r) return;
  r.render(<ConfirmModal req={req} />);
}

function closeModal() {
  if (root) root.render(null);
}

function ConfirmModal({ req }: { req: EmailConfirmRequest }) {
  const toList = Array.isArray(req.to) ? req.to : req.to ? [req.to] : [];
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => resolveConfirm(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-zinc-700"
      >
        <div className="p-6 border-b border-slate-200 dark:border-zinc-700 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Confirm sending email</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">An email is about to be sent.</p>
          </div>
        </div>
        <div className="p-6 space-y-3">
          {toList.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">To</p>
              <ul className="space-y-1">
                {toList.map((e, i) => (
                  <li key={i} className="text-sm font-medium text-slate-900 dark:text-zinc-100 break-all">{e}</li>
                ))}
              </ul>
            </div>
          )}
          {req.subject && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Subject</p>
              <p className="text-sm text-slate-700 dark:text-zinc-300">{req.subject}</p>
            </div>
          )}
          {req.note && <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">{req.note}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40">
          <button onClick={() => resolveConfirm(false)}
            className="flex-1 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all">
            Cancel
          </button>
          <button onClick={() => resolveConfirm(true)}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-sm hover:opacity-90 transition-all shadow-md">
            Confirm & Send
          </button>
        </div>
      </div>
    </div>
  );
}

let pendingResolver: ((ok: boolean) => void) | null = null;

export function resolveConfirm(ok: boolean) {
  if (pendingResolver) {
    const r = pendingResolver;
    pendingResolver = null;
    closeModal();
    r(ok);
  }
}

export function requestEmailConfirmation(req: EmailConfirmRequest): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  if (pendingResolver) pendingResolver(false); // supersede any older pending prompt
  renderModal(req);
  return new Promise<boolean>((resolve) => {
    pendingResolver = resolve;
  });
}