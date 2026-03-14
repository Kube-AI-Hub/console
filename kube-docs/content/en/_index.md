---
title: Heterogeneous Compute Management Platform, GPU/CPU Multi-cluster Scheduling | Kube AI Hub
description: Kube AI Hub is a heterogeneous compute management platform built on Kubernetes, providing GPU/CPU resource pooling, vGPU virtualization, multi-tenant isolation, intelligent scheduling, and full-stack observability to improve compute utilization by 3–10x.

css: scss/index.scss

section1:
  title: Kube AI Hub Compute Platform
  topic: Unified Heterogeneous Compute<br>3–10x Better GPU Utilization
  content: Kube AI Hub is a heterogeneous compute management platform with Kubernetes as its kernel. Through GPU/CPU resource pooling and vGPU virtualization, it enables platform-level management of hardware clusters and supports domestic GPU/CPU/NPU hardware for a secure, self-controlled AI compute infrastructure.

section2:
  title: Full-stack Compute Management, Simplified
  content: Kube AI Hub provides end-to-end compute management from hardware resources to business applications. A unified console manages heterogeneous GPU/CPU clusters with built-in multi-tenancy, elastic scheduling, and fine-grained metering — helping enterprises rapidly build a self-controlled AI compute infrastructure.
  children:
    - name: Easy to Deploy
      icon: /images/home/easy-to-run.svg
      content: Deploy on any existing Kubernetes cluster or bare metal, supports online and air-gapped installation, one-click scaling and upgrades.

    - name: Feature Complete
      icon: /images/home/feature-rich.svg
      content: Manage GPU nodes, job queues, compute scheduling, multi-tenancy, monitoring, metering, and log management in a single unified platform.

    - name: Modular & Pluggable
      icon: /images/home/modular-pluggable.svg
      content: All modules are loosely coupled and optional. Flexibly integrate third-party schedulers, storage systems, and monitoring stacks.

section3:
  title: Value for Every Team
  content: The built-in multi-tenant design lets infrastructure teams, AI engineers, and operations staff collaborate on the same platform. Infra teams control hardware resources centrally, engineers focus on model development, and ops teams gain complete observability and automation.
  children:
    - name: Infra Team
      content: Unified management of heterogeneous GPU/CPU clusters — resource pooling reduces hardware costs
      icon: /images/home/7.svg
      children:
        - content: Unified onboarding of NVIDIA, Huawei Ascend, Cambricon, Iluvatar, and other GPUs
        - content: vGPU virtualization slices compute resources, improving hardware utilization by 3–10x
        - content: Built-in CSI support for S3, NFS, Ceph, and other file storage resources
        - content: Multi-cluster management across data centers and hybrid cloud environments

    - name: AI Engineers
      content: Focus on model training and inference — no more fighting Kubernetes YAML
      icon: /images/home/74.png
      children:
        - content: Submit AI training jobs via web console without writing complex Kubernetes manifests
        - content: Built-in job queues with priority scheduling and resource reservation for fair compute allocation
        - content: Supports distributed training with PyTorch, TensorFlow, and other major frameworks
        - content: One-click inference service deployment with auto horizontal scaling

    - name: Ops Team
      content: Build a one-stop compute platform operations and observability system
      icon: /images/home/71.svg
      children:
        - content: Multi-dimensional monitoring and alerting for GPU temperature, utilization, and memory usage
        - content: Centralized log collection and search to quickly diagnose job failures
        - content: Node health checks and automatic fault isolation to ensure training job stability
        - content: Graphical console and web terminal to accommodate different operational preferences

    - name: Business Owner
      content: Compute costs are transparent and auditable — manage IT budgets with precision
      icon: /images/home/80.svg
      children:
        - content: View compute usage and cost allocation reports by tenant, department, or project
        - content: Quota management prevents resource contention and waste
        - content: Metering reports support IT budget planning and cost accounting
        - content: Multi-tenant isolation ensures data and resource security across teams

section4:
  title: Key Platform Features
  content: Kube AI Hub covers the full compute management lifecycle from hardware onboarding to workload delivery. All features are modular and can be enabled on demand.
  children:
    - name: Heterogeneous GPU Cluster Mgmt
      icon: /images/home/provisioning-kubernetes.svg
      content: Unified onboarding of NVIDIA, Huawei Ascend, Cambricon, Tianshu, and other GPUs. Supports online node expansion and cross-cluster resource allocation.

    - name: vGPU Virtualization & Scheduling
      icon: /images/home/k-8-s-resource-management.svg
      content: Fine-grained GPU slicing and sharing across concurrent workloads. Significantly improves hardware utilization with sub-card granularity.

    - name: Multi-tenant Access Control
      icon: /images/home/multi-tenant-management.svg
      content: Three-tier permission system across platform, workspace, and project. Supports AD/LDAP integration for secure multi-team resource isolation.

    - name: Storage & Networking
      icon: /images/home/multi-tenant-management.svg
      content: Supports S3, NFS, Ceph, LocalPV and other storage backends. Built-in network policy management with Calico, Flannel, and other CNI plugins.

  features:
    - name: Heterogeneous Compute Management
      icon: /images/home/dev-ops.svg
      content: GPU/CPU heterogeneous compute pooling and virtualization improves utilization by 3–10x, supporting domestic GPU/CPU/NPU hardware for a secure local compute foundation.
      link: "ai-compute/"
      color: orange

    - name: Intelligent Job Scheduling
      icon: /images/home/service.svg
      content: Thousand-GPU distributed scheduling with built-in priority job queues and resource reservation policies for large-scale parallel AI training workloads.
      link: "/docs/v3.4/pluggable-components/devops/"
      color: red

    - name: Full-stack Observability
      icon: /images/home/rich.svg
      content: Multi-dimensional GPU/CPU monitoring, alerting, and log management with multi-tenant isolation and support for multiple notification channels.
      link: "/docs/v3.4/pluggable-components/logging/"
      color: green

    - name: Metering and Billing
      icon: /images/home/store.svg
      content: Compute usage monitoring and cost accounting by tenant, department, and project — helping enterprises manage IT costs with precision.
      link: "/docs/v3.4/toolbox/metering-and-billing/view-resource-consumption/"
      color: grape

    - name: Multi-cluster Management
      icon: /images/home/management.svg
      content: Unified management of multiple GPU/CPU clusters across data centers and hybrid cloud, with high availability and disaster recovery best practices.
      link: "/docs/v3.4/multicluster-management/introduction/overview/"
      color: orange

    - name: Edge Node Support
      icon: /images/home/network.svg
      content: Extend compute scheduling to edge nodes via KubeEdge, enabling cloud-edge collaborative AI inference job distribution and management.
      link: "/docs/v3.4/pluggable-components/kubeedge/"
      color: green

    - name: App Marketplace
      icon: /images/home/multiple.svg
      content: Built-in Helm-based app marketplace and image registry (Harbor) for one-click deployment and lifecycle management of AI frameworks and tools.
      link: "/docs/v3.4/pluggable-components/app-store/"
      color: grape

section5:
  title: Cloud-native Architecture with Decoupled Frontend and Backend
  frontEnd:
    title: Frontend
    project: Kube AI Hub Console
    children:
      - icon: /images/home/mobx.jpg
      - icon: /images/home/koa.jpg
      - icon: /images/home/react.png

  backEnd:
    title: Backend (REST API)
    project: Kube AI Hub System
    group:
      - name: API Server
      - name: API Gateway
      - name: Controller Manager
      - name: GPU Scheduler

---
