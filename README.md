# AWS VPC Peering Simulator & Lab

An interactive cloud networking lab and simulator for Amazon Web Services (AWS) Virtual Private Cloud (VPC) Peering. Demonstrates private inter-VPC routing, strict least-privilege security groups, OpenSSH ProxyJump administration through a public bastion host, and empirical network verification.

---

## 📌 Repository Description (For GitHub About Section)

> **Short Description:**
> Interactive AWS VPC Peering simulator, live packet tracer, multi-host terminal sandbox, console walkthrough, and automated Terraform infrastructure for multi-VPC networking.

### 🏷️ GitHub Topics / Tags
`aws` `vpc-peering` `cloud-networking` `terraform` `bash` `ec2` `bastion-host` `security-groups` `packet-tracer` `react` `typescript`

---

## 🌐 Architecture Overview

The project provisions two non-overlapping Virtual Private Clouds (VPCs) connected via a native AWS VPC Peering connection:

```
[ Your Laptop / Admin ] (157.48.210.42/32)
         │
         │ SSH (Port 22)
         ▼
[ Internet Gateway: igw-a ]
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ VPC A (10.10.0.0/16)                                   │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Public Subnet: subnet-a-public (10.10.1.0/24)    │  │
│  │ • Bastion Host (10.10.1.10 + Public IPv4)         │  │
│  │ • Route: 0.0.0.0/0 -> igw-a                      │  │
│  │ • Route: 10.20.0.0/16 -> pcx-xxxxxx              │  │
│  └───────────────────────┬──────────────────────────┘  │
│                          │                             │
│  ┌───────────────────────▼──────────────────────────┐  │
│  │ Private Subnet: subnet-a-private (10.10.2.0/24)  │  │
│  │ • App-A (10.10.2.10 - No Public IP)              │  │
│  │ • Route: 10.20.0.0/16 -> pcx-xxxxxx              │  │
│  └───────────────────────┬──────────────────────────┘  │
└──────────────────────────┼─────────────────────────────┘
                           │
             AWS VPC Peering Connection (pcx-xxxxxx)
                           │
┌──────────────────────────┼─────────────────────────────┐
│ VPC B (10.20.0.0/16)     │ (No Internet Gateway!)       │
│                          ▼                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Private Subnet: subnet-b-private (10.20.1.0/24)  │  │
│  │ • App-B (10.20.1.10 - No Public IP)              │  │
│  │ • Route: 10.10.0.0/16 -> pcx-xxxxxx (Return Path)│  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

1. **Interactive Visual Topology & Dynamic Packet Tracer**:
   - Visualizes VPC A, VPC B, subnets, route tables, security groups, and the peering link.
   - Step-by-step packet tracer simulating **Forward Ping**, **Reverse Ping**, **SSH ProxyJump**, **Baseline Failure**, and **Controlled Chaos Failure**.

2. **Multi-Host Interactive Terminal Sandbox**:
   - Emulates Amazon Linux 2023 shell sessions across **Student Laptop**, **Bastion Host**, **App-A**, and **App-B**.
   - Supports real network troubleshooting commands (`ping`, `hostname -I`, `ssh`, `ip route`, `cat ~/.ssh/config`).
   - One-click **Auto-Run Verification Suite** testing all acceptance criteria.

3. **Two Deployment Paths**:
   - **AWS Management Console Guide**: 8-step click-by-click manual walkthrough with exact form fields and UI buttons.
   - **Infrastructure as Code (Terraform)**: Complete, production-grade `main.tf` ready for `terraform apply`.
   - **AWS CLI Scripts**: `deploy-lab.sh` and reverse-dependency `cleanup-lab.sh`.

---

## 🔒 Security Compliance (Least Privilege)

| Security Group | Inbound Protocol & Port | Allowed Source | Purpose |
| :--- | :--- | :--- | :--- |
| **sg-bastion** | TCP 22 (SSH) | `Your Public IP /32` | Administrative entry point |
| **sg-app-a** | TCP 22 (SSH) | `10.10.1.10/32` (Bastion private IP) | ProxyJump SSH access |
| **sg-app-a** | ICMP Echo Request | `10.20.1.10/32` (App-B) | Reverse ping testing |
| **sg-app-b** | TCP 22 (SSH) | `10.10.1.10/32` (Bastion private IP) | ProxyJump SSH access |
| **sg-app-b** | ICMP Echo Request | `10.10.2.10/32` (App-A) | Forward ping testing |

---

## 🧪 Verification & Acceptance Tests

1. **Test 01: Baseline Isolation (Pre-Peering)**:
   ```bash
   [ec2-user@ip-10-10-2-10 ~]$ ping -c 4 10.20.1.10
   # Result: 100% packet loss (Destination Host Unreachable)
   ```
2. **Test 02: Forward Path Reachability**:
   ```bash
   [ec2-user@ip-10-10-2-10 ~]$ ping -c 4 10.20.1.10
   # Result: 4 packets transmitted, 4 received, 0% packet loss (avg 0.8ms)
   ```
3. **Test 03: Reverse Path Return Route**:
   ```bash
   [ec2-user@ip-10-20-1-10 ~]$ ping -c 4 10.10.2.10
   # Result: 4 packets transmitted, 4 received, 0% packet loss
   ```
4. **Test 04: OpenSSH ProxyJump**:
   ```bash
   user@laptop:~ $ ssh app-b
   # Result: Direct authenticated interactive shell on private App-B host
   ```
5. **Controlled Chaos & Recovery Experiment**:
   - Revoke ICMP rule on `sg-app-b` &rarr; Ping fails (silent drop).
   - Re-authorize ICMP rule &rarr; Ping immediately resumes (0% loss).

---

## 🛠️ Quickstart (Terraform)

```bash
# Clone the repository
git clone https://github.com/your-username/aws-vpc-peering-simulator.git
cd aws-vpc-peering-simulator

# Initialize Terraform
terraform init

# Review and apply
terraform plan
terraform apply -auto-approve

# Clean up resources when finished
terraform destroy -auto-approve
```

---

## 📜 License
Apache-2.0
