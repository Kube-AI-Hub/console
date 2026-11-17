# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09 自制应用详情链路追踪

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

自制应用详情展示该应用 Service 的链路样本（traceID/服务/span 数/耗时）；有样本时可按行展开 span 瀑布（起点/耗时相对条）；无样本显示空态，tracing 不可用显示未上报而不是空表。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10** — Given 应用有 Service，When 打开详情，Then「链路追踪」区块逐个 Service 读取 traces（limit=10）：有样本时显示 traceID/服务/span 数/耗时（耗时由 span 窗口计算）；点击行展开调用链，按 span 的 startOffset/duration 画瀑布条（最多 100 个 span，按起点排序），无样本显示空态，tracing 模块不可用（404/5xx）显示「未上报」而不是空表；区块只读。

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

1. 创建临时应用与 Service，打开详情
2. 滚动到「链路追踪」区块，等待请求结束
3. 断言区块可见，并显示空态（本部署 tracing 返回 200/空）或未上报说明
4. 用契约 mock 返回一条含 2 个 span 的 trace，刷新后断言表格、展开、两个 span 瀑布行

## 期望结果

- 有 trace 时显示表格（traceID/服务/span 数/耗时），展开后按 span 起点/宽度画条
- 无样本与模块不可用分开；失败显示错误与重试
- 区块只读

## 失败排查

- 一直 loading：检查 /services/<svc>/traces 返回 200 空数组
- 表格出现无关 trace：确认只请求应用 Service

## 产品改版后如何更新自动化

- 句柄：composed-app-detail:tracing/tracing-empty/tracing-unavailable/tracing-table/trace:<id>/trace-toggle:<id>/trace-spans:<id>/trace-span:<spanId>/tracing-retry
