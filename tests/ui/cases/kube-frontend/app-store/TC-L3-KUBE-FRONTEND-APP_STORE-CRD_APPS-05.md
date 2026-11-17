# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05 创建多组件自制 CRD 应用

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

创建自制应用支持多个组件：每个组件生成一个 Deployment 与一个 Service，全部挂在同一 Application selector 下；dry-run 全量校验后写入，失败回滚。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06** — Given 创建对话框有多于一个组件（每行组件名/镜像/副本/端口），When 提交，Then 每个组件各创建一个 Deployment 与一个 Service（名称 <app>-<component>），全部带同一 app=<name> 标签并挂在同一 Application selector 下；全部对象先 dry-run 再真实写入，任一失败回滚；组件名为空/重复/非法、镜像为空、副本<1、端口越界时本地拒绝。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 创建自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在项目里直接创建一个自制应用（名称、镜像、副本、端口）**，以便 **不用分别去建 Application、Deployment 与 Service**。

**Independent Test**：打开 composing 页点创建，填名称/镜像/副本/端口提交；列表出现该应用（工作负载 1、服务 1）；API 中 Application selector 与 Deployment/Service 标签一致；详情能下钻到工作负载。

## 前置与配置

- 已登录 admin；项目 default 可用；用例自建唯一名称，finally 删除两个 Deployment/Service 与 Application

## 测试步骤

1. 打开创建对话框，填应用名，默认组件 web，点「添加组件」填第二个组件（名称 api、镜像/端口）
2. 提交，断言弹窗关闭、列表行组件数=工作负载 2、服务 2
3. API 断言 Application 存在、两个 Deployment 与两个 Service 均存在且 selector={app:<name>}

## 期望结果

- components 数组每个生成 Deployment/Service；Application selector 覆盖全部
- 组件名重复/非法、镜像空、副本<1、端口越界时本地拒绝
- 真实写入失败回滚所有已建对象（单测覆盖）

## 失败排查

- 只创建一个组件：检查 addComponent 状态与表单索引
- 组件标签不一致：所有组件必须同 app=<name> 标签

## 产品改版后如何更新自动化

- 句柄：composed-apps:create-add-component、create-component-<i>、create-image-<i>、create-replicas-<i>、create-port-<i>
