# 创建存储卷（L3）

[子模块需求](./_index.md)

## 概述

项目内的持久卷声明有两个来源：由存储类型直接供给，或从已有的卷快照恢复。两者放在同一个入口下，因为对一个想拿到可用存储的人来说它们是同一件事的两个分支，而恢复分支在别处没有入口。

## 用户故事

### US1 - 一次填完就能用 (Priority: P1)

作为 **项目成员**，我希望 **在列表上直接创建存储卷，并看到存储类型支持的模式与容量范围**，以便 **一次提交就得到能挂载的卷，而不是先建错再改**。

**Independent Test**：在项目存储卷列表点「创建存储卷」，填写名称与容量后提交，回读该 PVC 的 spec（存储类型、访问模式、容量）与表单一致；切换为「从快照创建」时存储类型字段消失并出现快照选择。

## 验收场景

- **AC-L3-KUBE-FRONTEND-STORAGE-CREATE-01** — 已知项目内存在存储类型（含集群默认类型），当在存储卷列表点「创建存储卷」并提交名称、存储类型、访问模式与容量，则创建出对应的 PersistentVolumeClaim，回读 spec.storageClassName、spec.accessModes、spec.resources.requests.storage 与表单一致，列表出现该行；存储类型留空时请求不带 storageClassName（由集群默认类型决定）；访问模式选项来自所选存储类型声明的支持模式，未声明时给出 Kubernetes 的四种模式；容量超出该类型声明的范围时在本地拒绝并说明范围。
- **AC-L3-KUBE-FRONTEND-STORAGE-CREATE-02** — 已知创建方式切到「从快照创建」，当选择快照并提交，则请求的 spec.dataSource 指向该 VolumeSnapshot 且不带 storageClassName；项目内没有就绪快照时给出「还没有就绪的快照」说明，而不是空下拉。

## 设计目标

1. 表单字段由存储类型驱动：支持的模式、容量上下限都取自该类型，而不是猜。
2. 恢复分支如实说明依赖：没有就绪快照时说明原因，不提供空下拉。

## 约束与边界

- 提交 `POST /api/v1/namespaces/<ns>/persistentvolumeclaims`（经 api-client 的 resourceApi.create）。
- 名称遵循 DNS-1123；容量单位为 GiB，范围来自存储类型 parameters 的 minSize/maxSize/stepSize（缺省 0/2048/1）。
- 访问模式的完整拼写（ReadWriteMany）用于写入；列表列仍显示缩写（RWX）。

## UI 交互设计

- 弹窗字段顺序：创建方式 → 名称 → 别名 → 描述 → 存储类型（或快照）→ 访问模式（多选）→ 容量。
- 切换存储类型会重置不可用的访问模式；切换创建方式会隐藏/显示存储类型与快照字段。

## 文案与校验

- 名称必填且符合 DNS-1123；至少一种访问模式；容量必填、为正且落在范围内；从快照创建时必须选择快照。
- 失败时显示服务端原因（例如存储类型不接受该容量），不关闭弹窗。

## 边界情况

- 存储类型列表读取失败：表单仍可用（可选择留空使用默认类型），提交失败时显示服务端原因。
- 别名与描述写入 kubesphere.io/alias-name 与 kubesphere.io/description 注解，未填写时不写注解。
- 容量为 0 或非数字：本地拒绝，不发请求。

## 明确不做

- 就地扩容：属详情的「扩容」操作，已单独迁移。
- 选择具体持久卷（PV 预绑定）：老 console 的新建表单不提供，属高级 YAML 场景。
- 从其他项目的快照恢复：快照是命名空间资源，跨项目恢复不在本页。

## 假设

- 集群至少存在一个存储类型；没有存储类型时创建会被服务端拒绝，页面如实显示原因。

## 功能需求

- **FR-L3-KUBE-FRONTEND-STORAGE-CREATE-01** — 存储卷列表主操作「创建存储卷」与创建弹窗（新建/从快照）。
- **FR-L3-KUBE-FRONTEND-STORAGE-CREATE-02** — 存储类型驱动的访问模式与容量范围。

## 成功标准

- **SC-L3-KUBE-FRONTEND-STORAGE-CREATE-01** — 创建后回读的 spec 与表单一致；两个分支（新建/从快照）都能提交出结构正确的对象。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-CREATE-01
- TC-L3-KUBE-FRONTEND-STORAGE-CREATE-02
