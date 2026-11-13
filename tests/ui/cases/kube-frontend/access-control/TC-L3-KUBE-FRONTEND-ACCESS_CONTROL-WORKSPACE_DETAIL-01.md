# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01 企业空间详情 · 基本信息与项目列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-detail`
- **入口**: `{BASE_URL}/kube-frontend/access/workspaces`
- **需求**: `prd/kube-frontend/access-control/workspace-detail.md`

## 产品功能

从企业空间列表点名称进入详情：基本信息（名称/别名/管理员/创建者/创建时间/部署集群/描述）+ 该企业空间下的项目列表（状态、创建时间，可点进项目控制台）。

### 关联需求

- `prd/kube-frontend/access-control/workspace-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-detail.md`](../../../../prd/kube-frontend/access-control/workspace-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01** — 已知平台上有企业空间，当从列表点名称进入详情，则显示名称、别名、管理员、创建者、创建时间、部署集群与描述；项目区块列出该企业空间下的全部项目（数量等于带 `kubesphere.io/workspace=<名称>` 标签的命名空间数），每项显示状态与创建时间，点名称进入该项目控制台；没有项目时显示空态说明。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-detail.md`](../../../../design/kube-frontend/access-control/workspace-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-detail.md`](../../../../prd/kube-frontend/access-control/workspace-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清一个企业空间里有什么 (Priority: P1)

作为 **平台管理员**，我希望 **从一个企业空间直接看到它的项目列表**，以便 **不必逐个去猜项目属于哪个企业空间**。

**Independent Test**：打开企业空间详情，核对项目数与带该企业空间标签的命名空间数一致；点项目名进入其控制台。

## 前置与配置

- 已登录平台管理
- 平台上至少有一个企业空间

## 测试步骤

1. 用 API 读取企业空间列表，取第一个并读取其对象与带该企业空间标签的命名空间
2. 打开企业空间列表，点击该企业空间名称
3. 核对 URL、基本信息与对象一致
4. 核对项目数量与带标签的命名空间数一致
5. 点击第一个项目名，核对进入该项目控制台

## 期望结果

- 详情页可达且状态 ready
- 管理员等于 spec.template.spec.manager，创建者等于 kubesphere.io/creator
- 项目数等于带 kubesphere.io/workspace 标签的命名空间数
- 项目名称链接可达项目控制台

## 失败排查

- 项目数与标签数不一致：可能读的是 resources 代理缓存而不是 resources 接口
- 管理员显示空：应从 spec.template.spec.manager 取
- 项目链接 404：项目 URL 缺少 workspace 段

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 WorkspaceDetailPage.tsx
