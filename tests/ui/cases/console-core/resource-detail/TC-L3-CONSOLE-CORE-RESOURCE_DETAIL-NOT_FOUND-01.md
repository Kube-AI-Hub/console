# TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01 资源不存在 · 中文提示并回退列表

- **用例 ID**: `TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01`
- **级别**: L3  **套件**: `point`
- **模块**: `console-core` / `resource-detail` `not-found`
- **入口**: `{BASE_URL}/clusters/default/projects/agent-platform/pods`
- **需求**: `prd/console-core/resource-detail/not-found.md`

## 产品功能

打开已删除资源的详情链接时，页面给出中文提示并自动回到该资源类型的列表。

### 关联需求

- `prd/console-core/resource-detail/not-found.md`

### 覆盖的验收场景

文案来自需求 [`prd/console-core/resource-detail/not-found.md`](../../../../prd/console-core/resource-detail/not-found.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01** — Given 已登录且目标 Pod 已被删除，When 打开它的 `/resource-status`，Then 右上角出现一条中文的「资源不存在」提示（正文含资源名），且地址栏在 3 秒内变为该项目下的 Pod 列表，页面不出现未翻译 key。

### 关联设计

- 技术方案 [`design/console-core/resource-detail/not-found.md`](../../../../design/console-core/resource-detail/not-found.md)

## 覆盖的用户故事

文案来自需求 [`prd/console-core/resource-detail/not-found.md`](../../../../prd/console-core/resource-detail/not-found.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，失效链接给出的提示是我能看懂的中文 (Priority: P1)

作为 **集群运维**，我希望 **打开已删除资源的详情链接时看到一句说明「资源不存在」的中文提示，并带上是哪个资源**，以便 **判断是自己点错了还是对象真的被删了**，而不是对着 `pods "xxx" not found` 猜。

**Independent Test**：打开 `/clusters/default/projects/agent-platform/pods/agent-platform-web-not-exist/resource-status`，右上角提示标题与正文均为中文，正文包含资源名 `agent-platform-web-not-exist`；切换界面语言到 English 后同一操作显示英文，两种语言都不出现未翻译的 key。

### US2 - 作为集群运维，失效链接把我送回它所属的列表 (Priority: P1)

作为 **集群运维**，我希望 **提示出现后页面自动回到这个资源类型的列表页，并保留我原来的集群 / 命名空间**，以便 **直接重新找目标，不用改地址栏**。

**Independent Test**：同一链接打开后，地址栏在 3 秒内变为 `/clusters/default/projects/agent-platform/pods`，列表有数据行；点浏览器后退不会回到那个失效地址。

## 前置与配置

- 已登录，且在 default 集群
- agent-platform 项目存在

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/projects/agent-platform/pods/kube-ai-hub-not-exist/resource-status
2. 等待地址栏离开详情路由，读取右上角提示

## 期望结果

- 地址栏在 3 秒内变为 /clusters/default/projects/agent-platform/pods
- 提示标题为「资源不存在」，正文包含 kube-ai-hub-not-exist
- 页面正文不出现 NotFound 或 not found 原文
- 列表主区可见，不出现未翻译 key

## 失败排查

- 仍停在详情页时确认该 store 是否继承 stores/base.js
- 有两条相同提示时检查 notifyResourceNotFound 的去重窗口

## 产品改版后如何更新自动化

- 文案变化时改 locales/{en,zh}/l10n-console-resourceDetail.js 与 pages/resource_detail.py
