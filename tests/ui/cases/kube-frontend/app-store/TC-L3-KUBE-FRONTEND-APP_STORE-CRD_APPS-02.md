# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02 创建自制 CRD 应用（Application + Deployment + Service）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

项目「自制应用」页提供创建：填名称/描述/版本/组件名/镜像/副本/端口，提交后创建 Application + Deployment + Service（先 dry-run 校验再真实写入，失败回滚）。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03** — Given 在 composing 页点「创建自制应用」，When 名称/镜像/副本/端口合法并提交，Then 依次创建 Application（selector.matchLabels={app:<name>}）、Deployment 与 Service（同标签），dry-run 先校验再真实写入；成功后弹窗关闭、列表出现该应用且组件/健康正确、详情可见该工作负载。名称为空/非法、镜像为空、副本<1、端口越界时本地拒绝且不发请求；真实写入中途失败时删除已创建对象并把错误留在弹窗内。成员集群不渲染创建入口。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 创建自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在项目里直接创建一个自制应用（名称、镜像、副本、端口）**，以便 **不用分别去建 Application、Deployment 与 Service**。

**Independent Test**：打开 composing 页点创建，填名称/镜像/副本/端口提交；列表出现该应用（工作负载 1、服务 1）；API 中 Application selector 与 Deployment/Service 标签一致；详情能下钻到工作负载。

## 前置与配置

- 已登录 admin；项目 default 可用；用例自建唯一名称并在 finally 删除 Application/Deployment/Service

## 测试步骤

1. 打开 composing 页，点「创建自制应用」，空名称提交：断言本地错误、无请求
2. 填名称/镜像/副本/端口提交；断言弹窗关闭、列表出现该应用、健康/组件显示工作负载 1 与服务 1
3. 用 API 断言 Application 存在、Deployment shop-web 存在且 selector 匹配、Service shop-web 存在；打开详情断言工作负载行

## 期望结果

- 三个对象都创建；Application selector.matchLabels 与工作负载/Service 标签一致
- 失败时删除已创建对象并保留错误（单测覆盖回滚）
- 创建入口只在 host 集群渲染（成员集群无写路径）

## 失败排查

- 弹窗关闭但列表无行：确认 invalidate 的 queryKey 与页面一致
- 创建 422：先 dry-run 定位哪个对象被拒；检查镜像/端口/selector 标签

## 产品改版后如何更新自动化

- 句柄：composed-apps:create/create-dialog/create-name/create-image/create-replicas/create-port/create-submit/create-error
