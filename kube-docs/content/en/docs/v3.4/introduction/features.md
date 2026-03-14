---
title: "Features"
keywords: "Kube AI Hub, Kubernetes, GPU, heterogeneous compute, features, vGPU"
description: "Kube AI Hub key platform features"
linkTitle: "Features"
weight: 1300
---

## Overview

Kube AI Hub is a heterogeneous compute management platform designed for GPU/AI workloads. It covers the full management lifecycle from hardware onboarding to workload delivery, with Kubernetes as its core engine. Through a unified web console, the platform provides visual operations across node management, workloads, storage, networking, monitoring and alerting, log collection, multi-tenant access control, and metering.

## Overview Dashboard

The cluster overview page aggregates the following key information:

- Overall cluster CPU, memory, and disk usage
- Total GPU card count and real-time utilization
- Node health status (Ready / Not Ready / Unknown)
- Pod running status (Running / Pending / Failed)
- System component health checks

## Node Management

### Cluster Nodes

Lists all compute nodes with status information. Supports node operations including Cordon, Drain, and label management. Node detail pages provide real-time CPU, memory, and Pod resource monitoring charts along with event records.

### Edge Nodes

Extends compute scheduling to edge devices via KubeEdge, supporting cloud-edge collaborative inference job distribution and management.

### GPU Cards

Lists all GPU cards in the cluster, displaying key metrics per card including model, driver version, VRAM size, utilization, and temperature. Supports NVIDIA, Huawei Ascend, Cambricon, Iluvatar, and other heterogeneous GPUs.

## Service Components

Displays the health status and runtime metrics of Kubernetes core service components (API Server, Scheduler, Controller Manager, etcd, etc.), helping ops teams quickly identify component-level failures.

## Projects (Namespace Management)

Unified management of all projects (namespaces) at the cluster level, with resource quota settings, member permission management, and usage summaries per project.

## App Workloads

### Workloads

Manages cluster-level workloads, including:

- **Deployments**: Stateless application management with rolling upgrades, rollback, and autoscaling (HPA)
- **StatefulSets**: Stateful service management with stable Pod identity and persistent storage guarantees
- **DaemonSets**: Ensures a specified Pod runs on every node, suitable for node monitoring and log collection

Workload detail pages provide container lists, environment variables, volume mounts, monitoring charts, and event records. Container specs can be edited through a guided UI.

### Jobs and CronJobs

- **Jobs**: Manage one-time batch tasks with configurable parallelism and completion policies
- **CronJobs**: Periodically triggered batch tasks based on Cron expressions, suitable for data cleanup and scheduled reporting

### Pods

View pods across all namespaces at cluster level, with filtering by node, status, and labels. Supports direct access to container terminals for command execution.

### Services

Manages ClusterIP, NodePort, and LoadBalancer type Kubernetes services, displaying port mappings and backend Endpoint status.

### Routes (Ingress)

Manages cluster-level Ingress rules, supporting HTTP/HTTPS routing based on domain names and paths.

## Configuration Management

- **Secrets**: Securely store sensitive information (passwords, certificates, tokens) with RBAC-controlled access
- **ConfigMaps**: Manage application configuration in key-value or file format
- **Service Accounts**: Manage API access credentials for Pods

## Storage Management

- **Persistent Volume Claims (PVC)**: Declare persistent storage needs with support for dynamic provisioning via StorageClass
- **Storage Classes**: Define storage backend policies supporting Ceph, NFS, LocalPV, and other storage solutions
- **Volume Snapshots**: Create point-in-time snapshots of persistent volumes for quick recovery
- **Volume Snapshot Classes**: Define snapshot drivers and deletion policies

## Network Management

- **Network Policies**: Define Pod-to-Pod communication rules to enforce network-layer isolation
- **Pod IP Pools**: Manage Pod IP address allocation ranges with Calico integration support
- **Gateway**: Manage cluster or project-level ingress gateways as a unified external access point

## Custom Resources (CRDs)

Provides a visual management interface for all Custom Resource Definitions (CRDs) in the cluster, available to platform administrators. Supports viewing custom resource instances and their details.

## Monitoring and Alerting

### Cluster Status Monitoring

Provides cluster-level monitoring at second-level precision, including:

- CPU utilization, memory utilization, load average
- Disk usage, I/O throughput, network traffic
- etcd health status and API Server request rates

Supports custom time range queries and ranking analysis.

### GPU Resource Monitoring

A monitoring view designed specifically for GPU compute scenarios. Displays real-time metrics per node and per GPU card:

- GPU utilization and VRAM usage
- GPU temperature and power consumption
- vGPU virtualization slicing status
- Unified view across multiple GPU types (NVIDIA, Ascend, Cambricon, etc.)

### Application Resource Monitoring

Displays resource usage at the workload and project level, with ranking by CPU, memory, and network metrics to quickly identify abnormally high-consuming workloads.

### Alert Messages

Displays alerts triggered in the cluster in real time, including node anomalies, Pod crashes, and storage alerts. Supports filtering by severity level (Critical, Warning, Info) with full alert history.

### Alert Rules

Define custom alerting rules for nodes, workloads, and pods. Set metric thresholds and trigger conditions, configure alert repeat intervals and notification recipients. Supported notification channels include email, WeCom, DingTalk, and Slack.

## Log Collection

Configure unified log collection policies at the cluster level, supporting the following log storage backends:

- Elasticsearch
- Kafka
- Fluentd

Multi-tenant log isolation is enforced — tenants can only view logs belonging to their own workloads.

## Cluster Settings

- **Basic Information**: View cluster name, Kubernetes version, node count, and other basic details
- **Visibility**: Control which workspaces can access the cluster
- **Member Management**: Manage cluster-level user and role assignments
- **Role Management**: Define custom cluster-level access roles and permission sets

## Multi-tenant Permission System

Kube AI Hub provides a **Platform → Workspace → Project** three-tier permission isolation model:

- Platform administrators manage cluster resources centrally
- Workspace managers control resource quotas and member access
- Project members work independently within isolated namespaces

Supports integration with LDAP, Active Directory, and SSO single sign-on.
