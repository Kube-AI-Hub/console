# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02 企业空间控制台 · 配额（项目 × 资源）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/quota`
- **需求**: `prd/kube-frontend/access-control/workspace-quota.md`

## 产品功能

企业空间独立作用域：配额页把空间内各项目的 ResourceQuota 展开为「项目 / 资源 / 上限 / 已使用」。

### 关联需求

- `prd/kube-frontend/access-control/workspace-quota.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-quota.md`](../../../../prd/kube-frontend/access-control/workspace-quota.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02** — 已知企业空间内有 P 个项目、这些项目的 ResourceQuota 共含 N 条 `spec.hard` 资源（可能为 0），当打开该空间的配额页，则页面列出 N 行，每行显示项目、资源键、上限与已用（已用取 `status.used`，缺失时为 0）；N 为 0 时显示空态并说明「项目没有设置资源配额」；接口失败时显示错误面板与重试，而不是空态。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-quota.md`](../../../../design/kube-frontend/access-control/workspace-quota.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-quota.md`](../../../../prd/kube-frontend/access-control/workspace-quota.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 企业空间管理员看配额分布 (Priority: P1)

作为 **企业空间管理员**，我希望 **在一张表里看到这个空间下每个项目的配额上限与已用量**，以便 **判断哪个项目快用满、要不要调整配额**。

**Independent Test**：打开 `/workspaces/<ws>/quota`，核对行数等于「该空间各项目 ResourceQuota 中 `spec.hard` 条目数之和」，且行内的限额/已用与接口值一致。

## 前置与配置

- 已登录，且能看到至少一个企业空间
- 该企业空间的项目与项目级 ResourceQuota 可读（可能为 0 条配额）

## 测试步骤

1. 用 API 读企业空间列表，选一个有数据的空间
2. 读该空间的项目，再读每个项目的 ResourceQuota，按 spec.hard 的键展开得到期望行数 N
3. 打开该空间的 /quota 页
4. 等待 surface 离开 loading
5. 核对表头四列与行数；N 为 0 时核对空态

## 期望结果

- surface 可见且 data-ai-state 从 loading 变为 ready 或 empty
- 表头含 项目 / 资源 / 上限 / 已使用
- 行数等于 N（超过 20 行时为第一页 20 行）
- N 为 0 时表格为空态，页面不报错

## 失败排查

- 行数为 0 但接口有配额：页面读的是 /api/v1/namespaces/<ns>/resourcequotas，检查 selector 与命名空间
- 整页错误：企业空间成员对某个项目无权读 ResourceQuota，检查请求是否并发抛出
- 表头是「把配额 CR 当空间级」的旧口径：检查是否误用了 tenant 的 405 集合接口

## 产品改版后如何更新自动化

- 选择器：pages/access_control.py（origin 拼接）、WorkspaceQuotaPage.tsx 的 workspace-quota:surface
