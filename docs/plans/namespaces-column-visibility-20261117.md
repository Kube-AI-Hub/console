# 项目列表接上列显隐（2026-11-17）

## 1. 缺口

集群作用域的**项目列表**（`/kube-frontend/clusters/<cluster>/namespaces`，组件 `ClusterListPage` 的
namespaces 分支）有 7 列却没有列显隐选择器。同文件的 nodes 分支委托给 `NodesPage`（已有），
所以漏的只是项目这一支。

## 2. 改动

| 项 | 内容 |
| --- | --- |
| 可隐藏列 | `status`、`cpu`、`memory`、`pods`、`workspace`、`createTime` 标 `hideable: true`（名称列保留） |
| 选择器 | `columnVisibility: { aiId: 'namespaces:columns' }`，仅 namespaces 分支声明 |
| 状态 | `useColumnVisibility('namespaces', columnKeys)`，localStorage 持久化 |
| 接线 | `visibleColumnKeys` 与 `onVisibleColumnsChange` 传给 `ResourceList` |

`exactOptionalPropertyTypes` 下不能把 `undefined` 直接传给可选 prop，因此用条件展开而不是三元传 undefined——
这条在 `tsc` 里会直接报 TS2375。

## 3. 验证

浏览器实测（`xc` 集群，工作区构建 5182）：

```
state: ready rows= 10
chooser: 1            ← namespaces:columns 存在
toggles: 3            ← 可隐藏列
headers 7 -> 6        ← 点一下真的少了一列
```

| 检查 | 结果 |
| --- | --- |
| `tsc`（本文件） | 0 错误 |
| `vite build` | ✓ |
| 契约套件 | 1481 passed / 1 failed（失败项是并行线 `KubectlPage` 的 ai-surface 断言，与本改动无关） |

## 4. 说明

`SettingsListPage`、`PlatformListPage`、`MonitoringListPage`、`NodeResourcesPanel` 也出现在「有分页但没列显隐」的
grep 结果里，但它们是**通用容器组件**：schema（含列定义）由调用方传入，是否接列显隐要在调用方判断。
把 grep 结果直接当成「缺 5 处」会改错地方——**先分清「页面」与「渲染器」**。
