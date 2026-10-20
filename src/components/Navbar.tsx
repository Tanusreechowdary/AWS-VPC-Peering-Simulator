import React from 'react';
import {
  Network,
  Terminal,
  Code2,
  Cloud,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const navItems = [
    { id: 'topology', label: 'Topology & Simulator', icon: Network },
    { id: 'terminal', label: 'Terminal Sandbox', icon: Terminal },
    { id: 'code', label: 'Console & Terraform', icon: Code2 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding (No EWB branding) */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 shadow-sm text-white font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">
                  AWS Cloud Networking
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                  Active Lab
                </span>
              </div>
              <h1 className="text-base font-bold text-slate-900 flex items-center space-x-1.5">
                <span>AWS VPC Peering Simulator</span>
              </h1>
            </div>
          </div>

          {/* Clean Subtitle info */}
          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>VPC A: 10.10.0.0/16</span>
            <span className="text-slate-300">•</span>
            <span>VPC B: 10.20.0.0/16</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-200/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-cyan-600 text-white font-bold shadow-sm shadow-cyan-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
