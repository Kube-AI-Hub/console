---
title: "GPU Virtualization Mode (Sharing/Slicing)"
keywords: "Kube AI Hub, GPU, vGPU, virtualization, sharing, slicing, MIG, HAMi"
description: "Learn how to configure GPU virtualization modes in Kube AI Hub for GPU sharing and slicing."
linkTitle: "GPU Virtualization Mode"
weight: 8120
---

## Overview

GPU Virtualization Mode (also known as sharing/slicing policy) is a node-level feature that configures virtualization for all GPU cards on a node. By setting different virtualization modes, a single physical GPU card can be sliced into multiple vGPUs, enabling multiple tasks to share the same GPU and significantly improving GPU utilization.

The platform supports virtualization schemes from multiple GPU vendors, offering vendor-specific mode options and configuration parameters.

## Supported Vendors and Modes

### NVIDIA GPUs

| Mode | Description |
|------|-------------|
| **Default** | No virtualization; each task exclusively occupies the entire GPU card |
| **MIG (Multi-Instance GPU)** | Hardware-level slicing of a GPU into independent instances, each with isolated memory and compute. Requires MIG-capable models like A100/A30/H100 |
| **HAMi-Core** | Software-level virtualization based on the HAMi framework, supporting flexible compute and memory sharing with overcommit |

**HAMi-Core Parameters:**

| Parameter | Description |
|-----------|-------------|
| **Device Split Count** | Maximum number of concurrent shared tasks per GPU card |
| **Device Memory Scaling** | VRAM overcommit ratio; values greater than 1 enable overcommit |
| **Device Core Scaling** | Compute overcommit ratio; values greater than 1 enable overcommit |

### Cambricon GPUs

| Mode | Description |
|------|-------------|
| **Default** | No virtualization |
| **Dynamic SMLU** | Dynamic sharing mode with minimum SMLU unit-based slicing |
| **Env Share** | Environment sharing mode with virtualization count-based slicing |

**Dynamic SMLU Parameters:**

| Parameter | Description |
|-----------|-------------|
| **Min DSMLU Unit** | Minimum slicing unit count per GPU |

**Env Share Parameters:**

| Parameter | Description |
|-----------|-------------|
| **Virtualization Num** | Number of virtual instances per GPU |

## Configuring GPU Virtualization Mode

### From the Node List

1. In the left navigation pane, select **Node Management → Cluster Nodes**.
2. Find the target GPU node and click **Set GPU Virtualization Mode** in the actions column.
3. In the dialog, select the target virtualization mode.
4. Fill in the configuration parameters for the selected mode.
5. Click **OK** to submit.

### From Node Details

1. Navigate to the GPU node's detail page.
2. Find the **GPU Virtualization Mode** field in the node attributes area.
3. Click the **Set** button next to it.
4. Complete mode selection and parameter configuration in the dialog.

{{< notice note >}}
- Switching virtualization modes requires time. During the switch, the page displays a "Switching" status and auto-refreshes until complete.
- If the mode switch fails, a "Switch Failed" status is displayed. Check that the GPU driver and device plugin on the node are functioning properly.
- Not all GPU vendors support virtualization mode settings. Unsupported vendors display a warning message in the dialog.
{{</ notice >}}

## Viewing Virtualization Status

After configuration, virtualization status is visible in:

- **Node Detail Page**: The GPU Virtualization Mode field shows the current mode; the GPU Device Max Split Count shows slicing parameters
- **GPU Card List**: The Virtualization Mode column shows each card's current mode
- **GPU Card Detail Page**: Attributes area shows the virtualization mode and slicing parameters inherited from the node

## Mode Selection Guide

| Scenario | Recommended Mode | Reason |
|----------|-----------------|--------|
| Production inference with strict isolation | MIG (NVIDIA) | Hardware-level isolation, predictable performance |
| Dev/test with shared GPUs | HAMi-Core (NVIDIA) or Env Share (Cambricon) | Flexible slicing, improved utilization |
| Training tasks requiring full GPU power | Default | No virtualization overhead, maximum performance |
| Compute-constrained, overcommit needed | HAMi-Core with scaling params | Allows VRAM/compute overcommit allocation |
