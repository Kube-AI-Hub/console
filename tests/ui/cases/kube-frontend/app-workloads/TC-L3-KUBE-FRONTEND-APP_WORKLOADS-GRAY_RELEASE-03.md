# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03 灰度发布详情 · 四区块顺序、版本权重与副本数、未找到工作负载的分支

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

详情页按固定顺序显示基本信息、版本与流量、匹配规则、状态条件。版本卡片显示角色、权重（未设置时明确说明而不显示 0%）、接管徽章，并在按注解或 <host>-<version> 找到 Deployment 时显示副本 ready/total 与工作负载链接；找不到时显示「未找到对应工作负载」。三档宽度下不横向溢出。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03** — 已知存在一个 v1（参考版本）/v2（新版本）按权重分流的 Canary 策略，当打开 `…/grayrelease/<name>` 详情，则基本信息区块按固定顺序显示集群、项目、分流方式、目标服务、参考版本、接管版本（未接管时显示「未接管（按规则分配）」）、策略与创建时间；版本与流量区块每个版本一张卡片，显示版本号、角色徽章、权重百分比（对象未设置权重时显示「未设置（Istio 默认均分）」而不是 0%）、接管徽章（仅 `spec.governor` 命中的版本），并按 `<目标服务>-<版本>` 或对象注解找到对应 Deployment 时显示「副本 ready/total」与工作负载链接，找不到时显示「未找到对应工作负载」而不是 0/0；匹配规则区块在没有内容匹配时明确说明按权重分流；区块顺序为基本信息 → 版本与流量 → 匹配规则 → 状态条件，1024/1280/1600 三档不横向溢出。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 看清一个发布的两个版本、权重、匹配规则与控制器条件 (Priority: P1)

作为 **项目运维**，我希望 **打开一个灰度发布的详情，看到基本信息、每个版本的角色/权重/副本数与对应工作负载、请求内容匹配规则，以及控制器写入的条件**，以便 **判断流量现在怎么分、某个版本是否在线、请求是按权重还是按内容路由、控制器为什么还没完成**。

**Independent Test**：打开一个按流量分流的 Canary 详情，版本区块显示 v2（新版本，20%）与 v1（参考版本，80%），对应工作负载的副本数为真实值（0 显示 0，缺失显示「未找到对应工作负载」）；匹配规则区块说明没有内容匹配规则；条件区块在控制器未写入时显示「控制器尚未写入条件」及原因。

## 前置与配置

- 已登录，host 集群 default 项目
- 用例创建一条 Canary（v1/v2 权重 80/20）与一个名为 <host>-v2 的 Deployment（1 副本、镜像拉不下来故 ready=0），不创建 <host>-v1
- 用例对象使用 tc-e2e-gray- 前缀，finally 删除 Strategy 与 Deployment

## 测试步骤

1. 打开该策略的详情 URL
2. 读取基本信息区块的标签与值
3. 读取版本卡片的角色、权重、副本数与工作负载链接
4. 读取匹配规则区块与状态条件区块
5. 比较四个区块的纵向位置
6. 在 1024 / 1280 / 1600 三档宽度下断言页面无横向溢出并截图

## 期望结果

- 基本信息包含 集群 / 项目 / 分流方式 / 目标服务 / 参考版本 / 接管版本 / 策略 / 创建时间，分流方式为「按流量比例」，接管版本为「未接管（按规则分配）」
- v2 卡片角色为新版本、权重 20%，找到 Deployment 时显示「副本 0/1」与工作负载链接；v1 卡片角色为参考版本、权重 80%，显示「未找到对应工作负载」
- 匹配规则区块说明该策略没有请求内容匹配规则、按权重分流
- 状态条件区块显示「控制器尚未写入条件」及原因说明
- 区块纵向顺序为 基本信息 < 版本与流量 < 匹配规则 < 状态条件
- 三档宽度下 document.scrollWidth 不超过窗口宽度

## 失败排查

- 副本数显示 0/0：检查 Deployment 是否创建成功、命名是否与约定一致
- 找不到 v2 工作负载链接：检查 Deployment 名称是否等于 <目标服务>-v2
- 权重显示「未设置」：对象的路由没有 weight 字段

## 产品改版后如何更新自动化

- 详情区块与句柄见 pages/app-workloads/canary/CanaryDetailPage.tsx
