# 健康状态（L3）

## 概述

显卡列表里的「状态」列，以及单卡详情侧栏的状态属性。它回答一个问题：**这张卡现在能不能被调度**。答案来自 HAMi device plugin 的健康检查结论，不是页面的推断，也不是监控指标。

## 用户故事

### US1 - 作为集群运维，看到一张被 device plugin 摘除的卡仍列在表里并标为亚健康

**Independent Test**：在某节点上让 device plugin 把一张卡标记为 unhealthy（或直接改该节点 register annotation 里对应设备的 `health` 为 `false`），刷新 `/clusters/default/nodes/<node>/status`：该卡仍出现在显卡列表里，状态列显示「亚健康」而不是「健康」；`kubectl get node <node> -o jsonpath='{.status.allocatable.nvidia\.com/gpu}'` 比 capacity 小。

### US2 - 作为集群运维，确认健康卡与故障卡在同一张表里可以一眼分辨

**Independent Test**：同一节点上既有健康卡也有故障卡时，状态列按卡分别渲染：健康卡「健康」、故障卡「亚健康」，两者颜色不同；页面不出现未翻译的 key。

## 验收场景

- **AC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — Given 某节点的 register annotation 里有一张设备 `health: false`，When 打开该节点的运行状态页，Then 该设备仍在显卡列表中，状态显示「亚健康」，其余设备显示「健康」。
- **AC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — Given 某节点的 register annotation 里全部设备 `health: true`，When 打开该节点的运行状态页，Then 所有行显示「健康」，不出现任何「亚健康」。

## 设计目标

- **健康状态的唯一来源是 device plugin 的结论。** 它写在节点注解 `hami.io/node-nvidia-register` 的每个设备的 `health` 字段里；接口读这个字段，页面渲染它。
- **故障卡不从列表消失。** 只要 register annotation 里还有这条设备记录，它就必须出现在列表里。device plugin 在把卡标记 unhealthy 时**不会**从注解里删掉它，所以「少了一张卡」不是预期行为。
- **不重复判定。** 页面不调 `nvidia-smi`、不查 Prometheus、不看 allocatable 差额去猜哪张卡坏了。allocatable 变小只说明「少了」，说不出「是哪一张」。

## 约束与边界

- 本功能只读。不提供「重置健康状态」按钮——恢复靠重启 device plugin（由 HAMi 侧操作），页面不代劳。
- 状态只有两态：健康 / 亚健康。没有「未知」态：没有设备记录的卡不产生行。
- 与监控的边界：健康与利用率无关。0% 利用率不代表不健康，100% 也不代表健康。

## UI 交互设计

- 状态列用 `Status` 组件：`health: true` → `type="Running"`、文案「健康」；`health: false` → `type="Warning"`、文案「亚健康」。
- 集群页的状态列可筛选（健康 / 亚健康），筛选值 `healthy` / `unhealthy` 由后端处理。
- 单卡详情侧栏的「状态」用同一映射。

## 文案与校验

| key | 中文 | 用途 |
| --- | --- | --- |
| `HEALTHY` | 健康 | 状态列 / 筛选 |
| `SUB_HEALTHY` | 亚健康 | 状态列 / 筛选 |
| `GPU_CARD_STATUS` | 状态 | 表头 |
| `GPU_CARD_LIST` | 显卡列表 | 节点页面板标题 |

## 边界情况

- 节点没有任何 register annotation：不产生行，页面显示空态。
- 注解里设备数为 0：同样按空态处理。
- 注解格式非法：该节点跳过并记日志，不影响其它节点。
- 设备有记录但 `health` 字段缺失：按不健康处理（`false` 是零值），避免把未知状态渲染成健康。

## 功能需求

- **FR-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — 系统 MUST 以 `hami.io/node-nvidia-register` 里每个设备的 `health` 字段作为显卡健康状态的唯一来源。
- **FR-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — 系统 MUST 让 `health: false` 的设备仍出现在显卡列表里，并渲染为「亚健康」。

## 成功标准

- **SC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01** — 注解变化后，页面在 30 秒内反映新的健康状态（缓存刷新周期 + 前端请求）。
- **SC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02** — 列表里的「亚健康」条数等于注解里 `health: false` 的设备数。

## 明确不做

- 不做健康状态的修改入口。
- 不做 XID 明细展示（XID 号、发生时间）。
- 不做历史健康趋势。

## 假设

- HAMi device plugin 会持续写 `hami.io/node-nvidia-register`，且保留 unhealthy 设备的记录。

## 验收用例

- `TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01`
- `TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02`
