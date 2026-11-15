# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04 灰度发布详情 · 匹配规则表与状态条件（Complete/Failed 与空条件）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

按请求内容分流的策略在匹配规则表里逐条显示 cookie/URL/请求头/客户端操作系统匹配与目标版本，未建模的匹配类型也要出现；条件表显示控制器写入的 type/status/reason/message/最近变更，状态徽标由 Complete/Failed 派生；没有条件时明确说明控制器未上报且状态为未知。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04** — 已知一个按请求内容分流的 Canary 策略（cookie/URL/请求头/客户端操作系统匹配），当打开详情，则匹配规则表逐条显示规则序号、匹配项与键名、匹配方式（精确/前缀/正则）、匹配值与目标版本；未建模的匹配类型（如 method）也以「其他」行出现而不是被丢弃；已知策略的 `status.conditions` 含 `Complete=True`（或 `Failed=True`）时条件表显示类型/结果/原因/消息/最近变更且列表状态徽标为「已完成」（或「失败」），无条件时条件区块显示「控制器尚未写入条件」及控制器未部署/未上报的说明、状态徽标为「未知」；条件为空不得显示为失败或已完成。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 看清一个发布的两个版本、权重、匹配规则与控制器条件 (Priority: P1)

作为 **项目运维**，我希望 **打开一个灰度发布的详情，看到基本信息、每个版本的角色/权重/副本数与对应工作负载、请求内容匹配规则，以及控制器写入的条件**，以便 **判断流量现在怎么分、某个版本是否在线、请求是按权重还是按内容路由、控制器为什么还没完成**。

**Independent Test**：打开一个按流量分流的 Canary 详情，版本区块显示 v2（新版本，20%）与 v1（参考版本，80%），对应工作负载的副本数为真实值（0 显示 0，缺失显示「未找到对应工作负载」）；匹配规则区块说明没有内容匹配规则；条件区块在控制器未写入时显示「控制器尚未写入条件」及原因。

## 前置与配置

- 已登录，host 集群 default 项目，servicemesh 可读写
- 用例创建按内容分流的 Canary（cookie 正则 + URL 前缀 + 自定义请求头 + method 未建模匹配）与两条普通 Canary
- 条件通过整对象 PUT 写入 status.conditions（CRD 无 status 子资源；无控制器，见 design DEC-11）
- 用例对象使用 tc-e2e-gray- 前缀，finally 删除

## 测试步骤

1. 打开内容分流策略详情，读取匹配规则表
2. 用 PUT 写入 Complete=True 条件后重新打开详情，读取条件表与状态徽标
3. 改为 Failed=True 条件后重新打开，读取条件表与状态徽标
4. 打开一条没有 status 的策略详情，读取条件区块与状态徽标

## 期望结果

- 匹配规则表出现 cookie 正则、URL 前缀、自定义请求头精确匹配与「其他」行的 method 匹配，每行带目标版本
- Complete=True 时条件表显示类型 Complete、结果 True、原因、消息与最近变更，状态徽标为「已完成」
- Failed=True 时条件表显示 Failed，状态徽标为「失败」
- 没有条件时条件区块显示「控制器尚未写入条件」与原因说明，状态徽标为「未知」，不显示失败色

## 失败排查

- 条件表为空：PUT 是否带上了 resourceVersion 与完整对象
- 页面仍显示缓存：详情查询键为 ['strategies', cluster, namespace, name]，重新打开或刷新
- 徽标语言随 locale 变化：断言用中文 locale

## 产品改版后如何更新自动化

- 条件映射见 strategyStatusOf；匹配规则展开见 toStrategyDetail
