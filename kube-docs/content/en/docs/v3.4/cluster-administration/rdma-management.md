---
title: "RDMA Monitoring"
keywords: "Kube AI Hub, RDMA, InfiniBand, RoCE, port, monitoring, link layer"
description: "Learn how to view the RDMA / InfiniBand port status and monitoring metrics of a cluster in Kube AI Hub."
linkTitle: "RDMA Monitoring"
weight: 8113
---

## Overview

RDMA (Remote Direct Memory Access) is the key transport for cross-node inference. In a disaggregated prefill/decode deployment, the KV cache travels between the prefill and decode instances over RDMA; without it the transfer falls back to TCP, and both throughput and latency degrade noticeably.

Kube AI Hub collects RDMA metrics from the node-exporter `infiniband` collector and, after aggregation by Prometheus recording rules, presents them on these pages:

| Page | Content |
|------|---------|
| **Cluster Nodes > node details > Running Status** | RDMA port list |
| **Cluster Nodes > node details > Monitoring** | RDMA throughput, port status, errors, congestion |
| **Monitoring & Alerting > Physical Resources Monitoring** | RDMA port health, port status, throughput, link rate, errors, link down |
| **Monitoring & Alerting > Cluster Status > Overview** | RDMA card (port health, active ports, throughput, errors, abnormal nodes) |

{{< notice note >}}
The metrics come from the `infiniband` collector built into node-exporter; no separate RDMA exporter is required. The pipeline is `node-exporter → Prometheus → recording rules → kube-server → console`.
{{</ notice >}}

## RDMA Port List

In the left navigation bar, choose **Nodes > Cluster Nodes**, then click a node to open its details page. The **Running Status** tab shows the **RDMA Port List**.

The list shows the real-time status of every RDMA port on that node:

| Column | Description |
|--------|-------------|
| **Device** | RDMA device name, such as `mlx5_0` (Mellanox) or `bnxt_re0` (Broadcom) |
| **Transport** | **InfiniBand** or **RoCE**, see the next section |
| **Port** | Port number, normally `1` |
| **Port State** | Logical port state, see the table below |
| **Link Rate** | Port rate. InfiniBand is quoted in Gb/s (for example 400 Gbps) |
| **HCA Type** | Network adapter chip model, such as `MT4129` |
| **Firmware** | Adapter firmware version |
| **RDMA Resource** | Whether the node advertises the `rdma/rdma_shared_device_a` extended resource |

### Telling InfiniBand from RoCE

Both kinds of device **register under `/sys/class/infiniband`**, and both report a link rate and a port state, so the metrics alone cannot distinguish them. The kernel's `link_layer` field is what does:

| `link_layer` | Transport | Devices in this cluster | Typical rate |
|--------------|-----------|-------------------------|--------------|
| `InfiniBand` | InfiniBand | `mlx5_*` (Mellanox) | 400 Gb/s (4X NDR), 100 Gb/s (2X HDR) |
| `Ethernet` | RoCE | `bnxt_re*` (Broadcom) | 25 Gb/s, 2.5 Gb/s |

The console publishes `link_layer` as the `node_rdma_link_layer` metric via a sidecar (`1` = InfiniBand, `2` = Ethernet/RoCE, `0` = unknown). The **Transport** column is derived from it.

{{< notice note >}}
`InfiniBand` means a native IB fabric; `Ethernet` means RDMA over Converged Ethernet (RoCE), which runs on top of Ethernet. Both can carry RDMA traffic, but their latency, congestion control and operational practices differ. Cross-node KV transfer in production inference normally uses the InfiniBand ports.
{{</ notice >}}

### Port States

Port states come from the kernel's `state` field:

| State | Meaning |
|-------|---------|
| **Active** | The port is activated and carrying traffic. Only this state is healthy |
| **Down** | The port is not activated |
| **Initializing** | The port is initializing |
| **Armed** | The port is ready but not activated |
| **Active Defer** | Activation is deferred |
| **No Change** | The state has not changed |

### Health Criteria

A port shows as **Active** (green) only when all three conditions hold:

1. The logical state is **Active**
2. The physical state is **Link Up**
3. The node advertises the `rdma/rdma_shared_device_a` extended resource, meaning the RDMA device plugin is serving that node

If any condition fails, the port shows as **Down** (orange); click the status for details.

## RDMA Monitoring Charts

Switch to the **Monitoring** tab on the node details page to see that node's RDMA charts:

- **RDMA Throughput**: transmitted and received rates
- **RDMA Port Status**: active ports versus total ports
- **RDMA Errors**: receive errors, link down, transmit discards, VL15 dropped
- **RDMA Congestion**: retransmits, out-of-sequence packets, slow restart (DCQCN)

On **Monitoring & Alerting > Physical Resources Monitoring**, the same data is available cluster-wide, including port health, port status, throughput, link rate, errors and link down.

The **RDMA Status** card on **Monitoring & Alerting > Cluster Status > Overview** summarises the cluster: port health, active ports, total throughput, error counts, and the list of nodes with abnormal ports.

## Prerequisites

The RDMA pages depend on the following; if any is missing the pages are empty or report no data:

1. **The node has RDMA hardware**, and the `ib_uverbs` and `mlx5_ib` kernel modules are loaded
2. **NFD has labelled the node** with `feature.node.kubernetes.io/custom-rdma.available=true`
3. **The RDMA device plugin runs on the node**, advertising `rdma/rdma_shared_device_a`
4. **node-exporter is v1.12.1 or newer**, with the `infiniband` collector enabled

{{< notice note >}}
node-exporter v1.3.1 fails to read some counters on ConnectX-7 adapters (it gets `EINVAL`), which aborts the whole infiniband collector and drops every RDMA metric. If the pages are empty, check the node-exporter version first.
{{</ notice >}}

## Troubleshooting

| Symptom | What to check |
|---------|---------------|
| The port list is empty | The node has no RDMA hardware, or node-exporter is not collecting. Run `ibstat` on the node to confirm the hardware |
| Every port shows **Down** | Check whether `rdma/rdma_shared_device_a` is in the node's `allocatable`, and that the RDMA device plugin is running |
| Transport shows **Unknown** | The `node_rdma_link_layer` metric is missing; check that the node-exporter textfile sidecar is running |
| The charts are empty | Check whether `node:ib_*` and `cluster:ib_*` exist in Prometheus, and that the recording rules are loaded |
| No RDMA card on the cluster overview | Confirm the monitoring feature is enabled for the cluster |

## Related Documentation

- [Node Management](../nodes/): node status, labels and taints
- [GPU Management](../gpu-management/): viewing GPU / NPU resources
