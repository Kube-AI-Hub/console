# 日志收集（L3）

[子模块需求](./_index.md)

## 概述

项目级日志收集开关：开启后，平台的边车注入器会向该项目的容器组注入日志边车，把容器日志投递到集群的日志后端。

开关写在一个**标签**上：`logging.kubesphere.io/logsidecar-injection`（`enabled` / `disabled`）。注入器读的就是这个标签，因此本页只读写它，不读写任何注解或 CR。

## 用户故事

### US1 - 开启本项目的日志收集 (Priority: P1)

作为 **项目管理员**，我希望 **一键开启日志收集**，以便 **不用改 YAML 就能让本项目的容器日志进入日志后端**。

**Independent Test**：在默认状态下开启开关，然后读取项目命名空间，核对标签为 `enabled`。

### US2 - 关闭前被明确告知代价 (Priority: P1)

作为 **项目管理员**，我希望 **关闭时先看到「边车会被移除、容器组会重启」的说明**，以便 **不会因为一个开关意外重启线上容器**。

**Independent Test**：关闭开关时出现确认区块，取消则标签不变；确认后标签变为 `disabled`。

### US3 - 知道从来没人配置过 (Priority: P2)

作为 **项目管理员**，我希望 **区分「从未配置」与「被关闭」**，以便 **判断这是默认状态还是有人主动关的**。

**Independent Test**：命名空间无该标签时显示「未配置」；标签为 `disabled` 时显示「已关闭」。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01** — 已知项目命名空间上没有日志标签，当打开日志收集页，则状态显示「未配置」；开启开关后回读命名空间，`logging.kubesphere.io/logsidecar-injection` 标签等于 `enabled`，页面状态变为「已开启」。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-02** — 已知日志收集处于开启状态，当关闭开关，则先出现确认说明（含「容器组将重启」）；点取消标签不变；点确认后标签变为 `disabled`，页面状态变为「已关闭」。

## 设计目标

1. 开关只写一个标签，不动命名空间的其它字段。
2. 关闭是破坏性方向，必须有确认与代价说明。
3. 「未配置」与「已关闭」是两种事实，不合并。

## 约束与边界

- 读 `/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>`；写 `/api/v1/namespaces/<ns>` 的 merge patch。
- 标签写在命名空间上，所以需要项目级权限。
- 集群未启用日志模块时开关禁用并说明（读集群对象的 `status.configz.logging`）。
- 不涉及日志查询与日志后端配置。

## UI 交互设计

- 一块面板：状态徽标（未配置/已开启/已关闭）、开关、说明、项目与标签值。
- 关闭时在面板内展开确认区块（不是弹窗），取消即收起。
- 日志模块缺失时开关禁用，并显示警示说明。

## 文案与校验

- 状态：未配置 / 已开启 / 已关闭。
- 关闭确认：说明边车会被移除、容器组将重启。

## 边界情况

- 标签值为 `disabled`：显示「已关闭」，不是「未配置」。
- 命名空间读取失败：错误面板 + 重试。
- 写入失败：错误信息显示在面板内，开关回到实际状态（不乐观更新）。

## 明确不做

- 日志查询与检索（属集群日志查询页面）。
- 日志后端（Elasticsearch/Kafka 等）配置（属集群级日志配置）。
- 按工作负载选择收集范围（老 console 也未提供）。

## 假设

- 边车注入器在命名空间标签为 `enabled` 时注入；关掉后已存在的边车由控制器移除。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01** — 读命名空间标签得到开关状态，并区分未配置。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-02** — 开关以 merge patch 只写该标签，值为 enabled/disabled。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-03** — 关闭前确认；集群无日志模块时禁用开关。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01** — 开关后回读标签与页面状态一致；关闭确认取消时标签不变。
