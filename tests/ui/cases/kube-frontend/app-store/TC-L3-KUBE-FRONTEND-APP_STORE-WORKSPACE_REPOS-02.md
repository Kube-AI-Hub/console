# TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02 企业空间应用仓库：添加与移除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `workspace-repos`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/repos`
- **需求**: `prd/kube-frontend/app-store/workspace-repos.md`

## 产品功能

企业空间仓库可添加（服务端拉取 index.yaml 校验）与移除。

### 关联需求

- `prd/kube-frontend/app-store/workspace-repos.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/workspace-repos.md`](../../../../prd/kube-frontend/app-store/workspace-repos.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02** — （需求里找不到这条 AC，请先补需求或改 `covers`）

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/workspace-repos.md`](../../../../design/kube-frontend/app-store/workspace-repos.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/workspace-repos.md`](../../../../prd/kube-frontend/app-store/workspace-repos.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 企业空间管理员查看应用仓库与仓库应用 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到本空间添加的应用仓库（地址/状态/创建时间）以及仓库同步来的应用**，以便 **确认仓库是否同步成功、空间里有哪些可部署应用**。

**Independent Test**：打开 `/workspaces/<ws>/repos`，行数等于 `GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos` 的条目数；打开 `/workspaces/<ws>/apps`，行数等于同一工作空间 `apps` 集合条目数；两者为 0 时分别显示空态。

## 前置与配置

- admin 可写企业空间仓库；集群可访问 charts.kubesphere.io

## 测试步骤

1. 打开企业空间仓库列表
2. 点击添加仓库，填写唯一名称与可达地址并提交
3. 回读接口并刷新列表
4. 行操作移除该仓库

## 期望结果

- 失败的地址不被接受并显示服务端原因

## 失败排查

- 400：地址不可达（DNS/网络），属预期校验，不是页面错误

## 产品改版后如何更新自动化

- 选择器：workspace-repos:create / :create:name / :create:url / :create:submit / :delete
