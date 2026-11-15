# TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03 企业空间应用仓库 · 编辑、同步索引、事件与详情

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `workspace-repos`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/repos`
- **需求**: `prd/kube-frontend/app-store/workspace-repos.md`

## 产品功能

仓库可编辑（PATCH 子集、同步周期校验）、可手动同步索引、详情页可看基本信息与索引事件。

### 关联需求

- `prd/kube-frontend/app-store/workspace-repos.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/workspace-repos.md`](../../../../prd/kube-frontend/app-store/workspace-repos.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03** — 已知列表里有一个仓库，当点行操作「编辑」，则弹窗预填名称/协议/地址/同步周期/描述；修改描述与同步周期后保存，`PATCH …/repos/<repoId>` 成功且列表与 `GET …/repos/<repoId>` 回读一致；同步周期非法（非 `<数字>s|m|h` 或非 0 且不在 180s–86400s）时不发请求并提示「同步周期需在 180s 到 86400s 之间（或 0s 关闭自动同步）」；名称为空或地址为空时不发请求并提示对应字段。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04** — 已知列表里有一个仓库，当点行操作「同步索引」，则向 `POST …/repos/<repoId>/action` 发送 `{action:"index"}`，成功后重新读取列表；失败时在页面上显示「同步失败：{reason}」且不假装成功。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-05** — 已知存在一个仓库，当打开 `…/repos/<repoId>`，则「基本信息」页签显示名称/地址/描述/状态/创建者/同步周期/最近同步/创建时间，取值与 `GET …/repos/<repoId>` 一致（`status_time` 为零值时显示 `-`）；「事件」页签行数等于 `GET …/repos/<repoId>/events` 的 `items` 数，列含创建时间/状态/消息，0 条时显示空态；仓库不存在时显示错误面板与重试，不白屏。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/workspace-repos.md`](../../../../design/kube-frontend/app-store/workspace-repos.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/workspace-repos.md`](../../../../prd/kube-frontend/app-store/workspace-repos.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 维护仓库（新增/编辑/删除/同步索引） (Priority: P1)

作为 **企业空间管理员**，我希望 **添加、编辑、删除应用仓库并手动触发索引同步**，以便 **在仓库地址或凭证变化后让应用重新可用，并清掉不再使用的仓库**。
点「同步索引」→ `POST …/repos/<id>/action {action:"index"}` 返回 200 且详情页事件页签出现一条同步记录；删除后接口与列表都不再包含它。

**Independent Test**：添加一个可达的 Helm 仓库（唯一名称）→ 列表与接口回读一致；编辑其描述与同步周期 → 回读一致；

### US3 - 看清仓库的索引状态与最近同步 (Priority: P2)

作为 **企业空间管理员**，我希望 **在列表与详情里看到仓库的索引状态、创建者与最近同步时间，并能翻看同步事件**，以便 **区分「还没同步」「同步成功」「同步失败」**。
「事件」页签行数等于 `GET …/repos/<id>/events` 的条目数，列含创建时间/状态/消息；没有事件时显示空态。

**Independent Test**：仓库详情「基本信息」显示名称/地址/描述/状态/创建者/同步周期/最近同步/创建时间；

## 前置与配置

- admin 可写企业空间仓库；集群可访问 charts.kubesphere.io
- 用例自建唯一名称仓库并在 finally 删除

## 测试步骤

1. 用 API 创建唯一名称仓库（url=https://charts.kubesphere.io/stable）
2. 打开企业空间仓库列表，等 surface 离开 loading
3. 行操作「编辑」，修改描述与同步周期后保存
4. 回读 GET /workspaces/<ws>/repos/<repoId> 核对描述与 sync_period
5. 打开编辑弹窗，把同步周期改成 10s 并保存（应被客户端拦截）
6. 行操作「同步索引」，等待请求完成
7. 打开仓库详情，核对基本信息与事件页签
8. 删除该仓库并回读确认 0 条

## 期望结果

- 编辑保存后接口回读 description 与 sync_period 与提交一致
- 非法同步周期不发 PATCH 请求，弹窗显示同步周期校验文案
- 同步索引发出 POST …/repos/<repoId>/action（body.action=index），页面不报错
- 详情「基本信息」显示名称/地址/状态/创建者/同步周期；「事件」页签行数等于 GET …/events 的 items 数
- 删除后 GET …/repos 不再包含该 repo_id

## 失败排查

- 400 且报文含 index.yaml：地址不可达，属服务端校验，不是页面缺陷
- 详情 status_time 为 0001-01-01：首次索引前，页面应显示 -
- 事件 0 条：控制器尚未写事件，核对 /repos/<id>/events 的 total_count

## 产品改版后如何更新自动化

- 句柄：workspace-repos:edit / :index / :name:<id>；workspace-repo-detail:surface / :tab:info / :tab:events / :events
