# 监控告警（L2）

[子模块需求](../../../prd/kube-frontend/monitoring/_index.md)


## 概述

告警消息与告警策略两张表，共用一个列表组件。

## 关联需求

- AC-FULL-KUBE-FRONTEND-MONITORING-01

- `prd/kube-frontend/monitoring/_index.md`

## 设计目标与非目标

目标：告警数据走正确的 kapis 组；模块缺失时退化为空态；项目级自定义策略可写。非目标：消息静默、通知渠道配置。

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

老 console `pages/projects/containers/Alerting/{Messages,Policies}`；列表列与本模块一致，策略支持启用/停用与编辑。

## 仓库落点

- `apps/console-next/src/pages/monitoring/`
- `src/routes/.../{alerts,alertingrules}/`
- `packages/api-client/src/alerting.ts`

## 对外契约

读 `alerting.kubesphere.io/v1alpha2`；删除同样走该组（未在页面暴露策略删除）。

## 不变量

1. 告警数据只经告警组读取。
2. 空响应体等价于空列表。

## 已知坑

- 把告警路径写成通用资源代理（`resources.kubesphere.io`）会得到 404。
- 空响应体不是 `{}`，任何 `.items` 访问前必须先兜底。

## 测试与可观测

E2E：`tests/kube-frontend/monitoring/`。

## 后续改进

消息静默；告警模板与 YAML 编辑。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-MONITORING-01`

## 页面与技术结构

- 区域 `monitoring`（两页），路由每页一个文件夹。
- 组件 `MonitoringListPage`，描述符在 `pages/monitoring/queries.ts`。

## 状态与数据归属

- 页面只持有 UI 态；数据在 Query 缓存，key 含 kind。

## 关键契约与依赖

- `alertingApi` / `alertingRulesApi`（`kapisPrefix: KAPIS_ALERTING`）。

## 明确不做

- 集群级与内置策略的编辑；消息静默、通知渠道配置。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 告警消息 | `prd/…/alerts.md` | `design/…/alerts.md` |
| 告警策略 | `prd/…/rules.md` | `design/…/rules.md` |
| 告警策略的创建与编辑 | `prd/…/alerts-write.md` | `design/…/alerts-write.md` |
