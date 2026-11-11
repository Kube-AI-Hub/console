# 服务账户 · 按名称搜索 · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/search.md`](../../../prd/kube-frontend/serviceaccounts/search.md)。

## 概述

与保密字典共用 `useResourceListState`：250ms 防抖、`name` 参数、页码重置、选择清空。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01`

## 设计目标与非目标

**目标**：搜索语义与另外两个资源完全一致，只按名称。

**非目标**：按角色或令牌搜索。

## 关键约束

- 关键字 `trim()` 后为空则不带 `name`。
- 句柄 `serviceaccounts:search`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01 — 复用同一 hook，不按资源分叉

**为什么**：三个资源的搜索行为没有差别；分叉会带来「这个页面搜索不重置页码」之类的隐性差异。

**被否方案**：为服务账户增加按角色过滤。kapis 没有该参数，需要客户端过滤，跨页不成立。

## 系统现状

老控制台 `searchType="name"`。

## 仓库落点

| 层 | 路径 |
|---|---|
| 状态 | `apps/console-next/src/components/resource/useResourceListState.ts` |
| 请求 | `apps/console-next/src/pages/serviceaccounts/queries.ts` |

## 对外契约

`GET .../serviceaccounts?name=<keyword>&page=1`

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01** — 搜索变化后请求的 `page` 为 1。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01** — 与保密字典相同的防抖/页码同步问题，已由共享 hook 统一处置。

## 测试与可观测

- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01`。

## 后续改进

同保密字典。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01`
