# TC-FULL-CLUSTER-GPU-GPU_MONITOR-01 GPU 监控 · 节点/卡/Pod 三个维度

- **用例 ID**: `TC-FULL-CLUSTER-GPU-GPU_MONITOR-01`
- **级别**: L2  **套件**: `full`
- **模块**: `cluster-gpu` / `gpu-monitor` `page`
- **入口**: `{BASE_URL}/clusters/default/nodes/{node}/monitors`
- **需求**: `prd/cluster-gpu/gpu-monitor/_index.md`

## 产品功能

节点监控、单卡监控、Pod 监控三处都有 GPU 指标曲线，单位正确且不出现未翻译 key。

### 关联需求

- `prd/cluster-gpu/gpu-monitor/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/gpu-monitor/_index.md`](../../../../prd/cluster-gpu/gpu-monitor/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-CLUSTER-GPU-GPU_MONITOR-01** — Given 已登录且节点有 GPU，When 依次打开节点监控、单卡监控、Pod 监控三个页面，Then 三处都有 GPU 指标曲线且单位正确（利用率为 %、显存为字节换算后的 GiB、功耗为 W、温度为 °C），不出现未翻译的 key。

### 关联设计

- 技术方案 [`design/cluster-gpu/gpu-monitor/_index.md`](../../../../design/cluster-gpu/gpu-monitor/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/gpu-monitor/_index.md`](../../../../prd/cluster-gpu/gpu-monitor/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，在节点监控页看到这台机器 GPU 的整体利用率与显存


**Independent Test**：打开 `/clusters/default/nodes/sagesuite-demo/monitors`，GPU 相关图表有曲线，节点 GPU 总量等于该节点卡数。

### US2 - 作为集群运维，在单卡详情页看到这一张卡的利用率、显存、功耗、温度


**Independent Test**：从节点显卡列表点进某张卡，Monitoring 页签出现五条曲线（利用率、显存、分配率、功耗、温度），且只反映这一张卡。

### US3 - 作为集群运维，在 Pod 监控页看到这个任务用了多少 GPU


**Independent Test**：打开一个 GPU Pod 的监控页，GPU 显存/分配量非零，且与该 Pod 的 `vgpu-devices-allocated` 注解条数一致。

### US4 - 作为集群运维，理解为什么某种虚拟化方式下容器级指标是近似的


**Independent Test**：在 `mig` 模式下打开 Pod 监控，页面上指标有值；对照节点显卡列表的分配情况，数值是按显存比例分摊的近似值。

## 前置与配置

- 已登录，且在 default 集群
- 目标节点有 GPU 且 gpu-agent 的指标已被 Prometheus 抓取
- 该节点上至少有一个申请了 GPU 的 Pod

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/nodes/{node}/monitors，读取 GPU 相关图表
2. 打开 {BASE_URL}/clusters/default/nodes/{node}/status，点某张卡的 UUID 进入详情，切到 Monitoring 页签
3. 打开该节点上一个 GPU Pod 的监控页

## 期望结果

- 节点监控页出现 GPU 利用率、显存用量、分配量三条曲线
- 单卡监控页出现使用率、显存用量、分配率、功耗、温度五条曲线
- Pod 监控页出现 GPU 显存用量、使用量、分配量三条曲线
- 利用率为百分比，显存为 GiB，功耗为 W，温度为 °C
- 三处都不出现未翻译的 key

## 失败排查

- 曲线为空时先 curl hami-gpu-agent:9101/metrics 确认 gpu_card_ 序列存在
- Pod 监控为空时确认 recording rule pod:gpu_* 已加载
- 单卡页数值与其它卡相同说明 gpu_uuid 没传

## 产品改版后如何更新自动化

- 指标名或单位变化时同步改 pages 与 expected
