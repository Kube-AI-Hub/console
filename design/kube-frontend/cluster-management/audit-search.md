# 审计日志查询 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/audit-search.md)

## 概述

审计检索页：时间窗口 + 动作/资源/用户/企业空间过滤 + 服务端分页。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01

## 设计目标与非目标

目标：按动作/资源/用户检索审计记录。非目标：请求响应原文（脱敏与权限）、导出、直方图。

## 关键约束

- `GET /kapis/tenant.kubesphere.io/v1alpha2/auditing/events?operation=query&start_time&end_time&from&size&verb_filter&objectref_resource_filter&user_search&workspace_search`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01 — 直接读审计索引，复用老 console 的过滤键

**为什么**：审计记录不是 Kubernetes 对象，没有资源列表可读；索引接口是唯一来源。过滤键沿用老 console 的 `verb_filter` / `objectref_resource_filter` / `user_search` / `workspace_search`（实测均生效：create→28 条、users 资源→23 条、admin→60 条）。
**被否方案**：解析审计对象的 CRD。本项目里审计走 ES，不经 CRD。
**何时重新考虑**：审计数据源换成 CRD/对象存储时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-02 — 不展示请求/响应原文

**为什么**：`RequestObject`/`ResponseObject` 可能包含凭据与敏感字段。展示需要脱敏规则与权限模型，不能顺手带出来。
**被否方案**：折叠展示原文。折叠不是脱敏。
**何时重新考虑**：有明确的脱敏与权限设计时。

## 系统现状

老 console：工具箱 → 审计日志查询弹窗（含直方图、详情抽屉）。本页迁移检索、过滤与分页。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterAuditLogsPage.tsx`
- 路由：`routes/kube-frontend.clusters.$cluster/audit-logs/`
- 接口：`packages/api-client/src/search.ts` 的 `auditSearchApi`
- 注册：`areas/registry.ts`（监控告警分组）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 检索 | GET /kapis/tenant.kubesphere.io/v1alpha2/auditing/events?operation=query |

## 不变量

1. 首页条数 = min(50, total)。
2. 只展示时间/动作/用户/资源/状态码/URI，不含请求体。

## 已知坑

- **`operation=query` 必填**：缺省时返回统计模式或空记录。
- **时间字段**：`@timestamp` 为 UTC，展示用统一时间格式化。
- **响应状态是对象**：`ResponseStatus.code`，不是顶层字段。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01.yaml`
可观测点：`cluster-audit-logs:surface`、`:list`、`:total`、`:page`。

## 后续改进

- 审计详情（脱敏后）、导出、直方图。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01