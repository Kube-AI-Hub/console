---
title: "Use Cases"
keywords: "Kube AI Hub, GPU, AI, Heterogeneous Compute, Compute Management, vGPU, Compute Pooling"
description: "Core use cases for the Kube AI Hub AI Compute Management Platform: compute pooling, on-demand allocation, metered billing, and intelligent scheduling."
linkTitle: "Use Cases"
weight: 1700
---

The Kube AI Hub AI Compute Management Platform is purpose-built for enterprise AI infrastructure. By pooling and virtualizing heterogeneous GPU/CPU compute resources, it improves hardware utilization by 3–10x. The platform provides unified management across domestic and mainstream compute hardware, supporting fine-grained multi-tenant resource allocation, usage billing, and intelligent scheduling — helping enterprises build a secure, locally-controlled AI compute foundation.

## Product Value

![AI Compute Management Platform — Product Value](/images/docs/v3.x/introduction/use-cases/ai-compute-platform-value.svg)

### Compute Pooling — Maximum Utilization

By pooling and virtualizing heterogeneous GPU/CPU hardware into a unified resource pool, the platform eliminates resource silos. vGPU slicing enables a single physical GPU to serve multiple workloads simultaneously, improving utilization by 3–10x.

**Key benefits:**

- Unified management across heterogeneous hardware: NVIDIA, Cambricon, Huawei Ascend, Tianshu, and more
- vGPU virtualization for multi-tenant GPU sharing
- Elastic resource pool that scales dynamically with demand

### On-demand Allocation — Flexible Scheduling

The platform supports compute over-subscription and fine-grained slicing. Resources can be allocated flexibly by tenant, department, or project with elastic scaling policies. Administrators can configure resource quotas and priority rules to ensure critical workloads always get the compute they need.

**Key benefits:**

- Multi-tenant RBAC for secure and isolated resource access
- CPU/GPU over-subscription and fine-grained partitioning
- Elastic scaling policies with dynamic resource rebalancing

### Metered Billing — Fine-grained Cost Control

The built-in usage monitoring and billing module tracks GPU/CPU consumption across tenants and departments in real time, generating detailed billing reports that help enterprises manage IT costs precisely and make resource usage fully transparent.

**Key benefits:**

- Real-time monitoring of compute usage across all dimensions
- Multi-dimensional billing reports with export capability
- Cost allocation and chargeback by project or department

### Intelligent Scheduling & O&M

The platform provides distributed scheduling capacity at the scale of thousands of GPUs, with built-in task queues, service deployment, alerting, and log management. Intelligent scheduling strategies maximize resource utilization while reducing operational complexity.

**Key benefits:**

- Distributed AI training scheduling at 1000+ GPU node scale
- Built-in task queues with priority management
- Integrated monitoring, alerting, and log collection

---

## Product Architecture

![AI Compute Management Platform — Product Architecture](/images/docs/v3.x/introduction/use-cases/ai-compute-architecture.svg)

The platform uses a layered architecture, organized from top to bottom as follows:

### User & Permissions Layer

Provides standard authentication, custom authentication, and multi-tenant isolation to ensure secure and controlled access for users, departments, and projects.

- **Standard Authentication**: Compatible with LDAP/AD protocols, supports Single Sign-On (SSO)
- **Custom Authentication**: Integrates with enterprise identity systems
- **Multi-tenant Isolation**: Three-level resource isolation — platform, workspace, and project

### Cluster Management Layer

Provides unified visual management of nodes, groups, containers, storage, monitoring, and logs within underlying compute clusters, simplifying cluster operations through a wizard-style interface.

- Node lifecycle management
- Container and workload management
- Storage volumes and persistent configuration
- Cluster-level monitoring and logging

### Kubernetes with vGPU Middleware Layer

Built on Kubernetes with integrated vGPU scheduling, this layer provides:

- **App Management**: Full application lifecycle management via Helm Charts
- **Product Registry**: Integrated Harbor container registry for unified image management
- **Compute Resource Management**: GPU/CPU unified scheduling via Kubernetes extensions
- **Service Management**: Microservice deployment, routing, and traffic governance

### vGPU Virtualization Layer

The core compute virtualization capability, delivering:

- **Heterogeneous GPU Virtualization**: Virtual slicing of multi-vendor GPUs for multi-tenant sharing
- **GPU Compute Scheduling**: Intelligent scheduling based on task priority and resource quotas

### Hardware Cluster Layer

Supports mainstream and domestic compute hardware:

| Type | Supported Vendors |
|------|-------------------|
| GPU Clusters | NVIDIA, Cambricon, Huawei Ascend, Tianshu, and others |
| CPU Clusters | INTEL, AMD, Hygon, and others |
| File Storage | S3, NFS, and other distributed storage solutions |

For more information, see [Platform Features](../features/).
