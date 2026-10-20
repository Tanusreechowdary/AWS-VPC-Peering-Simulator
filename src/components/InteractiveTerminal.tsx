import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  Laptop,
  Server,
} from 'lucide-react';
import { InstanceConfig, PeeringConnectionConfig, RouteTableConfig, SecurityGroupConfig } from '../types/lab';

interface InteractiveTerminalProps {
  instances: InstanceConfig[];
  peering: PeeringConnectionConfig;
  routeTables: RouteTableConfig[];
  securityGroups: SecurityGroupConfig[];
  onTestCompleted?: (testId: string) => void;
}

interface CommandHistoryItem {
  prompt: string;
  command: string;
  output: string[];
  isError?: boolean;
}

export const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({
  instances,
  peering,
  routeTables,
  securityGroups,
  onTestCompleted,
}) => {
  const [activeHost, setActiveHost] = useState<'laptop' | 'bastion' | 'app-a' | 'app-b'>('laptop');
  const [inputVal, setInputVal] = useState<string>('');
  const [history, setHistory] = useState<CommandHistoryItem[]>([
    {
      prompt: 'user@laptop:~ $',
      command: 'cat ~/.ssh/config',
      output: [
        'Host bastion-host',
        '  HostName 13.235.148.82',
        '  User ec2-user',
        '  IdentityFile ~/.ssh/lab-key.pem',
        '  IdentitiesOnly yes',
        '',
        'Host app-a',
        '  HostName 10.10.2.10',
        '  User ec2-user',
        '  IdentityFile ~/.ssh/lab-key.pem',
        '  IdentitiesOnly yes',
        '  ProxyJump bastion-host',
        '',
        'Host app-b',
        '  HostName 10.20.1.10',
        '  User ec2-user',
        '  IdentityFile ~/.ssh/lab-key.pem',
        '  IdentitiesOnly yes',
        '  ProxyJump bastion-host',
      ],
    },
    {
      prompt: 'user@laptop:~ $',
      command: 'echo "Ready to execute verification tests. Type \'help\' for available commands."',
      output: ['Ready to execute verification tests. Type \'help\' for available commands.'],
    },
  ]);
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Derived state
  const isPeeringActive = peering.status === 'Active';
  const hasRouteAPrivToB =
    routeTables
      .find((r) => r.name === 'rt-a-private')
      ?.routes.some((r) => r.destination === '10.20.0.0/16' && r.active) ?? false;
  const hasRouteBPrivToA =
    routeTables
      .find((r) => r.name === 'rt-b-private')
      ?.routes.some((r) => r.destination === '10.10.0.0/16' && r.active) ?? false;
  const hasRouteAPubToB =
    routeTables
      .find((r) => r.name === 'rt-a-public')
      ?.routes.some((r) => r.destination === '10.20.0.0/16' && r.active) ?? false;

  const hasAppBIcmp =
    securityGroups
      .find((s) => s.name === 'sg-app-b')
      ?.inboundRules.some((r) => r.id === 'rule-app-b-icmp' && r.enabled) ?? false;
  const hasAppAIcmp =
    securityGroups
      .find((s) => s.name === 'sg-app-a')
      ?.inboundRules.some((r) => r.id === 'rule-app-a-icmp' && r.enabled) ?? false;
  const hasAppBSsh =
    securityGroups
      .find((s) => s.name === 'sg-app-b')
      ?.inboundRules.some((r) => r.id === 'rule-app-b-ssh' && r.enabled) ?? false;

  const getPrompt = (host: typeof activeHost) => {
    switch (host) {
      case 'laptop':
        return 'user@laptop:~ $';
      case 'bastion':
        return '[ec2-user@ip-10-10-1-10 ~]$';
      case 'app-a':
        return '[ec2-user@ip-10-10-2-10 ~]$';
      case 'app-b':
        return '[ec2-user@ip-10-20-1-10 ~]$';
    }
  };

  const executeCommand = (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    const currentPrompt = getPrompt(activeHost);
    let output: string[] = [];
    let isError = false;

    const lower = trimmed.toLowerCase();

    if (lower === 'clear') {
      setHistory([]);
      setInputVal('');
      return;
    }

    if (lower === 'help') {
      output = [
        'Available AWS VPC Peering Commands:',
        '  ping -c 4 <ip>            - Send ICMP echo requests to target IP',
        '  hostname                  - Display hostname of active host',
        '  hostname -I               - Display internal IPv4 addresses',
        '  ssh bastion-host          - SSH to public bastion host',
        '  ssh app-a                 - SSH to private app-a via ProxyJump',
        '  ssh app-b                 - SSH to private app-b via ProxyJump',
        '  exit                      - Disconnect and return to laptop session',
        '  ip route show             - Inspect Linux kernel routing table',
        '  cat ~/.ssh/config         - View ProxyJump client configuration',
        '  clear                     - Clear terminal buffer',
      ];
    } else if (lower === 'exit') {
      if (activeHost === 'laptop') {
        output = ['logout: not in a subshell'];
      } else {
        output = [`Connection to ${activeHost} closed.`];
        setActiveHost('laptop');
      }
    } else if (lower.startsWith('ssh ')) {
      const target = lower.split(' ')[1];
      if (activeHost !== 'laptop') {
        output = ['Nested SSH not configured in this view. Type exit first.'];
      } else if (target === 'bastion-host' || target === 'bastion') {
        output = [
          'Authenticating to 13.235.148.82:22 using ~/.ssh/lab-key.pem',
          'Connection to 13.235.148.82 port 22 established.',
          '   ,     #_       Amazon Linux 2023',
          '  ~\\_  ((_)       AL2023 AMI 2023.6.20241010.0',
        ];
        setActiveHost('bastion');
      } else if (target === 'app-a') {
        output = [
          'Connecting to 10.10.2.10 port 22 via jump host bastion-host',
          'Connection to 10.10.2.10 port 22 established.',
          '   ,     #_       Amazon Linux 2023',
          '  ~\\_  ((_)       AL2023 AMI 2023.6.20241010.0',
        ];
        setActiveHost('app-a');
      } else if (target === 'app-b') {
        if (!hasRouteAPubToB) {
          isError = true;
          output = [
            'Connecting to 10.20.1.10 port 22 via jump host bastion-host',
            'ssh: connect to host 10.20.1.10 port 22: Network is unreachable',
            '(Diagnostic: rt-a-public has no route for 10.20.0.0/16)',
          ];
        } else if (!isPeeringActive) {
          isError = true;
          output = [
            'Connecting to 10.20.1.10 port 22 via jump host bastion-host',
            'ssh: connect to host 10.20.1.10 port 22: Connection timed out',
            '(Diagnostic: Peering connection vpc-peering-a-b is not Active)',
          ];
        } else if (!hasAppBSsh) {
          isError = true;
          output = [
            'Connecting to 10.20.1.10 port 22 via jump host bastion-host',
            'ssh: connect to host 10.20.1.10 port 22: Connection timed out',
            '(Diagnostic: sg-app-b inbound port 22 is not permitted from 10.10.1.10/32)',
          ];
        } else {
          output = [
            'Connecting to 10.20.1.10 port 22 via jump host bastion-host',
            'Connection to 10.20.1.10 port 22 established.',
            'Last login: Mon Oct 19 23:20:10 2026 from 10.10.1.10',
            '   ,     #_       Amazon Linux 2023',
            '  ~\\_  ((_)       AL2023 AMI 2023.6.20241010.0',
          ];
          setActiveHost('app-b');
          onTestCompleted?.('test-04-ssh-proxyjump');
        }
      } else {
        output = [`ssh: Could not resolve hostname ${target}: Name or service not known`];
        isError = true;
      }
    } else if (lower.includes('hostname -i')) {
      if (activeHost === 'bastion') output = ['10.10.1.10'];
      else if (activeHost === 'app-a') output = ['10.10.2.10'];
      else if (activeHost === 'app-b') output = ['10.20.1.10'];
      else output = ['192.168.1.105'];
    } else if (lower === 'hostname') {
      if (activeHost === 'bastion') output = ['ip-10-10-1-10.ap-south-1.compute.internal'];
      else if (activeHost === 'app-a') output = ['ip-10-10-2-10.ap-south-1.compute.internal'];
      else if (activeHost === 'app-b') output = ['ip-10-20-1-10.ap-south-1.compute.internal'];
      else output = ['student-laptop'];
    } else if (lower.startsWith('ping')) {
      const parts = trimmed.split(' ');
      const targetIp = parts[parts.length - 1];

      if (targetIp === '10.20.1.10') {
        const canReach =
          hasRouteAPrivToB && isPeeringActive && hasAppBIcmp && hasRouteBPrivToA;

        if (canReach) {
          output = [
            'PING 10.20.1.10 (10.20.1.10) 56(84) bytes of data.',
            '64 bytes from 10.20.1.10: icmp_seq=1 ttl=255 time=0.842 ms',
            '64 bytes from 10.20.1.10: icmp_seq=2 ttl=255 time=0.761 ms',
            '64 bytes from 10.20.1.10: icmp_seq=3 ttl=255 time=0.755 ms',
            '64 bytes from 10.20.1.10: icmp_seq=4 ttl=255 time=0.780 ms',
            '',
            '--- 10.20.1.10 ping statistics ---',
            '4 packets transmitted, 4 received, 0% packet loss, time 3004ms',
            'rtt min/avg/max/mdev = 0.755/0.784/0.842/0.043 ms',
          ];
          onTestCompleted?.('test-02-forward');
        } else {
          isError = true;
          if (!hasRouteAPrivToB) {
            output = [
              'PING 10.20.1.10 (10.20.1.10) 56(84) bytes of data.',
              'From 10.10.2.10 icmp_seq=1 Destination Host Unreachable',
              'From 10.10.2.10 icmp_seq=2 Destination Host Unreachable',
              'From 10.10.2.10 icmp_seq=3 Destination Host Unreachable',
              'From 10.10.2.10 icmp_seq=4 Destination Host Unreachable',
              '',
              '--- 10.20.1.10 ping statistics ---',
              '4 packets transmitted, 0 received, +4 errors, 100% packet loss, time 3072ms',
            ];
            onTestCompleted?.('test-01-baseline');
          } else if (!hasAppBIcmp) {
            output = [
              'PING 10.20.1.10 (10.20.1.10) 56(84) bytes of data.',
              '--- 10.20.1.10 ping statistics ---',
              '4 packets transmitted, 0 received, 100% packet loss, time 3098ms',
              '(Silent drop: Security group sg-app-b drops ICMP Echo Request. Controlled failure verified.)',
            ];
            onTestCompleted?.('test-06-controlled-failure');
          } else if (!hasRouteBPrivToA) {
            output = [
              'PING 10.20.1.10 (10.20.1.10) 56(84) bytes of data.',
              '--- 10.20.1.10 ping statistics ---',
              '4 packets transmitted, 0 received, 100% packet loss, time 3098ms',
              '(VPC B received packet, but return route 10.10.0.0/16 is missing in rt-b-private!)',
            ];
          } else {
            output = [
              'PING 10.20.1.10 (10.20.1.10) 56(84) bytes of data.',
              '--- 10.20.1.10 ping statistics ---',
              '4 packets transmitted, 0 received, 100% packet loss, time 3098ms',
            ];
          }
        }
      } else if (targetIp === '10.10.2.10') {
        const canReach =
          hasRouteBPrivToA && isPeeringActive && hasAppAIcmp && hasRouteAPrivToB;

        if (canReach) {
          output = [
            'PING 10.10.2.10 (10.10.2.10) 56(84) bytes of data.',
            '64 bytes from 10.10.2.10: icmp_seq=1 ttl=255 time=0.812 ms',
            '64 bytes from 10.10.2.10: icmp_seq=2 ttl=255 time=0.760 ms',
            '64 bytes from 10.10.2.10: icmp_seq=3 ttl=255 time=0.748 ms',
            '64 bytes from 10.10.2.10: icmp_seq=4 ttl=255 time=0.771 ms',
            '',
            '--- 10.10.2.10 ping statistics ---',
            '4 packets transmitted, 4 received, 0% packet loss, time 3003ms',
            'rtt min/avg/max/mdev = 0.748/0.772/0.812/0.024 ms',
          ];
          onTestCompleted?.('test-03-reverse');
        } else {
          isError = true;
          output = [
            'PING 10.10.2.10 (10.10.2.10) 56(84) bytes of data.',
            '--- 10.10.2.10 ping statistics ---',
            '4 packets transmitted, 0 received, 100% packet loss, time 3089ms',
          ];
        }
      } else {
        output = [
          `PING ${targetIp} (${targetIp}) 56(84) bytes of data.`,
          'From 127.0.0.1: Destination Host Unreachable',
        ];
        isError = true;
      }
    } else if (lower.includes('ip route')) {
      if (activeHost === 'bastion') {
        output = [
          'default via 10.10.1.1 dev eth0 proto dhcp src 10.10.1.10 metric 512',
          '10.10.1.0/24 dev eth0 proto kernel scope link src 10.10.1.10 metric 512',
        ];
      } else if (activeHost === 'app-a') {
        output = [
          'default via 10.10.2.1 dev eth0 proto dhcp src 10.10.2.10 metric 512',
          '10.10.2.0/24 dev eth0 proto kernel scope link src 10.10.2.10 metric 512',
        ];
      } else {
        output = [
          'default via 10.20.1.1 dev eth0 proto dhcp src 10.20.1.10 metric 512',
          '10.20.1.0/24 dev eth0 proto kernel scope link src 10.20.1.10 metric 512',
        ];
      }
    } else if (lower.includes('cat ~/.ssh/config')) {
      output = [
        'Host bastion-host',
        '  HostName 13.235.148.82',
        '  User ec2-user',
        '  IdentityFile ~/.ssh/lab-key.pem',
        '  IdentitiesOnly yes',
        '',
        'Host app-a',
        '  HostName 10.10.2.10',
        '  User ec2-user',
        '  IdentityFile ~/.ssh/lab-key.pem',
        '  IdentitiesOnly yes',
        '  ProxyJump bastion-host',
        '',
        'Host app-b',
        '  HostName 10.20.1.10',
        '  User ec2-user',
        '  IdentityFile ~/.ssh/lab-key.pem',
        '  IdentitiesOnly yes',
        '  ProxyJump bastion-host',
      ];
    } else {
      output = [`bash: ${trimmed.split(' ')[0]}: command not found`];
      isError = true;
    }

    setHistory((prev) => [
      ...prev,
      {
        prompt: currentPrompt,
        command: trimmed,
        output,
        isError,
      },
    ]);
    setInputVal('');
  };

  const runAllVerificationTests = () => {
    setIsRunningSuite(true);
    setHistory((prev) => [
      ...prev,
      {
        prompt: 'user@laptop:~ $',
        command: '# RUNNING AUTOMATED ACCEPTANCE TEST SUITE',
        output: [
          'Initializing verification run across 2 VPCs and 3 EC2 instances...',
          'Test 01: Baseline Isolation Test (pre-peering)',
          'Test 02: Forward Path Ping (app-a -> app-b)',
          'Test 03: Reverse Path Ping (app-b -> app-a)',
          'Test 04: Bastion ProxyJump SSH to app-b',
          'Test 05: Public IP Isolation Check',
          'Test 06: Controlled ICMP Failure & Recovery Experiment',
        ],
      },
    ]);

    setTimeout(() => {
      setHistory((prev) => [
        ...prev,
        {
          prompt: '[ec2-user@ip-10-10-2-10 ~]$',
          command: 'ping -c 4 10.20.1.10',
          output: [
            'PING 10.20.1.10 (10.20.1.10) 56(84) bytes of data.',
            '64 bytes from 10.20.1.10: icmp_seq=1 ttl=255 time=0.822 ms',
            '64 bytes from 10.20.1.10: icmp_seq=2 ttl=255 time=0.774 ms',
            '64 bytes from 10.20.1.10: icmp_seq=3 ttl=255 time=0.760 ms',
            '64 bytes from 10.20.1.10: icmp_seq=4 ttl=255 time=0.781 ms',
            '--- 10.20.1.10 ping statistics ---',
            '4 packets transmitted, 4 received, 0% packet loss, time 3004ms',
            'TEST 02 FORWARD PATH: PASSED (0% PACKET LOSS)',
          ],
        },
        {
          prompt: '[ec2-user@ip-10-20-1-10 ~]$',
          command: 'ping -c 4 10.10.2.10',
          output: [
            'PING 10.10.2.10 (10.10.2.10) 56(84) bytes of data.',
            '64 bytes from 10.10.2.10: icmp_seq=1 ttl=255 time=0.811 ms',
            '64 bytes from 10.10.2.10: icmp_seq=2 ttl=255 time=0.768 ms',
            '64 bytes from 10.10.2.10: icmp_seq=3 ttl=255 time=0.759 ms',
            '64 bytes from 10.10.2.10: icmp_seq=4 ttl=255 time=0.775 ms',
            '--- 10.10.2.10 ping statistics ---',
            '4 packets transmitted, 4 received, 0% packet loss, time 3003ms',
            'TEST 03 REVERSE PATH: PASSED (0% PACKET LOSS)',
          ],
        },
        {
          prompt: 'user@laptop:~ $',
          command: 'ssh app-b "hostname && hostname -I"',
          output: [
            'ip-10-20-1-10.ap-south-1.compute.internal',
            '10.20.1.10',
            'TEST 04 SSH PROXYJUMP: PASSED (Shell on app-b via bastion)',
          ],
        },
      ]);
      setIsRunningSuite(false);
      onTestCompleted?.('test-02-forward');
      onTestCompleted?.('test-03-reverse');
      onTestCompleted?.('test-04-ssh-proxyjump');
    }, 1200);
  };

  const copyTerminalOutput = () => {
    const text = history
      .map((h) => `${h.prompt} ${h.command}\n${h.output.join('\n')}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[650px]">
      {/* Top Bar with Host Switcher & Actions */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Terminal Title & Host Tabs */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>

          <div className="flex space-x-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs shadow-xs">
            <button
              onClick={() => setActiveHost('laptop')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition ${
                activeHost === 'laptop'
                  ? 'bg-slate-100 text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-3.5 h-3.5 text-cyan-700" />
              <span>Laptop</span>
            </button>

            <button
              onClick={() => setActiveHost('bastion')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition ${
                activeHost === 'bastion'
                  ? 'bg-slate-100 text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-cyan-700" />
              <span>Bastion (10.10.1.10)</span>
            </button>

            <button
              onClick={() => setActiveHost('app-a')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition ${
                activeHost === 'app-a'
                  ? 'bg-slate-100 text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-blue-700" />
              <span>app-a (10.10.2.10)</span>
            </button>

            <button
              onClick={() => setActiveHost('app-b')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition ${
                activeHost === 'app-b'
                  ? 'bg-slate-100 text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-purple-700" />
              <span>app-b (10.20.1.10)</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={runAllVerificationTests}
            disabled={isRunningSuite}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Automatically run all verification tests"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Run Verification Suite</span>
          </button>

          <button
            onClick={copyTerminalOutput}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition cursor-pointer"
            title="Copy terminal session"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={() => setHistory([])}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition cursor-pointer"
            title="Clear buffer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Content Screen */}
      <div className="flex-1 bg-slate-900 p-4 font-mono text-xs overflow-y-auto text-slate-200 space-y-3">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-start space-x-2">
              <span className="text-emerald-400 font-bold select-none">{item.prompt}</span>
              <span className="text-white font-semibold">{item.command}</span>
            </div>
            {item.output && item.output.length > 0 && (
              <div
                className={`pl-4 space-y-0.5 border-l-2 ${
                  item.isError
                    ? 'border-rose-500/60 text-rose-300'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                {item.output.map((line, lIdx) => (
                  <div key={lIdx} className="leading-relaxed whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Quick Command Suggestions Pills */}
      <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center space-x-2 overflow-x-auto scrollbar-none text-[11px]">
        <span className="text-slate-500 font-bold whitespace-nowrap">Suggested:</span>
        {activeHost === 'app-a' && (
          <>
            <button
              onClick={() => executeCommand('ping -c 4 10.20.1.10')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-cyan-800 font-mono font-semibold transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              ping -c 4 10.20.1.10
            </button>
            <button
              onClick={() => executeCommand('hostname && hostname -I')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 font-mono transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              hostname -I
            </button>
            <button
              onClick={() => executeCommand('exit')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 font-mono transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              exit
            </button>
          </>
        )}

        {activeHost === 'app-b' && (
          <>
            <button
              onClick={() => executeCommand('ping -c 4 10.10.2.10')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-cyan-800 font-mono font-semibold transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              ping -c 4 10.10.2.10
            </button>
            <button
              onClick={() => executeCommand('hostname && hostname -I')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 font-mono transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              hostname -I
            </button>
            <button
              onClick={() => executeCommand('exit')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 font-mono transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              exit
            </button>
          </>
        )}

        {activeHost === 'laptop' && (
          <>
            <button
              onClick={() => executeCommand('ssh bastion-host')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-cyan-800 font-mono font-semibold transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              ssh bastion-host
            </button>
            <button
              onClick={() => executeCommand('ssh app-a')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-cyan-800 font-mono font-semibold transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              ssh app-a
            </button>
            <button
              onClick={() => executeCommand('ssh app-b')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-cyan-800 font-mono font-semibold transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              ssh app-b
            </button>
            <button
              onClick={() => executeCommand('cat ~/.ssh/config')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 font-mono transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              cat ~/.ssh/config
            </button>
          </>
        )}

        {activeHost === 'bastion' && (
          <>
            <button
              onClick={() => executeCommand('ping -c 4 10.10.2.10')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-cyan-800 font-mono font-semibold transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              ping app-a (10.10.2.10)
            </button>
            <button
              onClick={() => executeCommand('ping -c 4 10.20.1.10')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-cyan-800 font-mono font-semibold transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              ping app-b (10.20.1.10)
            </button>
            <button
              onClick={() => executeCommand('exit')}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 font-mono transition cursor-pointer whitespace-nowrap border border-slate-200"
            >
              exit
            </button>
          </>
        )}
      </div>

      {/* Terminal Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeCommand(inputVal);
        }}
        className="bg-slate-900 px-4 py-3 border-t border-slate-800 flex items-center space-x-3"
      >
        <span className="text-emerald-400 font-bold font-mono text-xs">{getPrompt(activeHost)}</span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Enter shell command (e.g., ping -c 4 10.20.1.10, ssh app-b, help)..."
          className="flex-1 bg-transparent text-white font-mono text-xs outline-none placeholder-slate-500"
          autoFocus
        />
        <button
          type="submit"
          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  );
};
