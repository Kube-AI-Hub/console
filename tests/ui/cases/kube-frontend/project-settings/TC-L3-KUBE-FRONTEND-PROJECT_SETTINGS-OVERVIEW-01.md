# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-01 项目概览 · 信息、配额与快捷入口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `overview`
- **入口**: `{BASE_URL}/kube-frontend/public/clusters/host/projects/default/overview`
- **需求**: `prd/kube-frontend/project-settings/overview.md`

## 产品功能

项目作用域的落地页：基本信息、配额使用（已用/硬限 + 占比）、限额范围与快捷入口。

### 关联需求

- `prd/kube-frontend/project-settings/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/overview.md`](../../../../prd/kube-frontend/project-settings/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-01** — 已知项目存在，当打开项目概览，则显示名称、别名、创建者、创建时间与描述；配额区块逐条显示「已用 / 硬限」与占比条，条数等于该项目 resourcequotas 的 hard 键数（没有配额时显示空态）；限额范围区块列出 limitranges（没有时显示空态）；快捷入口包含容器组、部署、配置字典、存储卷、项目成员，链接指向对应页面。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/overview.md`](../../../../design/kube-frontend/project-settings/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/overview.md`](../../../../prd/kube-frontend/project-settings/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开项目先看清它的边界 (Priority: P1)

作为 **项目成员**，我希望 **进入项目先看到它的配额与限额**，以便 **在申请资源前知道自己还有多少余量**。

**Independent Test**：打开项目概览，核对配额条数与 resourcequotas 的 hard 键数一致；没有配额时显示空态。

## 前置与配置

- 已登录，且对 default 项目有读取权限

## 测试步骤

1. 用 API 读取 default 项目的 namespace 对象与 resourcequotas
2. 打开项目概览页
3. 核对基本信息（名称等于 namespace 名）
4. 核对配额区块（有条目时行数等于 hard 键数，否则空态）
5. 核对限额范围区块与快捷入口链接

## 期望结果

- 页可达且 ready
- 配额行数与 hard 键数一致，或明确空态
- 快捷入口包含容器组/部署/配置字典/存储卷/项目成员且链接可达

## 失败排查

- 配额区块报 resource is not supported：走了 resources 代理而不是 /api/v1
- 侧栏无「项目概览」：registry 未注册 project 区
- 占比显示 NaN：数量解析没有兜底

## 产品改版后如何更新自动化

- 选择器见 pages/project_settings.py 与 ProjectOverviewPage.tsx
