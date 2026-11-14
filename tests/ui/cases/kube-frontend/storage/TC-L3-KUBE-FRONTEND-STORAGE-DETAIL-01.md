# TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01 存储卷详情 · 八项属性顺序与取值

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/detail.md`

## 产品功能

点击列表名称进入 PVC 详情，属性块按固定顺序展示集群、项目、存储类型、容量、访问模式、持久卷、创建时间与创建者。

### 关联需求

- `prd/kube-frontend/storage/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/detail.md`](../../../../prd/kube-frontend/storage/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/detail.md`](../../../../design/kube-frontend/storage/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/detail.md`](../../../../prd/kube-frontend/storage/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在存储详情上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀、1Gi、ReadWriteOnce 的 PVC，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开存储卷列表并点击目标 PVC 的名称
2. 等待详情主区就绪
3. 读取属性标签的顺序
4. 读取集群、项目、存储类型、容量与访问模式的值

## 期望结果

- URL 以 /persistentvolumeclaims/<name> 结尾
- 八个属性标签按此顺序出现：集群、项目、存储类型、容量、访问模式、持久卷、创建时间、创建者（详情另有 状态、供应者，由 DETAIL-02 覆盖）
- 集群为 host，项目为 default，容量为 1Gi，访问模式为 RWO
- 存储类型等于创建时使用的 StorageClass；未绑定的卷持久卷与创建者显示 -

## 失败排查

- 详情显示成列表时先看路由文件夹是否同时提供 index 与 $name 路由
- 属性缺项时看 StorageDetailPage 的 Row 是否仍渲染
- 标签顺序变化时改 pages/storage.py 的断言顺序

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 属性顺序变化时改 pages/storage.py
