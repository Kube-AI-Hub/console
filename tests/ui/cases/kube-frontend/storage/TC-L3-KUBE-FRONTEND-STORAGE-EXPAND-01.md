# TC-L3-KUBE-FRONTEND-STORAGE-EXPAND-01 存储卷 · 扩容与按存储类门控

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-EXPAND-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `expand`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/list.md`

## 产品功能

只有存储类允许扩容的存储卷才出现「扩容」；填小值被拦下，填大值写入 spec.resources.requests.storage。

### 关联需求

- `prd/kube-frontend/storage/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-04** — 已知存储卷的存储类允许扩容，当点「扩容」并把容量改大，则 `spec.resources.requests.storage` 被更新；当存储类不允许扩容，则行操作里不出现「扩容」；填入小于当前容量时提交被拦下。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/list.md`](../../../../design/kube-frontend/storage/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些存储卷、是否绑定 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到绑定状态、容量与访问模式**，以便 **判断有没有卷没绑上**。

**Independent Test**：打开 `…/projects/<ns>/persistentvolumeclaims`，核对五列与状态徽章。

## 前置与配置

- 由夹具创建一个使用可扩容存储类的 tc-e2e- 存储卷，用例结束无条件删除
- 另外创建一个使用不可扩容存储类的存储卷，用于核对入口是否隐藏
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开列表，对不可扩容那个卷打开行操作，读取条目
2. 对可扩容的卷打开行操作，读取条目
3. 点「扩容」，先填小于当前容量的值并确认
4. 再填更大的值并确认
5. 用 API 核对 spec.resources.requests.storage

## 期望结果

- 不可扩容的卷不出现「扩容」
- 可扩容的卷出现「扩容」
- 小于当前容量时提交被拦下并给出提示
- 更大的值写入成功

## 失败排查

- 入口恒显示或恒隐藏时看 useExpandableClasses 的映射
- 写入失败时确认存储类设置了 allowVolumeExpansion

## 产品改版后如何更新自动化

- 存储类特性变化时改 api-client 的 storageClassExpands
