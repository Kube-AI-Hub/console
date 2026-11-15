# 克隆存储卷 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/storage/clone.md)

## 概述

`pages/storage/CloneVolumeDialog.tsx` 与 `storageApi.clone`（api-client）。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-CLONE-01

## 设计目标与非目标

目标：一次点击复制一份数据卷。非目标：跨项目克隆、克隆快照。

## 关键约束

- dataSource 只能是同命名空间的 PVC。
- 源卷的访问模式在 summary 里是缩写（RWX），写入必须用完整拼写，因此克隆取 `accessModeNames`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-CLONE-01 — 门控读存储类型注解，而不是试错

**为什么**：`storageclass.kubesphere.io/allow-clone` 是平台对该能力的声明；没声明就给出按钮，读者会得到一条来自存储层的报错，看起来像控制台的问题。源卷未绑定时克隆无意义，因此同时要求 phase=Bound。

**被否方案**：始终显示，失败再解释。

### DEC-L3-KUBE-FRONTEND-STORAGE-CLONE-02 — 只让填名称

**为什么**：克隆的语义就是「同形状的另一份」。让读者改容量或访问模式会产出与 dataSource 不匹配的对象，apiserver 会拒绝。

## 系统现状

老 console 详情有「克隆」操作（按同一注解门控）；新 UI 此前没有该操作。

## 仓库落点

- 页面：`apps/console-next/src/pages/storage/CloneVolumeDialog.tsx`、`StorageDetailPage.tsx`
- 契约：`packages/api-client/src/storage.ts`（claimCloneManifest、storageApi.clone）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 克隆 | POST /api/v1/namespaces/<ns>/persistentvolumeclaims（带 dataSource） |

## 不变量

1. dataSource.kind 固定为 PersistentVolumeClaim，name 为源卷名。
2. 继承容量/访问模式/存储类型；源卷无存储类型时不带该字段。

## 已知坑

- 把缩写访问模式写进 spec 会被 apiserver 拒绝（值为 RWX 等不是合法 mode）。
- 克隆请求成功后对象可能长时间 Pending：数据复制由驱动完成，状态不是失败。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/storage/TC-L3-KUBE-FRONTEND-STORAGE-CLONE-01.yaml`
单测：`packages/api-client/test/claim-manifests.test.ts`
句柄：persistentvolumeclaims-detail:clone、storage-clone:name/submit/error

## 后续改进

- 克隆进度（驱动侧事件）就地展示。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-CLONE-01
