# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10 自制应用详情灰度发布

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

自制应用详情展示命中该应用/服务的 servicemesh Strategy（名称/类型/命中服务/选择器）；无策略显示空态；策略接口不可用显示未上报而不是空表。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-11** — Given 服务网格可用，When 打开自制应用详情，Then「灰度发布」区块展示命中该应用（selector.app=<name> 或 hosts 命中应用 Service）的 Strategy：名称、类型（按流量比例/按内容/流量镜像）、命中服务、选择器；无策略显示空态；策略接口不可用（404/5xx）显示「未上报」而不是空表；区块只读，并提供「管理灰度发布」链接到项目级灰度发布页（写操作在那里承接）。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 删除不再使用的自制应用 (Priority: P2)

作为 **项目使用者**，我希望 **在自制应用详情里删除应用**，以便 **清理不再使用的工作负载聚合；删除以应用对象为准，组件由 ownerReference/控制器处理**。

**Independent Test**：进入应用详情点删除，输入对象名确认后 Application 404、回到列表且行消失；未输入正确名称时按钮不可用。

## 前置与配置

- 已登录 admin；项目 default 可用；用例自建 Application+Deployment+Service 与一个 Strategy，finally 清理

## 测试步骤

1. 创建临时应用、工作负载、服务与服务网格 Strategy（selector app=<name>，host=workload）
2. 打开详情，滚动到「灰度发布」区块
3. 若策略创建成功：断言表格出现且含策略名；否则断言空态/未上报说明
4. finally 删除 Strategy、Service、Deployment、Application

## 期望结果

- 表格列：名称/类型（按流量比例、按内容、流量镜像）/命中服务/选择器
- 「管理灰度发布」链接到项目灰度发布页（写操作在项目级向导承接）
- 无策略与模块不可用分开；区块只读

## 失败排查

- 表格为空但策略存在：检查 selector.app 或 hosts 是否命中应用
- 类型误判：检查 http 首条规则是 mirror/match/route

## 产品改版后如何更新自动化

- 句柄：composed-app-detail:gray/gray-empty/gray-unavailable/gray-table/gray:<name>/gray-retry
