# 告警消息列表（L3）

[子模块需求](./_index.md)

## 概述

告警消息表：消息内容（摘要为主、正文为辅）、状态、级别、告警策略、监控目标、触发时间；行操作「详情」打开消息抽屉（状态、摘要、正文、策略、目标、当前值、标签与注解摘要）。消息是告警控制器的活动记录，本页只读。

## 用户故事

### US1 - 看清当前告警与级别 (Priority: P1)

作为 **值班运维**，我希望 **在列表上直接看到状态、级别与触发时间**，以便 **判断先处理哪一条**。

**Independent Test**：打开告警消息页，核对列与状态徽章。

### US2 - 从正确的集合读到当前告警，而不是永远空表 (Priority: P1)

作为 **值班运维**，我希望 **告警消息页读的是聚合 v2beta1 的当前告警集合**，以便 **在项目里有告警时能看到它们，而不是永远显示「暂无告警消息」**。

**Independent Test**：打开项目告警消息页，抓取请求路径必须命中 `/kapis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/alerts`，不得再请求 `v1alpha2`；用 API 的 `totalItems` 判断页面应为 empty 还是 ready；ready 时列顺序与总数可核对。

## 验收场景

- **AC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01** — 已知项目内没有活动告警（模块未安装时也是同一读路径返回 0 条），当打开告警消息页，则页面状态为 `empty` 并显示空态标题与说明，不出现错误面板。
- **AC-L3-KUBE-FRONTEND-MONITORING-ALERTS-02** — 已知项目内有 M 条活动告警（M 可能为 0），当打开告警消息页，则列表请求命中聚合 v2beta1 的 namespaced `alerts` 集合、不请求 v1alpha2；M 为 0 时页面为 `empty` 且不渲染表头；M 大于 0 时页面为 `ready`，列依次为消息、状态、级别、告警策略、监控目标、触发时间，分页总数等于接口 `totalItems`；行操作只有「详情」，不提供删除（聚合 API 没有 item DELETE 路由，旧 console 的项目消息页也没有删除入口）。

## 设计目标

落实「模块未安装时退化为空态」这条不变量。

## 约束与边界

- 读 `/kapis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/alerts`，参数 `page`/`limit`/`sortBy=activeAt`/`ascending`/`keyword`；分页与总数取响应 `totalItems`。
- 该集合是聚合 API 的只读活动告警，不是 CRD：没有对象名、没有 namespace 元数据、也没有 item 删除路由（`DELETE …/alerts/<name>` 返回 `404 Page Not Found`，2026-11-15 实测）。
- 列表不渲染表头（空列表时）。

## UI 交互设计

行操作：详情（抽屉，字段来自行数据：名称、摘要、正文、状态、级别、策略、监控目标、当前值、触发时间，以及标签/注解摘要）。不提供删除。

## 文案与校验

- 列：消息（摘要 + 正文）、状态、级别、告警策略、监控目标、触发时间；窄屏依次折叠。
- 分页文案「第 N-M 条，共 T 条」；空态标题「暂无告警消息」。
- 状态：告警中 / 待触发 / 已恢复。

## 边界情况

- 接口 200 + `{items: [], totalItems: 0}` 是真空态，不是错误；只有非 2xx 才显示错误面板。
- 告警随时间变化：翻页/刷新后总数可能改变，以最后一次响应为准，不用旧总数做判断。
- 未知状态/级别原样显示，不映射为空。

## 明确不做

- 静默、通知、批量操作。
- **告警消息删除**：聚合 API 不提供 item 删除路由（实测 `DELETE /kapis/alerting.kubesphere.io/v2beta1/…/alerts/<name>` 与 `…/globalalerts/<name>` 均返回 404 Page Not Found），旧 console 的项目消息页也没有删除入口；提供删除会是一个永远失败的操作。

## 假设

- 聚合告警接口返回 `{items, totalItems}`，条目形状为 `{activeAt, annotations, labels, state, value}`。
- 活动告警是当前评估结果，不是历史归档；「历史」在这里指当前仍在触发/待触发的记录集合。

## 验收用例

- `TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01`
- `TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS-01** — 列表在有数据时按六列展示，无数据时为 `empty`。
- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS-02** — 数据源为聚合 v2beta1 的 namespaced `alerts`，服务端分页与总数；行详情展示标签/注解摘要。
- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS-03** — 不提供删除入口（API 无此路由）。

## 成功标准

- **SC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01** — 页面在 0 条时 `empty` 且无错误面板。
- **SC-L3-KUBE-FRONTEND-MONITORING-ALERTS-02** — 请求路径命中 v2beta1 聚合集合；有数据时列顺序与分页总数同接口一致。