# 保密字典 · 按名称搜索 · 技术方案（L3）

> 承接 [`prd/kube-frontend/secrets/search.md`](../../../prd/kube-frontend/secrets/search.md)。

## 概述

搜索状态由 `useResourceListState` 承担：输入值 `keyword`、防抖后的 `search`、以及「搜索变化即回第 1 页」。请求参数由 `toListParams()` 派生，`search` 空时不带 `name`。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01`

## 设计目标与非目标

**目标**：输入一次只发一个请求；搜索与翻页不会互相覆盖。

**非目标**：模糊匹配、多字段、搜索历史。

## 关键约束

- 防抖 250ms；到时间的定时器被清理（组件卸载或再次输入时）。
- 页码重置与防抖在同一处完成，避免「防抖值变了、页码没变」的双请求（配置字典的 GOT-LIST-07）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01 — 搜索状态抽成共享 hook

**为什么**：配置字典在页面里内联了这套逻辑（约 20 行），保密字典与服务账户都需要完全相同的语义。抽成 `useResourceListState` 后，「搜索重置页码」「选择随可见内容清空」只有一份实现。

**被否方案**：每个页面复制一份。配置字典曾因为「列表与详情各自实现格式化」出过缺陷；同样的分叉会在搜索与页码重置上重演。

**何时重新考虑**：搜索语义需要按资源分叉（例如服务端支持 label 搜索）时，给 hook 增加可选参数而不是分叉实现。

### DEC-L3-KUBE-FRONTEND-SECRETS-SEARCH-02 — 选择清空依赖序列化后的状态

**为什么**：`selected` 必须在页码、关键字、排序任一变化时清空。用 `JSON.stringify([page, search, sortBy, order])` 作为 effect 依赖，比四个依赖项更不容易漏——漏一个是「翻页后仍勾着上一页的行」。

**被否方案**：在每次 `setPage`/`setSort` 里手动清空。任何一个新的状态变更路径都会忘记清空。

## 系统现状

老控制台用 `Table` + `searchType="name"`，行为等价；新实现把 URL 中的参数交给路由（当前版本不序列化搜索参数，与配置字典一致）。

## 仓库落点

| 层 | 路径 |
|---|---|
| 状态 | `apps/console-next/src/components/resource/useResourceListState.ts` |
| 参数 | 同文件的 `toListParams()` |
| 请求 | `apps/console-next/src/pages/secrets/queries.ts`（`useSecrets`） |

## 对外契约

`GET /kapis/resources.kubesphere.io/v1alpha3[/clusters/{c}]/namespaces/{ns}/secrets?name=<keyword>&page=1`

## 不变量

- **INV-L3-KUBE-FRONTEND-SECRETS-SEARCH-01** — 一次输入只产生一个最终请求，且该请求的 `page` 为 1。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SECRETS-SEARCH-01** — 关键字两端空白若不清除，`name=" foo"` 不会匹配任何对象，用户会以为搜索坏了。
  处置：`search` 是 `keyword.trim()`。

## 测试与可观测

- 单元：`test/secrets-page.test.tsx` 中通过 mock 的 fetch 断言 URL 带 `name` 与 `page=1`。
- 端到端：`TC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01`。

## 后续改进

搜索结果参数持久化到 URL（便于分享），与配置字典的需求一起做。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01`
