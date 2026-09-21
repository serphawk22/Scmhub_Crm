"use client";

import { Search, Bell, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useRole, Role } from "@/context/RoleContext";

interface HeaderProps {
  currentRole: Role;
  setRole: (role: Role) => void;
}

export function Header({ currentRole, setRole }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { email } = useRole();

  const getProfile = () => {
    switch (currentRole) {
      case 'Admin': return { name: 'John Admin', role: 'Admin', img: 'https://ui-avatars.com/api/?name=John+Admin&background=random' };
      case 'Employee': return { name: 'Sarah Employee', role: 'Employee', img: 'https://ui-avatars.com/api/?name=Sarah+Emp&background=random' };
      case 'Client': return { name: 'Mike Client', role: 'Client', img: 'https://ui-avatars.com/api/?name=Mike+Client&background=random' };
      case 'Intern': return { name: 'Alex Intern', role: 'Intern', img: 'https://ui-avatars.com/api/?name=Alex+Intern&background=random' };
    }
  };

  const profile = getProfile();

  return (
    <header className="h-20 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 fixed top-0 right-0 left-64 z-10 px-8">
      <div className="h-full flex items-center justify-between">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
            {(['Admin', 'Employee', 'Client', 'Intern'] as Role[]).map((role) => (
              <button
                key={role}
                onClick={() => setRole(role)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${currentRole === role
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:text-zinc-50'
                  }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-gray-200" />

          <button className="relative p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:bg-zinc-950 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>

          <div className="flex items-center gap-3 pl-2 border-l border-gray-200 dark:border-zinc-700">
            <div className="text-right hidden sm:block">
              <span className="text-sm font-bold text-gray-900 dark:text-zinc-50 text-right block w-48">
                {email || 'Guest'}
              </span>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">{currentRole}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">
              {(email && email[0]) ? email[0].toUpperCase() : 'G'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
