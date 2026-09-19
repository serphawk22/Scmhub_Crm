"use client";
import { useState } from "react";
import { Shield, Plus, Edit2, Trash2, Check, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function RolesPage() {
  const { t } = useLanguage();
  const [roles, setRoles] = useState([
    { id: 1, name: "Admin", description: "Full access to all modules and settings.", users: 2 },
    { id: 2, name: "SalesManager", description: "Access to leads, clients, quotes, and reports.", users: 5 },
    { id: 3, name: "Employee", description: "Access to assigned projects and tasks.", users: 12 },
    { id: 4, name: "Client", description: "Limited access to own project portal and invoices.", users: 48 },
  ]);

  return (
    <div className="p-6 bg-slate-50 dark:bg-zinc-950 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            {t("roles.title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{t("roles.subtitle")}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> {t("roles.add_role")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(role => (
          <div key={role.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-100">{role.name}</h3>
              <div className="flex items-center gap-1">
                <button className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4 h-10">{role.description}</p>
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-zinc-800">
              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg">{role.users} {t("roles.users")}</span>
              <button className="text-xs font-semibold text-blue-500 hover:text-blue-600">{t("roles.view_permissions")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
