---
title: "Ascend NPU Resource Usage"
keywords: "Kube AI Hub, NPU, Ascend, 910C, 910B, 310P, HAMi, hard template, vNPU"
description: "Request Huawei Ascend NPU whole cards and hard-template slices in Kube AI Hub, including resource names and scheduling rules for 910C, 910B, and 310P."
linkTitle: "Ascend NPU Usage"
weight: 8115
---

Kube AI Hub schedules Ascend NPUs through HAMi. The production model is **Ascend Runtime + hard-template slicing**. Install the [Ascend driver and Ascend Docker Runtime](../../installing-on-linux/gpu-driver-installation/install-ascend-driver/) on NPU nodes first. See [GPU Virtualization Mode](../gpu-virt-mode/) for the slicing model and [NPU monitoring](../../faq/observability/monitoring/#npu-monitoring) for metrics.

## How to request an NPU

Workloads use `hami-scheduler`. If `runtimeClassName` is omitted, the admission webhook injects `ascend` so the container can mount `/dev/davinci*` and the driver libraries.

| Request | `limits` | Behavior |
|---------|----------|----------|
| **Whole card** | Count only, for example `huawei.com/Ascend910C: "2"` | The webhook fills in that SKU's whole-card memory |
| **Hard slice** | Count `"1"` plus `huawei.com/<SKU>-memory` in **MiB** | Memory is rounded **up** to the nearest hard template; the driver creates a vNPU from that template |

{{< notice note >}}

- Memory must be an integer **MiB** value, for example `16384` for 16 GiB. Do not use `16Gi` or a byte quantity.
- Do not request `huawei.com/*-core`. Soft slicing is disabled by default; a core request is rejected.
- Multi-NPU requests (count greater than 1) cannot include a partial memory request. Admission fails in that case.

{{</ notice >}}

## Supported models and resource names

The console **GPU Type** list and YAML use the same resource names. Count and memory must belong to the same SKU.

| Model | Count resource | Memory resource | Whole-card memory (MiB) | Notes |
|-------|----------------|-----------------|-------------------------|-------|
| 910A | `huawei.com/Ascend910A` | `huawei.com/Ascend910A-memory` | 32768 | DCMI may report `910B` or `910ProB` |
| 910B2 | `huawei.com/Ascend910B2` | `huawei.com/Ascend910B2-memory` | 65536 | |
| 910B3 | `huawei.com/Ascend910B3` | `huawei.com/Ascend910B3-memory` | 65536 | |
| 910B4 | `huawei.com/Ascend910B4` | `huawei.com/Ascend910B4-memory` | 32768 | |
| 910B4-1 | `huawei.com/Ascend910B4-1` | `huawei.com/Ascend910B4-1-memory` | 65536 | |
| 310P (24G die) | `huawei.com/Ascend310P` | `huawei.com/Ascend310P-memory` | 21527 | Auto-detected from die capacity |
| 310P48 (48G die) | `huawei.com/Ascend310P48` | `huawei.com/Ascend310P48-memory` | 43054 | Do not mix with `Ascend310P` |
| 910C | `huawei.com/Ascend910C` | `huawei.com/Ascend910C-memory` | 65536 | Whole-card minimum is 2 NPUs |

## Hard templates

The scheduler rounds `*-memory` **up** to the smallest template that is at least as large as the request. Inside the container, `npu-smi info` shows the VF / template name.

| Model | Template | Memory (MiB) | AI Core | AI CPU |
|-------|----------|--------------|---------|--------|
| 910A | `vir02` | 2184 | 2 | — |
| 910A | `vir04` | 4369 | 4 | — |
| 910A | `vir08` | 8738 | 8 | — |
| 910A | `vir16` | 17476 | 16 | — |
| 910B2 | `vir03_1c_8g` | 8192 | 3 | 1 |
| 910B2 | `vir06_1c_16g` | 16384 | 6 | 1 |
| 910B2 | `vir12_3c_32g` | 32768 | 12 | 3 |
| 910B3 / 910B4-1 | `vir05_1c_16g` | 16384 | 5 | 1 |
| 910B3 / 910B4-1 | `vir10_3c_32g` | 32768 | 10 | 3 |
| 910B4 | `vir05_1c_8g` | 8192 | 5 | 1 |
| 910B4 | `vir10_3c_16g` | 16384 | 10 | 3 |
| 310P | `vir01` | 3072 | 1 | 1 |
| 310P | `vir02` | 6144 | 2 | 2 |
| 310P | `vir04` | 12288 | 4 | 4 |
| 310P48 | `vir01` | 6144 | 1 | 1 |
| 310P48 | `vir02` | 12288 | 2 | 2 |
| 310P48 | `vir04` | 24576 | 4 | 4 |
| 910C | `vir06_1c_16g` | 16384 | 6 | 1 |
| 910C | `vir12_3c_32g` | 32768 | 12 | 3 |

The current 910C profile uses Atlas A3 **training** templates (`vir06_1c_16g` / `vir12_3c_32g`). A request of `16384` maps to `vir06_1c_16g`; `20000`–`32768` maps to `vir12_3c_32g`.

## 910C and 310P rules

**910C**

- A whole-card request of `1` is adjusted to `2` (one physical module = a pair of dies).
- A slice with `*-memory` below whole-card memory keeps count `1`.
- Odd whole-card counts (3, 5, 7, …) are rejected. Multi-NPU whole-card allocations use pairs 0+1, 2+3, and so on.

**310P**

- The device plugin picks the resource name from each die's DCMI memory: below 32768 MiB → `Ascend310P`; 32768 MiB or more → `Ascend310P48`.
- A pod that requests `huawei.com/Ascend310P` will not schedule on a 48G-die node. Use `Ascend310P48` instead.

## Examples

Whole card (910C; the webhook changes `1` to `2` and fills memory):

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ascend910c-whole
spec:
  schedulerName: hami-scheduler
  containers:
    - name: inference
      image: your-registry/vllm-ascend:latest
      resources:
        limits:
          huawei.com/Ascend910C: "1"
```

32G hard slice (910C → `vir12_3c_32g`):

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ascend910c-slice-32g
spec:
  schedulerName: hami-scheduler
  containers:
    - name: inference
      image: your-registry/vllm-ascend:latest
      resources:
        limits:
          huawei.com/Ascend910C: "1"
          huawei.com/Ascend910C-memory: "32768"
```

310P48 hard slice (`8000` rounds up to `vir02` / 12288 MiB):

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ascend310p48-slice
spec:
  schedulerName: hami-scheduler
  containers:
    - name: inference
      image: your-registry/vllm-ascend:latest
      resources:
        limits:
          huawei.com/Ascend310P48: "1"
          huawei.com/Ascend310P48-memory: "8000"
```

When you pick an Ascend GPU type on the workload create page, enter memory in MiB from the table above and leave core empty. See [Container Image Settings](../../project-user-guide/application-workloads/container-image-settings/).

## Small templates and graph capture

16G / 32G hard templates have fewer AI Cores and streams than a whole card. Default vLLM-Ascend ACL Graph capture can fail with `EE1023` (stream resources exhausted). Use one of:

- Add `--enforce-eager` to disable graph capture
- Reduce `cudagraph_capture_sizes`, or move to a larger template / whole card

The Pod detail page **Scheduled to GPU** section shows the result. A hard slice lists the template name (for example `vir12_3c_32g`) and memory, not a core percentage. Cluster-side views are in [GPU Card Management](../gpu-management/).
