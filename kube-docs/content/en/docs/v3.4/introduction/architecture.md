---
title: "Architecture"
keywords: "Kube AI Hub, Kubernetes, architecture, API Server, GPU Scheduler"
description: "Kube AI Hub system architecture"
linkTitle: "Architecture"
weight: 1500
---

## Decoupled Frontend and Backend

Kube AI Hub separates frontend from backend. The console communicates with backend services through standard REST APIs, and each backend component can scale independently or integrate with external systems. See [API Documentation](../../reference/api-docs/) for details.

The following diagram illustrates the overall system architecture:

![System Architecture](/images/docs/v3.x/introduction/system-architecture-new.svg)

## Frontend

The Kube AI Hub Console is built with React and MobX, using a Node.js service layer to proxy user requests to the backend REST API. The platform also includes a built-in Web Terminal, enabling users to run kubectl commands directly in the browser.

## Backend Core Components

| Component | Description |
|---|---|
| ks-apiserver | Unified API interface for cluster management, handling inter-module communication and security control |
| API Gateway | Authentication, request routing, and proxying; supports LDAP/AD/SSO integration |
| ks-controller-manager | Implements platform business logic, e.g., syncing permissions when a workspace is created |
| GPU Scheduler | Heterogeneous GPU scheduler handling vGPU virtualization slicing and multi-card parallel dispatch |

## Kubernetes Layer

The platform uses standard Kubernetes as its foundation without any invasive modifications. All extensions are implemented via CRD (Custom Resource Definitions). Key Kubernetes capabilities leveraged include:

- **Cluster API**: Resource CRUD operations and state synchronization
- **Scheduler**: Pod scheduling policies (affinity, taints, GPU resource requests)
- **Workload Engine**: Lifecycle management for Deployment, StatefulSet, DaemonSet, Job, and CronJob
- **RBAC**: Fine-grained role and permission control

## Optional Components

The following components are all optional and can be enabled on demand:

| Component | Function |
|---|---|
| Prometheus | Metric collection and alerting for clusters, nodes, and GPUs |
| Elasticsearch | Log indexing and full-text search |
| Fluent Bit | Container log collection and forwarding |
| Harbor | Container image registry with scanning and permission management |
| OpenLDAP / AD | Enterprise user identity authentication and unified account management |
| KubeEdge | Cloud-edge collaboration, extending compute scheduling to edge nodes |

## Infrastructure

Kube AI Hub can run on any compatible infrastructure:

- **Bare metal servers**: Ideal for high-performance GPU cluster deployments
- **Virtual machines and private cloud**: On-premises data center installations
- **Managed Kubernetes**: Alibaba Cloud, AWS, Huawei Cloud, Tencent Cloud, and more
- **Hybrid cloud**: Unified management of multiple clusters across data centers

Supports multiple storage backends (S3, NFS, Ceph, LocalPV) and network plugins (Calico, Flannel).
