# AWS VPC Peering Simulator & Lab

An interactive cloud networking lab, simulator, and verification toolkit for Amazon Web Services (AWS) Virtual Private Cloud (VPC) Peering. Demonstrates private inter-VPC routing, strict least-privilege security groups, OpenSSH ProxyJump administration through a public bastion host, and empirical network verification.

---

## 📌 Repository Description (For GitHub)

### 🏷️ Short Description / Tagline (GitHub "About" Box)
> **Interactive AWS VPC Peering simulator, live packet tracer, multi-host terminal sandbox, AWS Console guide, and production Terraform automation for private multi-VPC networking.**

### 🏷️ GitHub Topics / Tags
`aws` `vpc-peering` `cloud-networking` `terraform` `bash` `ec2` `bastion-host` `security-groups` `packet-tracer` `react` `typescript` `vite` `vercel`

---

## 🚀 Deploy on Vercel

This project is fully optimized for one-click or continuous deployment on **Vercel**.

### Method 1: Deploy with Vercel CLI (Fastest)

```bash
# 1. Install Vercel CLI globally
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy preview
vercel

# 4. Deploy to production
vercel --prod
```

### Method 2: Deploy via Vercel Dashboard (Connected to GitHub)

1. Push this repository to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit of AWS VPC Peering simulator"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Navigate to [vercel.com/new](https://vercel.com/new).
3. Import your GitHub repository.
4. Vercel automatically detects the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Click **Deploy**. Your app is live in seconds with global edge CDN and automatic SSL!

### Vercel Configuration Included (`vercel.json`)
The project includes a pre-configured `vercel.json` file ensuring single-page application (SPA) routing:
```json
{
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 📋 PDF Project Requirements Verification Matrix

This project strictly satisfies **100% of the functional and architectural requirements** specified in the AWS VPC Peering specification:

| # | PDF Lab Requirement | Specification Details | Implementation Status | How It Is Verified |
| :- | :--- | :--- | :---: | :--- |
| **1** | **Non-Overlapping VPC CIDRs** | VPC A: `10.10.0.0/16`<br>VPC B: `10.20.0.0/16` | ✅ **SATISFIED** | Configured in Topology, Terraform, CLI, and simulator validation logic. Overlapping CIDRs are strictly rejected. |
| **2** | **Subnet Architecture** | `ewb-a-public` (`10.10.1.0/24`)<br>`ewb-a-private` (`10.10.2.0/24`)<br>`ewb-b-private` (`10.20.1.0/24`) | ✅ **SATISFIED** | Exact subnet names, CIDRs, and availability zone mappings across both console guides and IaC. |
| **3** | **Single Internet Gateway (VPC A only)** | `ewb-igw-a` attached to VPC A only.<br>VPC B has **NO** Internet Gateway or NAT Gateway. | ✅ **SATISFIED** | Isolated VPC B design prevents public exposure. App servers remain 100% private. |
| **4** | **No Public IPs on App Servers** | `ewb-app-a` & `ewb-app-b` strictly have **no public IPs**. Only Bastion has a public IP. | ✅ **SATISFIED** | `Auto-assign public IP: Disable` on private subnets. Verified in network state and security checks. |
| **5** | **Strict Least-Privilege Security Groups** | - `ewb-sg-bastion`: Port 22 from admin IP only.<br>- `ewb-sg-app-a`: Port 22 from Bastion (`10.10.1.10/32`) + ICMP from App-B (`10.20.1.10/32`).<br>- `ewb-sg-app-b`: Port 22 from Bastion (`10.10.1.10/32`) + ICMP from App-A (`10.10.2.10/32`). | ✅ **SATISFIED** | Zero `0.0.0.0/0` ingress on private instances. Specific host `/32` CIDRs enforced. |
| **6** | **VPC Peering Connection** | `ewb-a-b-peer` created from VPC A (Requester) to VPC B (Accepter) & Accepted. | ✅ **SATISFIED** | Peering status must be `Active`. Packet tracer and terminal enforce active status. |
| **7** | **Bidirectional Targeted Route Tables** | - VPC A route table: `10.20.0.0/16` &rarr; `pcx-xxxxxx`<br>- VPC B route table: `10.10.0.0/16` &rarr; `pcx-xxxxxx` | ✅ **SATISFIED** | Return route requirement is enforced. Asymmetrical routing drops packets with clear diagnostic messaging. |
| **8** | **OpenSSH ProxyJump Administration** | Connect to private App-A and App-B from student laptop through Bastion without exposing private keys. | ✅ **SATISFIED** | Emulated in terminal sandbox (`ssh -J ec2-user@bastion ec2-user@10.20.1.10` and `~/.ssh/config` block). |
| **9** | **Empirical Verification: Baseline Failure** | Capture ping failure before peering/routes are active (100% packet loss). | ✅ **SATISFIED** | Terminal and packet simulator reproduce 100% packet loss pre-peering. |
| **10** | **Empirical Verification: Peering Success** | Ping from `ewb-app-a` (`10.10.2.10`) to `ewb-app-b` (`10.20.1.10`) with 0% packet loss. | ✅ **SATISFIED** | Terminal and packet simulator confirm bi-directional ICMP delivery with sub-millisecond latency. |
| **11** | **Empirical Verification: Reverse Ping** | Ping from `ewb-app-b` (`10.20.1.10`) to `ewb-app-a` (`10.10.2.10`) proving return route. | ✅ **SATISFIED** | Verified across all testing tools. |
| **12** | **Chaos Experiment & Recovery** | Delete ICMP rule on `ewb-sg-app-b` &rarr; observe packet drop &rarr; restore rule &rarr; observe recovery. | ✅ **SATISFIED** | Interactive toggle switches allow real-time testing of the exact chaos condition and immediate recovery. |
| **13** | **Clean Resource Teardown** | Reverse dependency teardown script to prevent AWS billing charges. | ✅ **SATISFIED** | `cleanup-lab.sh` and `terraform destroy` included in Console & Terraform tab. |

---

## 🌐 Network Architecture Diagram

```
[ Admin Laptop ] (Your Public IP /32)
       │
       │ SSH (Port 22)
       ▼
[ Internet Gateway: ewb-igw-a ]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ VPC A (10.10.0.0/16)                                   │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Public Subnet: ewb-a-public (10.10.1.0/24)       │  │
│  │ • Bastion Host (10.10.1.10 + Public IPv4)        │  │
│  │ • Route: 0.0.0.0/0 -> ewb-igw-a                  │  │
│  │ • Route: 10.20.0.0/16 -> pcx-xxxxxx              │  │
│  └───────────────────────┬──────────────────────────┘  │
│                          │ OpenSSH ProxyJump           │
│  ┌───────────────────────▼──────────────────────────┐  │
│  │ Private Subnet: ewb-a-private (10.10.2.0/24)     │  │
│  │ • App-A (10.10.2.10 - NO Public IP)              │  │
│  │ • Route: 10.20.0.0/16 -> pcx-xxxxxx              │  │
│  └───────────────────────┬──────────────────────────┘  │
└──────────────────────────┼─────────────────────────────┘
                           │
             AWS VPC Peering Connection (pcx-xxxxxx)
                           │
┌──────────────────────────┼─────────────────────────────┐
│ VPC B (10.20.0.0/16)     │ (Completely Private VPC)    │
│                          ▼                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Private Subnet: ewb-b-private (10.20.1.0/24)     │  │
│  │ • App-B (10.20.1.10 - NO Public IP)              │  │
│  │ • Route: 10.10.0.0/16 -> pcx-xxxxxx              │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 🖥️ Application Features

1. **Interactive Network Topology & Live Packet Tracer**:
   - Visual map of VPC A, VPC B, subnets, route tables, and security groups.
   - Dynamic simulation buttons: **Baseline Ping Failure**, **Forward Ping**, **Reverse Ping**, **SSH ProxyJump**, and **Controlled Chaos Failure**.
   - Step-by-step packet inspection showing every hop, route table evaluation, and security group decision.

2. **Multi-Host Interactive Terminal Sandbox**:
   - Emulates Amazon Linux 2023 shell sessions across **Laptop**, **Bastion Host**, **App-A**, and **App-B**.
   - Real network diagnostic commands: `ping -c 4 <ip>`, `hostname -I`, `ssh`, `ip route`, `traceroute`, `cat ~/.ssh/config`.
   - Dynamic terminal response to interactive toggles (turn off peering or security rules to see real-time packet drops in the terminal).

3. **Step-by-Step AWS Console Guide**:
   - 8-step comprehensive walkthrough with exact AWS Management Console clicks, field names, and radio buttons.

4. **Production Infrastructure as Code (Terraform & CLI)**:
   - Ready-to-apply `main.tf` declaring VPCs, subnets, IGW, peering, route tables, security groups, and EC2 instances.
   - `deploy-lab.sh` automated AWS CLI provisioning script.
   - `cleanup-lab.sh` reverse-dependency teardown script.

---

## 💻 Local Development Setup

```bash
# Clone the repository
git clone https://github.com/<your-username>/aws-vpc-peering-simulator.git
cd aws-vpc-peering-simulator

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 📜 License
Apache-2.0
