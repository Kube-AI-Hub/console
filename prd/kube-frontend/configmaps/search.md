# 按名称搜索（L3）

## 概述

工具条左侧的搜索框，按 ConfigMap 名称过滤当前 namespace 的列表。

## 用户故事

### US1 - 作为项目成员，在几十条配置里快速找到目标

**Independent Test**：在搜索框输入 `nginx`，列表在 1 秒内只剩名称包含 `nginx` 的条目，且页码回到第 1 页。

### US2 - 作为项目成员，清空搜索恢复完整列表

**Independent Test**：清空搜索框，列表恢复为未过滤状态，已选项为空。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01** — Given 列表已加载，When 在搜索框输入 `nginx`，Then 250ms 后以 `keyword=nginx` 重新请求，列表只显示匹配项，页码重置为 1。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02** — Given 已输入关键字且无匹配，When 请求完成，Then 页面进入 `empty` 态并显示「暂无配置字典」，而不是空表头。

## 设计目标

- 不因每个按键发一次请求：输入做 250ms 防抖。
- 搜索是服务端过滤，不是本地过滤：本地过滤只作用于当前页，会漏掉其他页的匹配项。

## 约束与边界

- 关键字经 `trim` 后发送；空串不带 `keyword` 参数。
- 搜索条件在翻页与排序之间保持。

## UI 交互设计

- 输入框 `type="search"`，带 `aria-label` 与 `data-ai-id="configmaps:search"`。
- 触控目标小屏不小于 44px 高，小屏占满一行。
- 无显式「搜索」按钮：输入即生效，避免两个入口做同一件事。

## 文案与校验

- 占位符：按名称搜索。
- 无结果文案沿用空态标题，不另造一套。

## 边界情况

- 仅输入空格：视为无关键字。
- 快速连续输入：只有最后一次防抖触发请求，前序请求被 key 变化丢弃。
- 搜索期间点击批量删除：已选项已被清空，按钮回到禁用。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01** — 搜索必须经服务端过滤，并在输入停止 250ms 后发起。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02** — 无匹配时必须呈现空态而非空表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01** — 输入完整名称后结果恰好一条。

## 明确不做

- 不做按标签 / 键值搜索。
- 不做搜索历史与建议。

## 假设

- 上游以 `fieldSelector=metadata.name=~<keyword>` 支持名称模糊匹配。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02`
