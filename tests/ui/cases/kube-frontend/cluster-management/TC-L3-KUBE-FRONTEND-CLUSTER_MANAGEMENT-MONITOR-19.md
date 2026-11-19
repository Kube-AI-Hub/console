# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-19 集群监控 · 图表面板首屏骨架与就绪态同高

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-19`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor?tab=resource`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

物理资源监控页首次加载时，每张图表卡片以骨架占位（标题条 + 轴刻度 + 脉冲带 + 图例行），骨架卡片与数据到达后的卡片高度相同；数据到达时页面不跳动，且骨架期间不出现「无数据」说明。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-19** — 已知任一监控页签的图表卡片尚未取到数据，则该卡片以骨架占位而不是空白或整块灰底：卡片 `data-ai-id="<前缀>:chart:<key>"` 在首屏带 `data-ai-state="loading"` 与 `aria-busy="true"`，内部渲染骨架句柄 `<前缀>:chart:<key>:loading`（轴刻度条 + 脉冲带 + 图例占位），且**不**渲染 `<前缀>:chart:<key>:empty` 说明；骨架卡片的标题行、绘图区、图例行三段高度与数据到达后（`data-ai-state` 为 `ready` 或 `empty`）分别相同（差值 ≤ 1px），卡片总高度同样不变，数据到达时页面不跳动；读者点刷新时卡片报 `refreshing` 并保留曲线与遮罩，自动刷新不报 `refreshing`。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看趋势而不只是当前值 (Priority: P1)

作为 **集群管理员**，我希望 **看到最近一段时间的用量曲线**，以便 **区分「一直很忙」和「刚刚抖了一下」——概览的当前值无法回答这个**。

**Independent Test**：打开集群监控，核对四个卡片都画出曲线，且每张卡片显示最小/最大/当前值。

## 前置与配置

- 已登录，host 集群
- 监控接口的响应被暂时挂起，以便观察首屏状态

## 测试步骤

1. 拦截 monitoring.kubesphere.io 的 range 读，先不放行
2. 打开 /kube-frontend/clusters/host/monitor?tab=resource
3. 读取某张图表卡片的 data-ai-state、骨架句柄与卡片高度，以及卡片三个子块的高度
4. 放行请求并等待数据到达
5. 再读同一卡片的高度与三个子块高度

## 期望结果

- 首屏卡片的 data-ai-state 为 loading，存在 <aiId>:loading 骨架，且不存在 <aiId>:empty
- 骨架卡片的标题条、图表区、图例行三段高度与就绪态分别相等（差值 ≤ 1px）
- 数据到达后骨架消失，卡片总高度与首屏相同（差值 ≤ 1px）
- 骨架期间不出现「无数据」段落

## 失败排查

- 首屏空白：加载态用了由响应构建的 charts 列表，首屏它为空，改用静态 spec 清单
- 数据到达时卡片变矮：骨架多渲染了 empty 段落，或标题/图例占位高度与真实行不一致
- 骨架比卡片矮：ChartSkeleton 没有带 legend，漏掉了图例占位

## 产品改版后如何更新自动化

- 卡片句柄：data-ai-id="cluster-monitor:resource:chart:<group>:<key>"；骨架是其子元素 <aiId>:loading
- 子块高度用 section > div 的顺序读取（标题 / 图表 / 图例）
