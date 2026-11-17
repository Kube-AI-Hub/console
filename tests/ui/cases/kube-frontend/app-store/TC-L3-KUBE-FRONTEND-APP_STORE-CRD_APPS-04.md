# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-04 编辑自制 CRD 应用信息

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

自制应用详情提供「编辑信息」：修改别名/描述，保存为 Application metadata.annotations（merge-patch，清空键 null）；保存后详情别名与接口回读一致。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05** — Given 打开自制应用详情，When 点「编辑信息」修改别名/描述并保存，Then 只对 Application metadata.annotations 发 merge-patch（清空键 null），不触碰 spec/selector/组件；成功后详情显示别名、接口回读一致；失败保留弹窗与原因。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 修改自制应用的别名与描述 (Priority: P3)

作为 **项目使用者**，我希望 **在应用详情编辑别名与描述**，以便 **让列表/详情用业务名称而不是对象名沟通**。

**Independent Test**：详情点编辑信息，填别名/描述保存；详情显示别名，接口 annotations 中 alias/description 与输入一致；清空描述后注解被移除。

## 前置与配置

- 已登录 admin；项目 default 可用；用例自建唯一 Application，finally 删除

## 测试步骤

1. API 创建临时 Application，打开详情
2. 点「编辑信息」，填别名与描述，提交
3. 断言弹窗关闭、详情显示别名、API annotations 中 alias/description 与输入一致
4. 清空描述再保存，断言 description 注解被移除

## 期望结果

- 编辑信息只发 annotations merge-patch，不触碰 spec/selector/组件
- 清空字段删除注解而非写空串
- 失败保留弹窗与原因

## 失败排查

- 保存后别名不显示：确认详情 invalidate 了 composed-app 查询
- 注解未删除：确认清空键发 null

## 产品改版后如何更新自动化

- 句柄：composed-app-detail:edit/edit-alias/edit-description/edit-info-submit/alias
