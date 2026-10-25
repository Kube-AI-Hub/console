# TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01 资源详情页 · 页签切换

- **用例 ID**: `TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01`
- **级别**: L2  **套件**: `full`
- **模块**: `console-core` / `resource-detail` `page`
- **入口**: `{BASE_URL}/clusters/default/projects/agent-platform/pods`
- **需求**: `prd/console-core/resource-detail/_index.md`

## 产品功能

资源详情页的页签导航与主区同步，左侧摘要常驻。

### 关联需求

- `prd/console-core/resource-detail/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/console-core/resource-detail/_index.md`](../../../../prd/console-core/resource-detail/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01** — Given 已登录且目标对象存在，When 依次切换该详情页的全部页签，Then 每次切换地址栏与主区同步变化，左侧摘要始终可见，页面不出现未翻译 key。

### 关联设计

- 技术方案 [`design/console-core/resource-detail/_index.md`](../../../../design/console-core/resource-detail/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/console-core/resource-detail/_index.md`](../../../../prd/console-core/resource-detail/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，打开一条存在的记录，能在页签之间切换并看到各自内容

作为 **集群运维**，我希望 **从列表点进一条记录后能在资源状态、元数据、事件等页签之间切换**，以便 **在一页里看全这个对象的运行情况**。

**Independent Test**：打开一个真实 Pod 的 `/resource-status`，切到 `/metadata` 再切到 `/events`，地址栏与主区同步变化；左侧名称与状态始终可见。

## 前置与配置

- 已登录，且在 default 集群
- agent-platform 项目下至少有一个 Pod

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/projects/agent-platform/pods
2. 取第一行的 Pod 名称，打开它的 /resource-status
3. 依次点击资源状态、元数据、事件页签，每次核对地址栏

## 期望结果

- 每次切换后地址栏末尾的页签段与点击的页签一致
- 左侧摘要的名称始终可见
- 页面不出现形如 FOO_BAR 的未翻译 key

## 失败排查

- 页签点不动时先确认 Pod 仍存在（列表可能是缓存）
- 地址栏不变时确认点击的是页签而不是标题

## 产品改版后如何更新自动化

- 页签标题变化时改 pages/resource_detail.py 的 TAB_TITLES
