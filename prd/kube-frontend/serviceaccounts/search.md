# 服务账户 · 按名称搜索（L3）

## 概述

与保密字典、配置字典共用同一套搜索行为：工具条输入，250ms 后把 `name=<关键字>` 交给上游，同时把页码重置到第 1 页并清空已选项。

## 用户故事

### US1 - 作为项目成员，在长列表里定位某个服务账户

**Independent Test**：输入名称片段，列表只剩名称包含该片段的条目，总数随之变化；清空输入后恢复全量。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01** — Given 列表已加载，When 在搜索框输入关键字，Then 请求带 `name=<关键字>` 且 `page=1`，列表与总数只包含匹配项，已选项被清空。

## 设计目标

- 搜索在服务端完成：跨页搜索不能只过滤当前页。

## 约束与边界

- 只按名称搜索（老控制台 `searchType="name"`）。
- 关键字两端空白去掉；纯空白不传参。

## UI 交互设计

- 稳定句柄 `serviceaccounts:search`；输入即搜，无独立按钮。

## 文案与校验

- 占位符：按名称搜索。无匹配时为空态而非错误态。

## 边界情况

- 搜索与项目筛选叠加生效。
- 搜索过程中翻页：页码回到第 1 页。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01** — 搜索必须交给上游并重置页码与选择。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01** — 结果与上游 `name` 过滤一致（子串匹配）。

## 明确不做

- 不做按角色或令牌搜索。

## 假设

- kapis 的 `name` 参数按子串过滤。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01`
