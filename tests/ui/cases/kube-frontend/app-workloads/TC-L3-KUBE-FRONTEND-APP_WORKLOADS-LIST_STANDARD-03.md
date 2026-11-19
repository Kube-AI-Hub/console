# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03 列表交互标准 · 首屏骨架与刷新遮罩不混用

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list-standard`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/deployments`
- **需求**: `prd/kube-frontend/app-workloads/list-standard.md`

## 产品功能

列表首屏是骨架行、重取是保留行的「更新中…」遮罩；图表首屏是与图表等高的骨架，手动刷新保留曲线，自动刷新不出现遮罩。

### 关联需求

- `prd/kube-frontend/app-workloads/list-standard.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list-standard.md`](../../../../prd/kube-frontend/app-workloads/list-standard.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-05** — 已知数据尚未到达（首次加载、翻页、改排序），则列表显示骨架行而不是空白或遮罩；已知已有行、正在重取（点刷新、改筛选），则行保留不动并显示居中「更新中…」遮罩与 `aria-busy="true"`，请求结束后遮罩消失；两种画面不会同时出现，遮罩外观与图表页同款。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-06** — 已知图表区域尚未有数据，则显示与图表同高的骨架（轴刻度条 + 脉冲带 + 基线），**不**显示空坐标轴、也不把骨架叠在图表上方；已知图表已有曲线、读者点刷新，则曲线保留并加半透明遮罩；页面定时自动刷新时**不出现**遮罩。自动轮询的页面若不遮罩，读者只能看到曲线平滑过渡。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list-standard.md`](../../../../design/kube-frontend/app-workloads/list-standard.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list-standard.md`](../../../../prd/kube-frontend/app-workloads/list-standard.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在任何一个列表里都不丢方向 (Priority: P1)

作为 **运维**，我希望 **横向滚动表格时行名始终可见、刷新时能看到正在更新、筛选后有一个按钮清空全部条件**，以便 **不必记住自己在看哪一行、也不必逐列找回筛选入口**。

**Independent Test**：在部署列表横向滚动，名称列固定不动；点刷新出现「更新中…」且行不消失；用状态列筛选后工具栏出现「清除全部条件」，点击后列表恢复全集。

## 前置与配置

- 已登录，host 集群
- 该集群至少有一个项目与一条部署（列表可加载出数据）

## 测试步骤

1. 对列表与图表的接口加网络延迟（如 800ms），重新打开集群级部署列表
2. 在数据到达前读取 surface 的 data-ai-state 与骨架行数量
3. 数据到达后读取行数；点刷新，读取遮罩、aria-busy 与行数
4. 打开集群概览，读取图表首屏：骨架句柄、骨架与图表容器的 getBoundingClientRect 高度、是否同时存在绘图区
5. 数据到达后读图表容器高度；点面板刷新读取遮罩句柄与曲线是否仍在
6. 若有自动刷新开关，开启后等两个刷新周期，确认遮罩未出现

## 期望结果

- 首屏 surface 的 data-ai-state 为 loading，出现骨架行，不出现「更新中…」遮罩
- 数据到达后 data-ai-state 为 ready，行数大于 0
- 点刷新时出现 table:refreshing，容器 aria-busy=true，行数等于刷新前
- 图表首屏只有骨架（<chartAiId>:loading），绘图区不渲染
- 骨架与就绪状态的图表容器高度相等（差值 ≤ 1px）
- 面板刷新时出现 <chartAiId>:refreshing，曲线仍在屏幕上（不换成骨架）
- 自动刷新期间不出现遮罩

## 失败排查

- 首屏出现遮罩或骨架与遮罩同时出现：页面把 loading 与 refreshing 一起传了
- 首屏面板高度明显大于就绪态：骨架叠在图表上方，而不是代替它
- 手动刷新无遮罩：manualRefresh 没有接线，或页面用 isFetching 推断而钩子只认读者点击
- 自动刷新也闪遮罩：manualRefresh 接到了 query.isFetching

## 产品改版后如何更新自动化

- 列表：data-ai-state="loading" → 骨架行；重取句柄 table:refreshing
- 图表：骨架 <aiId>:loading，遮罩 <aiId>:refreshing；以 panel 容器高度作为占位高度的判据
