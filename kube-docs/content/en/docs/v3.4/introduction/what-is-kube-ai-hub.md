---
title: "What is Kube AI Hub"
keywords: "Kubernetes, Kube AI Hub, GPU, heterogeneous compute, Introduction"
description: "What is Kube AI Hub"
linkTitle: "What is Kube AI Hub"
weight: 1100
---

## Overview

Kube AI Hub is a **heterogeneous compute management platform** built on [Kubernetes](https://kubernetes.io), focusing on GPU/CPU resource pooling, vGPU virtualization, multi-tenant isolation, intelligent scheduling, and full-stack observability. Through a unified web console, Kube AI Hub manages multiple heterogeneous hardware clusters, helping enterprises improve compute utilization by 3–10x and build a secure, self-controlled AI compute infrastructure.

![Platform Feature Overview](/images/docs/v3.x/introduction/platform-overview.svg)

## Core Design Goals

- **Unified heterogeneous compute management**: Supports NVIDIA, Huawei Ascend, Cambricon, Iluvatar, and other mainstream GPUs, as well as Intel, AMD, and Hygon CPUs — all managed through a single control plane.
- **vGPU virtualization**: Fine-grained GPU slicing and sharing across concurrent workloads, significantly improving hardware utilization.
- **Multi-tenant isolation**: Three-tier permission system across platform, workspace, and project — resources and data are fully isolated between tenants.
- **Full-stack observability**: Second-level GPU/CPU monitoring, alerting, and log management with support for multiple notification channels.
- **Modular and pluggable**: All feature modules can be enabled on demand; supports flexible integration with third-party schedulers and storage systems.

## Who Is It For

Kube AI Hub delivers differentiated value to three types of teams:

**Infrastructure Teams**: Centrally manage heterogeneous GPU/CPU clusters. Resource pooling and vGPU virtualization reduce hardware costs and increase overall utilization.

**AI Engineers**: Submit AI training and inference jobs through the web console without writing complex Kubernetes manifests. Supports distributed training with PyTorch, TensorFlow, and other major frameworks.

**Operations and Business Teams**: Multi-dimensional monitoring and alerting, centralized log search, and metering/billing reports enable fine-grained compute cost management and IT budget planning.

## Supported Deployment Environments

Kube AI Hub is built on standard Kubernetes with no invasive modifications to the underlying infrastructure. It can be **deployed on any version-compatible Kubernetes cluster**, including:

- Bare metal servers
- Private cloud and data center virtual machines
- Managed Kubernetes on Alibaba Cloud, AWS, Huawei Cloud, Tencent Cloud, and more
- Hybrid cloud and cross-datacenter environments

Both online and air-gapped installation are supported, with one-click node scaling and rolling upgrades.

For more information, see [Installing on Linux](../../installing-on-linux/) and [Installing on Kubernetes](../../installing-on-kubernetes/).
