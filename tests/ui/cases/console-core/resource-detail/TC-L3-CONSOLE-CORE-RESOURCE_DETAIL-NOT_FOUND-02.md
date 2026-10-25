# TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02 资源不存在 · 存在时不误报

- **用例 ID**: `TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02`
- **级别**: L3  **套件**: `point`
- **模块**: `console-core` / `resource-detail` `not-found`
- **入口**: `{BASE_URL}/clusters/default/projects/agent-platform/pods`
- **需求**: `prd/console-core/resource-detail/not-found.md`

## 产品功能

资源存在时详情页行为不变，不弹「资源不存在」，也不跳转。

### 关联需求

- `prd/console-core/resource-detail/not-found.md`

### 覆盖的验收场景

文案来自需求 [`prd/console-core/resource-detail/not-found.md`](../../../../prd/console-core/resource-detail/not-found.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02** — Given 已登录且目标 Pod 存在，When 打开它的 `/resource-status`，Then 5 秒内不出现「资源不存在」提示，地址栏保持在该 Pod 的详情路由，主区正常渲染。

### 关联设计

- 技术方案 [`design/console-core/resource-detail/not-found.md`](../../../../design/console-core/resource-detail/not-found.md)

## 覆盖的用户故事

文案来自需求 [`prd/console-core/resource-detail/not-found.md`](../../../../prd/console-core/resource-detail/not-found.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为集群运维，正常打开一条存在的记录时不受影响 (Priority: P1)

作为 **集群运维**，我希望 **资源存在时行为与以前完全一致**，以便 **这次改动不会在正常路径上多出提示或跳转**。

**Independent Test**：打开一个真实 Pod 的 `/resource-status`，页面正常渲染且 5 秒内不出现「资源不存在」提示，地址栏保持在该 Pod 的详情路由。

## 前置与配置

- 已登录，且在 default 集群
- agent-platform 项目下至少有一个 Pod

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/projects/agent-platform/pods
2. 取第一行的 Pod 名称，打开它的 /resource-status
3. 等待 5 秒，统计「资源不存在」提示条数并读取地址栏

## 期望结果

- 「资源不存在」提示条数为 0
- 地址栏仍以 /pods/{pod}/resource-status 结尾
- 侧栏名称等于该 Pod 名称

## 失败排查

- 出现提示时确认上一个页面是否刚发生过 404（recentlyNotFound 窗口是 5 秒）
- 被跳转时检查 store.notFound 是否被误置为 true

## 产品改版后如何更新自动化

- 提示标题变化时改 pages/resource_detail.py 的 NOT_FOUND_TITLE
