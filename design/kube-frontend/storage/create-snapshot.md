# 创建快照 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/storage/create-snapshot.md)

## 概述

`pages/storage/CreateSnapshotDialog.tsx` 与 `volumeSnapshotsWriteApi.create`。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01

## 设计目标与非目标

目标：从卷详情创建快照并按驱动过滤快照类。非目标：定时快照、删除快照。

## 关键约束

- 快照类必须与卷的 provisioner 一致，否则存储层拒绝。
- 集群可能没有安装快照 API（404），此时按「没有可用快照类」处理。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01 — 快照类按驱动过滤，无匹配时禁用提交并说明

**为什么**：把所有类都列出来会让读者选到驱动不匹配的类，然后收到一条与「选错了」无关的报错。B200 上确实没有 VolumeSnapshotClass，说明路径就是当前的正确交付形态。

**被否方案**：列出全部类，让服务端拒绝。

### DEC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-02 — 空类不发送 volumeSnapshotClassName

**为什么**：Kubernetes 允许省略该字段由驱动默认类决定；发送空串会被当作类名解析。

## 系统现状

老 console 详情有「创建快照」（按 allow-snapshot 注解与版本门控，快照类按 provisioner 过滤）；新 UI 此前只有只读快照页签。

## 仓库落点

- 页面：`apps/console-next/src/pages/storage/CreateSnapshotDialog.tsx`、`StorageDetailPage.tsx`
- 契约：`packages/api-client/src/storage.ts`（snapshotManifest、volumeSnapshotsWriteApi）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 创建快照 | POST /api/v1/namespaces/<ns>/volumesnapshots |
| 快照类 | GET /apis/snapshot.storage.k8s.io/v1/volumesnapshotclasses |

## 不变量

1. source.kind 固定 PersistentVolumeClaim，persistentVolumeClaimName 为当前卷。
2. 快照类为空时不发送该字段。

## 已知坑

- 卷的 provisioner 注解有 beta 与正式两种拼写，两者都要读。
- B200 当前 0 个 VolumeSnapshotClass：页面显示说明而不是空下拉，测试断言该说明。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/storage/TC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01.yaml`
单测：`packages/api-client/test/claim-manifests.test.ts`
句柄：persistentvolumeclaims-detail:snapshot、storage-snapshot:name/class/no-class/submit/error

## 后续改进

- 快照创建进度轮询（readyToUse）。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01
