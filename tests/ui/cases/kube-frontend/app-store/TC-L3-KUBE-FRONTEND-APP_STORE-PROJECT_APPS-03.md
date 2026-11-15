# TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03 项目内应用 · 详情与卸载

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `project-apps`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/applications`
- **需求**: `prd/kube-frontend/app-store/project-apps.md`

## 产品功能

项目内应用详情五页签；卸载按 rls 对象 id 删除，行消失且回读不再存在。

### 关联需求

- `prd/kube-frontend/app-store/project-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/project-apps.md`](../../../../prd/kube-frontend/app-store/project-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03** — 当在列表点 release 名称，则进入项目内应用详情（基本信息/资源/事件/配置/YAML 五页签，取值与 `helmreleases` 对象一致）；当在详情页点「卸载」并确认，则发出 `DELETE /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications/<cluster_id>`（用 `rls-…` 对象 id 而不是 release 名），成功后该 release 从项目集合消失且回读不再存在；失败显示服务端原因、保留确认框；取消不发请求。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/project-apps.md`](../../../../design/kube-frontend/app-store/project-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/project-apps.md`](../../../../prd/kube-frontend/app-store/project-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 打开一个应用看它的资源与配置，或者卸载它 (Priority: P1)

作为项目使用者，我从列表点进应用详情查看基本信息/资源/事件/配置/YAML，并在需要时卸载；卸载以 release 的真实对象 id 为准。

## 前置与配置

- 项目内有 1 个由本用例创建的 release

## 测试步骤

1. API 创建唯一 release 后打开项目应用页
2. 点 release 名称进入详情，核对五页签
3. 返回列表，行操作卸载并确认
4. 轮询项目集合直到该 release 消失

## 期望结果

- 详情页 installed-app:surface 出现，含 基本信息/资源/事件/配置/YAML 五个页签
- DELETE 用 cluster_id（rls-…）而不是 release 名
- 行消失；回读该 release 不再存在

## 失败排查

- 删除 200 但行还在：用名字删的，应该用 cluster_id
- 即时断言卸载：删除是异步的，必须轮询

## 产品改版后如何更新自动化

- 句柄：installed-apps:name:<id> / :uninstall / :uninstall:confirm / installed-app:surface
