# TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02 已安装应用 · 详情五页签与卸载

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `installed-apps`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/public/apps/instances`
- **需求**: `prd/kube-frontend/app-store/installed-apps.md`

## 产品功能

真实安装一个 release 后，详情页五页签取到真实数据；卸载用 release 对象 id 且回读为 0。

### 关联需求

- `prd/kube-frontend/app-store/installed-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/installed-apps.md`](../../../../prd/kube-frontend/app-store/installed-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02** — 已知存在一个 release，当打开它的详情页，则「基本信息」页签显示名称/状态/应用/版本/项目/集群/创建者/修订版本/创建时间/最近更新/部署历史，取值与 `helmreleases` 对象的 `spec`/`status` 一致；「资源」页签按 `app.kubesphere.io/instance=<release>` 列出 deployments/statefulsets/daemonsets/services/ingresses 及其摘要（就绪/期望副本或服务类型），没有资源时显示空态而不是空表；「事件」页签列出该 release 的 Kubernetes 事件，没有事件时显示空态；「配置」页签显示安装时提交的 values YAML（`spec.values` 的 base64 解码），没有自定义 values 时显示「使用 chart 默认值」；「YAML」页签显示 helmrelease 对象原文；页面对升级/回滚给出「接口无升级路由」的说明且不提供该控件。
- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-03** — 当在列表行操作或详情页点「卸载」并在确认框中确认，则向 `DELETE /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications/<cluster_id>` 发送请求（用 release 的 `rls-…` id，而不是 release 名），成功后接口回读与列表都不再包含该 release；失败时显示服务端原因且不关闭确认框、不伪造成功；取消不发请求。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/installed-apps.md`](../../../../design/kube-frontend/app-store/installed-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/installed-apps.md`](../../../../prd/kube-frontend/app-store/installed-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 查看一个 release 的详情并卸载它 (Priority: P1)

作为 **企业空间用户**，我希望 **打开某个 release 看到它的基本信息、创建的资源、事件、安装时提交的 values 与对象 YAML，并在确认后卸载**，以便 **判断它是否正常工作、并在不需要时清理**。
`app.kubesphere.io/instance=<release>` 列出 chart 创建的工作负载/服务/路由；YAML 页签显示 helmrelease 原文；
点卸载并在确认框确认后，接口与列表都不再包含该 release（用 `rls-…` id 删除）。

**Independent Test**：打开任一 release 详情，基本信息页签字段与接口一致；资源页签按

## 前置与配置

- admin 可写 public/csghub；用例自建唯一 release 名并在 finally 卸载
- 安装来源：商店应用（app_id 来自 GET /kapis/openpitrix.io/v1/apps）

## 测试步骤

1. 用 API 安装一个最小 chart（POST /workspaces/public/namespaces/csghub/applications，conf 为 YAML 字符串）
2. 轮询 GET /workspaces/public/applications 直到出现该 release，取 cluster_id（rls-…）
3. 打开详情页 /kube-frontend/workspaces/public/apps/instances/<rls-id>
4. 核对基本信息（名称/状态/应用/版本/项目/修订版本）
5. 切到资源页签，核对按 app.kubesphere.io/instance=<release> 查询的结果
6. 切到事件页签、配置页签（values 与提交内容一致）、YAML 页签
7. 点卸载并确认；回读 GET /workspaces/public/applications 与 helmreleases

## 期望结果

- 基本信息字段与汇总行/helmrelease 对象一致；升级说明可见且无升级控件
- 资源页签列出 chart 创建的工作负载/服务，无资源时显示空态
- 配置页签显示提交的 values（含自定义键）；YAML 页签显示 helmrelease 原文
- 卸载请求路径最后一段为 rls-…；卸载后汇总集合与 helmreleases 都不再包含它

## 失败排查

- 卸载返回 200 但对象还在：按 release 名删了，必须用 cluster_id
- helmrelease 404：helmreleases 是集群级对象，不要拼 /namespaces/<ns>/
- values 显示乱码：spec.values 是 base64，需解码

## 产品改版后如何更新自动化

- 句柄：installed-app:surface / :name / :tab:{info,resources,events,config,yaml} / :uninstall / :uninstall:confirm / :not-found
