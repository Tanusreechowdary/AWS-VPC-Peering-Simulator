import React, { useState } from 'react';
import {
  Server,
  Shield,
  Layers,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Info,
  Globe,
  Terminal,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  InstanceConfig,
  PeeringConnectionConfig,
  RouteTableConfig,
  SecurityGroupConfig,
} from '../types/lab';

interface NetworkTopologyProps {
  instances: InstanceConfig[];
  peering: PeeringConnectionConfig;
  routeTables: RouteTableConfig[];
  securityGroups: SecurityGroupConfig[];
  onTogglePeering: (active: boolean) => void;
  onToggleRoute: (rtName: string, dest: string) => void;
  onToggleSecurityRule: (sgName: string, ruleId: string) => void;
  onRunTestLog?: (testType: string, status: 'success' | 'failure', log: string) => void;
}

export type SimMode =
  | 'idle'
  | 'baseline-ping'
  | 'forward-ping'
  | 'reverse-ping'
  | 'ssh-proxyjump'
  | 'controlled-failure';

interface HopStep {
  step: number;
  from: string;
  to: string;
  component: string;
  action: string;
  passed: boolean;
  reason: string;
}

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({
  instances,
  peering,
  routeTables,
  securityGroups,
  onTogglePeering,
  onToggleRoute,
  onToggleSecurityRule,
  onRunTestLog,
}) => {
  const [selectedEntity, setSelectedEntity] = useState<string | null>('vpc-peering-a-b');
  const [simMode, setSimMode] = useState<SimMode>('idle');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simHops, setSimHops] = useState<HopStep[]>([]);
  const [simOutcome, setSimOutcome] = useState<{
    success: boolean;
    title: string;
    description: string;
  } | null>(null);

  // Derived state helpers
  const isPeeringActive = peering.status === 'Active';
  const rtAPriv = routeTables.find((r) => r.name === 'rt-a-private');
  const hasRouteAPrivateToB =
    rtAPriv?.routes.some((r) => r.destination === '10.20.0.0/16' && r.active) ?? false;

  const rtBPriv = routeTables.find((r) => r.name === 'rt-b-private');
  const hasRouteBPrivateToA =
    rtBPriv?.routes.some((r) => r.destination === '10.10.0.0/16' && r.active) ?? false;

  const rtAPub = routeTables.find((r) => r.name === 'rt-a-public');
  const hasRouteAPublicToB =
    rtAPub?.routes.some((r) => r.destination === '10.20.0.0/16' && r.active) ?? false;

  const sgAppB = securityGroups.find((s) => s.name === 'sg-app-b');
  const hasAppBIcmpRule =
    sgAppB?.inboundRules.some((r) => r.id === 'rule-app-b-icmp' && r.enabled) ?? false;
  const hasAppBSshRule =
    sgAppB?.inboundRules.some((r) => r.id === 'rule-app-b-ssh' && r.enabled) ?? false;

  const sgAppA = securityGroups.find((s) => s.name === 'sg-app-a');
  const hasAppAIcmpRule =
    sgAppA?.inboundRules.some((r) => r.id === 'rule-app-a-icmp' && r.enabled) ?? false;

  const bastionHost = instances.find((i) => i.name === 'bastion-host')!;
  const appAHost = instances.find((i) => i.name === 'app-a')!;
  const appBHost = instances.find((i) => i.name === 'app-b')!;

  // Simulation runner
  const startSimulation = (mode: SimMode) => {
    setSimMode(mode);
    setIsSimulating(true);
    setActiveStepIndex(0);
    setSimOutcome(null);

    let hops: HopStep[] = [];

    if (mode === 'baseline-ping') {
      const canRouteOut = hasRouteAPrivateToB && isPeeringActive;
      hops = [
        {
          step: 1,
          from: 'app-a (10.10.2.10)',
          to: 'rt-a-private',
          component: 'Route Table A Private',
          action: 'Kernel looks up destination 10.20.1.10 in VPC A route table',
          passed: canRouteOut,
          reason: canRouteOut
            ? 'Matched 10.20.0.0/16 -> pcx target.'
            : 'NO ROUTE for 10.20.0.0/16! Baseline condition met: packet dropped.',
        },
      ];
      if (canRouteOut) {
        hops.push({
          step: 2,
          from: 'rt-a-private',
          to: 'vpc-peering-a-b',
          component: 'VPC Peering Connection',
          action: 'Transmits packet across AWS VPC peering backbone',
          passed: isPeeringActive,
          reason: isPeeringActive ? 'Peering status Active' : 'Peering connection not active',
        });
      }
    } else if (mode === 'forward-ping' || mode === 'controlled-failure') {
      const s1 = hasRouteAPrivateToB;
      const s2 = isPeeringActive;
      const s3 = hasAppBIcmpRule;
      const s4 = hasRouteBPrivateToA;

      hops = [
        {
          step: 1,
          from: 'app-a (10.10.2.10)',
          to: 'rt-a-private',
          component: 'Route Table A Private',
          action: 'Lookup destination CIDR 10.20.1.10 in VPC A Private Route Table',
          passed: s1,
          reason: s1
            ? 'Matched 10.20.0.0/16 -> Target: pcx-0f81d45c8290e21b4'
            : 'DROPPED: No route for 10.20.0.0/16 in rt-a-private!',
        },
        {
          step: 2,
          from: 'rt-a-private',
          to: 'vpc-peering-a-b',
          component: 'VPC Peering (pcx)',
          action: 'Forward packet across VPC Peering connection',
          passed: s1 && s2,
          reason: s2
            ? 'Peering status: ACTIVE. Packet bridged to VPC B.'
            : 'DROPPED: Peering connection is not active!',
        },
        {
          step: 3,
          from: 'vpc-peering-a-b',
          to: 'sg-app-b',
          component: 'Security Group sg-app-b',
          action: 'Inbound evaluation: ICMP Type 8 Code 0 from 10.10.2.10/32',
          passed: s1 && s2 && s3,
          reason: s3
            ? 'ALLOWED: Inbound ICMP Echo Request permitted from 10.10.2.10/32.'
            : 'FIREWALL DROP: Inbound ICMP rule missing! (Controlled Failure simulation)',
        },
        {
          step: 4,
          from: 'app-b (10.20.1.10)',
          to: 'rt-b-private',
          component: 'Return Route Table B Private',
          action: 'app-b generates ICMP Echo Reply to 10.10.2.10. Looks up return route.',
          passed: s1 && s2 && s3 && s4,
          reason: s4
            ? 'RETURN ROUTE FOUND: 10.10.0.0/16 -> Target: pcx-0f81d45c8290e21b4'
            : 'RETURN PATH DROP: VPC B Private Route Table lacks route for 10.10.0.0/16!',
        },
        {
          step: 5,
          from: 'rt-b-private',
          to: 'app-a (10.10.2.10)',
          component: 'app-a Ingress (Stateful Reply)',
          action: 'Echo reply arrives back at app-a (Security Group stateful match)',
          passed: s1 && s2 && s3 && s4,
          reason: 'SUCCESS: Stateful firewall allows return reply automatically. 0% packet loss.',
        },
      ];
    } else if (mode === 'reverse-ping') {
      const s1 = hasRouteBPrivateToA;
      const s2 = isPeeringActive;
      const s3 = hasAppAIcmpRule;
      const s4 = hasRouteAPrivateToB;

      hops = [
        {
          step: 1,
          from: 'app-b (10.20.1.10)',
          to: 'rt-b-private',
          component: 'Route Table B Private',
          action: 'Lookup destination 10.10.2.10 in VPC B Route Table',
          passed: s1,
          reason: s1
            ? 'Matched 10.10.0.0/16 -> Target: pcx-0f81d45c8290e21b4'
            : 'DROPPED: Route missing for 10.10.0.0/16!',
        },
        {
          step: 2,
          from: 'rt-b-private',
          to: 'vpc-peering-a-b',
          component: 'VPC Peering (pcx)',
          action: 'Forward across peering link to VPC A',
          passed: s1 && s2,
          reason: s2 ? 'Peering status: ACTIVE' : 'Peering inactive',
        },
        {
          step: 3,
          from: 'vpc-peering-a-b',
          to: 'sg-app-a',
          component: 'Security Group sg-app-a',
          action: 'Inbound evaluation: ICMP Echo Request from 10.20.1.10/32',
          passed: s1 && s2 && s3,
          reason: s3
            ? 'ALLOWED: Inbound ICMP Echo Request permitted from 10.20.1.10/32.'
            : 'FIREWALL DROP: Inbound ICMP rule missing on sg-app-a!',
        },
        {
          step: 4,
          from: 'app-a (10.10.2.10)',
          to: 'app-b (10.20.1.10)',
          component: 'Return Route & Stateful Arrival',
          action: 'Echo reply traverses rt-a-private return route back to app-b',
          passed: s1 && s2 && s3 && s4,
          reason: s4
            ? 'SUCCESS: Two-way path verified. 4 packets transmitted, 4 received, 0% packet loss.'
            : 'RETURN ROUTE MISSING in VPC A Private RT!',
        },
      ];
    } else if (mode === 'ssh-proxyjump') {
      const s1 = true;
      const s2 = hasRouteAPublicToB;
      const s3 = isPeeringActive;
      const s4 = hasAppBSshRule;

      hops = [
        {
          step: 1,
          from: 'Laptop (157.48.210.42)',
          to: 'Bastion Public IP (13.235.148.82:22)',
          component: 'Internet Gateway (igw-a)',
          action: 'SSH connection initiated over internet to Bastion public IPv4',
          passed: s1,
          reason: 'CONNECTED: sg-bastion permits port 22 from admin /32 IP.',
        },
        {
          step: 2,
          from: 'Bastion (10.10.1.10)',
          to: 'rt-a-public',
          component: 'Public Route Table (rt-a-public)',
          action: 'Bastion ProxyJump opens 2nd socket to 10.20.1.10. Checks route table.',
          passed: s2,
          reason: s2
            ? 'MATCHED PEERING ROUTE: 10.20.0.0/16 -> pcx'
            : 'DROPPED: rt-a-public lacks 10.20.0.0/16 route!',
        },
        {
          step: 3,
          from: 'rt-a-public',
          to: 'vpc-peering-a-b',
          component: 'VPC Peering (pcx)',
          action: 'TCP SYN packet crosses peering conduit into VPC B',
          passed: s2 && s3,
          reason: s3 ? 'Peering Active' : 'Peering inactive',
        },
        {
          step: 4,
          from: 'vpc-peering-a-b',
          to: 'sg-app-b',
          component: 'Security Group sg-app-b',
          action: 'app-b evaluates inbound TCP port 22 from source IP 10.10.1.10',
          passed: s2 && s3 && s4,
          reason: s4
            ? 'AUTHENTICATED: Inbound TCP 22 permitted from 10.10.1.10/32. Shell open!'
            : 'FIREWALL REJECT: app-b SG does not allow SSH from 10.10.1.10/32!',
        },
      ];
    }

    setSimHops(hops);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < hops.length) {
        setActiveStepIndex(step);
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        const allPassed = hops.every((h) => h.passed);

        if (mode === 'baseline-ping') {
          setSimOutcome({
            success: !allPassed,
            title: !allPassed ? 'Baseline Isolation Verified' : 'Baseline Test Failed',
            description: !allPassed
              ? 'app-a ping to 10.20.1.10 yielded 100% packet loss as expected before peering was configured. Isolation proven.'
              : 'Packets reached destination unexpectedly.',
          });
        } else if (mode === 'controlled-failure') {
          setSimOutcome({
            success: !hops.find((h) => h.step === 3)?.passed,
            title: 'Controlled Failure Verified',
            description:
              'With the ICMP Echo rule removed on sg-app-b, pings from app-a are cleanly dropped by the AWS stateful firewall. Restoring the rule will re-enable flow.',
          });
        } else {
          setSimOutcome({
            success: allPassed,
            title: allPassed ? 'Network Verification Succeeded' : 'Packet Drop Detected',
            description: allPassed
              ? 'All route tables, peering links, and security groups properly permitted bi-directional traffic.'
              : `Packet dropped at step ${hops.findIndex((h) => !h.passed) + 1}: ${hops.find((h) => !h.passed)?.reason}`,
          });
        }

        if (onRunTestLog) {
          onRunTestLog(
            mode,
            allPassed ? 'success' : 'failure',
            hops.map((h) => `[Step ${h.step}] ${h.action} -> ${h.passed ? 'OK' : 'FAIL'}`).join('\n')
          );
        }
      }
    }, 700);
  };

  const resetSimulation = () => {
    setSimMode('idle');
    setActiveStepIndex(-1);
    setIsSimulating(false);
    setSimHops([]);
    setSimOutcome(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Simulator Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
                Live Dynamic Packet Tracer
              </span>
              <span className="text-xs text-slate-500 font-medium">AWS ap-south-1 (Mumbai)</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              VPC Peering Architecture &amp; Packet Flow
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Simulates packet routing from client laptop through the public bastion to private
              application workloads across VPC A (10.10.0.0/16) and VPC B (10.20.0.0/16).
            </p>
          </div>

          {/* Quick Simulation Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => startSimulation('forward-ping')}
              disabled={isSimulating}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm"
              title="Test ping from app-a to app-b"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Forward Ping</span>
            </button>

            <button
              onClick={() => startSimulation('reverse-ping')}
              disabled={isSimulating}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm"
              title="Test ping from app-b to app-a"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Reverse Ping</span>
            </button>

            <button
              onClick={() => startSimulation('ssh-proxyjump')}
              disabled={isSimulating}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm"
              title="Test SSH to app-b via ProxyJump"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>SSH ProxyJump</span>
            </button>

            <button
              onClick={() => startSimulation('baseline-ping')}
              disabled={isSimulating}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition disabled:opacity-50 cursor-pointer border border-slate-300"
              title="Test pre-peering baseline ping failure"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Baseline Test</span>
            </button>

            <button
              onClick={() => {
                if (hasAppBIcmpRule) {
                  onToggleSecurityRule('sg-app-b', 'rule-app-b-icmp');
                }
                startSimulation('controlled-failure');
              }}
              disabled={isSimulating}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              title="Run Controlled Failure / Chaos experiment"
            >
              <Zap className="w-3.5 h-3.5 text-rose-600" />
              <span>Controlled Failure</span>
            </button>

            {simMode !== 'idle' && (
              <button
                onClick={resetSimulation}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs transition cursor-pointer"
                title="Reset simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Simulation Status Banner */}
        {simMode !== 'idle' && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-3 w-3">
                  {isSimulating ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-600"></span>
                    </>
                  ) : (
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 ${
                        simOutcome?.success ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    ></span>
                  )}
                </span>
                <span className="text-xs font-bold text-slate-900 capitalize">
                  {simMode.replace('-', ' ')} Simulation:
                </span>
                <span className="text-xs text-slate-700">
                  {isSimulating
                    ? `Tracing Hop ${activeStepIndex + 1} of ${simHops.length}...`
                    : simOutcome?.title}
                </span>
              </div>

              {simOutcome && (
                <div
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                    simOutcome.success
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                      : 'bg-rose-50 border border-rose-300 text-rose-800'
                  }`}
                >
                  {simOutcome.description}
                </div>
              )}
            </div>

            {/* Stepper bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-3">
              {simHops.map((hop, index) => {
                const isCurrent = activeStepIndex === index;
                const isDone = activeStepIndex > index || (!isSimulating && activeStepIndex >= 0);
                return (
                  <div
                    key={index}
                    className={`p-2 rounded-lg border text-xs transition-all ${
                      isCurrent
                        ? 'border-cyan-600 bg-cyan-50/70 text-cyan-900 ring-2 ring-cyan-500/30'
                        : isDone
                        ? hop.passed
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : 'border-rose-300 bg-rose-50 text-rose-900'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500">
                        Step {hop.step}
                      </span>
                      {isDone &&
                        (hop.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        ))}
                    </div>
                    <p className="font-semibold text-slate-900 truncate">{hop.component}</p>
                    <p className="text-[10px] text-slate-600 line-clamp-2 mt-0.5">{hop.reason}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Visual Architecture Canvas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Topology Diagram */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-6 relative overflow-hidden shadow-sm">
          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(#0284c7 1px, transparent 1px), radial-gradient(#0284c7 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0, 12px 12px',
            }}
          />

          {/* External Laptop Node (Top Left) */}
          <div className="mb-6 flex items-center justify-between">
            <div
              onClick={() => setSelectedEntity('laptop')}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl border bg-white shadow-sm cursor-pointer transition ${
                selectedEntity === 'laptop'
                  ? 'border-cyan-600 ring-2 ring-cyan-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-cyan-700">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <span>Your Laptop (OpenSSH Client)</span>
                  <span className="px-1.5 py-0.2 text-[9px] bg-slate-100 rounded text-slate-600 font-semibold border border-slate-200">
                    Client
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  ~/.ssh/config • ProxyJump configured
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 animate-pulse"></span>
              <span>Click any component to inspect AWS settings &amp; CLI</span>
            </div>
          </div>

          {/* VPC A & VPC B Container Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* =========================================================================
                VPC A: 10.10.0.0/16
            ========================================================================= */}
            <div
              className={`rounded-2xl border p-5 transition relative ${
                selectedEntity === 'vpc-a'
                  ? 'border-cyan-500 bg-cyan-50/80 ring-2 ring-cyan-400/30'
                  : 'border-cyan-300 bg-sky-50/60'
              }`}
            >
              {/* VPC A Header */}
              <div className="flex items-center justify-between pb-3 border-b border-cyan-200 mb-4">
                <div
                  onClick={() => setSelectedEntity('vpc-a')}
                  className="cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-cyan-700" />
                    <span className="text-sm font-bold text-slate-900">VPC A (vpc-a)</span>
                  </div>
                  <div className="text-xs font-mono text-cyan-800 font-bold mt-0.5">10.10.0.0/16</div>
                </div>

                {/* Internet Gateway Badge */}
                <div
                  onClick={() => setSelectedEntity('igw-a')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-[11px] cursor-pointer transition ${
                    selectedEntity === 'igw-a'
                      ? 'border-cyan-500 bg-cyan-100 text-cyan-900 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-600" />
                  <span className="font-semibold">igw-a</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Public Subnet A */}
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selectedEntity === 'subnet-a-public'
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span
                      onClick={() => setSelectedEntity('subnet-a-public')}
                      className="font-bold text-cyan-800 cursor-pointer hover:underline"
                    >
                      Public Subnet A (10.10.1.0/24)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
                      IGW Route Active
                    </span>
                  </div>

                  {/* Bastion Host Card */}
                  <div
                    onClick={() => setSelectedEntity('bastion-host')}
                    className={`rounded-lg border p-3 cursor-pointer transition ${
                      selectedEntity === 'bastion-host'
                        ? 'border-cyan-600 bg-cyan-50/50 ring-1 ring-cyan-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded bg-cyan-100 border border-cyan-300 flex items-center justify-center text-cyan-700">
                          <Server className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">bastion-host</div>
                          <div className="text-[10px] text-slate-600 font-mono">
                            Priv: {bastionHost.privateIp} • Pub: {bastionHost.publicIp}
                          </div>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Running"></span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
                      <span>SG: sg-bastion</span>
                      <span className="text-cyan-800 font-mono font-semibold">SSH / 22 from Admin IP</span>
                    </div>
                  </div>
                </div>

                {/* Private Subnet A */}
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selectedEntity === 'subnet-a-private'
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span
                      onClick={() => setSelectedEntity('subnet-a-private')}
                      className="font-bold text-blue-800 cursor-pointer hover:underline"
                    >
                      Private Subnet A (10.10.2.0/24)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      No Public IP
                    </span>
                  </div>

                  {/* app-a Card */}
                  <div
                    onClick={() => setSelectedEntity('app-a')}
                    className={`rounded-lg border p-3 cursor-pointer transition ${
                      selectedEntity === 'app-a'
                        ? 'border-cyan-600 bg-cyan-50/50 ring-1 ring-cyan-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700">
                          <Server className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">app-a</div>
                          <div className="text-[10px] text-slate-600 font-mono">
                            Priv: {appAHost.privateIp} (Private Workload)
                          </div>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Running"></span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
                      <span>SG: sg-app-a</span>
                      <span className="text-emerald-700 font-mono font-semibold">
                        SSH (Bastion) + ICMP (app-b)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Route Table Status Indicator */}
              <div
                onClick={() => setSelectedEntity('rt-a-private')}
                className="mt-4 p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs cursor-pointer hover:border-slate-300 shadow-xs"
              >
                <div className="flex items-center space-x-2">
                  <Shield className="w-3.5 h-3.5 text-cyan-700" />
                  <span className="text-slate-700 font-medium">RT A Private Route to VPC B:</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    hasRouteAPrivateToB
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {hasRouteAPrivateToB ? '10.20.0.0/16 -> pcx' : 'Missing'}
                </span>
              </div>
            </div>

            {/* =========================================================================
                VPC B: 10.20.0.0/16
            ========================================================================= */}
            <div
              className={`rounded-2xl border p-5 transition relative ${
                selectedEntity === 'vpc-b'
                  ? 'border-purple-500 bg-purple-50/80 ring-2 ring-purple-400/30'
                  : 'border-purple-300 bg-purple-50/60'
              }`}
            >
              {/* VPC B Header */}
              <div className="flex items-center justify-between pb-3 border-b border-purple-200 mb-4">
                <div
                  onClick={() => setSelectedEntity('vpc-b')}
                  className="cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-purple-700" />
                    <span className="text-sm font-bold text-slate-900">VPC B (vpc-b)</span>
                  </div>
                  <div className="text-xs font-mono text-purple-800 font-bold mt-0.5">10.20.0.0/16</div>
                </div>

                {/* No IGW Badge */}
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 font-medium">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  <span>No Internet Gateway</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Private Subnet B */}
                <div
                  className={`rounded-xl border p-3.5 transition ${
                    selectedEntity === 'subnet-b-private'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span
                      onClick={() => setSelectedEntity('subnet-b-private')}
                      className="font-bold text-purple-800 cursor-pointer hover:underline"
                    >
                      Private Subnet B (10.20.1.0/24)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      Isolated Workload
                    </span>
                  </div>

                  {/* app-b Card */}
                  <div
                    onClick={() => setSelectedEntity('app-b')}
                    className={`rounded-lg border p-3 cursor-pointer transition ${
                      selectedEntity === 'app-b'
                        ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-700">
                          <Server className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">app-b</div>
                          <div className="text-[10px] text-slate-600 font-mono">
                            Priv: {appBHost.privateIp} (Private Workload)
                          </div>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Running"></span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
                      <span>SG: sg-app-b</span>
                      <span className="text-purple-800 font-mono font-semibold">
                        SSH (Bastion) + ICMP (app-a)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Rules Quick-Toggle for Controlled Failure */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      sg-app-b ICMP Echo (Chaos Test):
                    </span>
                    <button
                      onClick={() => onToggleSecurityRule('sg-app-b', 'rule-app-b-icmp')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                        hasAppBIcmpRule
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                      }`}
                    >
                      {hasAppBIcmpRule ? 'Rule Active (Allowed)' : 'Revoked (Chaos Failure)'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Toggle this rule to run the controlled failure and recovery verification.
                  </p>
                </div>
              </div>

              {/* Route Table Status Indicator (Return Route!) */}
              <div
                onClick={() => setSelectedEntity('rt-b-private')}
                className="mt-4 p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs cursor-pointer hover:border-slate-300 shadow-xs"
              >
                <div className="flex items-center space-x-2">
                  <Shield className="w-3.5 h-3.5 text-purple-700" />
                  <span className="text-slate-700 font-medium">RT B Return Route to VPC A:</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    hasRouteBPrivateToA
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {hasRouteBPrivateToA ? '10.10.0.0/16 -> pcx' : 'Missing! (No replies)'}
                </span>
              </div>
            </div>
          </div>

          {/* Peering Link Centerpiece */}
          <div className="mt-6 flex flex-col items-center">
            <div
              onClick={() => setSelectedEntity('vpc-peering-a-b')}
              className={`w-full max-w-md p-3.5 rounded-xl border flex items-center justify-between shadow-md cursor-pointer transition ${
                selectedEntity === 'vpc-peering-a-b'
                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isPeeringActive
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  pcx
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                    <span>VPC Peering: {peering.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        isPeeringActive
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {peering.status}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">{peering.id}</div>
                </div>
              </div>

              {/* Peering Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePeering(!isPeeringActive);
                }}
                className={`text-[11px] px-2.5 py-1 rounded font-bold border transition cursor-pointer ${
                  isPeeringActive
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isPeeringActive ? 'Active' : 'Activate'}
              </button>
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5">
              Direct private IPv4 routing across AWS infrastructure • Non-transitive
            </div>
          </div>
        </div>

        {/* Right Col: Entity Inspector & Configuration Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-900">Component Inspector</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedEntity || 'None selected'}
              </span>
            </div>

            {selectedEntity === 'vpc-peering-a-b' && (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Resource Name &amp; ID:</span>
                  <span className="font-bold text-slate-900 text-sm">{peering.name}</span>
                  <div className="font-mono text-cyan-700 font-semibold text-[11px] mt-0.5">{peering.id}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span
                      className={`font-bold ${
                        isPeeringActive ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {peering.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Requester VPC:</span>
                    <span className="font-mono text-slate-800 font-semibold">vpc-a (10.10.0.0/16)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Accepter VPC:</span>
                    <span className="font-mono text-slate-800 font-semibold">vpc-b (10.20.0.0/16)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Region:</span>
                    <span className="text-slate-700">ap-south-1 (Same Region)</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] space-y-1">
                  <span className="font-bold block text-blue-800">
                    Bidirectional Connectivity:
                  </span>
                  Both requester and accepter must activate the connection and have routes added to
                  route tables on both sides.
                </div>

                <div className="space-y-1.5">
                  <span className="text-slate-600 font-semibold block text-[11px]">
                    AWS CLI Command:
                  </span>
                  <div className="p-2.5 rounded bg-slate-900 font-mono text-[10px] text-cyan-300 overflow-x-auto">
                    aws ec2 create-vpc-peering-connection --vpc-id vpc-a --peer-vpc-id vpc-b
                  </div>
                </div>
              </div>
            )}

            {selectedEntity === 'bastion-host' && (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">EC2 Instance:</span>
                  <span className="font-bold text-slate-900 text-sm">{bastionHost.name}</span>
                  <div className="font-mono text-cyan-700 font-semibold text-[11px] mt-0.5">{bastionHost.id}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Private IP:</span>
                    <span className="font-mono text-slate-900 font-bold">{bastionHost.privateIp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Public IP:</span>
                    <span className="font-mono text-emerald-700 font-bold">
                      {bastionHost.publicIp}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subnet:</span>
                    <span className="text-slate-800 font-medium">subnet-a-public (10.10.1.0/24)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">AMI / Type:</span>
                    <span className="text-slate-800 font-medium">Amazon Linux 2023 / t3.micro</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px] space-y-1">
                  <span className="font-bold block text-slate-900">
                    Role in Architecture:
                  </span>
                  Single entry gatehouse. The client laptop SSHs to this host and uses ProxyJump to
                  administer private hosts app-a and app-b.
                </div>
              </div>
            )}

            {(selectedEntity === 'app-a' || selectedEntity === 'app-b') && (
              <div className="space-y-4 text-xs">
                {(() => {
                  const inst = selectedEntity === 'app-a' ? appAHost : appBHost;
                  const isAppB = selectedEntity === 'app-b';
                  return (
                    <>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Private Workload:</span>
                        <span className="font-bold text-slate-900 text-sm">{inst.name}</span>
                        <div className="font-mono text-cyan-700 font-semibold text-[11px] mt-0.5">{inst.id}</div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Private IPv4:</span>
                          <span className="font-mono text-slate-900 font-bold">{inst.privateIp}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Public IPv4:</span>
                          <span className="font-mono text-rose-600 font-bold">
                            None (Disabled)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Subnet:</span>
                          <span className="text-slate-800 font-medium">{inst.subnet}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">VPC:</span>
                          <span className="text-slate-800 font-medium">{inst.vpc}</span>
                        </div>
                      </div>

                      {isAppB && (
                        <div className="space-y-2">
                          <span className="font-bold text-slate-800 block">
                            Security Group Firewalls:
                          </span>
                          <button
                            onClick={() => onToggleSecurityRule('sg-app-b', 'rule-app-b-icmp')}
                            className="w-full flex items-center justify-between p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs transition cursor-pointer border border-slate-200"
                          >
                            <span>ICMP Rule (10.10.2.10/32):</span>
                            <span
                              className={`font-bold ${
                                hasAppBIcmpRule ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {hasAppBIcmpRule ? 'Active' : 'Revoked'}
                            </span>
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {(selectedEntity === 'rt-a-private' ||
              selectedEntity === 'rt-b-private' ||
              selectedEntity === 'rt-a-public') && (
              <div className="space-y-4 text-xs">
                {(() => {
                  const rt = routeTables.find((r) => r.name === selectedEntity)!;
                  return (
                    <>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Route Table:</span>
                        <span className="font-bold text-slate-900 text-sm">{rt.name}</span>
                        <div className="text-[11px] text-cyan-800 font-mono font-medium">{rt.associatedSubnet}</div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-slate-600 font-bold block text-[11px]">
                          Configured Routes:
                        </span>
                        <div className="divide-y divide-slate-200 bg-slate-50 rounded-lg border border-slate-200">
                          {rt.routes.map((route, idx) => (
                            <div key={idx} className="p-2.5 flex items-center justify-between">
                              <div>
                                <div className="font-mono text-slate-900 font-bold text-xs">
                                  {route.destination}
                                </div>
                                <div className="text-[10px] text-slate-500">{route.purpose}</div>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-cyan-800 font-semibold text-[11px] block">
                                  {route.target}
                                </span>
                                {route.targetType === 'pcx' && (
                                  <button
                                    onClick={() => onToggleRoute(rt.name, route.destination)}
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold cursor-pointer ${
                                      route.active
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {route.active ? 'Enabled' : 'Disabled'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {selectedEntity === 'laptop' && (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Admin Station:</span>
                  <span className="font-bold text-slate-900 text-sm">Student Laptop / WSL</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Public IP:</span>
                    <span className="font-mono text-cyan-800 font-bold">157.48.210.42/32</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Key Pair:</span>
                    <span className="font-mono text-slate-900 font-bold">~/.ssh/lab-key.pem</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Permissions:</span>
                    <span className="font-mono text-emerald-700 font-bold">chmod 400</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px]">
                  Configured with OpenSSH ProxyJump. Allows typing{' '}
                  <code className="text-cyan-800 font-bold font-mono">ssh app-b</code> directly without
                  manually logging into the bastion first.
                </div>
              </div>
            )}
          </div>

          {/* Quick Route/Rule Toggles Footer */}
          <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Quick State Toggles
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                onClick={() => onToggleRoute('rt-a-private', '10.20.0.0/16')}
                className={`p-2 rounded border text-left cursor-pointer transition ${
                  hasRouteAPrivateToB
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-medium'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                <div className="font-bold">RT A Private Route</div>
                <div className="text-[9px] text-slate-500">10.20.0.0/16 -&gt; pcx</div>
              </button>

              <button
                onClick={() => onToggleRoute('rt-b-private', '10.10.0.0/16')}
                className={`p-2 rounded border text-left cursor-pointer transition ${
                  hasRouteBPrivateToA
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-medium'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                <div className="font-bold">RT B Return Route</div>
                <div className="text-[9px] text-slate-500">10.10.0.0/16 -&gt; pcx</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
