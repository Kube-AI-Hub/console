# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-07 容器详情 · 监控页签（四图 / 三档窗口 / 三态）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

「监控」页签显示 GPU 使用 / GPU 显存 / CPU / 内存四张趋势图，时间窗可在 1h / 6h / 24h 间切换并重新取数；请求失败显示「监控不可用」并可重试，成功但无采样显示「该时间窗没有数据」，真实 0 画零值曲线而不是空态。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-07** — 已知容器有监控数据，当打开「监控」页签，则显示 GPU 使用、GPU 显存、CPU、内存四张趋势图，时间窗可在 1h / 6h / 24h 间切换并重新取数；请求失败显示「监控不可用」并可重试，请求成功但无采样显示「该时间窗没有数据」，真实 0 显示为零值曲线而不是空态。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/container-detail.md`](../../../../design/kube-frontend/app-workloads/container-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 项目里至少有一个带容器的容器组
- 已知本部署的容器级监控返回空 result（集群 cAdvisor 缺 container/image 标签），因此「空态」是合格结果；用例按「有数据/无数据」两分支判定，不 skip

## 测试步骤

1. 打开容器详情，点「监控」页签
2. 等面板就绪，读 container-detail:monitor 的 data-ai-state 与四个卡片/空态/错误三选一
3. 有采样点时：核对四张卡片都在、chart 的 data-ai-points > 0、存在 svg 趋势路径；无采样时：核对空态文案
4. 点 6h / 24h 窗口按钮，核对按下态转移且发生一次新的区间请求（有数据时 data-ai-window 跟随）
5. 用拦截把监控请求改成 500，重新进入页签，核对「监控不可用」与重试按钮；解除拦截后点重试恢复
6. 用拦截返回全 0 的 matrix，核对出现图表与零值曲线（不退化成空态）

## 期望结果

- 监控面板就绪，四张卡片（GPU 使用 / GPU 显存 / CPU / 内存）在有数据时都出现，趋势图有采样点与 svg 路径
- 无采样时显示「该时间窗没有数据。」（本部署属此类，属环境限制而非功能缺失）
- 窗口按钮三档可切换，当前档 aria-pressed=true，切换后重新取数
- 请求失败显示「监控不可用。」并可重试，重试后恢复
- 全 0 采样画零值曲线，不显示空态

## 失败排查

- 面板一直 loading：区间没折算成绝对时间戳，query key 每帧变化导致无限重取
- 有采样却没有柱子/路径：断言方式错了——数 data-ai-points 或 path[data-ai-trend-line]，不要看首根柱高度
- 空态与不可用混用：isError 与「0 个采样点」没有分开判断

## 产品改版后如何更新自动化

- 句柄 container-detail:monitor、:monitor:chart（data-ai-window / data-ai-points）、:monitor:<gpu|gpu-memory|cpu|memory>、:monitor:window:<1h|6h|24h>、:monitor:empty、:monitor:error、:monitor:retry
