# 存储列表（L3）

[子模块需求](./_index.md)

## 概述

存储卷与存储卷快照共用一张列表：名称（副行是存储类型）、状态、容量、访问模式、创建时间。

## 用户故事

### US1 - 看清项目里有哪些存储卷、是否绑定 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到绑定状态、容量与访问模式**，以便 **判断有没有卷没绑上**。

**Independent Test**：打开 `…/projects/<ns>/persistentvolumeclaims`，核对五列与状态徽章。

## 验收场景

- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-04** — 已知存储卷的存储类允许扩容，当点「扩容」并把容量改大，则 `spec.resources.requests.storage` 被更新；当存储类不允许扩容，则行操作里不出现「扩容」；填入小于当前容量时提交被拦下。

- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-03** — 已知存储卷列表有数据，当对一行点「编辑信息」并填写别名，则对象的 `kubesphere.io/alias-name` 注解被更新，列表显示该别名。
- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-01** — 已知项目内有存储卷，当打开存储卷列表，则表格显示名称、状态、容量、访问模式、创建时间五列。
- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-02** — 已知项目内没有存储卷，当打开该页，则显示空态标题与说明，且不渲染表头。

## 设计目标

存储区的列表与工作负载共用同一套表格与空态规则：空列表不显示表头。

## 约束与边界

- 状态取 PVC 的 `status.phase`，存在 `Resizing` / `FileSystemResizePending` 条件时以条件类型为准。
- 访问模式显示为 `RWO`/`ROX`/`RWX`/`RWOP`。
- 快照没有访问模式列。

## UI 交互设计

- 名称列两行：名称与存储类型；名称是链接。
- 状态徽章：已绑定/就绪为成功色，等待中/扩容中为警告色，已丢失为危险色。

## 文案与校验

- 表头：名称、状态、容量、访问模式、创建时间。
- 状态文案：已绑定 / 等待中 / 已丢失 / 就绪 / 扩容中 / 等待文件系统扩容。

## 边界情况

- 未绑定存储类型的卷显示 `-`。
- 容量为空的显示 `-`。
- 快照列表不显示访问模式列。

## 明确不做

- 不做列显隐与列宽拖拽。
- 不在列表创建存储卷。
- 不做快照创建。
- 扩容已迁移，但仅对存储类声明了 `allowVolumeExpansion` 的卷开放。

## 假设

- kapis 的 `totalItems` 是切片前总数。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-LIST-01`
- `TC-L3-KUBE-FRONTEND-STORAGE-LIST-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-STORAGE-LIST-01** — 列表按五列展示存储对象。
- **FR-L3-KUBE-FRONTEND-STORAGE-LIST-02** — 空列表显示空态且不渲染表头。

## 成功标准

- **SC-L3-KUBE-FRONTEND-STORAGE-LIST-01** — 名称集合与 `kubectl get pvc -n <ns>` 一致。
