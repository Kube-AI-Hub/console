---
title: "GPU Virtualization Mode (Sharing/Slicing)"
keywords: "Kube AI Hub, GPU, NPU, vGPU, virtualization, sharing, slicing, MIG, HAMi, Ascend, 910C, 310P"
description: "Configure GPU virtualization modes in Kube AI Hub, including Ascend NPU Runtime + hard-template slicing."
linkTitle: "GPU Virtualization Mode"
weight: 8120
---

## Overview

GPU Virtualization Mode (also known as sharing/slicing policy) is a node-level feature that configures virtualization for all GPU cards on a node. By setting different virtualization modes, a single physical GPU card can be sliced into multiple vGPUs, enabling multiple tasks to share the same GPU and significantly improving GPU utilization.

The platform supports virtualization schemes from multiple GPU / NPU vendors. NVIDIA and Cambricon expose a node-level mode switch. Ascend NPUs do **not** use that switch; they slice through **Ascend Runtime + hard templates** based on the memory request. Resource names, template tables, and YAML examples are in [Ascend NPU Usage](../npu-usage/).

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

### Huawei Ascend NPUs

Ascend slicing is **not** the node-level **Set GPU Virtualization Mode** action, and it is not NVIDIA HAMi-Core soft slicing.

| Mode | Description |
|------|-------------|
| **Whole card** | Request count only. The workload occupies the full NPU (or a 910C die pair). |
| **Hard template** | Request count `1` plus `huawei.com/<SKU>-memory` in MiB. The scheduler rounds up to a fixed template (for example 910C `vir06_1c_16g` / `vir12_3c_32g`). Ascend Runtime and the driver create the vNPU. |

Soft slicing is disabled by default. Do not set `huawei.com/vnpu-mode: hami-core` or `huawei.com/*-core` on the Pod; those requests are rejected. If `runtimeClassName` is omitted, the webhook injects `ascend`.

Supported models include 910A, 910B2 / 910B3 / 910B4 / 910B4-1, 310P / 310P48, and 910C. Template sizes and 910C / 310P rules are in [Ascend NPU Usage](../npu-usage/).

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
| Ascend inference with in-card isolation | Hard template (request memory) | Runtime creates a fixed-size vNPU |
| Ascend training or ACL Graph / vLLM graph capture | Whole card or a larger template | Small templates can exhaust stream quota |
