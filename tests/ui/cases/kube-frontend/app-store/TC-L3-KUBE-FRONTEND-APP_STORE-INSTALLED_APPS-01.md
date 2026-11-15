# TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01 已安装应用 · 列表行数、页内搜索与无分页器

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `installed-apps`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/apps/instances`
- **需求**: `prd/kube-frontend/app-store/installed-apps.md`

## 产品功能

已安装应用列表来自跨项目汇总集合，行数一致、页内搜索生效、不渲染服务端无法兑现的分页器。

### 关联需求

- `prd/kube-frontend/app-store/installed-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/installed-apps.md`](../../../../prd/kube-frontend/app-store/installed-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01** — 已知企业空间 `<ws>` 有 N 个 release（N 可能为 0），当打开 `/kube-frontend/workspaces/<ws>/apps/instances`，则列表行数等于 `GET /workspaces/<ws>/applications` 的 `items` 数，每行显示 release 名称（次行为描述）、状态徽标、应用名、版本、项目、创建时间；N=0 时显示空态标题「还没有已安装的应用」与说明；接口失败显示错误面板与重试按钮；页面显式说明「跨项目汇总接口没有服务端分页与搜索，筛选在本页内完成」并且**不渲染分页器**；在搜索框输入应用名后只显示匹配行，清空后恢复全部行。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/installed-apps.md`](../../../../design/kube-frontend/app-store/installed-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/installed-apps.md`](../../../../prd/kube-frontend/app-store/installed-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认安装结果并看清 release 的真实状态 (Priority: P1)

作为 **企业空间用户**，我希望 **看到本空间所有项目里已安装的应用及其状态、版本与项目归属**，以便 **确认我刚提交的安装是否真的落地、现在处于什么状态**。
`GET /workspaces/<ws>/applications` 的 `items` 数；搜索框能按 release 名/应用名/项目过滤。

**Independent Test**：在商店详情安装一个应用后打开本页，能看到该 release 行（名称/状态/应用/版本/项目/创建时间）；行数等于

## 前置与配置

- 已登录；GET /workspaces/<ws>/applications 可读（可能为空）

## 测试步骤

1. 读 GET /kapis/openpitrix.io/v1/workspaces/<ws>/applications 得到 N 与条目
2. 打开已安装应用列表，等 installed-apps:surface 离开 loading
3. 核对行数、表头与首行字段
4. 在搜索框输入首行应用名，核对只剩匹配行；清空后恢复
5. 核对页面是否出现分页器与数据源说明

## 期望结果

- 行数 = N（N=0 显示「还没有已安装的应用」）
- 表头含 名称/状态/应用/版本/项目/创建时间
- 搜索后行数减少且都匹配；清空后回到 N
- 页面有 installed-apps:source-note 说明「跨项目汇总接口只返回全量列表，没有服务端分页与搜索」，且不渲染分页器

## 失败排查

- 行数为 0 但接口有数据：漏了 /workspaces/<ws> 前缀
- 搜索后行数不变：过滤字段未包含 release 名/应用名/项目

## 产品改版后如何更新自动化

- 句柄：installed-apps:surface / :table / :refresh / :search / :source-note / :name:<id>
