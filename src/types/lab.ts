export interface StudentProfile {
  name: string;
  batch: string;
  region: string;
  completionDate: string;
  keyPairName: string;
  projectTag: string;
}

export interface ResourceItem {
  id: string;
  name: string;
  type: string;
  cidrOrIp: string;
  vpc: 'VPC A' | 'VPC B';
  status: string;
  details: string;
}

export interface RouteEntry {
  destination: string;
  target: string;
  targetType: 'local' | 'igw' | 'pcx';
  purpose: string;
  active: boolean;
}

export interface RouteTableConfig {
  id: string;
  name: string;
  vpc: 'VPC A' | 'VPC B';
  associatedSubnet: string;
  routes: RouteEntry[];
}

export interface SecurityGroupRule {
  id: string;
  type: string;
  protocol: string;
  port: number | string;
  source: string;
  sourceLabel: string;
  description: string;
  enabled: boolean;
}

export interface SecurityGroupConfig {
  id: string;
  name: string;
  vpc: 'VPC A' | 'VPC B';
  description: string;
  inboundRules: SecurityGroupRule[];
  outboundRules: string;
}

export interface InstanceConfig {
  id: string;
  name: string;
  hostname: string;
  vpc: 'VPC A' | 'VPC B';
  subnet: string;
  privateIp: string;
  publicIp?: string;
  instanceType: string;
  ami: string;
  securityGroupId: string;
  state: 'running' | 'stopped' | 'terminated';
}

export interface PeeringConnectionConfig {
  id: string;
  name: string;
  requesterVpcId: string;
  accepterVpcId: string;
  status: 'Initiating' | 'Pending-Acceptance' | 'Active' | 'Deleted';
  requesterCidr: string;
  accepterCidr: string;
}

export interface VerificationTest {
  id: string;
  title: string;
  stage: string;
  where: string;
  command: string;
  expectedResult: string;
  actualResult: string;
  status: 'passed' | 'failed' | 'pending';
  explanation: string;
  consoleSnippet?: string[];
}

export interface CheckpointStatus {
  cp1: boolean; // VPC A subnets & default route
  cp2: boolean; // EC2 instances launched & private IPs verified
  cp3: boolean; // Peering connection active
  cp4: boolean; // Route tables configured on both sides
  cpBaseline: boolean; // Baseline failure captured
  cpForward: boolean; // Forward ping success captured
  cpReverse: boolean; // Reverse ping success captured
  cpSsh: boolean; // SSH ProxyJump verified
  cpControlledFailure: boolean; // Controlled failure & recovery verified
  cpCleanup: boolean; // Cleanup verified
}
