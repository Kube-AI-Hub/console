# 监控告警（L2）

[子模块需求](../../../prd/kube-frontend/monitoring/_index.md)


## 概述

告警消息与告警策略两张表，共用一个列表组件。

## 关联需求

- AC-FULL-KUBE-FRONTEND-MONITORING-01

- `prd/kube-frontend/monitoring/_index.md`

## 设计目标与非目标

目标：告警数据走正确的 kapis 组（聚合 v2beta1）；0 条时退化为空态；项目级自定义策略可写；策略详情可读到逐条规则与告警消息历史。非目标：消息静默、通知渠道配置（通知在平台「通知管理」的独立对象里）。

## 关键约束

- kapis 前缀为 `/kapis/alerting.kubesphere.io/v1alpha2`，与通用资源代理不同。
- 告警消息可删除；项目级、非内置策略可创建/编辑/删除（见 `alerts-write.md`），内置与集群级策略只读。

## 方案决策

### DEC-L2-KUBE-FRONTEND-MONITORING-01 — 把 kapis 组做成参数，而不是再加一个客户端

**为什么**：只有前缀不同，其余（分页、搜索、详情映射）完全一样。参数化让 `resourceApi` 仍然是唯一入口。

**被否方案**：为告警单独写一套请求与列表逻辑。会重复分页与错误处理。

**何时重新考虑**：告警接口的形状与资源接口出现实质差异时。

### DEC-L2-KUBE-FRONTEND-MONITORING-02 — 200 + 空响应体按空列表处理

**为什么**：模块未安装时聚合 API 返回 200 但无 body。解析成 `undefined` 后直接读 `.items` 会抛错，页面变成红色错误面板——那是在报告「我们的代码出错」，而事实是「这里没有数据」。

**被否方案**：捕获异常再显示空态。会把真正的解析错误也一起吞掉。

### DEC-L2-KUBE-FRONTEND-MONITORING-03 — 告警在集群域与项目域都提供列表

**为什么**：告警规则的 `namespace` 是归属，不是可见范围。集群管理员要回答的是「整个集群现在有哪些告警在响」「哪条规则在反复触发」——按项目逐个点进去看，等于把一次聚合查询拆成 N 次人肉操作。老 console 的集群级告警还多「自定义策略 / 内置策略」两个页签，正是这个视角：内置策略由安装器维护，本来就跨项目。

**被否方案（原决策，2026-11-14 推翻）**：只在项目作用域提供。理由是「集群级聚合要么发一次全命名空间查询（接口没有该能力，只能逐项目拉），要么在集群页里再做一次项目筛选」。**这条依据没经过探测**——「接口没有全命名空间查询」是当时的假设，不是实测结论；告警 list 与项目级是同一个端点，不传 `namespace` 即全命名空间返回。把未验证的假设写成技术约束，是这条决策错得最典型的地方。

**落地约定**：
1. 集群级 `alerts` / `alertingrules` 两页，列在项目级基础上加「项目」列。
2. 策略详情与项目级共用同一组件。
3. 「自定义 / 内置」用来源列区分，不另做页签。

## 系统现状

老 console `pages/projects/containers/Alerting/{Messages,Policies}`：消息页六列、只读；策略列表四列 + 启用/停用/编辑/删除/恢复初始配置；策略详情是独立路由（左栏属性 + 规则/告警消息两页签）。新实现保留这些任务：列表、详情（规则 + 消息时间线）、创建/编辑/删除、启停、SSAR 门控；集群级两页签复用 `RuleGroupBody`。

## 仓库落点

- `apps/console-next/src/pages/monitoring/`（`MonitoringListPage` / `RuleGroupsPage` / `RuleGroupDetailPage` / `AlertMessagesTimeline` / `permissions.ts`）
- `src/routes/.../{alerts,alertingrules}/`（含 `alertingrules/$name.tsx` 详情路由）
- `packages/api-client/src/alerting.ts`

## 对外契约

读聚合告警 `/kapis/alerting.kubesphere.io/v2beta1/{clusteralerts,globalalerts,namespaces/<ns>/alerts}`；规则组读 `/apis/alerting.kubesphere.io/v2beta1/{globalrulegroups,clusterrulegroups,namespaces/<ns>/rulegroups}`，写走 `/apis` 的 POST/PUT/DELETE。告警消息只读（聚合 API 无 item 删除路由）。

## 不变量

1. 告警数据只经告警 kapis 组读取；规则组只经 `/apis/alerting.kubesphere.io/v2beta1` 读写。
2. 0 条（200 + 空数组）等价于空态；非 2xx 才是错误。
3. 消息区的「共 N 条」来自服务端 `totalItems`；按策略过滤用 `label_filters=rule_group`，不在分页后的行上过滤。
4. 写入口 = 所有权 × SSAR；检查失败 fail-open。

## 已知坑

- 把告警路径写成通用资源代理（`resources.kubesphere.io`）会得到 404。
- 空响应体不是 `{}`，任何 `.items` 访问前必须先兜底。
- 本部署的 v1alpha2 告警组对不存在的集合返回 200 空体；读它会把「有告警」显示成「没有告警」。当前实现读 v2beta1 聚合集合。
- 项目列表合并三种规则组作用域，详情的 `scope` 必须随行数据传递；同名对象可能跨集合存在。

## 测试与可观测

E2E：`tests/kube-frontend/monitoring/`。

## 后续改进

消息静默；告警模板与 YAML 编辑。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-MONITORING-01`

## 页面与技术结构

- 区域 `monitoring`（两页），路由每页一个文件夹。
- 组件：`MonitoringListPage`（两张列表 + 告警详情抽屉）、`RuleGroupsPage`（策略列表/行操作/共享 `RuleGroupBody`）、`RuleGroupDetailPage`（详情路由页）、`AlertMessagesTimeline`（消息时间线）、`RuleGroupDialog`（创建/编辑）、`permissions.ts`（SSAR）。描述符在 `pages/monitoring/queries.ts`。

## 状态与数据归属

- 页面只持有 UI 态；数据在 Query 缓存，key 含 kind。

## 关键契约与依赖

- `alertMessagesApi`（聚合 v2beta1，scope+ruleGroup）、`ruleGroupsApi` / `ruleGroupsWriteApi`（`/apis` CRD）、`alertingRulesApi`（3.3 旧模型）、`accessReviewApi`（SSAR）。

## 明确不做

- 集群级与内置策略的编辑；消息静默、通知渠道配置（平台通知管理另有独立页）；告警消息删除（聚合 API 无此路由）。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 告警消息 | `prd/…/alerts.md` | `design/…/alerts.md` |
| 告警策略 | `prd/…/rules.md` | `design/…/rules.md` |
| 告警策略的创建与编辑 | `prd/…/alerts-write.md` | `design/…/alerts-write.md` |