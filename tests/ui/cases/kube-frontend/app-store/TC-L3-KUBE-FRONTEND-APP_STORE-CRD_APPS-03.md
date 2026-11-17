# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03 删除自制 CRD 应用

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

自制应用详情提供删除：输入应用名确认后删除 Application；成功后回到列表且行消失。组件是否级联取决于 ownerReference/控制器，页面不假装自己级联删除。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-04** — Given 打开自制应用详情，When 点删除并输入完整对象名确认，Then 发出 DELETE /apis/app.k8s.io/v1beta1/namespaces/<ns>/applications/<name>；成功后回到列表、该行消失、接口回读 404；取消或名称不匹配时不发请求。组件是否级联删除取决于 ownerReference（addOwnerRef 与 app.k8s.io 控制器），页面不自行级联，也不把组件残留伪装成删除失败。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 删除不再使用的自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在自制应用详情里删除应用**，以便 **清理不再使用的工作负载聚合；删除以应用对象为准，组件由 ownerReference/控制器处理**。

**Independent Test**：进入应用详情点删除，输入对象名确认后 Application 404、回到列表且行消失；未输入正确名称时按钮不可用。

## 前置与配置

- 已登录 admin；项目 default 可用；用例自建 Application+Deployment+Service，finally 清理

## 测试步骤

1. 用 API 创建临时 Application（selector app=<name>）、Deployment、Service
2. 打开详情，点删除，输入应用名确认
3. 断言 Application 404、页面回到 composing 列表、行消失
4. finally 删除 Deployment/Service（应用对象已删）

## 期望结果

- 删除确认必须输入完整对象名；取消不发请求
- 删除成功回列表；失败保留弹窗并显示原因
- 组件不保证级联；页面说明由 ownerReference/控制器负责

## 失败排查

- 行仍存在：确认删除的是 Application 且列表 invalidate
- 组件残留：检查 ownerReferences 是否有 app.k8s.io 控制器添加的 owner

## 产品改版后如何更新自动化

- 句柄：composed-app-detail:delete/delete-input/delete-confirm
