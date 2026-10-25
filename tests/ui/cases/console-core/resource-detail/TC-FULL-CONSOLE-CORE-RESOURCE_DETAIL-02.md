# TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-02 资源详情页 · 不存在时回退

- **用例 ID**: `TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-02`
- **级别**: L2  **套件**: `full`
- **模块**: `console-core` / `resource-detail` `page`
- **入口**: `{BASE_URL}/clusters/default/projects/agent-platform/pods`
- **需求**: `prd/console-core/resource-detail/_index.md`

## 产品功能

用不存在的资源名打开详情页时，页面结束加载、给出中文提示并回到列表。

### 关联需求

- `prd/console-core/resource-detail/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/console-core/resource-detail/_index.md`](../../../../prd/console-core/resource-detail/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-02** — Given 已登录，When 用不存在的资源名打开同一详情页，Then 页面结束加载、给出中文提示并回退到该页自己的列表入口。

### 关联设计

- 技术方案 [`design/console-core/resource-detail/_index.md`](../../../../design/console-core/resource-detail/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/console-core/resource-detail/_index.md`](../../../../prd/console-core/resource-detail/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为集群运维，打开一条已删除的记录，3 秒内回到列表

作为 **集群运维**，我希望 **失效的详情链接不会把我留在空转页面**，以便 **马上回到列表重新找目标**。

**Independent Test**：打开 `/clusters/default/projects/agent-platform/pods/not-exist/resource-status`，地址栏在 3 秒内变为 `/clusters/default/projects/agent-platform/pods`，右上角提示为中文。

## 前置与配置

- 已登录，且在 default 集群
- agent-platform 项目存在

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/projects/agent-platform/pods/kube-ai-hub-not-exist/resource-status
2. 等待地址栏变化，读取右上角提示

## 期望结果

- 地址栏在 3 秒内变为 /clusters/default/projects/agent-platform/pods
- 提示标题为「资源不存在」，正文包含资源名
- 页面不出现 NotFound 或 not found 原文

## 失败排查

- 仍停在详情页时先看 store 是否走了 stores/base.js
- 提示为空时确认 locales/{en,zh} 都有 RESOURCE_NOT_FOUND_*

## 产品改版后如何更新自动化

- 文案变化时改 locales/{en,zh}/l10n-console-resourceDetail.js 与 pages/resource_detail.py
