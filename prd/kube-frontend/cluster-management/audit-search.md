# 审计日志查询（L3）

[子模块需求](./_index.md)

## 概述

集群级审计检索：按动作（verb）、资源、用户、企业空间与时间窗口检索审计事件，展示时间、动作、用户、资源、状态码与请求 URI。

老 console 的「审计日志查询」弹窗同样来自工具箱；本页把它做成可直达的页面。

## 用户故事

### US1 - 谁在什么时候改了什么 (Priority: P1)

作为 **平台管理员**，我希望 **按用户/资源/动作检索审计记录**，以便 **回答「这次变更是谁做的」**。

**Independent Test**：读接口总数与首页条数，页面行数与之对应；按动作过滤后结果收窄。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01** — 已知集群有审计记录，当打开审计日志查询页，则按时间倒序列出时间、动作、用户、资源·命名空间、状态码与请求 URI；首页条数等于 `min(50, 接口 total)`；按动作过滤通过 `verb_filter` 下发且结果收窄；底部显示总数与页码并可翻页。

## 设计目标

1. 一屏回答「谁、对什么、做了什么、结果如何」。
2. 与容器日志查询共用工时窗口与分页形态。

## 约束与边界

- 读 `/kapis/tenant.kubesphere.io/v1alpha2/auditing/events`（`operation=query`，时间参数为秒）。
- 只读。

## UI 交互设计

- 顶部：动作/资源/用户/企业空间四个输入框 + 时间窗口下拉。
- 表格：时间、动作、用户、资源·命名空间、状态码、请求 URI。
- 底部：总数与上一页/下一页。

## 文案与校验

- 空态：当前条件下没有审计记录。
- 总数：共 {count} 条。

## 边界情况

- 状态码非 2xx 用警示徽标。
- 接口不可用：只该区块降级。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01** - 按时间窗口与过滤条件检索审计记录并分页。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-02** - 展示状态码与请求 URI 以便定位操作。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-03** - 顶部显示计数条与时间分布直方图（`operation=histogram`）。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01** - 首页条数 = min(50, total)；过滤经 verb_filter 等参数下发。

## 明确不做

- 审计导出：`/auditing/events/export` 实测 404。
- 审计详情抽屉（请求/响应原文）：涉及敏感内容，需要单独的权限与脱敏设计。

## 假设

假设：审计数据落在 ES 索引中，保留期由平台配置决定。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01`
