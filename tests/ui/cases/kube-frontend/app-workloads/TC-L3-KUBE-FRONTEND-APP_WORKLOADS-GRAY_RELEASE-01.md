# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01 灰度发布列表 · 空态、六列与版本权重、名称下钻

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

灰度发布页读取 servicemesh Strategy：项目内没有策略时显示空态；用 API 创建一个两版本带权重的 Canary（并注入 Complete 条件）后，页面出现名称/类型/目标服务/版本/状态/创建时间六列与该行，类型为金丝雀发布、目标服务取自 Istio host、版本列按新版本在前显示两个版本与权重、状态显示已完成，名称链接可进入该发布详情。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01** — 已知项目内没有灰度发布策略，当打开灰度发布页，则页面进入空态并说明创建后会列在这里；已知项目内存在一个 v1/v2 两版本带权重的 Canary 策略，当打开同一页面，则出现列头「名称 / 类型 / 目标服务 / 版本 / 状态 / 创建时间」，该行显示类型「金丝雀发布」、目标服务取自 `spec.template.spec.hosts[0]`、版本列按新版本在前显示两个版本及其权重、状态属于已完成/进行中/失败/未知之一；名称是指向该发布详情的链接；读取失败时页面给出重试入口。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看到项目里有哪些灰度发布、各自分流到哪些版本 (Priority: P1)

作为 **项目运维**，我希望 **在项目内一页看到所有灰度发布策略的名称、类型、目标服务、版本与分流状态**，以便 **不进入命令行就能判断某个发布是否存在、在哪些版本之间分流、控制器是否完成**。

**Independent Test**：项目内存在一个 Canary 策略（v1/v2 两个版本、带权重）时，打开灰度发布页，列表出现该行且列头为名称/类型/目标服务/版本/状态/创建时间；类型显示为「金丝雀发布」、版本列显示两个版本与权重；项目内没有策略时页面显示明确空态。

## 前置与配置

- servicemesh 已启用（strategies 原生端点返回 200），当前账号可读 default 项目的策略
- 用例通过 API 创建 tc-e2e-gray- 前缀的 Canary 策略（v1/v2 权重 80/20）并通过 PUT 写入 Complete=True 条件，finally 无条件删除

## 测试步骤

1. 打开 default 项目的灰度发布页
2. 项目内无策略时断言空态与空态文案
3. 通过 API 创建一条 Canary 策略并注入 status.conditions Complete=True
4. 重新打开页面，读取列头与目标行内容
5. 点名称链接进入详情页

## 期望结果

- 页面外壳 grayrelease:surface 可达，四态为 empty 或 ready，不进入 error
- 空态文案为「暂无灰度发布任务」
- 列头包含 名称 / 类型 / 目标服务 / 版本 / 状态 / 创建时间
- 目标行类型为「金丝雀发布」，目标服务为策略的 Istio host，版本列同时出现 v2 与 v1 以及 20% 与 80%
- 状态徽标为「已完成」（条件 Complete=True 派生）
- 点名称链接后 URL 变为 …/grayrelease/<名称> 且 grayrelease-detail:surface 可见

## 失败排查

- servicemesh 未启用或接口 404 时页面进入 error 态并给出重试，不是空态
- 条件注入后立即读列表可能被缓存：等待列表重新拉取或刷新
- 目标服务显示为空时检查 spec.template.spec.hosts 是否存在

## 产品改版后如何更新自动化

- 状态派生与版本摘要见 packages/api-client/src/servicemesh.ts
- 列与句柄见 pages/app-workloads/CanaryReleasesPage.tsx
