# 克隆存储卷（L3）

[子模块需求](./_index.md)

## 概述

从存储卷详情复制一份数据卷。Kubernetes 用 dataSource 表达克隆：新 PVC 指向源 PVC，存储类型、访问模式与容量都由源决定，管理员只需要给新卷起名。

## 用户故事

### US1 - 复制一份现有数据 (Priority: P2)

作为 **项目成员**，我希望 **在存储卷详情里直接克隆出另一份卷**，以便 **在不重建数据的情况下做并行实验或备份验证**。

**Independent Test**：打开一个存储类型允许克隆（注解 allow-clone=true）且已绑定的存储卷详情，点「克隆」并提交名称，回读新 PVC 的 spec.dataSource 指向源卷，容量/访问模式/存储类型与源一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-STORAGE-CLONE-01** — 已知存储卷已绑定且其存储类型声明允许克隆，当在详情点「克隆」并提交名称，则创建出 spec.dataSource 指向源 PVC 的新存储卷，容量、访问模式与存储类型与源一致，成功后回到列表；存储类型未声明允许克隆或源卷未绑定时不显示该操作；新名称与源相同时本地拒绝。

## 设计目标

1. 只让填写真正需要选择的东西（名称）。
2. 能力门控来自存储类型与源卷状态，不给出会被服务端拒绝的按钮。

## 约束与边界

- 创建 `POST …/persistentvolumeclaims`，body 由 `claimCloneManifest` 生成。
- 门控：存储类型注解 `storageclass.kubesphere.io/allow-clone` 为 true，且源卷 phase 为 Bound。

## UI 交互设计

- 详情头部按钮「克隆」，弹窗只有名称字段，默认名为 `<源名>-clone`。

## 文案与校验

- 名称必填、符合 DNS-1123、不能与源同名；失败显示服务端原因。

## 边界情况

- 驱动不支持克隆（CSI 能力缺失）：服务端拒绝，弹窗显示原因。
- 源卷未绑定：不显示克隆入口。

## 明确不做

- 克隆快照（从快照创建新卷已由创建流程覆盖）。
- 跨项目克隆：dataSource 只能是同命名空间的对象。

## 假设

- 存储类型的能力注解由平台安装时写入。

## 功能需求

- **FR-L3-KUBE-FRONTEND-STORAGE-CLONE-01** — 详情「克隆」入口与克隆弹窗。

## 成功标准

- **SC-L3-KUBE-FRONTEND-STORAGE-CLONE-01** — 克隆出的 PVC dataSource 指向源卷且继承其形状。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-CLONE-01
