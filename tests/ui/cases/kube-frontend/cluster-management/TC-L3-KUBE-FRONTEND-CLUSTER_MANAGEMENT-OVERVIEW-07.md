# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07 集群概览 · 资源选择与真实历史读数

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

按资源与时间窗读取集群历史，指针和键盘检查真实采样。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-08** — 六张资源卡整卡可点击，使用ai-kit Card抬升/阴影/聚光，支持Enter/Space及焦点/选中态，不能仅标题可点击或在整卡内套按钮。点击只切换资源趋势不改排行；默认GPU显存、无GPU默认CPU。资源趋势提供1h/6h/24h窗口，按60s/5m/15m和时间戳匹配比例，缺分母不填零、缺口断线。轴及悬停/键盘读数保持真实，失败不抹当前值，不虚构无来源指标。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/overview.md`](../../../../design/kube-frontend/cluster-management/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 优先定位资源压力并查看变化 (Priority: P1)

作为 **集群运维人员**，我希望 **先看资源总量/用量和节点排行，并切换资源趋势**，以便 **快速定位压力与异常节点**。

**Independent Test**：资源和排行先于身份信息；切换资源与1h/6h/24h，趋势与同次历史响应对账；默认30秒更新，可暂停，隐藏页面不继续轮询。

## 前置与配置

- 已登录B200，当前资源和历史指标可读

## 测试步骤

1. 捕获默认显存历史并核对matrix采样与时间戳比例
2. 点击CPU，仅查询CPU使用与总量，保持排行维度不变
3. 悬停资源卡核对抬升和聚光，点击非标题留白区域也能选择
4. 核对整卡焦点和键盘选择，减弱动画不抬升
5. 切换6h和24h，核对步长和窗口长度
6. 悬停和键盘移动，核对读数与采样
7. 切换深浅主题和现有色调，核对中英文与三档截图

## 期望结果

- 使用与总量按时间戳匹配，不用分配量或compute利用率替代
- 趋势有真实采样、单位和读数，切换不影响其他面板
- 缺值和失败独立降级，原字段及主题交互保留

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
