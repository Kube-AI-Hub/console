---
linkTitle: "GPU Driver Installation"
title: "GPU Driver Installation"
description: "Overview and guidance for installing GPU/NPU drivers and container runtimes on Linux nodes for Kube AI Hub clusters."
weight: 3170
---

During the [Prepare Linux Hosts](../introduction/multioverview/) phase of [multi-node installation](../introduction/multioverview/), if your cluster includes worker nodes with **NVIDIA GPUs** or **Huawei Ascend NPUs**, you must install the corresponding drivers and container runtimes **before** running KubeKey `./kk create cluster`.

## Applicable Scenarios

| Hardware | Documentation |
| -------- | ------------- |
| NVIDIA GPU | [Install NVIDIA Driver](install-nvidia-driver/) |
| Huawei Ascend NPU | [Install Huawei Ascend Driver](install-ascend-driver/) |

CPU-only nodes do not require this section. In heterogeneous clusters, apply the appropriate guide to each **GPU/NPU worker node** based on its hardware type.

## Installation Order

1. Install the operating system and configure basic networking
2. Configure [time synchronization](../introduction/time-synchronization/)
3. **Install GPU drivers and container runtimes** (this section)
4. Use KubeKey to create the Kubernetes cluster and install Kube AI Hub

## General Prerequisites

- `root` or `sudo` privileges
- **Ubuntu 22.04/24.04** (deb packages) or **RHEL 8/9** and compatible distributions (rpm packages) is recommended for NVIDIA GPU nodes; Ascend NPU nodes support **Ubuntu 22.04/24.04**, **CentOS 9+**, **Kylin V10**, and **openEuler 22.03 LTS+** — see the Ascend guide for details
- All nodes have synchronized time (see [Time Synchronization](../introduction/time-synchronization/))
- Package versions must match your hardware model, OS, and kernel version; verify against your deployment environment

{{< notice note >}}

This documentation is provided as a reference example. Adjust steps according to your actual hardware model, OS version, and vendor release notes during deployment.

{{</ notice >}}
