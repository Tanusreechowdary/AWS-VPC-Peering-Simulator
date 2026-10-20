import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Terminal,
  FileCode,
  Shield,
  Layers,
  Sparkles,
  MousePointerClick,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  terraformCode,
  bashDeployScript,
  bashCleanupScript,
  sshConfigFile,
} from '../data/codeTemplates';

export const TerraformAndCli: React.FC = () => {
  const [activeCodeTab, setActiveCodeTab] = useState<
    'console' | 'terraform' | 'deploy-cli' | 'cleanup-cli' | 'ssh'
  >('console');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeConsoleStep, setActiveConsoleStep] = useState<number>(1);

  const getCodeContent = () => {
    switch (activeCodeTab) {
      case 'terraform':
        return { content: terraformCode, filename: 'main.tf', lang: 'hcl' };
      case 'deploy-cli':
        return { content: bashDeployScript, filename: 'deploy-lab.sh', lang: 'bash' };
      case 'cleanup-cli':
        return { content: bashCleanupScript, filename: 'cleanup-lab.sh', lang: 'bash' };
      case 'ssh':
        return { content: sshConfigFile, filename: 'config', lang: 'ssh' };
      default:
        return { content: '', filename: '', lang: '' };
    }
  };

  const current = getCodeContent();

  const handleCopy = () => {
    if (!current.content) return;
    navigator.clipboard.writeText(current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!current.content) return;
    const blob = new Blob([current.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = current.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const consoleSteps = [
    {
      step: 1,
      title: 'Step 1: Create VPC A & Subnets (VPC Console)',
      service: 'Amazon VPC',
      instructions: [
        'Open the AWS Management Console and navigate to VPC Dashboard.',
        'Click Create VPC. Under Resources to create, select "VPC only".',
        'Name tag: enter "ewb-vpc-a". IPv4 CIDR: enter "10.10.0.0/16". Leave Tenancy as Default and click Create VPC.',
        'In the left navigation, click Subnets > Create subnet.',
        'Select VPC ID: choose "ewb-vpc-a".',
        'Subnet 1: Subnet name: "ewb-a-public", AZ: select your region’s first AZ (e.g. ap-south-1a), IPv4 CIDR block: "10.10.1.0/24".',
        'Click Add new subnet. Subnet 2: Subnet name: "ewb-a-private", AZ: select the same AZ (ap-south-1a), IPv4 CIDR: "10.10.2.0/24".',
        'Click Create subnet.',
      ],
    },
    {
      step: 2,
      title: 'Step 2: Attach Internet Gateway to VPC A',
      service: 'Amazon VPC > Internet Gateways',
      instructions: [
        'In the left navigation, choose Internet gateways > Create internet gateway.',
        'Name tag: enter "ewb-igw-a" and click Create internet gateway.',
        'Click Actions > Attach to VPC.',
        'Select "ewb-vpc-a" from the dropdown and click Attach internet gateway.',
      ],
    },
    {
      step: 3,
      title: 'Step 3: Build VPC B & Isolated Subnet',
      service: 'Amazon VPC',
      instructions: [
        'Click Your VPCs > Create VPC > "VPC only".',
        'Name tag: enter "ewb-vpc-b". IPv4 CIDR block: enter "10.20.0.0/16". Click Create VPC.',
        'Navigate to Subnets > Create subnet.',
        'Select VPC ID: choose "ewb-vpc-b".',
        'Subnet name: "ewb-b-private", Availability Zone: same AZ (e.g. ap-south-1a), IPv4 CIDR: "10.20.1.0/24".',
        'Click Create subnet. Note: DO NOT attach an Internet Gateway to VPC B. It must stay 100% private.',
      ],
    },
    {
      step: 4,
      title: 'Step 4: Create Security Groups (Strict /32 Ingress)',
      service: 'Amazon VPC > Security Groups',
      instructions: [
        'Create ewb-sg-bastion: In VPC A. Inbound rule: Type "SSH", Port "22", Source: select "My IP" (or your public IP /32).',
        'Create ewb-sg-app-a: In VPC A. Rule 1: Type "SSH", Port "22", Source: Custom "10.10.1.10/32". Rule 2: Type "Custom ICMP - IPv4", Port range: "Echo Request" (Type 8, Code 0), Source: Custom "10.20.1.10/32".',
        'Create ewb-sg-app-b: In VPC B. Rule 1: Type "SSH", Port "22", Source: Custom "10.10.1.10/32". Rule 2: Type "Custom ICMP - IPv4", Port range: "Echo Request", Source: Custom "10.10.2.10/32".',
        'Leave default outbound allow-all rules on all three security groups.',
      ],
    },
    {
      step: 5,
      title: 'Step 5: Launch the 3 EC2 Instances',
      service: 'Amazon EC2 > Launch Instance',
      instructions: [
        'Instance 1 (ewb-bastion): Name "ewb-bastion", AMI Amazon Linux 2023, Type t3.micro, Key pair "ewb-lab". Under Network settings, click Edit. VPC: "ewb-vpc-a", Subnet: "ewb-a-public", Auto-assign public IP: "Enable", Primary IP: "10.10.1.10". Security group: choose "ewb-sg-bastion". Click Launch instance.',
        'Instance 2 (ewb-app-a): Name "ewb-app-a", AMI AL2023, Type t3.micro, Key "ewb-lab". Network settings: VPC "ewb-vpc-a", Subnet "ewb-a-private", Auto-assign public IP: "Disable", Primary IP: "10.10.2.10". Security group: choose "ewb-sg-app-a". Click Launch.',
        'Instance 3 (ewb-app-b): Name "ewb-app-b", AMI AL2023, Type t3.micro, Key "ewb-lab". Network settings: VPC "ewb-vpc-b", Subnet "ewb-b-private", Auto-assign public IP: "Disable", Primary IP: "10.20.1.10". Security group: choose "ewb-sg-app-b". Click Launch.',
      ],
    },
    {
      step: 6,
      title: 'Step 6: Request & Accept VPC Peering',
      service: 'Amazon VPC > Peering Connections',
      instructions: [
        'In the left navigation, click Peering connections > Create peering connection.',
        'Name: enter "ewb-a-b-peer".',
        'VPC ID (Requester): select "ewb-vpc-a".',
        'Account: select "My account". Region: select "This Region".',
        'VPC ID (Accepter): select "ewb-vpc-b".',
        'Click Create peering connection.',
        'Select the newly created connection (status will be "Pending acceptance"). Click Actions > Accept request. Confirm.',
        'Status updates to "Active" (record pcx-ID).',
      ],
    },
    {
      step: 7,
      title: 'Step 7: Configure Bidirectional Route Tables',
      service: 'Amazon VPC > Route Tables',
      instructions: [
        'Create ewb-rt-a-public in VPC A: Associate to "ewb-a-public". Routes: add "0.0.0.0/0" -> Target "ewb-igw-a", and add "10.20.0.0/16" -> Target "Peering Connection" (pcx-ID).',
        'Create ewb-rt-a-private in VPC A: Associate to "ewb-a-private". Routes: add "10.20.0.0/16" -> Target "Peering Connection" (pcx-ID).',
        'Create ewb-rt-b-private in VPC B: Associate to "ewb-b-private". Routes: add "10.10.0.0/16" -> Target "Peering Connection" (pcx-ID).',
      ],
    },
    {
      step: 8,
      title: 'Step 8: Verification & Evidence Capture',
      service: 'Local Terminal / SSH',
      instructions: [
        '1. SSH to Bastion: ssh -i ~/.ssh/ewb-lab.pem ec2-user@BASTION_PUBLIC_IP.',
        '2. SSH to App-A via ProxyJump: ssh ewb-app-a.',
        '3. Run Ping to App-B: ping -c 4 10.20.1.10 (Capture screenshot of 0% packet loss).',
        '4. SSH to App-B: ssh ewb-app-b. Run ping -c 4 10.10.2.10 (Capture reverse ping screenshot).',
        '5. Controlled Failure: Go to EC2 Console > Security Groups > ewb-sg-app-b. Delete the ICMP rule. Retest ping from App-A -> Observe 100% loss. Restore rule -> Observe recovery.',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
                Implementation Options: Manual Console or Automated IaC
              </span>
              <span className="text-xs text-slate-500 font-medium">Production-Ready Guides</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Choose Your Implementation Path
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Complete the lab using our step-by-step AWS Management Console click guide, or deploy
              everything automatically in 90 seconds using Terraform or AWS CLI.
            </p>
          </div>

          {activeCodeTab !== 'console' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {current.filename}</span>
              </button>
            </div>
          )}
        </div>

        {/* Code / Console Selector Tabs */}
        <div className="flex space-x-2 mt-5 border-t border-slate-200 pt-4 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveCodeTab('console')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              activeCodeTab === 'console'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>AWS Console Click-by-Click Guide</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('terraform')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              activeCodeTab === 'terraform'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Terraform (main.tf)</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('deploy-cli')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              activeCodeTab === 'deploy-cli'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>AWS CLI Deploy Script (deploy-lab.sh)</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('cleanup-cli')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              activeCodeTab === 'cleanup-cli'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>AWS CLI Cleanup Script (cleanup-lab.sh)</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('ssh')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              activeCodeTab === 'ssh'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>SSH Config (~/.ssh/config)</span>
          </button>
        </div>
      </div>

      {/* View 1: AWS Console Click-by-Click Guide */}
      {activeCodeTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps List */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              8 Implementation Steps
            </div>
            {consoleSteps.map((s) => (
              <button
                key={s.step}
                onClick={() => setActiveConsoleStep(s.step)}
                className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${
                  activeConsoleStep === s.step
                    ? 'border-cyan-600 bg-cyan-50/80 ring-1 ring-cyan-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    activeConsoleStep === s.step
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {s.step}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{s.title}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.service}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Step Detail */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            {(() => {
              const currentStep = consoleSteps.find((s) => s.step === activeConsoleStep)!;
              return (
                <>
                  <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center space-x-2 text-cyan-800 text-xs font-bold uppercase tracking-wider mb-1">
                      <MousePointerClick className="w-4 h-4" />
                      <span>{currentStep.service}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{currentStep.title}</h3>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Exact Click-by-Click Instructions:
                    </h4>
                    <div className="space-y-2.5">
                      {currentStep.instructions.map((inst, iIdx) => (
                        <div
                          key={iIdx}
                          className="flex items-start space-x-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed"
                        >
                          <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            {iIdx + 1}
                          </span>
                          <span>{inst}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                    <button
                      onClick={() => setActiveConsoleStep((s) => Math.max(1, s - 1))}
                      disabled={activeConsoleStep === 1}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      &larr; Previous Step
                    </button>
                    <span className="text-xs font-mono text-slate-500">
                      Step {activeConsoleStep} of {consoleSteps.length}
                    </span>
                    <button
                      onClick={() =>
                        setActiveConsoleStep((s) => Math.min(consoleSteps.length, s + 1))
                      }
                      disabled={activeConsoleStep === consoleSteps.length}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer shadow-sm"
                    >
                      Next Step &rarr;
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* View 2: Code Editor (Terraform / CLI / SSH) */}
      {activeCodeTab !== 'console' && (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-slate-400 font-mono">
                <span>File: </span>
                <span className="text-white font-bold">{current.filename}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {current.lang}
              </span>
            </div>

            <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed max-h-[600px] scrollbar-thin">
              <code>{current.content}</code>
            </pre>
          </div>

          {/* Usage Guide */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs text-slate-700 space-y-3 shadow-sm">
            <div className="flex items-center space-x-2 text-cyan-800 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Execution Instructions for Real AWS Account</span>
            </div>
            {activeCodeTab === 'terraform' && (
              <div className="space-y-1.5 font-mono text-[11px] text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans font-semibold"># 1. Initialize Terraform</div>
                <div className="text-cyan-800 font-bold">$ terraform init</div>
                <div className="text-slate-500 font-sans font-semibold mt-2">
                  # 2. Plan and inspect resource creation
                </div>
                <div className="text-cyan-800 font-bold">
                  $ terraform plan -var=&quot;student_name=Your Name&quot;
                </div>
                <div className="text-slate-500 font-sans font-semibold mt-2">
                  # 3. Apply infrastructure
                </div>
                <div className="text-cyan-800 font-bold">$ terraform apply -auto-approve</div>
                <div className="text-slate-500 font-sans font-semibold mt-2">
                  # 4. Teardown when finished (Page 14)
                </div>
                <div className="text-rose-700 font-bold">$ terraform destroy -auto-approve</div>
              </div>
            )}

            {activeCodeTab === 'deploy-cli' && (
              <div className="space-y-1.5 font-mono text-[11px] text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans font-semibold"># 1. Make executable</div>
                <div className="text-cyan-800 font-bold">$ chmod +x deploy-lab.sh</div>
                <div className="text-slate-500 font-sans font-semibold mt-2">
                  # 2. Run deployment
                </div>
                <div className="text-cyan-800 font-bold">$ ./deploy-lab.sh</div>
              </div>
            )}

            {activeCodeTab === 'cleanup-cli' && (
              <div className="space-y-1.5 font-mono text-[11px] text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans font-semibold">
                  # Run reverse-dependency teardown after collecting evidence
                </div>
                <div className="text-rose-700 font-bold">
                  $ chmod +x cleanup-lab.sh &amp;&amp; ./cleanup-lab.sh
                </div>
              </div>
            )}

            {activeCodeTab === 'ssh' && (
              <div className="space-y-1.5 font-mono text-[11px] text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-500 font-sans font-semibold">
                  # Append configuration to your local SSH config
                </div>
                <div className="text-cyan-800 font-bold">
                  $ cat config &gt;&gt; ~/.ssh/config &amp;&amp; chmod 600 ~/.ssh/config
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
