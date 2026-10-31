# 厂商与虚拟化方式分派（L3）

[子模块需求](./_index.md)

## 概述

同一套 `gpu_card_*` / `gpu_agent_pod_*` 指标背后，各厂商、各虚拟化方式的取数来源不同。这一节是那张对照表的正文：**哪一列来自哪个 exporter、哪一列是近似、近似怎么算**。

页面不实现这张表，但运维需要它来解释「为什么这个数看着不对」。

## 用户故事

### US1 - 作为集群运维，知道 MIG 模式下 Pod 显存为什么是分摊出来的

**Independent Test**：读本文对照表，能找到 `NVIDIA / mig` 行的「POD 级来源」与「近似策略」两列。

### US2 - 作为研发，新增一种虚拟化方式时知道要改哪几处

**Independent Test**：按对照表新增一行，能定位到 gpu-agent 里对应的 `CollectMetrics` 分支。

## 验收场景

- **AC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01** — Given 节点是 `hami-core` 模式，When 查看该节点 Pod 的 GPU 指标，Then 数值来自 vGPUmonitor（`vGPU_device_memory_usage_in_bytes`），且与 `nvidia-smi` 观察到的容器用量一致。

## 设计目标

- **分派逻辑只存在于 gpu-agent 一处。** 页面、kube-server、recording rules 都只认 `gpu_card_*` / `gpu_agent_pod_*`，不知道 DCGM 或 vGPUmonitor 的存在。
- **近似必须显式。** 近似值与被测量值在同一个字段里，但 design 里写清哪种情况是近似，运维据此判断可信度。

## 约束与边界

- 这张表是**契约**：新增厂商或模式，必须同时更新本表、`design/cluster-gpu/gpu-monitor/vendor-dispatch.md` 与 HAMi 侧 `pkg/gpu-agent/collector/`。
- 页面不感知厂商：`vendor` 标签只用于筛选与分组，不用于分支渲染。
- 单位统一：显存字节、利用率 0–100、分配量卡当量。

## UI 交互设计

页面上没有这一节的控件。可观察的是：

- 集群 GPU 资源页可按 `vendor` 筛选。
- 显卡列表的「厂商」列显示 `getVendorDisplayName`。
- 节点监控页的曲线不区分厂商。

## 文案与校验

| 厂商 | 模式 | 卡级来源 | POD/容器级来源 | 取不到时的近似 |
| --- | --- | --- | --- | --- |
| NVIDIA | `default` | `hami-dcgm-exporter`（`DCGM_FI_DEV_*`） | kubelet podresources 拿 UUID → 回查卡指标 | Pod 独占整卡时等于卡值 |
| NVIDIA | `hami-core` | 同上 | `vGPUmonitor`（`vGPU_device_memory_usage_in_bytes`、`Device_utilization_desc_of_container`） | vGPUmonitor 不可用时按分配注解的 `gpumem` 比例切分卡指标 |
| NVIDIA | `mig` | 同上（DCGM 4.7 + MIG profiling 库） | 分配注解 + MIG 实例 | 按 MIG 实例的卡指标按 `gpumem` 比例近似 |
| 寒武纪 | `default` / `env-share` / `dynamic-smlu` / `mim` | `mlu-exporter` | `mlu_container` 标签映射 | 按 `smlu_instance_info` 的 `vcore` 占比加权 |
| 昇腾 | 硬切分 / `hami-vnpu-core` | `npu-exporter`（`npu_chip_info_*`） | `npu_container_info` | 按 vNPU 模板的算力占比近似 |
| 海光 DCU | `default` | gpu-agent 自采 | 无容器级指标 | 卡指标全量计入该 Pod |

## 边界情况

| 情况 | 对外行为 |
| --- | --- |
| exporter 与 gpu-agent 不在同节点 | gpu-agent 解析失败，该维度无数据（co-located resolver 只找同节点 Pod） |
| 同一卡被多个 Pod 共享且无容器级指标 | 按 `gpumem` 比例分摊；比例和为 0 时按 Pod 数均分 |
| 厂商新增但表里没有 | gpu-agent 不采集，页面无数据；新增时必须补表 |
| 一个节点两种厂商卡 | 不支持的组合，`xpu-vendor` 只允许一个值 |

## 功能需求

- **FR-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01**：系统必须在 gpu-agent 内按厂商与虚拟化方式分派取数来源，对外只暴露统一指标名。
- **FR-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-02**：取不到容器级指标时，系统必须按分配比例近似而不是留空。

## 成功标准

- **SC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01**：任一厂商、任一模式下，`gpu_card_*` 与 `gpu_agent_pod_*` 都有数据（或明确的空态原因），不出现「有卡但无任何指标」。

## 明确不做

- 不做厂商原始指标名的透出。
- 不做多厂商混合节点的采集。
- 不做 per-container 精确计量（受硬件与虚拟化方式限制）。

## 假设

- 各厂商 exporter 已按 chart 的子 chart 部署在对应节点。
- gpu-agent 的 collector 能通过 `xpu-vendor` 标签选择正确的实现。

## 验收用例

- L3：`TC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01`
