import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { NetworkTopology } from './components/NetworkTopology';
import { InteractiveTerminal } from './components/InteractiveTerminal';
import { TerraformAndCli } from './components/TerraformAndCli';
import {
  defaultInstances,
  defaultPeering,
  defaultRouteTables,
  defaultSecurityGroups,
} from './data/defaultLabState';
import {
  InstanceConfig,
  PeeringConnectionConfig,
  RouteTableConfig,
  SecurityGroupConfig,
} from './types/lab';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('topology');
  const [instances] = useState<InstanceConfig[]>(defaultInstances);
  const [peering, setPeering] = useState<PeeringConnectionConfig>(defaultPeering);
  const [routeTables, setRouteTables] = useState<RouteTableConfig[]>(defaultRouteTables);
  const [securityGroups, setSecurityGroups] = useState<SecurityGroupConfig[]>(defaultSecurityGroups);

  // Toggle Peering State
  const handleTogglePeering = (active: boolean) => {
    setPeering((prev) => ({
      ...prev,
      status: active ? 'Active' : 'Pending-Acceptance',
    }));
  };

  // Toggle Route active/inactive
  const handleToggleRoute = (rtName: string, dest: string) => {
    setRouteTables((prev) =>
      prev.map((rt) => {
        if (rt.name !== rtName) return rt;
        return {
          ...rt,
          routes: rt.routes.map((r) => {
            if (r.destination !== dest) return r;
            return { ...r, active: !r.active };
          }),
        };
      })
    );
  };

  // Toggle Security Group Rule
  const handleToggleSecurityRule = (sgName: string, ruleId: string) => {
    setSecurityGroups((prev) =>
      prev.map((sg) => {
        if (sg.name !== sgName) return sg;
        return {
          ...sg,
          inboundRules: sg.inboundRules.map((rule) => {
            if (rule.id !== ruleId) return rule;
            return { ...rule, enabled: !rule.enabled };
          }),
        };
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'topology' && (
          <NetworkTopology
            instances={instances}
            peering={peering}
            routeTables={routeTables}
            securityGroups={securityGroups}
            onTogglePeering={handleTogglePeering}
            onToggleRoute={handleToggleRoute}
            onToggleSecurityRule={handleToggleSecurityRule}
          />
        )}

        {activeTab === 'terminal' && (
          <InteractiveTerminal
            instances={instances}
            peering={peering}
            routeTables={routeTables}
            securityGroups={securityGroups}
          />
        )}

        {activeTab === 'code' && <TerraformAndCli />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/80 py-4 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium text-slate-700">
            AWS VPC Peering Simulator
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            CIDR Plan: VPC A (10.10.0.0/16) &amp; VPC B (10.20.0.0/16) • Non-overlapping
          </span>
        </div>
      </footer>
    </div>
  );
}
