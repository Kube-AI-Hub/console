# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04 存储类型写能力：创建、编辑、默认、卷功能、删除与 PVC 守卫

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `storage-classes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{KA_CLUSTER}/storageclasses`
- **需求**: `prd/kube-frontend/cluster-management/storage-classes.md`

## 产品功能

存储类型列表可创建（名称/供应者/回收策略/绑定模式/能力）；详情与行操作可编辑信息/YAML、设为默认、切换卷功能；删除以实时 PVC 统计为前置（有 PVC 使用的类不可删，批量跳过并汇总；PVC 读取失败时删除停用）。

### 关联需求

- `prd/kube-frontend/cluster-management/storage-classes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/storage-classes.md`](../../../../prd/kube-frontend/cluster-management/storage-classes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04** — Given 打开存储类型列表并点「创建存储类型」，When 填写合法名称、供应者，选择回收策略与绑定模式并勾选扩容/克隆/快照，Then 发出 POST /apis/storage.k8s.io/v1/storageclasses，body 含内联供应者、回收策略、绑定模式与仅被勾选的 allowVolumeExpansion/能力注解；成功后列表出现该行。名称为空/非法/重复或供应者为空时提交被拦下并显示对应提示；取消不发请求。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-05** — Given 打开一个存储类型（列表行或详情），When 编辑信息（别名/描述，merge-patch 只发 metadata.annotations，清空键为 null）、编辑 YAML（整对象 PUT 带 resourceVersion）、设为默认（清掉旧默认后写 storageclass.kubernetes.io/is-default-class）、或切换卷能力（克隆/快照写注解，扩容写 spec.allowVolumeExpansion，关闭时移除而非写 false），Then 保存后列表/详情回读一致；设为默认前有「会替换现有默认类型」的提示；能力徽标与对象字段一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-06** — Given 一个存储类型被 N 个存储卷（PVC）使用（按集群级 PVC 实查，不信 pvc-count 注解），When 打开其列表行操作或详情，Then 删除入口置灰并显示「有 N 个 PVC 在使用」的原因，不发出 DELETE；Given 选择若干类批量删除并确认，Then 只删除无 PVC 的类，结果区汇总「成功/跳过（有 PVC）/失败」计数，被跳过的类仍在；Given PVC 列表读取失败，Then 所有删除入口停用并说明「无法确认是否安全」，不把读取失败当作「没被使用」。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/storage-classes.md`](../../../../design/kube-frontend/cluster-management/storage-classes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/storage-classes.md`](../../../../prd/kube-frontend/cluster-management/storage-classes.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 安全地创建、调整和清理存储类型 (Priority: P2)

作为 **集群管理员**，我希望 **在控制台创建存储类型、改别名/YAML、切换默认类和卷能力，并在确认没有存储卷使用时删除它**，以便 **不必去 kubectl 改基础设施，也不会把仍在使用的类删掉**。

**Independent Test**：创建临时类后列表出现；编辑别名与 YAML 后对象回读一致；设为默认后只有它带默认徽标；卷能力开关与列表徽标一致；把临时类删掉；对「被 PVC 使用」的类，删除入口置灰并说明原因；批量删除时仅有 PVC 的类被跳过并汇总。

## 前置与配置

- 已登录，且在 host 集群；集群有 3 个以上存储类型、至少一个 PVC
- 用例自建唯一临时存储类型（无效供应者可接受，Kubernetes 不校验）与一个引用它的 Pending PVC；结束后删除 PVC、临时类，恢复原默认类

## 测试步骤

1. 打开存储类型列表，点「创建存储类型」，填唯一名称与供应者、勾选扩容/克隆/快照，提交
2. 轮询 API 确认对象存在、spec.allowVolumeExpansion=true、两个能力注解；列表出现该行且徽标与设置一致
3. 行操作编辑信息，改别名与描述；回读注解
4. 编辑 YAML，在别名注解行末追加 -yaml；回读
5. 详情切换卷功能（关闭克隆、开启扩容），回读注解与 spec
6. 设为默认：记录当前默认类；对本类执行并确认；断言本类带默认徽标、旧默认注解被清空；恢复旧默认
7. 在某命名空间创建引用本类的 Pending PVC；返回列表，断言本类行删除入口不可用；打开详情，删除按钮禁用并显示「有 1 个 PVC 在使用」
8. 再创建一个无 PVC 的临时类，两个一起选中批量删除：结果汇总成功 1 / 跳过 1，被使用类仍在
9. 删除 PVC 后再删除被使用的临时类，确认从 API 与列表消失

## 期望结果

- 创建请求为 POST /apis/storage.k8s.io/v1/storageclasses，仅写被勾选能力
- 编辑信息为只含 annotations 的 merge-patch（清空键 null）；YAML 为整对象 PUT
- 设为默认后旧默认（三种拼写）被清空、只有一个默认徽标；跨行无两个默认
- 有 PVC 使用的类单条与批量都不会被 DELETE；汇总计数正确
- PVC 读取失败时删除入口停用（单测覆盖，E2E 通过代理模拟不做）

## 失败排查

- 创建 405：确认写路径是 /apis/storage.k8s.io/v1，不是 kapis resources 代理
- 设为默认后两个徽标：确认 setDefault 先清旧默认的三种注解拼写
- 关闭能力后徽标仍在：确认 setFeatures 对 false 发 null 移除（不是写 'false' 字符串）
- 有 PVC 仍可删：确认守卫用实时 PVC 列表而不是 pvc-count 注解

## 产品改版后如何更新自动化

- 句柄：storageclasses:create/create-name/create-provisioner/create-expand|clone|snapshot/create-submit、:select:<name>、:bulk-delete、:batch-result、sc-detail:edit-info|edit-yaml|set-default|features|delete|delete-protected、:features-dialog、:feature:<key>
