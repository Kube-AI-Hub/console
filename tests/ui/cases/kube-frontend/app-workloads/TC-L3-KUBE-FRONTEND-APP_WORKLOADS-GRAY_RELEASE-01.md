# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01 灰度发布列表 · 空态可达、列头与行内容

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

项目控制台的灰度发布页读取 servicemesh Strategy：项目内没有策略时显示明确空态；通过 API 创建一个 Canary 策略后，页面出现名称/类型/目标服务/状态四列与该行，类型显示为金丝雀发布、目标服务取自策略的 Istio host，状态是四种派生值之一；列表提供创建入口（创建行为由另一条用例覆盖）。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01** — 已知项目内没有灰度发布策略，当打开灰度发布页，则页面进入空态并说明创建后会列在这里；已知项目内存在一个 `type=Canary` 的策略，当打开同一页面，则出现列头「名称 / 类型 / 目标服务 / 状态」，该行带稳定句柄且类型显示为「金丝雀发布」、目标服务取自策略的 Istio host、状态是已完成/进行中/失败/未知之一；读取失败时页面给出重试入口。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看到项目里有哪些灰度发布及其实施状态 (Priority: P1)

作为 **项目运维**，我希望 **在项目内一页看到所有灰度发布策略的名称、类型、目标服务与状态**，以便 **不进入命令行就能判断某个发布是否完成、失败或仍在进行**。

**Independent Test**：项目内存在一个 Canary 策略时，打开灰度发布页，列表出现该行且列头为名称/类型/目标服务/状态；项目内没有策略时，页面显示明确的空态。

## 前置与配置

- servicemesh 已启用（strategies 接口返回 200），当前账号可读 default 项目的策略
- 用例通过原生 API 创建一个 tc-e2e- 前缀的 Canary 策略作为列表数据，finally 无条件删除；若打开时项目内没有策略，先断言空态

## 测试步骤

1. 打开 default 项目的灰度发布页
2. 项目内无策略时读取页面状态与空态文案
3. 通过 API 创建一条 Canary 策略后重新打开页面
4. 读取列头与目标行内容
5. 检查页面有 grayrelease:create 创建入口

## 期望结果

- 页面外壳 grayrelease:surface 可达，状态为 empty 或 ready，不进入 error
- 空态文案为「暂无灰度发布任务」
- 列头包含 名称 / 类型 / 目标服务 / 状态
- 目标行的类型为「金丝雀发布」，目标服务为策略的 Istio host，状态属于 已完成/进行中/失败/未知
- 页面有 grayrelease:create 创建入口（创建流程由 GRAY_RELEASE-02 覆盖）

## 失败排查

- servicemesh 未启用或接口 404 时页面进入 error 态并给出重试，不是空态
- 策略刚创建时状态可能为「未知」，等控制器写入 condition 后会变成进行中/已完成
- 目标服务显示为空时检查策略的 spec.template.spec.hosts 是否存在

## 产品改版后如何更新自动化

- 状态派生与目标服务回退见 packages/api-client/src/servicemesh.ts
- 页面句柄见 pages/app-workloads/CanaryReleasesPage.tsx
