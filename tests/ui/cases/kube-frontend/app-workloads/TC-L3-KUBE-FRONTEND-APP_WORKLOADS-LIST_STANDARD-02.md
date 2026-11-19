# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02 列表交互标准 · 列头字段筛选、说明与清除全部条件

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list-standard`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/list-standard.md`

## 产品功能

字段筛选挂在列头（不在工具栏）；选中即重新请求并回到第 1 页；工具栏出现「清除全部条件」，点击后恢复全集；可选字段的列头有可聚焦的说明按钮，且不触发排序。

### 关联需求

- `prd/kube-frontend/app-workloads/list-standard.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list-standard.md`](../../../../prd/kube-frontend/app-workloads/list-standard.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03** — 已知列表支持字段筛选，当用某一列的筛选器选定值，则列表按该值重新请求并回到第 1 页，列头筛选图标显示为激活态；工具栏出现「清除全部条件」，点击后清空搜索与全部字段筛选并恢复全集，该按钮随之消失；筛选后无结果时显示「没有匹配的结果」而不是「暂无数据」。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-04** — 已知列表有可选字段（就绪数、镜像、端口、NTP 偏移、GPU/显存用量等），则列头提供可键盘聚焦的说明按钮，悬浮/聚焦显示该字段的单位与口径；点击该按钮不触发排序。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list-standard.md`](../../../../design/kube-frontend/app-workloads/list-standard.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list-standard.md`](../../../../prd/kube-frontend/app-workloads/list-standard.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在任何一个列表里都不丢方向 (Priority: P1)

作为 **运维**，我希望 **横向滚动表格时行名始终可见、刷新时能看到正在更新、筛选后有一个按钮清空全部条件**，以便 **不必记住自己在看哪一行、也不必逐列找回筛选入口**。

**Independent Test**：在部署列表横向滚动，名称列固定不动；点刷新出现「更新中…」且行不消失；用状态列筛选后工具栏出现「清除全部条件」，点击后列表恢复全集。

## 前置与配置

- 已登录，host 集群，default 项目有部署

## 测试步骤

1. 打开部署列表，等待主区就绪
2. 读取状态列头里的筛选触发器句柄，确认它位于 th 内而不是工具栏
3. 点开筛选，读取选项集合
4. 选择一个必然无匹配的取值（如「已停止」，当项目内没有已停止的部署时）
5. 读取空态文案、筛选触发器激活态与「清除全部条件」是否出现
6. 点「清除全部条件」，读取行数与按钮是否消失
7. 读取状态列头的说明按钮，点击并确认 aria-sort 未变化

## 期望结果

- 状态筛选触发器位于状态列 th 内；工具栏只有项目范围与搜索
- 选项为「全部状态 / 运行中 / 更新中 / 已停止」
- 选择后请求带 status=<取值>，列表回到第 1 页
- 无匹配时空态是「没有匹配的结果」而不是「暂无数据」
- 筛选激活时触发器带 data-active="true"，「清除全部条件」可见
- 点击清除后恢复原行数，按钮消失，触发器不再激活
- 说明按钮是 button（可聚焦），点击后该列 aria-sort 不变

## 失败排查

- 筛选出现在工具栏：ListFilter 没有写 column 字段
- 选了没反应：选项值不是该 getter 的词表（未知值静默返回 0 行）
- 清除后按钮不消失：页面没有把 filters 的当前值传给 ResourceList

## 产品改版后如何更新自动化

- 列头筛选句柄：<pagePrefix>:filter:<column>；重置：<pagePrefix>:filter:<column>:reset
- 「清除全部条件」：<sortAiPrefix>:filters-clear
- 说明按钮用 aria-label="<列名>" 定位，断言 aria-sort 前后一致
