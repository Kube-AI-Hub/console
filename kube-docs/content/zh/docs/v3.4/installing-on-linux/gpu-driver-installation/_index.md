---
linkTitle: "安装显卡驱动"
title: "安装显卡驱动"
description: "在 Linux 上为 Kube AI Hub 集群 GPU/NPU 节点安装显卡驱动与容器 runtime 的概述与指引。"
weight: 3170
---

在 [多节点安装](../introduction/multioverview/) 的「准备 Linux 主机」阶段，若集群中存在配备 **NVIDIA GPU** 或 **华为昇腾 NPU** 的工作节点，需要在执行 KubeKey `./kk create cluster` **之前**完成对应驱动与容器 runtime 的安装与配置。

## 适用场景

| 硬件类型 | 文档 |
| -------- | ---- |
| 英伟达 NVIDIA GPU | [安装英伟达 (NVIDIA) 驱动](install-nvidia-driver/) |
| 华为昇腾 Ascend NPU | [安装华为昇腾 (Ascend) 驱动](install-ascend-driver/) |

仅 CPU 节点无需安装本节内容。混合集群中，请对 **GPU/NPU 工作节点** 分别按硬件类型执行对应文档中的步骤。

## 安装时机

1. 完成操作系统安装与基础网络配置
2. 完成 [时间同步](../introduction/time-synchronization/) 配置
3. **安装显卡驱动与容器 runtime**（本节）
4. 使用 KubeKey 创建 Kubernetes 集群并安装 Kube AI Hub

## 通用前提

- 具有 `root` 或 `sudo` 权限
- NVIDIA GPU 节点建议使用 **Ubuntu 22.04/24.04**（deb 包）或 **RHEL 8/9** 及兼容发行版（rpm 包）；昇腾 NPU 节点请参考对应子文档
- 所有节点时间已同步（参见[时间同步配置](../introduction/time-synchronization/)）
- 安装包版本需与目标硬件型号、操作系统及内核版本匹配；部署时请根据实际环境选择对应版本

{{< notice note >}}

本文档为参考示例。实际操作过程中，请根据实际硬件型号、操作系统版本及厂商发布说明进行校对。

{{</ notice >}}
