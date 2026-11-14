# 快照内容视图 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/storage/snapshot-content.md)

## 概述

`/clusters/<c>/volume-snapshot-content/<name>` 的只读详情页。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01

## 设计目标与非目标

目标：把快照内容的判断依据（驱动、句柄、恢复大小）呈现在一屏内。非目标：编辑/删除内容、从快照恢复。

## 关键约束

- 读原生组：`GET /apis/snapshot.storage.k8s.io/v1/volumesnapshotcontents/<name>`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01 — 读原生组，不走 kapis

**为什么**：kapis 的 resources 聚合对快照类资源需要 cluster 段与额外映射，而这一页只读一个集群级对象；直接用原生组少一层转换，句柄等字段也不会被截断。
**被否方案**：走 `/kapis/resources.../volumesnapshotcontents`（列表页用的是 kapis，详情用原生组）。
**何时重新考虑**：需要成员集群切换时（届时统一带上 clusters 段）。

## 系统现状

老 console：`clusters/containers/Storage/VolumeSnapshots/SnapshotContent/Detail`。本页迁只读详情。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/VolumeSnapshotContentPage.tsx`
- 路由：`routes/kube-frontend.clusters.$cluster/volume-snapshot-content/`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 快照内容 | /apis/snapshot.storage.k8s.io/v1/volumesnapshotcontents/&lt;name&gt; |

## 不变量

1. 不存在的名字显示明确提示（不是空白）。
2. 句柄为空时显示 `-`，不隐藏。

## 已知坑

- **`ResourceErrorPanel` 没有 `notFoundText` 属性**：想定制 404 文案要改组件；本页先用组件的统一文案。
- **CRD 缺失**：`snapshot.storage.k8s.io` 未安装时接口 404，页面按错误面板显示。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/storage/TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01.yaml`
可观测点：`snapshot-content:surface`、`snapshot-content:basic`。

## 后续改进

- 从快照恢复到 PVC。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01