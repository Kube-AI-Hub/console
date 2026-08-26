---
title: "昇腾 NPU 资源使用"
keywords: "Kube AI Hub, NPU, 昇腾, Ascend, 910C, 910B, 310P, HAMi, 硬模板, vNPU"
description: "了解如何在 Kube AI Hub 中申请华为昇腾 NPU 整卡与硬模板切分，以及 910C、910B、310P 的资源名与调度规则。"
linkTitle: "昇腾 NPU 使用"
weight: 8115
---

平台通过 HAMi 调度昇腾 NPU，生产口径为 **Ascend Runtime + 硬模板切分**。节点需先完成 [昇腾驱动与 Ascend Docker Runtime](../../installing-on-linux/gpu-driver-installation/install-ascend-driver/) 安装。切分策略说明见 [GPU 虚拟化模式](../gpu-virt-mode/)，监控见 [NPU 监控](../../faq/observability/monitoring/#npu-监控)。

## 申请方式

工作负载使用 `hami-scheduler`。未填写 `runtimeClassName` 时，准入 webhook 会注入 `ascend`，容器即可挂载 `/dev/davinci*` 与驱动库。

| 申请类型 | `limits` | 行为 |
|----------|----------|------|
| **整卡** | 只写卡数，例如 `huawei.com/Ascend910C: "2"` | webhook 补上该型号的整卡显存 |
| **硬切分** | 卡数 `"1"` + `huawei.com/<SKU>-memory`（单位 **MiB**） | 显存向上取整到最近硬模板，驱动按模板创建 vNPU |

{{< notice note >}}

- 显存必须写 **MiB 整数**，例如 `16384` 表示 16 GiB。不要写 `16Gi` 或字节数。
- 不要申请 `huawei.com/*-core`。当前默认关闭软切分，带 core 的请求会被拒绝。
- 多卡（卡数大于 1）不能同时申请部分显存，否则准入失败。

{{</ notice >}}

## 支持的型号与资源名

控制台「GPU 类型」与 YAML 使用同一套资源名。申请整卡或切分时，卡数与显存必须属于同一 SKU。

| 型号 | 卡数资源 | 显存资源 | 整卡显存（MiB） | 说明 |
|------|----------|----------|-----------------|------|
| 910A | `huawei.com/Ascend910A` | `huawei.com/Ascend910A-memory` | 32768 | DCMI 可能报 `910B` / `910ProB` |
| 910B2 | `huawei.com/Ascend910B2` | `huawei.com/Ascend910B2-memory` | 65536 | |
| 910B3 | `huawei.com/Ascend910B3` | `huawei.com/Ascend910B3-memory` | 65536 | |
| 910B4 | `huawei.com/Ascend910B4` | `huawei.com/Ascend910B4-memory` | 32768 | |
| 910B4-1 | `huawei.com/Ascend910B4-1` | `huawei.com/Ascend910B4-1-memory` | 65536 | |
| 310P（24G die） | `huawei.com/Ascend310P` | `huawei.com/Ascend310P-memory` | 21527 | 节点按 die 容量自动识别 |
| 310P48（48G die） | `huawei.com/Ascend310P48` | `huawei.com/Ascend310P48-memory` | 43054 | 不可与 `Ascend310P` 混用 |
| 910C | `huawei.com/Ascend910C` | `huawei.com/Ascend910C-memory` | 65536 | 整卡最小单位为 2 个 NPU |

## 硬模板

调度器把 `*-memory` **向上取整**到下表中不小于该值的最小模板。容器内执行 `npu-smi info` 可看到对应 VF / 模板名。

| 型号 | 模板名 | 显存（MiB） | AI Core | AI CPU |
|------|--------|-------------|---------|--------|
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

当前 910C 配置为 Atlas A3 **训练卡**模板（`vir06_1c_16g` / `vir12_3c_32g`）。例如申请 `16384` 会落到 `vir06_1c_16g`，申请 `20000`～`32768` 会落到 `vir12_3c_32g`。

## 910C 与 310P 规则

**910C**

- 整卡申请 `1` 会被改成 `2`（一块物理模块 = 一对 die）。
- 带 `*-memory` 且小于整卡显存的切片保持卡数 `1`。
- 整卡奇数（3、5、7…）会被拒绝；多卡整卡按 0+1、2+3 成对分配。

**310P**

- 插件按每颗 die 的 DCMI 显存选择资源名：小于 32768 MiB 为 `Ascend310P`，大于等于 32768 MiB 为 `Ascend310P48`。
- 在 48G die 节点上申请 `huawei.com/Ascend310P` 无法调度，必须改用 `Ascend310P48`。

## 示例

整卡（910C，webhook 会把 `1` 调整为 `2` 并补齐显存）：

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

32G 硬切分（910C → `vir12_3c_32g`）：

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

310P48 硬切分（`8000` 向上取整到 `vir02` / 12288 MiB）：

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

工作负载创建页选择昇腾 GPU 类型时，显存请按上表填写 MiB，不要填写 core。详见 [容器镜像设置](../../project-user-guide/application-workloads/container-image-settings/)。

## 小模板与图编译

16G / 32G 硬模板上的 AI Core 与 stream 配额小于整卡。vLLM-Ascend 默认 ACL Graph 捕获可能报 `EE1023`（stream 资源不足）。可任选其一：

- 启动参数增加 `--enforce-eager`，关闭 graph 捕获
- 减少 `cudagraph_capture_sizes`，或改用更大模板 / 整卡

分配结果可在 Pod 详情的「调度至显卡」中查看，硬切分会显示模板名（如 `vir12_3c_32g`）和显存，不会显示 core 比例。集群侧查看方式见 [显卡管理](../gpu-management/)。
