# 资源事件查询（L3）

[子模块需求](./_index.md)

## 概述

集群最近事件的浏览与过滤：类型、原因、对象（kind + 名称 + 命名空间）、消息、最近发生时间与重复次数。

老 console 把这件事故在集群的「工具箱」里（弹窗）。这里做成页面：工具箱要先进某个集群、再点开弹窗，而「某个东西在报错」是随时会发生的入口需求。

**窗口语义**：页面读的是事件集合的**最近 200 条**，不是全部历史——apiserver 本身会分页并让事件过期，`kubectl get events` 也是同一个窗口。页面把这件事明写出来，避免读者以为搜索没找到就是「不存在」。

## 用户故事

### US1 - 集群里现在什么在报错 (Priority: P1)

作为 **集群管理员**，我希望 **按类型/关键字过滤最近事件**，以便 **在不知道具体对象时定位问题**。

**Independent Test**：打开资源事件页，核对行数等于接口返回条数；切到「警告」后所有行都是 Warning。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01** — 已知集群有事件，当打开资源事件页，则以表格列出六列：时间、类别、项目、资源名称与类型、原因、消息（消息出现多次时追加 `xN`）；表格按最近发生时间倒序，每页 20 条，页脚显示总数与「第 N / M 页」，可上一页/下一页，首尾页时对应按钮禁用。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-02** — 已知资源事件页，当设置任一过滤条件（消息 / 项目 / 资源类型 / 资源名称 / 原因 / 类别）并点「查询」，则列表回到第 1 页并用该条件重新取数，页脚总数随之变化；点「重置」则清空所有条件并回到未过滤状态；**上方的 12 小时柱状图与列表使用同一组过滤条件**（柱状图的总数与桶由 `operation=histogram` 返回），因此柱高描述的就是下方这批记录；柱状图接口失败时只降级该卡片（显示「事件统计暂不可用」），列表照常可用。

## 设计目标

1. 倒序：最近的错误在最上面。
2. 统计与列表同源同条件：柱状图不能描述另一批记录。
3. 总数与分页来自接口，不由前端窗口猜测。

## 约束与边界

- 只读；数据来自 `/kapis/tenant.kubesphere.io/v1alpha2/events`（`operation=histogram` 与 `operation=query`）。核心组 `/api/v1/events` 既没有总数也不支持服务端过滤，因此不作为数据源。
- 过滤全部在服务端执行（`message_search` / `involved_object_namespace_filter` / `involved_object_kind_filter` / `involved_object_name_filter` / `reason_filter` / `type_filter`）。
- 柱状图固定最近 12 小时、30 分钟一桶（对齐老 console 的「最近 12 小时事件数」卡片）；列表覆盖接口保留的全部历史。

## UI 交互设计

- 顶部：12 小时柱状图卡片（右上角显示该窗口总数）。
- 过滤区：消息 / 项目 / 资源类型 / 资源名称 / 原因 / 类别六个输入 + 「查询」「重置」。
- 表格六列；分页在表格下方。

## 文案与校验

- 空态：没有事件 / 当前条件下没有事件记录。
- 窗口提示：显示最近 200 条；事件会在 apiserver 中过期。

## 边界情况

- 时间字段缺失：优先 `lastTimestamp`，回退 `eventTime`/`firstTimestamp`。
- `count` 缺失按 1。

## 明确不做

- 事件全文检索后端（ES）：本页只过滤已加载窗口，不承诺历史检索。
- 日志检索、审计检索：另两个工具箱页面，属独立功能。

## 假设

- 事件的 `involvedObject` 足以标出「哪个对象」。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01** — 读集群事件并按时间倒序展示。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-02** — 类型过滤与窗口内关键字过滤。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01** — 行数与接口一致；类型过滤只留所选类型。