# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09 企业空间 DevOps 工程入口与列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{KA_WORKSPACE}/devops`
- **需求**: `prd/kube-frontend/access-control/workspace-console.md`

## 产品功能

企业空间侧栏有「DevOps 工程」入口；列表按 workspace 聚合各已启用 DevOps 的集群，显示工程名称/别名/描述、集群、同步状态与创建时间；行链接到该工程在集群作用域的详情；集为空、未启用 DevOps、部分集群读取失败分别给出说明。

### 关联需求

- `prd/kube-frontend/access-control/workspace-console.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-console.md`](../../../../prd/kube-frontend/access-control/workspace-console.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09** — 已知企业空间 `<ws>` 的若干集群中，部分/全部启用了 DevOps（`status.configz.devops`），当打开空间侧栏「DevOps 工程」页 `/workspaces/<ws>/devops`，则行集合等于各「就绪且启用 DevOps」集群的 `GET /kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops?limit=-1`（成员集群加 `/kapis/clusters/<c>` 前缀）返回工程的并集：每行显示名称（有别名时主显示别名、次显示名称）、描述、所在集群、同步状态（successful/pending/failed → 已同步/同步中/同步失败，其它/缺失显示 `-`）与创建时间；行名称链接到 `/kube-frontend/clusters/<cluster>/devops/<name>`；搜索按名称/别名/描述/集群过滤；没有任何工程时显示「还没有 DevOps 工程」空态，所在集群都未启用 DevOps 时显示未启用说明（并非空表），某集群读取失败保留其他集群行并显示部分失败提示，全部集群读取失败显示错误与重试。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-console.md`](../../../../design/kube-frontend/access-control/workspace-console.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-console.md`](../../../../prd/kube-frontend/access-control/workspace-console.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 从企业空间进入自己的 DevOps 工程 (Priority: P2)

作为 **企业空间管理员**，我希望 **在空间侧栏直接看到这个空间的 DevOps 工程（名称/别名、所在集群、同步状态、创建时间）并打开其中一个**，以便 **不必先切到集群作用域再找「我的空间有哪些工程」**。

**Independent Test**：从空间概览点侧栏「DevOps 工程」进入 `/workspaces/<ws>/devops`，行集合等于各已启用 DevOps 集群的 kapis workspace 聚合（`/kapis/devops.../workspaces/<ws>/devops`）的并集；每行链接到 `/kube-frontend/clusters/<cluster>/devops/<name>`。

## 前置与配置

- 已登录，且在 host 集群；企业空间 system-workspace 存在且至少一个集群启用了 DevOps
- 测试自建一个唯一 DevOps 工程（POST /kapis/devops.kubesphere.io/v1alpha3/workspaces/system-workspace/devops），结束后删除（含 finalizer 清理），不依赖环境里已有工程

## 测试步骤

1. 从企业空间概览点击侧栏「DevOps 工程」，进入 /kube-frontend/workspaces/system-workspace/devops
2. 等待列表离开 loading，核对行集合与各集群 kapis workspace aggregate（/kapis/devops.../workspaces/<ws>/devops，成员集群走 /kapis/clusters/<c>/...）的并集一致
3. 定位刚创建的工程行：显示别名（无别名显示名称）、集群、同步状态与创建时间
4. 核对行链接 href 指向 /kube-frontend/clusters/<cluster>/devops/<name>
5. 在搜索框输入别名，行集合缩小到该行；清空搜索恢复
6. 清理测试工程，确认列表中不再出现

## 期望结果

- 侧栏入口可达，URL 为 workspace 作用域的 /workspaces/<ws>/devops（不带集群段）
- 行数 = 各 DevOps 已启用集群 aggregate 并集；每行集群列正确，名称/别名不混用
- 行链接到集群作用域工程详情；搜索按名称/别名过滤
- 无任何工程时显示「还没有 DevOps 工程」空态；空间所在集群都未启用 DevOps 时显示未启用说明，而不是空表或整页错误
- 某集群读取失败时保留其他集群的行并显示部分失败提示；全部失败显示错误+重试

## 失败排查

- 入口不存在：确认 registry workspace 区域有 devops 页，且 route 文件在 workspaces/$workspace/devops/
- 有工程但列表为空：确认按 status.configz.devops 过滤了集群，且用 kapis workspace aggregate（不是 raw /apis/devopsprojects）
- 成员集群行缺失：确认成员集群请求走 /kapis/clusters/<c>/devops...；成员未就绪时不查询

## 产品改版后如何更新自动化

- 行的 data-ai-id 为 workspace-devops:link:<cluster>:<name>；surface 为 workspace-devops:surface
