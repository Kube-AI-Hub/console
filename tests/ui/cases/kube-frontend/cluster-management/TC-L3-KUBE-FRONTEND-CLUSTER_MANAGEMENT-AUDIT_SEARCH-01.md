# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01 审计日志查询 · 检索与过滤

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `audit-search`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/audit-logs`
- **需求**: `prd/kube-frontend/cluster-management/audit-search.md`

## 产品功能

集群审计检索：时间窗口 + 动作/资源/用户/企业空间过滤 + 服务端分页。

### 关联需求

- `prd/kube-frontend/cluster-management/audit-search.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/audit-search.md`](../../../../prd/kube-frontend/cluster-management/audit-search.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01** — 已知集群有审计记录，当打开审计日志查询页，则按时间倒序列出时间、动作、用户、资源·命名空间、状态码与请求 URI；首页条数等于 `min(50, 接口 total)`；按动作过滤通过 `verb_filter` 下发且结果收窄；底部显示总数与页码并可翻页。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/audit-search.md`](../../../../design/kube-frontend/cluster-management/audit-search.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/audit-search.md`](../../../../prd/kube-frontend/cluster-management/audit-search.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 谁在什么时候改了什么 (Priority: P1)

作为 **平台管理员**，我希望 **按用户/资源/动作检索审计记录**，以便 **回答「这次变更是谁做的」**。

**Independent Test**：读接口总数与首页条数，页面行数与之对应；按动作过滤后结果收窄。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群开启审计且索引有数据

## 测试步骤

1. 用 API 读最近 1 小时审计 total 与首页条数
2. 打开审计日志查询页
3. 核对首页行数与总数显示
4. 按动作过滤后结果收窄

## 期望结果

- 首页行数等于 min(50, total)
- 行内显示动作、用户、资源、状态码与 URI

## 失败排查

- 记录数为 0：缺 operation=query 参数
- 状态码为空：读了顶层字段而不是 ResponseStatus.code
- 过滤无效：过滤键写成 verb 而不是 verb_filter

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterAuditLogsPage.tsx
