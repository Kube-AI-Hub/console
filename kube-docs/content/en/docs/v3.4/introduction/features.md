---
title: "Features"
keywords: "Kube AI Hub, Kubernetes, GPU, heterogeneous compute, features, vGPU"
description: "Kube AI Hub key platform features"
linkTitle: "Features"
weight: 1300
---

## Overview

Kube AI Hub is a heterogeneous compute management platform designed for GPU/AI workloads. It covers the full management lifecycle from hardware onboarding to workload delivery, with Kubernetes as its core engine. Through a unified web console, the platform provides visual operations across three major product modules: the Compute Platform, the Industry AI Model Platform, and System Management.

## Compute Platform

### Resource Overview

Core metrics display for all cluster compute resources, including compute/VRAM allocation and utilization, node count, GPU card count, total CPU, total memory, total VRAM, container-level resource usage, and monitoring alerts.

### Node Management

#### Cluster Node Management

Monitor and manage compute node status. Supports enabling or disabling scheduling on nodes, viewing physical GPU cards and GPU card topology, configuring GPU virtualization modes, and monitoring all tasks running on each node.

#### Sharing/Slicing Policies

Configure GPU sharing and slicing policies at the node level, setting vGPU count, compute power, and VRAM sharing/overcommit ratios for all GPU cards on a node.

#### GPU Card Management

Monitor physical GPU card status, including allocation and usage information, and view all tasks running on each physical GPU card.

### Service Components

Displays the health status and runtime metrics of Kubernetes core service components (API Server, Scheduler, Controller Manager, etcd, etc.), helping ops teams quickly identify component-level failures.

### Projects (Namespace Management)

#### Project Management

Organize cluster resources by project, view project resources and pods, and assign projects to tenants.

#### Resource Quotas

A mechanism to limit GPU and other resource usage, ensuring fair resource allocation and preventing overuse. Supports setting quotas for GPU, CPU, memory, pods, and jobs.

### App Workloads

#### Workloads

Manages cluster-level workloads, including:

- **Deployments**: Stateless application management with rolling upgrades, rollback, and autoscaling (HPA)
- **StatefulSets**: Stateful service management with stable Pod identity and persistent storage guarantees
- **DaemonSets**: Ensures a specified Pod runs on every node, suitable for node monitoring and log collection

#### Jobs and CronJobs

- **Jobs**: Manage one-time batch tasks with configurable parallelism and completion policies
- **CronJobs**: Periodically triggered batch tasks based on Cron expressions, suitable for data cleanup and scheduled reporting

#### Pods

View pods across all namespaces at cluster level, with filtering by node, status, and labels. Supports direct access to container terminals for command execution.

#### Services

Manages ClusterIP, NodePort, and LoadBalancer type Kubernetes services, displaying port mappings and backend Endpoint status.

#### Routes (Ingress)

Manages cluster-level Ingress rules, supporting HTTP/HTTPS routing based on domain names and paths.

### Configuration Management

- **Secrets**: Securely store sensitive information (passwords, certificates, tokens) with RBAC-controlled access
- **ConfigMaps**: Manage application configuration in key-value or file format
- **Service Accounts**: Manage API access credentials for Pods

### Network Management

- **Network Policies (NetworkPolicy)**: Define Pod-to-Pod communication rules to enforce network-layer isolation
- **Pod IP Pools (IPPool)**: Manage Pod IP address allocation ranges with Calico integration support

### Storage Management

- **Persistent Volume Claims (PVC)**: Declare persistent storage needs with support for dynamic provisioning via StorageClass
- **Storage Classes**: Define storage backend policies supporting Ceph, NFS, LocalPV, JuiceFS, and other storage solutions
- **Volume Snapshots**: Create point-in-time snapshots of persistent volumes for quick recovery
- **Volume Snapshot Classes**: Define snapshot drivers and deletion policies

### Custom Resources (CRDs)

Provides a visual management interface for all Custom Resource Definitions (CRDs) in the cluster, available to platform administrators. Supports viewing custom resource instances and their details.

### Monitoring and Alerting

#### Cluster Status Monitoring

Provides cluster-level monitoring at second-level precision, including CPU utilization, memory utilization, load average, disk usage, I/O throughput, network traffic, and API Server request rates.

#### GPU Resource Monitoring

A monitoring view designed specifically for GPU compute scenarios. Displays real-time metrics per node and per GPU card: GPU health status, GPU utilization and VRAM usage, GPU allocation, and resource usage rankings.

#### Alert Messages

Displays alerts triggered in the cluster in real time, including node anomalies, Pod crashes, and storage alerts. Supports filtering by severity level (Critical, Warning, Info) with full alert history.

#### Alert Rules

Define custom alerting rules for nodes, workloads, and pods. Set metric thresholds and trigger conditions, configure alert repeat intervals and notification recipients. Supported notification channels include email, WeCom, DingTalk, and Slack.

### Log Management

#### Log Receivers

Configure unified log collection policies at the cluster level, supporting log storage backends including Elasticsearch, Kafka, and Fluentd. Multi-tenant log isolation is enforced — tenants can only view logs belonging to their own workloads.

#### Log Query

Provides log collection, query, and management capabilities from the user's perspective. Supports viewing and searching logs at the project, application, and container levels.

### Events and Audit

#### Event Query

Supports Kubernetes event queries. Events can be searched by message, tenant, project, resource type, resource name, reason, and category.

#### Audit Log Query

Records all activities by users, administrators, and other components that impact the system, generating events that can be queried by cluster, project, tenant, resource type, resource name, action, operator, and time range.

### Cluster Settings

- **Basic Information**: View cluster name, Kubernetes version, node count, and other basic details
- **Visibility**: Control which workspaces can access the cluster
- **Member Management**: Manage cluster-level user and role assignments
- **Role Management**: Define custom cluster-level access roles and permission sets
- **Log Receivers**: Configure log collection backends in cluster settings
- **Gateway Settings**: Manage cluster or project-level ingress gateways

## Tenant Management (Workspaces)

### Tenant (Workspace) List

View the tenant list, edit tenant information, and add or remove tenants.

### Tenant Projects

Manage projects under a tenant, view project resource usage, and create or delete projects.

### Application Management

Provides Helm-based application lifecycle management. Tenant administrators can upload or create new application templates, perform rapid testing, and publish tested applications to the App Store for other tenants to deploy with one click.

### Tenant Settings

Configure tenant resource quotas, manage tenant members, roles, and departments. Platform users can be added to tenants via invitation.

## Tenant User Management

### User Management

Add and manage users within the organization, configure permissions, roles, and member operation privileges.

### Platform Roles

Control user access to platform resources, including cluster management, workspace management, and platform user management.

### Resource Specifications

Create and manage instance specifications including CPU, memory, disk, and GPU configurations. Users can select pre-defined specifications when creating container instances.

### Third-party Login

Provides a built-in OAuth service, supporting external user access through multiple methods including LDAP, OIDC, CAS, and OAuth 2.0.

## Industry AI Model Platform

### Model Hub

#### Model Creation

Create model repositories with a card-style UI.

#### Model Card Management

Provides a card-style UI for model list management, enabling users to intuitively view model information with multi-criteria quick search support.

#### Model Filtering

Supports tag-based model card filtering (innovative version updates are in progress; the standard version is currently available).

#### Model File Download

Provides model file download capability for secondary customization and deployment.

#### Model File Upload

Supports 4 upload methods: clone repo source files, sync files from existing repos, and sync models from Hugging Face or ModelScope to internal repos.

#### Model Integration

Supports importing various large and small model types, including Qwen, DeepSeek, ChatGLM, Kimi, Llama, and other well-known domestic and international models, with ongoing expansion to more model platforms.

### Model Inference Management

#### Public Model Inference Service

Supports deploying and managing public model inference service platforms.

#### Dedicated Model Instance Deployment

Supports deploying user-dedicated model inference instances with compute resource management, service online/offline control, and deletion.

#### Service Details

Provides a dialog interface for conversation and model interaction, displaying API/SDK method documentation for calling model inference services.

#### Service Invocation

Supports one-click model service deployment, with API/SDK calling support for published model inference services.

### Model Training and Evaluation

#### Model Fine-tuning

The platform provides GPU-accelerated fine-tuning instance hosting services, supporting mainstream fine-tuning frameworks (LLaMA-Factory, MS-Swift). Users only need to select compute resources and datasets to quickly fine-tune large models without writing complex training code.

#### Model Evaluation

Supports visual interface model evaluation with three mainstream evaluation frameworks: lm-evaluation-harness, OpenCompass, and EvalScope. Supports custom evaluation datasets — users can upload their own datasets for model performance evaluation to meet specific business scenario assessment needs.

### Data Management

Provides dataset collection creation, creation, deletion, and version management capabilities. Supports uploading or downloading datasets via Git or SDK.

### Development Tools

#### Development Environment

A unified interface for creating and managing Notebook instances. Users can directly use platform compute resources for data analysis, model training, and experimentation without manual environment setup.

#### User Spaces

Provides rapid service deployment through code repositories with compute resource configuration, offering three interactive development environments: JupyterLab, VS Code, and Eclipse Theia.

## System Management

### User Information Management

#### Personal Information

Supports user profile configuration, including viewing personal models, code, and user spaces.

#### Account Settings

Configure user Access Tokens and SSH Keys.

### Admin Console

#### Resource Management Console

Manage personal platform resources including Notebook instances, fine-tuning instances, dedicated inference instances, model evaluation tasks, and Notebook image configurations.

#### Runtime Framework and Image Management

Configure inference engines, model fine-tuning training, model evaluation, and Notebook image configurations.

#### Compute Specification Management

Supports system administrators in managing compute specifications through a card-style interface, including Notebook image configurations.
