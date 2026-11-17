# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07 为自制应用添加 Ingress 路由

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

自制应用详情「添加路由」：选择该应用内的 Service 作为后端，填域名/路径，创建带 app 标签的 Ingress；dry-run 校验，失败回滚。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08** — Given 自制应用已有一个带端口的 Service，When 详情点「添加路由」填域名/路径并选择后端服务/端口提交，Then 创建带 app=<name> 标签、rules.host/path、backend.service 指向该 Service:port 的 Ingress（dry-run 先校验，失败回滚）；成功后详情路由区块出现该 Ingress；无 Service 时不显示入口；域名/路径/服务/端口非法时本地拒绝。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 创建自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在项目里直接创建一个自制应用（名称、镜像、副本、端口）**，以便 **不用分别去建 Application、Deployment 与 Service**。

**Independent Test**：打开 composing 页点创建，填名称/镜像/副本/端口提交；列表出现该应用（工作负载 1、服务 1）；API 中 Application selector 与 Deployment/Service 标签一致；详情能下钻到工作负载。

## 前置与配置

- 已登录 admin；项目 default 可用；用例自建 Application+Deployment+Service(80)，finally 清理三对象与 Ingress

## 测试步骤

1. 打开详情，点「添加路由」，填域名、路径 /，保持默认后端服务与端口，提交
2. 断言弹窗关闭、详情「路由」区块出现该 Ingress
3. API 断言 Ingress 存在，labels app=<name>，rules host/路径/backend 指向该 Service:80

## 期望结果

- 无 Service 时不显示添加路由入口；域名/路径/服务/端口本地校验
- Ingress 名称由 app/host/path 生成且合法；dry-run 先校验
- 创建失败删除已建 Ingress 并保留错误

## 失败排查

- 详情无路由行：确认创建后 invalidate composed-app 查询
- Ingress backend 端口错误：确认服务端口映射

## 产品改版后如何更新自动化

- 句柄：composed-app-detail:add-route；composed-app-route:dialog/host/path/service/port/submit/error
