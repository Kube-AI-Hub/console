# 快照别名路由 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/storage/snapshot-alias.md)

## 概述

`/clusters/<c>/snapshots` 与 `/snapshots/<namespace>` 两条旧地址重定向到 `/volume-snapshots`。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01

## 设计目标与非目标

目标：旧书签不 404。非目标：保留第二份列表实现。

## 关键约束

- TanStack Router 的 `beforeLoad` 里 `throw redirect({ to, params, replace: true })`；`replace` 避免返回键在两条地址间来回跳。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01 — 重定向而不是重复页面

**为什么**：同一份列表两个地址，重复实现会让过滤/列定义分叉；重定向保住了书签，只保留一套实现。
**被否方案**：把 `/snapshots` 做成独立页面并复用组件。多一个页面就要多一份测试与文档。
**何时重新考虑**：旧地址语义发生变化（例如要按命名空间预过滤）。

## 系统现状

老 console：`routes/index.js` 的 `${PATH}/snapshots/:namespace?` 指向与 `/volume-snapshots` 同一个组件。

## 仓库落点

- 路由：`routes/kube-frontend.clusters.$cluster/snapshots/{route,index,$namespace}.tsx`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 旧列表地址 | /kube-frontend/clusters/&lt;c&gt;/snapshots |

## 不变量

1. 两个旧形态都最终落到 `/volume-snapshots`。
2. 重定向使用 replace，不污染返回栈。

## 已知坑

- **可选段**：TanStack 文件路由里 `$namespace?` 用 `$namespace.tsx` 承接；`index.tsx` 承接无段形态。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/storage/TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01.yaml`
可观测点：最终 URL 与 `cluster-volume-snapshots:surface`。

## 后续改进

- 若需要按命名空间预过滤，再在列表页加筛选并让别名带上查询参数。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01