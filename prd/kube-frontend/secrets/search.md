# 保密字典 · 按名称搜索（L3）

## 概述

搜索框在列表工具条上，输入后 250ms 生效，按**名称**过滤（不做描述或键名的模糊匹配——老控制台的 `searchType="name"` 也只按名称）。

## 用户故事

### US1 - 作为项目成员，在几十条 Secret 里找到某一条

**Independent Test**：在搜索框输入某个 Secret 名称中的一段，列表只剩名称包含该片段的条目，总数显示为匹配数；清空后恢复全量。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01** — Given 列表已加载，When 在搜索框输入关键字，Then 请求带上 `name=<关键字>`，列表与总数只包含名称匹配的条目，页码回到第 1 页，已选项清空。

## 设计目标

- 搜索是服务端行为：跨页搜索必须把条件交给上游，否则只搜到当前页。

## 约束与边界

- 关键字两端空白被去掉；只有空白时不带 `name` 参数。
- 与配置字典共用同一套防抖与页码重置逻辑（`useResourceListState`）。

## UI 交互设计

- 输入即搜，无「搜索」按钮；`configmaps:search` 同款的稳定句柄 `secrets:search` 供智能体定位。

## 文案与校验

- 占位符：按名称搜索。
- 无匹配：空态「暂无保密字典」，而不是「加载失败」。

## 边界情况

- 关键字只匹配大小写敏感的子串（与上游 `name` 过滤一致）。
- 搜索过程中切换项目：两个条件同时生效，页码回到第 1 页。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SECRETS-SEARCH-01** — 搜索必须把 `name` 参数交给上游，并重置页码与选择。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01** — 搜素结果与 `kubectl get secrets --field-selector metadata.name=<关键字>` 不一致时，以上游返回为准并记录到用例。`name` 过滤是子串而不是精确匹配。

## 明确不做

- 不做多字段搜索、模糊匹配或正则。
- 不做搜索历史。

## 假设

- kapis 的 `name` 参数按子串过滤。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01`
