---
title: "GPU Card Management"
keywords: "Kube AI Hub, GPU, GPU card, GPU management, vGPU, monitoring"
description: "Learn how to view and manage GPU card resources in Kube AI Hub clusters."
linkTitle: "GPU Card Management"
weight: 8110
---

## Overview

The GPU Card Management page provides a unified view of all physical GPU cards in the cluster, supporting filtering and viewing GPU resource allocation and usage by node, vendor, model, and status.

## Viewing the GPU Card List

In the left navigation pane, select **Node Management → GPU Cards** to access the cluster GPU card list.

### Overview Panel

The top of the page displays the cluster GPU resource status:

- **Total GPU Count**: Total number of physical GPU cards in the cluster
- **Health Status Distribution**: Pie chart showing the ratio of healthy vs. unhealthy GPU cards
- **Vendor/Model Distribution**: GPU card counts by vendor and model

### GPU Card Table

The table displays detailed information for each GPU card:

| Column | Description |
|--------|-------------|
| **Node** | Name of the compute node where the GPU is installed; click to navigate to node details |
| **Card Index** | GPU index number within the node |
| **Card UUID** | Globally unique GPU identifier; click to navigate to GPU card details |
| **Status** | Healthy or Sub-healthy |
| **Model** | GPU model, e.g., A100, V100, 910B |
| **NUMA** | NUMA node number the GPU belongs to |
| **Vendor** | GPU vendor: NVIDIA, Huawei Ascend, Cambricon, etc. |
| **Virtualization Mode** | Current GPU virtualization running mode |
| **vGPU** | vGPU used / total |
| **Compute** | GPU compute used / total |
| **Memory** | VRAM used / total (GiB) |

### Filtering and Search

The following filters are supported:

- **Filter by Node**: Select a specific node from the dropdown
- **Search by UUID**: Enter a GPU UUID for exact matching
- **Label Selector**: Filter using Kubernetes labels
- **Filter by Vendor**: Select NVIDIA, Huawei Ascend, Cambricon, etc.
- **Filter by Model**: Enter GPU model keywords
- **Filter by Status**: Healthy / Sub-healthy

## Viewing GPU Card Details

Click a GPU card's UUID in the list to navigate to its detail page.

### Basic Attributes

| Attribute | Description |
|-----------|-------------|
| **Status** | Current health status |
| **Node** | Physical node where the GPU is installed |
| **Card UUID** | Globally unique identifier |
| **Card Index** | Index within the node |
| **Model** | GPU model |
| **Vendor** | GPU vendor |
| **NUMA** | NUMA node number |
| **Virtualization Mode** | Virtualization mode inherited from the node |
| **Total Memory** | Physical VRAM size (GiB) |
| **Driver Version** | GPU driver version (if available) |
| **Max Device Split Count** | Maximum concurrent tasks after vGPU slicing (if configured) |

### Resource Summary

Displays current GPU card resource usage:

- **Compute**: Used / Total
- **Memory**: Used / Total (GiB)
- **vGPU**: Allocated / Total

### Detail Tabs

| Tab | Content |
|-----|---------|
| **Running Status** | Real-time monitoring charts for GPU utilization, memory usage, allocation rate, power, and temperature, plus GPU topology |
| **Pods** | List of all Pods currently scheduled to this GPU |
| **Monitoring** | Historical monitoring metric charts with custom time range support |
| **Events** | Kubernetes events related to this GPU |

## GPU Cards in Node Details

In **Node Management → Cluster Nodes**, click a node to enter its detail page. For nodes equipped with GPUs, the running status page displays:

- **Total GPUs**: Number of GPU cards on the node
- **Total VRAM**: Combined VRAM across all GPUs on the node
- **Total vGPUs**: Total vGPU count on the node
- **GPU Card List**: Status, model, vGPU/compute/memory usage for each GPU card

## Pod Scheduling Information

For Pods using GPU resources, the Pod detail page shows **Scheduled to GPU** information, including:

- Allocated GPU UUID with a link to the physical GPU card
- Allocated vendor type
- Allocated VRAM size
- Allocated compute percentage
