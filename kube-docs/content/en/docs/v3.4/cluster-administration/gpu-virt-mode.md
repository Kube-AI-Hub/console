---
title: "GPU Virtualization Mode (Sharing/Slicing)"
keywords: "Kube AI Hub, GPU, NPU, XPU, vGPU, virtualization, sharing, slicing, MIG, HAMi, Ascend, Kunlunxin, 910C, 310P"
description: "Configure GPU virtualization modes in Kube AI Hub for NVIDIA, Cambricon, Kunlunxin, and Ascend NPUs."
linkTitle: "GPU Virtualization Mode"
weight: 8120
---

## Overview

GPU Virtualization Mode (also known as sharing/slicing policy) is a node-level feature that configures virtualization for all GPU cards on a node. By setting different virtualization modes, a single physical GPU card can be sliced into multiple vGPUs, enabling multiple tasks to share the same GPU and significantly improving GPU utilization.

The platform supports virtualization schemes from multiple GPU / NPU / XPU vendors. NVIDIA, Cambricon, and Kunlunxin expose a node-level mode switch. Ascend NPUs do **not** use that switch; they slice through **Ascend Runtime + hard templates** based on the memory request. Ascend resource names, template tables, and YAML examples are in [Ascend NPU Usage](../npu-usage/).

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

### Kunlunxin XPUs

Kunlunxin nodes can be switched from the node list or the node detail page. The dialog has two modes only and **does not** ask for split count, memory scaling, or core scaling. The number of shares per card comes from the device-plugin register (typically 4 on P800).

| Mode | Description |
|------|-------------|
| **Exclusive (Default)** | No virtualization; each task occupies a whole XPU. Workloads request `kunlunxin.com/xpu`. The count must be **1, 2, 4, or 8**. |
| **HAMi-Core** | Software sharing. Workloads request `kunlunxin.com/vxpu` (virtual-card shares) and `kunlunxin.com/vxpu-memory` (MiB). Example: one VXPU with `24576` MiB. |

**What to check after the switch:**

| Mode | Running Status page |
|------|---------------------|
| **Exclusive** | `kunlunxin.com/xpu` equals the physical card count (8 on an 8-card P800 node). `kunlunxin.com/vxpu` and `kunlunxin.com/vxpu-memory` are 0 or omitted. The GPU list still has one row per physical card, mode **Exclusive**. |
| **HAMi-Core** | Non-zero `kunlunxin.com/vxpu` and `kunlunxin.com/vxpu-memory` (32 vxpu on 8 cards with 4 shares each). The GPU list still has 8 rows; the virtual-card count is 32. |

Switching from HAMi-Core back to Exclusive tears down SR-IOV virtual functions (VFs) created during sharing, so capacity stays at the physical card count. Stop workloads that hold XPUs on that node before you switch.

### Huawei Ascend NPUs

Ascend slicing is **not** the node-level **Set GPU Virtualization Mode** action, and it is not NVIDIA HAMi-Core soft slicing.

| Mode | Description |
|------|-------------|
| **Whole card** | Request count only. The workload occupies the full NPU (or a 910C die pair). |
| **Hard template** | Request count `1` plus `huawei.com/<SKU>-memory` in MiB. The scheduler rounds up to a fixed template; Ascend Runtime and the driver create the vNPU. 910C defaults to Atlas A3 **training** templates `vir06_1c_16g` / `vir12_3c_32g`. A3 **inference** cards must use `vir05_1c_16g` / `vir10_3c_32g`. See [Ascend NPU Usage](../npu-usage/). |

Soft slicing is disabled by default. Do not set `huawei.com/vnpu-mode: hami-core` or `huawei.com/*-core` on the Pod; those requests are rejected. If `runtimeClassName` is omitted, the webhook injects `ascend`.

Supported models include 910A, 910B2 / 910B3 / 910B4 / 910B4-1, 310P / 310P48, and 910C. Template sizes, 910C training vs inference switching, and 310P rules are in [Ascend NPU Usage](../npu-usage/).

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
- Switching virtualization modes requires time. During the switch, the page displays a **Switching** status and auto-refreshes until complete.
- After the label is written, the vendor exclusive plugin and the shared plugin swap by node selector and re-register capacity with kubelet. When no workload holds the devices and the plugin image is already on the node: the page mode and exclusive capacity (`kunlunxin.com/xpu`) are ready in about **15 seconds**; shared capacity (`kunlunxin.com/vxpu`) can take another **5–6 minutes** for kubelet to unregister it to 0. If the image is missing, add image-pull time.
- Kunlunxin, HAMi-Core → Exclusive: stop Pods / containers that use XPUs first. If a VF is still in use, the page can stay on **Switching** and capacity may temporarily count leftover VFs (for example 11 instead of 8 physical cards). If those processes cannot exit, reboot the node so capacity returns to the physical card count.
- Mode switch does not change the vendor label. Kunlunxin nodes stay Kunlunxin and only toggle Exclusive vs HAMi-Core.
- If the mode switch fails, a **Switch Failed** status is displayed. Check that the GPU driver and device plugin on the node are functioning properly.
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
| Training tasks requiring full GPU power | Default / Kunlunxin Exclusive | No virtualization overhead, maximum performance |
| Compute-constrained, overcommit needed | HAMi-Core with scaling params (NVIDIA) | Allows VRAM/compute overcommit allocation |
| Kunlunxin whole-card inference or training | Exclusive | Request `kunlunxin.com/xpu`; count must be 1, 2, 4, or 8 |
| Kunlunxin multi-task sharing on one card | HAMi-Core | Request `kunlunxin.com/vxpu` and `kunlunxin.com/vxpu-memory` |
| Ascend inference with in-card isolation | Hard template (request memory) | Runtime creates a fixed-size vNPU |
| Ascend training or ACL Graph / vLLM graph capture | Whole card or a larger template | Small templates can exhaust stream quota |
