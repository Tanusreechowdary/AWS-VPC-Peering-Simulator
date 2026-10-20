export const terraformCode = `##############################################################################
# AWS VPC Peering - Infrastructure as Code (Terraform)
##############################################################################

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project   = "AWS-VPC-Peering"
      ManagedBy = "Terraform"
    }
  }
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "admin_public_ip" {
  description = "Administrator public IPv4 for bastion SSH ingress (format: x.x.x.x/32)"
  type        = string
  default     = "157.48.210.42/32"
}

# ----------------------------------------------------------------------------
# 1. KEY PAIR
# ----------------------------------------------------------------------------
resource "aws_key_pair" "lab_key" {
  key_name   = "lab-key"
  public_key = file("~/.ssh/lab-key.pub")
}

# ----------------------------------------------------------------------------
# 2. VPC A (10.10.0.0/16) & NETWORKING
# ----------------------------------------------------------------------------
resource "aws_vpc" "vpc_a" {
  cidr_block           = "10.10.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "vpc-a"
  }
}

resource "aws_internet_gateway" "igw_a" {
  vpc_id = aws_vpc.vpc_a.id

  tags = {
    Name = "igw-a"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_subnet" "subnet_a_public" {
  vpc_id                  = aws_vpc.vpc_a.id
  cidr_block              = "10.10.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = false

  tags = {
    Name = "subnet-a-public"
  }
}

resource "aws_subnet" "subnet_a_private" {
  vpc_id                  = aws_vpc.vpc_a.id
  cidr_block              = "10.10.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = false

  tags = {
    Name = "subnet-a-private"
  }
}

# ----------------------------------------------------------------------------
# 3. VPC B (10.20.0.0/16) & NETWORKING (NO IGW)
# ----------------------------------------------------------------------------
resource "aws_vpc" "vpc_b" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "vpc-b"
  }
}

resource "aws_subnet" "subnet_b_private" {
  vpc_id                  = aws_vpc.vpc_b.id
  cidr_block              = "10.20.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = false

  tags = {
    Name = "subnet-b-private"
  }
}

# ----------------------------------------------------------------------------
# 4. VPC PEERING CONNECTION
# ----------------------------------------------------------------------------
resource "aws_vpc_peering_connection" "peering" {
  vpc_id      = aws_vpc.vpc_a.id
  peer_vpc_id = aws_vpc.vpc_b.id
  auto_accept = true

  tags = {
    Name = "vpc-peering-a-b"
  }
}

# ----------------------------------------------------------------------------
# 5. ROUTE TABLES & ASSOCIATIONS
# ----------------------------------------------------------------------------
resource "aws_route_table" "rt_a_public" {
  vpc_id = aws_vpc.vpc_a.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw_a.id
  }

  route {
    cidr_block                = "10.20.0.0/16"
    vpc_peering_connection_id = aws_vpc_peering_connection.peering.id
  }

  tags = {
    Name = "rt-a-public"
  }
}

resource "aws_route_table_association" "a_public" {
  subnet_id      = aws_subnet.subnet_a_public.id
  route_table_id = aws_route_table.rt_a_public.id
}

resource "aws_route_table" "rt_a_private" {
  vpc_id = aws_vpc.vpc_a.id

  route {
    cidr_block                = "10.20.0.0/16"
    vpc_peering_connection_id = aws_vpc_peering_connection.peering.id
  }

  tags = {
    Name = "rt-a-private"
  }
}

resource "aws_route_table_association" "a_private" {
  subnet_id      = aws_subnet.subnet_a_private.id
  route_table_id = aws_route_table.rt_a_private.id
}

resource "aws_route_table" "rt_b_private" {
  vpc_id = aws_vpc.vpc_b.id

  route {
    cidr_block                = "10.10.0.0/16"
    vpc_peering_connection_id = aws_vpc_peering_connection.peering.id
  }

  tags = {
    Name = "rt-b-private"
  }
}

resource "aws_route_table_association" "b_private" {
  subnet_id      = aws_subnet.subnet_b_private.id
  route_table_id = aws_route_table.rt_b_private.id
}

# ----------------------------------------------------------------------------
# 6. SECURITY GROUPS (STRICT LEAST-PRIVILEGE /32 RULES)
# ----------------------------------------------------------------------------
resource "aws_security_group" "sg_bastion" {
  name        = "sg-bastion"
  description = "Permit SSH strictly from admin public IP"
  vpc_id      = aws_vpc.vpc_a.id

  ingress {
    description = "SSH from admin IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_public_ip]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sg-bastion"
  }
}

resource "aws_security_group" "sg_app_a" {
  name        = "sg-app-a"
  description = "Private workload A security group"
  vpc_id      = aws_vpc.vpc_a.id

  ingress {
    description = "SSH from Bastion private IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.10.1.10/32"]
  }

  ingress {
    description = "Custom ICMP Echo Request from app-b"
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = ["10.20.1.10/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sg-app-a"
  }
}

resource "aws_security_group" "sg_app_b" {
  name        = "sg-app-b"
  description = "Private workload B security group"
  vpc_id      = aws_vpc.vpc_b.id

  ingress {
    description = "SSH from Bastion private IP via ProxyJump"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.10.1.10/32"]
  }

  ingress {
    description = "Custom ICMP Echo Request from app-a"
    from_port   = 8
    to_port     = 0
    protocol    = "icmp"
    cidr_blocks = ["10.10.2.10/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sg-app-b"
  }
}

# ----------------------------------------------------------------------------
# 7. EC2 INSTANCES (AMAZON LINUX 2023)
# ----------------------------------------------------------------------------
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_instance" "bastion" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = "t3.micro"
  key_name                    = aws_key_pair.lab_key.key_name
  subnet_id                   = aws_subnet.subnet_a_public.id
  private_ip                  = "10.10.1.10"
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.sg_bastion.id]

  root_block_device {
    volume_size           = 8
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name = "bastion-host"
  }
}

resource "aws_instance" "app_a" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = "t3.micro"
  key_name                    = aws_key_pair.lab_key.key_name
  subnet_id                   = aws_subnet.subnet_a_private.id
  private_ip                  = "10.10.2.10"
  associate_public_ip_address = false
  vpc_security_group_ids      = [aws_security_group.sg_app_a.id]

  root_block_device {
    volume_size           = 8
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name = "app-a"
  }
}

resource "aws_instance" "app_b" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = "t3.micro"
  key_name                    = aws_key_pair.lab_key.key_name
  subnet_id                   = aws_subnet.subnet_b_private.id
  private_ip                  = "10.20.1.10"
  associate_public_ip_address = false
  vpc_security_group_ids      = [aws_security_group.sg_app_b.id]

  root_block_device {
    volume_size           = 8
    volume_type           = "gp3"
    delete_on_termination = true
  }

  tags = {
    Name = "app-b"
  }
}

output "bastion_public_ip" {
  value       = aws_instance.bastion.public_ip
  description = "Public IP of Bastion host"
}

output "peering_connection_id" {
  value       = aws_vpc_peering_connection.peering.id
  description = "ID of VPC Peering connection"
}
`;

export const bashDeployScript = `#!/usr/bin/env bash
# ==============================================================================
# AWS CLI Automated Deployment Script for VPC Peering
# ==============================================================================
set -e

REGION="ap-south-1"
PROJECT_TAG="AWS-VPC-Peering"

echo "=== [1/7] Creating VPC A and VPC B ==="
VPC_A_ID=$(aws ec2 create-vpc --cidr-block 10.10.0.0/16 --region $REGION \\
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=vpc-a},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'Vpc.VpcId' --output text)

VPC_B_ID=$(aws ec2 create-vpc --cidr-block 10.20.0.0/16 --region $REGION \\
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=vpc-b},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'Vpc.VpcId' --output text)

echo "VPC A: $VPC_A_ID | VPC B: $VPC_B_ID"

echo "=== [2/7] Creating Subnets ==="
AZ=$(aws ec2 describe-availability-zones --region $REGION --query 'AvailabilityZones[0].ZoneName' --output text)

SUBNET_A_PUB=$(aws ec2 create-subnet --vpc-id $VPC_A_ID --cidr-block 10.10.1.0/24 --availability-zone $AZ --region $REGION \\
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=subnet-a-public},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'Subnet.SubnetId' --output text)

SUBNET_A_PRIV=$(aws ec2 create-subnet --vpc-id $VPC_A_ID --cidr-block 10.10.2.0/24 --availability-zone $AZ --region $REGION \\
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=subnet-a-private},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'Subnet.SubnetId' --output text)

SUBNET_B_PRIV=$(aws ec2 create-subnet --vpc-id $VPC_B_ID --cidr-block 10.20.1.0/24 --availability-zone $AZ --region $REGION \\
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=subnet-b-private},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'Subnet.SubnetId' --output text)

echo "=== [3/7] Creating and Attaching Internet Gateway to VPC A ==="
IGW_A_ID=$(aws ec2 create-internet-gateway --region $REGION \\
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=igw-a},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'InternetGateway.InternetGatewayId' --output text)

aws ec2 attach-internet-gateway --vpc-id $VPC_A_ID --internet-gateway-id $IGW_A_ID --region $REGION

echo "=== [4/7] Creating Peering Connection ==="
PEER_ID=$(aws ec2 create-vpc-peering-connection --vpc-id $VPC_A_ID --peer-vpc-id $VPC_B_ID --region $REGION \\
  --tag-specifications "ResourceType=vpc-peering-connection,Tags=[{Key=Name,Value=vpc-peering-a-b},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'VpcPeeringConnection.VpcPeeringConnectionId' --output text)

aws ec2 accept-vpc-peering-connection --vpc-peering-connection-id $PEER_ID --region $REGION

echo "=== [5/7] Creating and Configuring Route Tables ==="
RT_A_PUB=$(aws ec2 create-route-table --vpc-id $VPC_A_ID --region $REGION \\
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=rt-a-public},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 associate-route-table --subnet-id $SUBNET_A_PUB --route-table-id $RT_A_PUB --region $REGION
aws ec2 create-route --route-table-id $RT_A_PUB --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_A_ID --region $REGION
aws ec2 create-route --route-table-id $RT_A_PUB --destination-cidr-block 10.20.0.0/16 --vpc-peering-connection-id $PEER_ID --region $REGION

RT_A_PRIV=$(aws ec2 create-route-table --vpc-id $VPC_A_ID --region $REGION \\
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=rt-a-private},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 associate-route-table --subnet-id $SUBNET_A_PRIV --route-table-id $RT_A_PRIV --region $REGION
aws ec2 create-route --route-table-id $RT_A_PRIV --destination-cidr-block 10.20.0.0/16 --vpc-peering-connection-id $PEER_ID --region $REGION

RT_B_PRIV=$(aws ec2 create-route-table --vpc-id $VPC_B_ID --region $REGION \\
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=rt-b-private},{Key=Project,Value=$PROJECT_TAG}]" \\
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 associate-route-table --subnet-id $SUBNET_B_PRIV --route-table-id $RT_B_PRIV --region $REGION
aws ec2 create-route --route-table-id $RT_B_PRIV --destination-cidr-block 10.10.0.0/16 --vpc-peering-connection-id $PEER_ID --region $REGION

echo "=== [6/7] Creating Security Groups ==="
MY_IP=$(curl -s https://checkip.amazonaws.com)/32
SG_BASTION=$(aws ec2 create-security-group --group-name sg-bastion --description "Bastion SG" --vpc-id $VPC_A_ID --region $REGION --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $SG_BASTION --protocol tcp --port 22 --cidr $MY_IP --region $REGION

SG_APP_A=$(aws ec2 create-security-group --group-name sg-app-a --description "App A SG" --vpc-id $VPC_A_ID --region $REGION --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $SG_APP_A --protocol tcp --port 22 --cidr 10.10.1.10/32 --region $REGION
aws ec2 authorize-security-group-ingress --group-id $SG_APP_A --protocol icmp --port -1 --cidr 10.20.1.10/32 --region $REGION

SG_APP_B=$(aws ec2 create-security-group --group-name sg-app-b --description "App B SG" --vpc-id $VPC_B_ID --region $REGION --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $SG_APP_B --protocol tcp --port 22 --cidr 10.10.1.10/32 --region $REGION
aws ec2 authorize-security-group-ingress --group-id $SG_APP_B --protocol icmp --port -1 --cidr 10.10.2.10/32 --region $REGION

echo "=== [7/7] Launching EC2 Instances ==="
AMI_ID=$(aws ssm get-parameter --name "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" --region $REGION --query 'Parameter.Value' --output text)

BASTION_ID=$(aws ec2 run-instances --image-id $AMI_ID --instance-type t3.micro --key-name lab-key \\
  --subnet-id $SUBNET_A_PUB --private-ip-address 10.10.1.10 --associate-public-ip-address \\
  --security-group-ids $SG_BASTION --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=bastion-host},{Key=Project,Value=$PROJECT_TAG}]" \\
  --region $REGION --query 'Instances[0].InstanceId' --output text)

APP_A_ID=$(aws ec2 run-instances --image-id $AMI_ID --instance-type t3.micro --key-name lab-key \\
  --subnet-id $SUBNET_A_PRIV --private-ip-address 10.10.2.10 --no-associate-public-ip-address \\
  --security-group-ids $SG_APP_A --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=app-a},{Key=Project,Value=$PROJECT_TAG}]" \\
  --region $REGION --query 'Instances[0].InstanceId' --output text)

APP_B_ID=$(aws ec2 run-instances --image-id $AMI_ID --instance-type t3.micro --key-name lab-key \\
  --subnet-id $SUBNET_B_PRIV --private-ip-address 10.20.1.10 --no-associate-public-ip-address \\
  --security-group-ids $SG_APP_B --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=app-b},{Key=Project,Value=$PROJECT_TAG}]" \\
  --region $REGION --query 'Instances[0].InstanceId' --output text)

echo "=== Infrastructure Provisioned Successfully! ==="
`;

export const bashCleanupScript = `#!/usr/bin/env bash
# ==============================================================================
# AWS CLI Teardown Script (Reverse Dependency Order)
# ==============================================================================
set -e
REGION="ap-south-1"

echo "=== 1. Terminating EC2 Instances ==="
INSTANCE_IDS=$(aws ec2 describe-instances --filters "Name=tag:Project,Values=AWS-VPC-Peering" \\
  --query 'Reservations[*].Instances[*].InstanceId' --output text --region $REGION)

if [ -n "$INSTANCE_IDS" ]; then
  aws ec2 terminate-instances --instance-ids $INSTANCE_IDS --region $REGION
  aws ec2 wait instance-terminated --instance-ids $INSTANCE_IDS --region $REGION
fi

echo "=== 2. Deleting VPC Peering Connection ==="
PEER_ID=$(aws ec2 describe-vpc-peering-connections --filters "Name=tag:Project,Values=AWS-VPC-Peering" \\
  --query 'VpcPeeringConnections[*].VpcPeeringConnectionId' --output text --region $REGION)
if [ -n "$PEER_ID" ]; then
  aws ec2 delete-vpc-peering-connection --vpc-peering-connection-id $PEER_ID --region $REGION
fi

echo "=== 3. Deleting Security Groups ==="
for SG in $(aws ec2 describe-security-groups --filters "Name=tag:Project,Values=AWS-VPC-Peering" --query 'SecurityGroups[*].GroupId' --output text --region $REGION); do
  aws ec2 delete-security-group --group-id $SG --region $REGION || true
done

echo "=== 4. Deleting Subnets & Route Tables ==="
for RT in $(aws ec2 describe-route-tables --filters "Name=tag:Project,Values=AWS-VPC-Peering" --query 'RouteTables[*].RouteTableId' --output text --region $REGION); do
  aws ec2 delete-route-table --route-table-id $RT --region $REGION || true
done

for SUB in $(aws ec2 describe-subnets --filters "Name=tag:Project,Values=AWS-VPC-Peering" --query 'Subnets[*].SubnetId' --output text --region $REGION); do
  aws ec2 delete-subnet --subnet-id $SUB --region $REGION || true
done

echo "=== 5. Detaching and Deleting Internet Gateway ==="
for IGW in $(aws ec2 describe-internet-gateways --filters "Name=tag:Project,Values=AWS-VPC-Peering" --query 'InternetGateways[*].InternetGatewayId' --output text --region $REGION); do
  VPC_ATTACHED=$(aws ec2 describe-internet-gateways --internet-gateway-ids $IGW --query 'InternetGateways[0].Attachments[0].VpcId' --output text --region $REGION)
  if [ "$VPC_ATTACHED" != "None" ]; then
    aws ec2 detach-internet-gateway --internet-gateway-id $IGW --vpc-id $VPC_ATTACHED --region $REGION
  fi
  aws ec2 delete-internet-gateway --internet-gateway-id $IGW --region $REGION
done

echo "=== 6. Deleting VPCs ==="
for VPC in $(aws ec2 describe-vpcs --filters "Name=tag:Project,Values=AWS-VPC-Peering" --query 'Vpcs[*].VpcId' --output text --region $REGION); do
  aws ec2 delete-vpc --vpc-id $VPC --region $REGION
done

echo "=== Teardown Complete! Zero Remaining Resources. ==="
`;

export const sshConfigFile = `# ~/.ssh/config for AWS VPC Peering
Host bastion-host
  HostName 13.235.148.82 # Replace with your bastion public IPv4
  User ec2-user
  IdentityFile ~/.ssh/lab-key.pem
  IdentitiesOnly yes

Host app-a
  HostName 10.10.2.10
  User ec2-user
  IdentityFile ~/.ssh/lab-key.pem
  IdentitiesOnly yes
  ProxyJump bastion-host

Host app-b
  HostName 10.20.1.10
  User ec2-user
  IdentityFile ~/.ssh/lab-key.pem
  IdentitiesOnly yes
  ProxyJump bastion-host
`;
