---
title: "RDMA 监控"
keywords: "Kube AI Hub, RDMA, InfiniBand, RoCE, 端口, 监控, 链路类型"
description: "了解如何在 Kube AI Hub 中查看集群的 RDMA / InfiniBand 端口状态与监控指标。"
linkTitle: "RDMA 监控"
weight: 8113
---

## 概述

RDMA（Remote Direct Memory Access）是跨节点推理的关键通道。在 PD 分离（Prefill/Decode 分离）部署中，Prefill 与 Decode 实例之间的 KV Cache 通过 RDMA 传输；没有 RDMA 时只能退化为 TCP，吞吐和延迟都会明显劣化。

Kube AI Hub 从 node-exporter 的 infiniband collector 采集 RDMA 指标，经 Prometheus recording rules 聚合后，在三个页面展示：

| 页面 | 内容 |
|------|------|
| **集群节点详情 → 运行状态** | RDMA 端口列表 |
| **集群节点详情 → 监控** | RDMA 吞吐、端口状态、错误、拥塞曲线 |
| **集群监控 → 物理资源监控** | RDMA 端口健康度、端口状态、吞吐、链路速率、错误、链路中断曲线 |
| **集群监控 → 集群状态 → 概览** | RDMA 卡片（端口健康度、活动端口、吞吐、错误、异常节点） |

{{< notice note >}}
RDMA 指标来自 node-exporter 自带的 `infiniband` collector，不需要额外部署 RDMA exporter。采集链路为 `node-exporter → Prometheus → recording rules → kube-server → 控制台`。
{{</ notice >}}

## RDMA 端口列表

在左侧导航栏选择**节点管理 → 集群节点**，点击某个节点进入节点详情页，**运行状态**标签页中会显示 **RDMA 端口列表**。

列表展示该节点上每个 RDMA 端口的实时状态：

| 列名 | 说明 |
|------|------|
| **设备** | RDMA 设备名，如 `mlx5_0`（Mellanox）或 `bnxt_re0`（Broadcom） |
| **链路类型** | **InfiniBand** 或 **RoCE**，见下节 |
| **端口** | 端口号，通常为 `1` |
| **端口状态** | 端口逻辑状态，见下表 |
| **链路速率** | 端口速率。InfiniBand 按 Gb/s 标注（如 400 Gbps） |
| **HCA 类型** | 网卡芯片型号，如 `MT4129` |
| **固件版本** | 网卡固件版本 |
| **RDMA 资源** | 节点是否已暴露 `rdma/rdma_shared_device_a` 扩展资源 |

### 如何区分 InfiniBand 与 RoCE

两类设备**都注册在 `/sys/class/infiniband` 下**，也都上报速率和端口状态，因此单看指标无法区分。区分依据是内核的 `link_layer` 字段：

| `link_layer` | 链路类型 | 本集群设备 | 典型速率 |
|--------------|----------|-----------|----------|
| `InfiniBand` | InfiniBand | `mlx5_*`（Mellanox） | 400 Gb/s (4X NDR)、100 Gb/s (2X HDR) |
| `Ethernet` | RoCE | `bnxt_re*`（Broadcom） | 25 Gb/s、2.5 Gb/s |

控制台通过一个 sidecar 把 `link_layer` 发布为 `node_rdma_link_layer` 指标（`1` = InfiniBand，`2` = Ethernet/RoCE，`0` = 未知），端口列表的**链路类型**列即由此而来。

{{< notice note >}}
`InfiniBand` 表示走原生 IB 链路；`Ethernet` 表示 RDMA over Converged Ethernet（RoCE），底层是以太网。两者都能承载 RDMA 流量，但延迟、拥塞控制机制和运维方式不同。生产推理的跨节点 KV 传输通常使用 InfiniBand 端口。
{{</ notice >}}

### 端口状态

端口状态来自内核的 `state` 字段：

| 状态 | 含义 |
|------|------|
| **活动** | 端口已激活，正在承载流量。只有此状态才算正常 |
| **断开** | 端口未激活 |
| **初始化中** | 端口正在初始化 |
| **待激活** | 端口已就绪但未激活 |
| **延迟激活** | 激活被延迟 |
| **无变化** | 状态未变化 |

### 健康判定

端口显示为**活动**（绿色）需要同时满足三个条件：

1. 逻辑状态为 **活动**（Active）
2. 物理状态为 **链路已连接**（Link Up）
3. 节点已暴露 `rdma/rdma_shared_device_a` 扩展资源，即 RDMA device plugin 正在为该节点提供服务

任一条件不满足都会显示为**断开**（橙色），点击状态可查看端口详情。

## RDMA 监控曲线

在节点详情页切换到**监控**标签页，可以查看该节点的 RDMA 曲线：

- **RDMA 吞吐**：收发速率
- **RDMA 端口状态**：活动端口数与端口总数
- **RDMA 错误**：接收错误、链路中断、发送丢弃、VL15 丢弃
- **RDMA 拥塞**：重传、乱序包、慢重启（DCQCN）

在**集群监控 → 物理资源监控**页面，还可以查看集群维度的 RDMA 曲线，包括端口健康度、端口状态、吞吐、链路速率、错误和链路中断。

{{< notice note >}}
曲线与端口列表使用同一口径，**InfiniBand 与 RoCE 都计入**，所以端口数一致。两点需要留意：吞吐与错误类曲线只有 InfiniBand 有数据（RoCE 网卡不提供这些计数器），端口健康度把 RoCE 也算进分母，而这些端口通常处于断开状态，因此健康度会低于 100%。
{{</ notice >}}

**集群监控 → 集群状态 → 概览**页面的 **RDMA 状态**卡片汇总了集群整体情况：端口健康度、活动端口数、集群总吞吐、错误计数，以及存在异常端口的节点列表。

## 前置条件

RDMA 页面依赖以下条件，缺任一项时页面会显示为空或提示无数据：

1. **节点具备 RDMA 硬件**，且内核模块 `ib_uverbs`、`mlx5_ib` 已加载
2. **NFD 已为节点打上 `feature.node.kubernetes.io/custom-rdma.available=true` 标签**
3. **RDMA device plugin 已在该节点运行**，暴露 `rdma/rdma_shared_device_a` 资源
4. **node-exporter 版本不低于 v1.12.1**，且启用了 `infiniband` collector

{{< notice note >}}
node-exporter v1.3.1 在 ConnectX-7 网卡上读取部分计数器会返回 `EINVAL`，导致整个 infiniband collector 失败、所有 RDMA 指标缺失。如页面无数据，请先确认 node-exporter 版本。
{{</ notice >}}

## 排查

| 现象 | 排查方向 |
|------|----------|
| 端口列表为空 | 节点无 RDMA 硬件，或 node-exporter 未采集到指标；在节点上执行 `ibstat` 确认硬件 |
| 所有端口显示**断开** | 检查 `rdma/rdma_shared_device_a` 是否在节点 `allocatable` 中，确认 RDMA device plugin 正常运行 |
| 链路类型显示**未知** | `node_rdma_link_layer` 指标缺失，检查 node-exporter 的 textfile sidecar 是否正常运行 |
| 监控曲线为空 | 检查 Prometheus 中是否存在 `node:ib_*` 与 `cluster:ib_*` 指标，确认 recording rules 已加载 |
| 集群概览无 RDMA 卡片 | 确认集群已启用监控功能 |

## 相关文档

- [节点管理](../nodes/)：节点状态、标签与污点管理
- [显卡管理](../gpu-management/)：GPU / NPU 资源查看
