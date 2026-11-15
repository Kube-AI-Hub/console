# TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04 企业空间应用仓库 · 权限门控与中英文文案

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `workspace-repos`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/repos`
- **需求**: `prd/kube-frontend/app-store/workspace-repos.md`

## 产品功能

无写权限时写入入口不可用并说明；中英文文案双向齐全，不出现语言串台。

### 关联需求

- `prd/kube-frontend/app-store/workspace-repos.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/workspace-repos.md`](../../../../prd/kube-frontend/app-store/workspace-repos.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-06** — 当当前身份对 `helmrepos`（`application.kubesphere.io`）的 `create` 被 `SelfSubjectAccessReview` 明确拒绝，则列表页隐藏「编辑/同步索引/删除」行操作并把「添加仓库」按钮置为禁用，同时显示说明「当前身份没有在该企业空间管理应用仓库的权限，写入入口已隐藏」；权限探测失败（网络/旧 BFF）时保持入口可用（fail-open），不以探测失败当拒绝。
- **AC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-07** — 当界面语言为中文，则仓库页的主按钮、弹窗标题/说明、字段标签、行操作与提示全部为中文（不得出现 `Add repository` 之类的英文串）；当语言为英文（`kube-frontend-locale=en`），同一批文案全部为英文（不得出现中文）。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/workspace-repos.md`](../../../../design/kube-frontend/app-store/workspace-repos.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/workspace-repos.md`](../../../../prd/kube-frontend/app-store/workspace-repos.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 维护仓库（新增/编辑/删除/同步索引） (Priority: P1)

作为 **企业空间管理员**，我希望 **添加、编辑、删除应用仓库并手动触发索引同步**，以便 **在仓库地址或凭证变化后让应用重新可用，并清掉不再使用的仓库**。
点「同步索引」→ `POST …/repos/<id>/action {action:"index"}` 返回 200 且详情页事件页签出现一条同步记录；删除后接口与列表都不再包含它。

**Independent Test**：添加一个可达的 Helm 仓库（唯一名称）→ 列表与接口回读一致；编辑其描述与同步周期 → 回读一致；

## 前置与配置

- admin 登录（有权限分支）；无权限分支用 SSAR 拦截模拟（route 返回 allowed:false）

## 测试步骤

1. 打开仓库列表，读取主按钮与行操作文案（zh）
2. 切到英文（localStorage kube-frontend-locale=en 或 URL 参数），重新打开并读取同一批文案
3. 用 route 拦截 POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews 返回 allowed:false，重载页面
4. 核对主按钮状态与行操作可见性

## 期望结果

- zh：主按钮文案为「添加仓库」，不含 "Add repository"；弹窗标题「添加应用仓库」
- en：主按钮文案为 "Add repository"，不含「添加仓库」；弹窗标题 "Add app repository"
- SSAR 明确拒绝时：主按钮 disabled 且页面出现「当前身份没有在该企业空间管理应用仓库的权限，写入入口已隐藏」；行操作里不再出现「编辑/同步索引」
- SSAR 请求失败（非 allowed:false）时按钮仍可用（fail-open）

## 失败排查

- 出现英文串在中文界面：locale 键反串（zh 字典写英文），见 design GOT
- 按钮始终禁用：检查 useMemo 依赖是否漏了查询状态

## 产品改版后如何更新自动化

- 句柄：workspace-repos:create / :edit / :index / :delete；页面 pages/appstore/WorkspaceReposPage.tsx
