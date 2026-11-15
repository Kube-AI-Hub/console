# 告警消息（L3）

[子模块需求](../../../prd/kube-frontend/monitoring/alerts.md)

## 概述

项目内的活动告警消息列表。数据来自聚合 v2beta1 的 namespaced 集合，六列展示（消息、状态、级别、告警策略、监控目标、触发时间），行「详情」打开只读抽屉；与告警策略列表共用列表组件，差异由描述符表达。

## 关联需求

- AC-L3-KUBE-FRONTEND-MONITORING-ALERTS-03
- AC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01
- AC-L3-KUBE-FRONTEND-MONITORING-ALERTS-02

- `prd/kube-frontend/monitoring/alerts.md`

## 设计目标与非目标

目标：从**当前真正有数据的集合**读告警；分页/总数/排序走服务端；空态与错误分开。非目标：静默、通知、删除。

## 关键约束

- 项目集合 `GET /kapis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/alerts`；参数 `page`/`limit`/`sortBy=activeAt`/`ascending`/`keyword`；总数取 `totalItems`。
- 条目形状是 `{activeAt, annotations, labels, state, value}` —— 聚合告警记录，不是 Kubernetes 对象：没有 `metadata.name`、没有 namespace 元数据。
- 只读：聚合 API 没有 item 删除路由。

## 方案决策

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01 — 详情用抽屉，从行数据渲染

**为什么**：聚合记录很小，列表响应已带全字段（含完整 labels/annotations）。再发一次详情请求在慢接口上是纯等待。

**被否方案**：详情页路由。为只读小对象增加一条路由与一次请求，收益为零。

**何时重新考虑**：详情需要列表没有的字段（例如关联工作负载的实时指标）时。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS-03 — 数据源改用 v2beta1 聚合集合，不再读 v1alpha2

**为什么**：`/kapis/alerting.kubesphere.io/v1alpha2/namespaces/<ns>/alerts` 在本部署返回 **200 且响应体为空**——页面把它当空列表，于是「项目有告警」永远显示成「暂无告警消息」。旧 console 的消息 store 本来就写 `kapis/alerting.kubesphere.io/v2beta1`（`console/src/stores/alerting/message.js`），迁移时选错了版本。实测 v2beta1 项目集合返回 `{items, totalItems}`，且集群级 `globalalerts` 当前有 44 条活动记录，证明读链路可用。

**被否方案**：继续用 v1alpha2 并在空体时回退到 v2beta1。会产生两次请求、两个语义（「真空」与「读错组」）无法区分，且回退只在空时发生，非空时永远走错路径。

**何时重新考虑**：平台移除 v2beta1 聚合告警组时。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS-04 — 不提供告警消息删除

**为什么**：聚合 API 只有集合端点：`DELETE /kapis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/alerts/<name>` 与 `…/globalalerts/<name>` 均返回 `404 Page Not Found`（2026-11-15 实测），记录也没有可引用的对象名。旧 console 的项目消息页 `itemActions={[]}`，本来就没有删除。保留一个必然失败的删除按钮比不提供更糟。

**被否方案**：保留删除按钮，失败时提示「由控制器管理」。把一个已知不可用的操作做成错误提示，是在教用户重试。

**何时重新考虑**：聚合 API 提供按 label 选择器的 silence/delete 端点，且平台确认可安全删除活动告警时（届时按静默语义重新设计，而不是删除）。

## 系统现状

老 console 的消息页：列 MESSAGE（summary + message/description）、STATUS（pending/firing 过滤）、SEVERITY（critical/error/warning）、ALERTING_POLICY（`labels.rule_group`，链到策略详情）、MONITORING_TARGET（模板规则按 labels 链到工作负载/节点）、TRIGGER_TIME（可按 activeAt 排序）；服务端分页 10/20/50，无行操作。本页保留列语义，删除入口按 DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS-04 不迁移。

## 仓库落点

- 页面：`apps/console-next/src/pages/monitoring/MonitoringListPage.tsx`（alerts 分支的列、详情抽屉）
- 接口：`packages/api-client/src/alerting.ts` 的 `alertMessagesApi`（`scope: project`、`keyword`、`sortBy: activeAt`）与 `toAlertMessage`（severity 归一、target 推导）
- 查询：`apps/console-next/src/pages/monitoring/queries.ts` 的 `useMonitoringList`（kind=alerts）
- 文案：`packages/locales/src/index.ts` 的 `monitoring.alerts.*` / `monitoring.column.policy` / `monitoring.column.target` / `monitoring.field.summary` / `monitoring.field.value`

## 对外契约

### CON-L3-KUBE-FRONTEND-MONITORING-ALERTS-01 — 项目活动告警集合

`GET /kapis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/alerts?page=1&limit=10&sortBy=activeAt&ascending=false[&keyword=…][&state=firing|pending][&label_filters=severity=critical|warning|info]` → `{items, totalItems}`。`items` 为聚合告警记录；`totalItems` 是**筛选后**的服务端总数，翻页以它为准。排序只支持 `activeAt`（旧 console 同样只按触发时间排序）。实测 `state=firing` 与 `label_filters=severity=warning` 都服务端生效（total 从 65 分别降到 23 / 51）。

### CON-L3-KUBE-FRONTEND-MONITORING-ALERTS-02 — 告警记录形状

`{activeAt: string, annotations: {summary?, message?, description?, runbook_url?}, labels: {alertname, severity?, rule_group?, rule_type?, namespace?, pod?, container?, node?, workload?, …}, state: "firing"|"pending", value?: string|number}`。`labels.alertname` 是规则名；`severity` 可能是 high/medium/low，读取端归一为 critical/warning/info。

## 不变量

1. 详情抽屉展示的字段与列表行来自同一份数据（同一次列表响应）。
2. 页面 `data-ai-state` 由接口结果决定：0 条 → `empty`；非 2xx → `error`；200 空体也按 `empty` 处理。

### INV-L3-KUBE-FRONTEND-MONITORING-ALERTS-01

分页区「共 N 条」恒等于最近一次响应的 `totalItems`；搜索/翻页后页码与总数同一次请求更新，不展示旧总数。

### INV-L3-KUBE-FRONTEND-MONITORING-ALERTS-02

告警消息只读：列表不渲染删除动作，也不发 DELETE 请求。

## 已知坑

- **v1alpha2 是错误组**：本部署对不存在的资源返回 200 空体，看起来像「没有告警」，实际是读错了组（见 DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS-03）。
- **`/apis` 下没有 alerts**：`GET /apis/alerting.kubesphere.io/v2beta1/alerts` 返回 404；只有 `/kapis` 聚合前缀有集合。
- **target 不能只对 `rule_type=template` 显示**：本部署 33/44 条活动告警都是 `rule_type=custom`，却带有 `namespace`/`pod` 标签；按旧 console 的 `rule_type` 门槛会隐藏全部目标。本实现按标签推导 `namespace/resource`。
- **告警数量会变**：活动告警随评估周期增删，用例以同次响应或页面自身总数对账，不写死具体条数。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS-05 — 状态/级别筛选放在服务端，不筛选当前页

**为什么**：两个过滤参数都由端点支持（实测 `state=firing` 23 条、`label_filters=severity=warning` 51 条，均带过滤后的 `totalItems`）。如果只过滤当前页的行，读者看到的总数仍是全量、翻页后又会冒出别的状态；旧 console 的 `withList` 同样把 `state`/`label_filters` 下发给服务端。

**被否方案**：取全量后前端过滤。告警多时首屏变慢，且分页与总数需要自己重算，容易与接口不一致。

**何时重新考虑**：端点取消 `state` 参数时，改为对 `labels`/`state` 的单一 label filter 组合。

### GOT-L3-KUBE-FRONTEND-MONITORING-ALERTS-01

把搜索当成本地过滤：聚合集合支持 `keyword` 参数，本地过滤只作用于当前页，会漏掉其他页的匹配项。

### GOT-L3-KUBE-FRONTEND-MONITORING-ALERTS-02

用 `metadata.name` 做行键：聚合记录没有对象名，`alertname` 会重复（同一规则按 pod 展开多条）。行键用 `scope:index:alertname` 合成，刷新后仍唯一。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/monitoring/TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-0{1,2}.yaml`。
- 可观测点：`alerts:surface`（`data-ai-state`）、`alerts:search`、`alerts:detail`、`alerts:detail:labels`、`alerts:detail:annotations`；列表行 `data-ai-row="<scope:index:alertname>"`。
- 数据源对账断言：页面必须请求 `/kapis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/alerts`，且不得请求 `/kapis/alerting.kubesphere.io/v1alpha2`。

## 后续改进

- 静默（silence）与通知路由（平台通知管理已有独立对象）。
- 监控目标的下钻链接（labels→工作负载/节点路由）。
- 按 `state` / `severity` 的服务端筛选（当前只用 keyword 与告警策略过滤）。

## 验收用例

- TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01
- TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-02
