# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01 列表交互标准 · 固定首尾列与刷新可见

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list-standard`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/list-standard.md`

## 产品功能

列表横向滚动时身份列固定在起始边、操作列固定在结束边；点刷新时保留现有行并显示「更新中…」遮罩，首次加载才用骨架行。

### 关联需求

- `prd/kube-frontend/app-workloads/list-standard.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list-standard.md`](../../../../prd/kube-frontend/app-workloads/list-standard.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01** — 已知列表列宽超过容器（或视口收窄），当横向滚动，则身份列（名称 / 用户名 / 消息标题）保持贴住起始边，操作列保持贴住结束边，中间列从其下方滚过；固定列有不透明背景，滚动内容不穿透。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02** — 已知列表已有数据，当点击刷新或改变筛选触发重取，则表格保留现有行并显示居中的「更新中…」遮罩与 `aria-busy="true"`，请求结束后遮罩消失；首次加载仍用骨架行，两者不混用。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list-standard.md`](../../../../design/kube-frontend/app-workloads/list-standard.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list-standard.md`](../../../../prd/kube-frontend/app-workloads/list-standard.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在任何一个列表里都不丢方向 (Priority: P1)

作为 **运维**，我希望 **横向滚动表格时行名始终可见、刷新时能看到正在更新、筛选后有一个按钮清空全部条件**，以便 **不必记住自己在看哪一行、也不必逐列找回筛选入口**。

**Independent Test**：在部署列表横向滚动，名称列固定不动；点刷新出现「更新中…」且行不消失；用状态列筛选后工具栏出现「清除全部条件」，点击后列表恢复全集。

## 前置与配置

- 已登录，host 集群，default 项目有至少一条部署
- 视口收窄到表格必然横向滚动的宽度

## 测试步骤

1. 打开部署列表，等待主区就绪
2. 把表格容器横向滚动一段距离，读取身份列与操作列相对容器的坐标
3. 读取身份列单元格的 computed position 与背景色
4. 点刷新按钮，读取刷新遮罩与 aria-busy，同时确认行数未变
5. 等遮罩消失，再次读取行数

## 期望结果

- 身份列（名称）的 position 为 sticky，横向滚动后其左边界与容器左边界差值保持稳定（不随 scrollLeft 变化）
- 操作列贴住容器右边界
- 固定列背景不是透明（滚动内容不会穿透）
- 刷新时出现「更新中…」遮罩且 aria-busy=true，行数等于刷新前的行数
- 遮罩消失后行数仍大于 0

## 失败排查

- 固定列跟着滚：列没有 pin，或 pin 没有声明 width（共享层会忽略无宽度的 pin）
- 刷新无反馈：页面只传了 loading（isFetching），没有传 refreshing
- 刷新时行消失：loading 用了 isFetching，把重取当成首次加载

## 产品改版后如何更新自动化

- 遮罩句柄：data-ai-id="table:refreshing"；容器在 refreshing 时带 aria-busy="true"
- 身份列用 tbody tr td:nth-child(2)（第 1 个是选择框），操作列取最后一个 th
