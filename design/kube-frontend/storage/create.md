# 创建存储卷 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/storage/create.md)

## 概述

`pages/storage/CreateVolumeDialog.tsx` 与 api-client 的 `claimManifest`，由列表的 primaryAction 打开。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-CREATE-01
- AC-L3-KUBE-FRONTEND-STORAGE-CREATE-02

## 设计目标与非目标

目标：一次提交得到结构正确的 PVC；字段由存储类型驱动。非目标：PV 预绑定、跨项目快照恢复、就地扩容。

## 关键约束

- 写入走 `resourceApi.create`（`POST …/persistentvolumeclaims`）。
- 存储类型的支持模式来自注解 `storageclass.kubesphere.io/supported-access-modes`（JSON 数组）；容量范围来自 `parameters.minSize/maxSize/stepSize`。
- 恢复分支不发送 `storageClassName`：恢复的卷沿用快照的存储类型，带类会与恢复冲突。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-CREATE-01 — 清单由纯函数生成，弹窗只收集值

**为什么**：创建的正确性在于「哪些字段进入 spec」，与 UI 无关。`claimManifest` 是纯函数，单测直接断言生成的 spec（含 dataSource、注解、空类的省略），不需要集群。

**被否方案**：在组件里内联拼装对象——只能靠 E2E 验证，且两个分支的差异容易写错。

### DEC-L3-KUBE-FRONTEND-STORAGE-CREATE-02 — 支持模式与容量范围读自存储类型，缺省给出全量

**为什么**：声明缺失（老类型、非 CSI 类型）时若当成「不支持任何模式」，创建会变得不可能；缺省给出 Kubernetes 的四种模式与 0/2048/1 GiB 才与老 console 一致。

**被否方案**：缺省时禁用访问模式字段——把「类型没说」误读成「类型禁止」。

### DEC-L3-KUBE-FRONTEND-STORAGE-CREATE-03 — 没有就绪快照时说明原因，不渲染空下拉

**为什么**：空下拉读起来像缺陷；说明「该项目还没有就绪的快照」把读者引向正确动作（先创建快照）。

## 系统现状

老 console 的创建是三步表单（基本信息/存储设置/高级设置）加「从快照创建」分支；新 UI 此前只有列表与详情，没有创建入口。

## 仓库落点

- 页面：`apps/console-next/src/pages/storage/CreateVolumeDialog.tsx`
- 数据：`apps/console-next/src/pages/storage/queries.ts`（useStorageClasses、useProjectSnapshots、useCreateStorage）
- 契约：`packages/api-client/src/storage.ts`（claimManifest、storageApi.create）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 创建 PVC | POST /api/v1/namespaces/<ns>/persistentvolumeclaims |
| 存储类型（含能力与范围） | GET /apis/storage.k8s.io/v1/storageclasses |
| 可恢复快照 | GET /api/v1/namespaces/<ns>/volumesnapshots |

## 不变量

1. 恢复分支不带 storageClassName；新建分支留空时不带该字段。
2. 提交前本地校验名称/访问模式/容量；服务端拒绝的原因原样展示。
3. 别名与描述只写注解，未填写不产生空注解。

## 已知坑

- 列表行里的访问模式是缩写（RWO），写入必须用完整拼写；两者都由 summary 提供（accessModes 与 accessModeNames）。
- openebs-hostpath 是 WaitForFirstConsumer，创建后停在 Pending 是正常状态，不是失败。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/storage/TC-L3-KUBE-FRONTEND-STORAGE-CREATE-01.yaml`、`…-02.yaml`
单测：`packages/api-client/test/claim-manifests.test.ts`
句柄：persistentvolumeclaims:create、storage-create:method/name/alias/description/storage-class/snapshot/access-mode:<mode>/size/submit/error

## 后续改进

- 表单内联显示所选类型的驱动参数摘要。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-CREATE-01
- TC-L3-KUBE-FRONTEND-STORAGE-CREATE-02
