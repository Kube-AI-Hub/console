# TC-L3-KUBE-FRONTEND-STORAGE-CLONE-01 克隆存储卷

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-CLONE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `clone`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/clone.md`

## 产品功能

存储卷详情的「克隆」：按存储类型 allow-clone 门控，克隆出 dataSource 指向源卷的新 PVC。

### 关联需求

- `prd/kube-frontend/storage/clone.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/clone.md`](../../../../prd/kube-frontend/storage/clone.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-CLONE-01** — 已知存储卷已绑定且其存储类型声明允许克隆，当在详情点「克隆」并提交名称，则创建出 spec.dataSource 指向源 PVC 的新存储卷，容量、访问模式与存储类型与源一致，成功后回到列表；存储类型未声明允许克隆或源卷未绑定时不显示该操作；新名称与源相同时本地拒绝。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/clone.md`](../../../../design/kube-frontend/storage/clone.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/clone.md`](../../../../prd/kube-frontend/storage/clone.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 复制一份现有数据 (Priority: P2)

作为 **项目成员**，我希望 **在存储卷详情里直接克隆出另一份卷**，以便 **在不重建数据的情况下做并行实验或备份验证**。

**Independent Test**：打开一个存储类型允许克隆（注解 allow-clone=true）且已绑定的存储卷详情，点「克隆」并提交名称，回读新 PVC 的 spec.dataSource 指向源卷，容量/访问模式/存储类型与源一致。

## 前置与配置

- 已登录；存在存储类型声明 allow-clone 且源卷已绑定

## 测试步骤

1. 创建一个该存储类型的存储卷并等待绑定
2. 打开其详情，核对「克隆」按钮存在
3. 点克隆，提交默认名称
4. 回读克隆对象的 spec

## 期望结果

- 存储类型不允许克隆时按钮不出现

## 失败排查

- 422：访问模式用了缩写（应为完整拼写）
- 按钮缺失：类未声明 allow-clone 或源卷未绑定

## 产品改版后如何更新自动化

- 选择器：persistentvolumeclaims-detail:clone / storage-clone:name / storage-clone:submit
