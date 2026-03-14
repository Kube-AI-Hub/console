---
title: "什么是 Kube AI Hub"
keywords: "Kubernetes, Kube AI Hub, GPU, 异构算力, 介绍"
description: "什么是 Kube AI Hub"
linkTitle: "什么是 Kube AI Hub"
weight: 1100
---

## 概述

Kube AI Hub 是以 [Kubernetes](https://kubernetes.io) 为内核的**异构算力管理平台**，专注于 GPU/CPU 资源池化、vGPU 虚拟化、多租户隔离、智能调度与全栈可观测性。平台通过统一的 Web 控制台纳管多个异构硬件集群，帮助企业将算力利用率提升 3～10 倍，构建安全可控的本地 AI 算力底座。

![平台功能全览](/images/docs/v3.x/introduction/platform-overview-zh.svg)

## 核心设计目标

- **异构算力统一管理**：支持英伟达、华为昇腾、寒武纪、天数智芯等主流 GPU，以及 Intel、AMD、海光等 CPU 的统一接入与调度。
- **vGPU 虚拟化**：GPU 细粒度切分与共享，多任务并发使用同一卡，显著提升硬件利用率。
- **多租户隔离**：平台、企业空间、项目三层权限体系，资源与数据完全隔离。
- **全栈可观测性**：秒级精度的 GPU/CPU 监控、告警、日志管理，支持多种通知渠道。
- **模块化可插拔**：所有功能组件按需启用，支持灵活集成第三方调度器与存储系统。

## 适合的使用场景

Kube AI Hub 面向以下三类团队提供差异化价值：

**基础设施团队**：统一纳管异构 GPU/CPU 集群，通过资源池化和 vGPU 虚拟化降低硬件成本，提升整体利用率。

**算法工程师**：通过 Web 控制台提交 AI 训练与推理任务，无需编写复杂的 Kubernetes YAML，支持 PyTorch、TensorFlow 等主流框架的分布式训练。

**运维与业务团队**：通过多维度监控告警、统一日志检索、计量计费报告，实现精细化的算力成本管理与 IT 预算规划。

## 支持的部署环境

Kube AI Hub 基于标准 Kubernetes 构建，对底层基础设施没有侵入性修改，可**部署并运行在任何兼容的 Kubernetes 集群**之上，包括：

- 裸金属服务器
- 私有云与数据中心虚拟机
- 阿里云、AWS、华为云、腾讯云等公有云托管 Kubernetes
- 混合云与跨数据中心环境

支持在线安装与离线（Air-gapped）安装，提供一键扩容与滚动升级能力。

有关更多信息，请参见[在 Linux 上安装](../../installing-on-linux/)和[在 Kubernetes 上安装](../../installing-on-kubernetes/)。
