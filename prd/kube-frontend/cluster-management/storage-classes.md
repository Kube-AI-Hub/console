# 存储类型（L3）

[子模块需求](./_index.md)

## 概述

集群级存储类型列表：名称（默认类型带徽标）、供应者、存储卷数、能力、回收策略、创建时间。

## 用户故事

### US1 - 确认某个存储类适合做什么 (Priority: P1)

作为 **集群管理员**，我希望 **看到供应者、回收策略与支持的能力**，以便 **判断新存储该选哪一类**。

**Independent Test**：打开存储类型页，核对默认类的徽标与各行的能力标记。

### US2 - 判断一个存储类型的行为 (Priority: P1)

作为 **集群管理员**，我希望 **看到存储类型的绑定模式、回收策略与能力开关**，以便 **判断在它上面申请卷会得到什么行为**。

**Independent Test**：从列表点进存储类型详情，核对绑定模式与能力开关与该对象一致。

### US3 - 安全地创建、调整和清理存储类型 (Priority: P2)

作为 **集群管理员**，我希望 **在控制台创建存储类型、改别名/YAML、切换默认类和卷能力，并在确认没有存储卷使用时删除它**，以便 **不必去 kubectl 改基础设施，也不会把仍在使用的类删掉**。

**Independent Test**：创建临时类后列表出现；编辑别名与 YAML 后对象回读一致；设为默认后只有它带默认徽标；卷能力开关与列表徽标一致；把临时类删掉；对「被 PVC 使用」的类，删除入口置灰并说明原因；批量删除时仅有 PVC 的类被跳过并汇总。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 已知集群有多个存储类型，当打开存储类型页，则显示名称、供应者、存储卷数、能力、回收策略、创建时间六列；标了默认的那一行带「默认」徽标；能力列只列出该类型实际支持的能力（不支持的不显示），且与 API 的 `allowVolumeExpansion` 等字段一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02** — 已知集群中有存储类型，当点击名称进入详情，则显示供应者、回收策略、绑定模式、创建时间、是否允许扩容/克隆/快照与已绑定声明数，并列出该驱动声明的参数（无参数时明确说明）；这些值与该存储类型对象一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03** — 已知一个存储类型被若干存储卷使用，当打开该存储类型详情，则「关联存储卷」列出这些存储卷的名称、命名空间、状态与容量；行数等于 `storageClassName` 等于该类型的 PVC 数；名称链接到该卷所属项目内的存储卷详情；没有任何关联存储卷时给出明确说明。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04** — Given 打开存储类型列表并点「创建存储类型」，When 填写合法名称、供应者，选择回收策略与绑定模式并勾选扩容/克隆/快照，Then 发出 POST /apis/storage.k8s.io/v1/storageclasses，body 含内联供应者、回收策略、绑定模式与仅被勾选的 allowVolumeExpansion/能力注解；成功后列表出现该行。名称为空/非法/重复或供应者为空时提交被拦下并显示对应提示；取消不发请求。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-05** — Given 打开一个存储类型（列表行或详情），When 编辑信息（别名/描述，merge-patch 只发 metadata.annotations，清空键为 null）、编辑 YAML（整对象 PUT 带 resourceVersion）、设为默认（清掉旧默认后写 storageclass.kubernetes.io/is-default-class）、或切换卷能力（克隆/快照写注解，扩容写 spec.allowVolumeExpansion，关闭时移除而非写 false），Then 保存后列表/详情回读一致；设为默认前有「会替换现有默认类型」的提示；能力徽标与对象字段一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-06** — Given 一个存储类型被 N 个存储卷（PVC）使用（按集群级 PVC 实查，不信 pvc-count 注解），When 打开其列表行操作或详情，Then 删除入口置灰并显示「有 N 个 PVC 在使用」的原因，不发出 DELETE；Given 选择若干类批量删除并确认，Then 只删除无 PVC 的类，结果区汇总「成功/跳过（有 PVC）/失败」计数，被跳过的类仍在；Given PVC 列表读取失败，Then 所有删除入口停用并说明「无法确认是否安全」，不把读取失败当作「没被使用」。

## 设计目标

让「这个存储类能做什么」一眼可读，而不是靠比较颜色推断。

## 约束与边界

- 读集群级 `storage.k8s.io/v1/storageclasses`，无 namespace 段。
- 默认类型取 `storageclass.kubernetes.io/is-default-class` 注解。
- 回收策略与绑定模式未设置时按 Kubernetes 默认值显示（`Delete` / `Immediate`）。

## UI 交互设计

名称旁带「默认」徽标；能力列用徽标列出支持项，无支持项显示 `-`。

- 列表：右上「创建存储类型」；多选 + 「批量删除」；行操作「编辑信息 / 编辑 YAML / 设为默认（已是默认则不出现，确认提示会替换现有默认）/ 删除（有 PVC 使用时置灰）」；有不可删类时表格上方显示原因条。
- 详情：右上「编辑信息 / 编辑 YAML / 设为默认（已是默认时禁用，附替换提示）/ 卷功能 / 删除（有 PVC 或读取失败时禁用 + 可见原因）」。
- 创建对话框：名称、供应者、回收策略（Delete/Retain）、绑定模式（Immediate/WaitForFirstConsumer）、扩容/克隆/快照复选框；名称为空/非法/重复、供应者为空各自显示提示。
- 卷功能对话框：三个复选框，保存后列表徽标与详情字段同步。
- 批量删除：确认后逐条删除，结果区显示成功/跳过（有 PVC）/失败计数；全部被跳过时说明「均在使用」。

详情页在属性与驱动参数之后追加「关联存储卷」区块：表头为名称、命名空间、状态、容量；名称可点进项目内的存储卷详情。区块标题旁显示实际条数。

## 文案与校验

- 列：名称、供应者、存储卷数、能力、回收策略、创建时间。
- 能力：扩容 / 克隆 / 快照。
- 关联存储卷列：名称（链接）、命名空间、状态、容量；空态「该存储类型还没有关联的存储卷。」
- 状态沿用存储列表的中文用词（已绑定 / 等待中 / 已丢失 / 扩容中）。

## 边界情况

- 平台未上报存储卷数时显示 `-`（不是 0）。
- 没有能力字段时能力列为 `-`。
- 类上标注的「已绑定声明数」来自注解、可能滞后；「关联存储卷」区块显示的是按 `storageClassName` 实查的结果，两者不一致时以列表为准并在文档里说明。
- 引用该类的 PVC 超过一次批量读取的上限（当前 500 条）时只展示已读到的部分，不假装完整。
- PVC 列表读取失败：删除入口停用并显示「无法确认是否安全」；不把失败当 0。批量删除时不渲染批量操作。
- 设为默认但已有默认：确认提示之后才提交；旧默认的所有拼写注解被清空，不出现两个默认徽标。
- 能力关闭：从对象移除注解/字段（而不是保留 false），避免「能力列不显示但对象里写着 false」的歧义。

## 明确不做

- 在关联存储卷列表里删除或编辑存储卷：这里只是入口，操作回项目存储页。

## 重纳能力（2026-11-17 产品复核）

原登记「创建与编辑存储类型不做（属基础设施操作）」「设为默认类型的操作不做」。**2026-11-17 产品复核决定重纳**（N-12，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)）。

交付（2026-11-17，AC-04/05/06）：

1. 创建存储类型（名称、供应者、回收策略、绑定模式、卷功能开关）。
2. 编辑信息、编辑 YAML、删除、批量删除、设为默认。
3. 设为默认：清掉旧默认（三种注解拼写）后写 `storageclass.kubernetes.io/is-default-class`，操作前提示会替换现有默认。
4. 卷功能管理（克隆/快照注解、扩容 spec.allowVolumeExpansion）；关闭时移除字段而不是写 false。

约束（**老实现有、新实现必须保留**）：

- **有 PVC 依赖时删除被拦截**：删除前按 `storageClassName` 统计关联存储卷数，非零时不提交，提示「有 N 个 PVC 在使用该存储类型」。这条对应详情页已有的「关联存储卷」区块，两处口径一致。
- 删除校验读**实时 PVC 列表**，不读可能滞后的 `kubesphere.io/pvc-count` 注解；PVC 读取失败时删除入口停用（无法证明安全），不当作「没被使用」。
- 设为默认时若已有默认类，提示「将替换现有默认类」，不静默切换。

## 假设

- 克隆与快照能力由存储类字段或其注解声明。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 列表六列，能力只显示支持项。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02** — 默认类型带徽标。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03** — 详情按 `storageClassName` 列出关联的存储卷，含项目内详情链接与空态。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04** — 列表与详情提供创建、编辑信息/YAML、设为默认、卷功能开关、单条与批量删除。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-05** — 删除前按实时 PVC 统计拦截；读取失败停用删除；批量跳过并汇总。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 名称集合与 `kubectl get storageclass` 一致。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02** — 关联存储卷行数 = 该 `storageClassName` 的 PVC 数；每行名称链接含项目与 `persistentvolumeclaims/<name>` 段。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03** — 创建/编辑/默认/能力开关后对象与页面回读一致；被 PVC 使用的类在单条与批量两条路径都不会被 DELETE；批量汇总计数与实际结果一致。
