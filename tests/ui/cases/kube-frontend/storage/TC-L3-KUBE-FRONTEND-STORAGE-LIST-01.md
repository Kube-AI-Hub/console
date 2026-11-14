# TC-L3-KUBE-FRONTEND-STORAGE-LIST-01 存储卷列表 · 五列与可点击名称

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/list.md`

## 产品功能

存储卷列表以表格展示名称、状态、容量、访问模式与创建时间，名称是进入详情的链接。

### 关联需求

- `prd/kube-frontend/storage/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-01** — 已知项目内有存储卷，当打开存储卷列表，则表格显示名称、状态、容量、访问模式、创建时间五列。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/list.md`](../../../../design/kube-frontend/storage/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些存储卷、是否绑定 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到绑定状态、容量与访问模式**，以便 **判断有没有卷没绑上**。

**Independent Test**：打开 `…/projects/<ns>/persistentvolumeclaims`，核对五列与状态徽章。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀、1Gi、ReadWriteOnce 的 PVC，用例结束后无条件删除
- PVC 允许停在 Pending：列表列与名称链接不依赖绑定状态
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开存储卷列表，等待主区离开 loading
2. 核对表头顺序
3. 读取目标行的名称链接与行内状态、容量、访问模式
4. 点击名称进入详情

## 期望结果

- 表头依次为 名称、状态、容量、访问模式、创建时间
- 目标行出现，名称是链接且 data-ai-id 为 persistentvolumeclaims:open:<name>
- 行内显示状态徽章、1Gi 与 RWO（不要求已绑定：无 provisioner 时 PVC 停在 Pending 同样算通过）
- 点击名称后 URL 以 /persistentvolumeclaims/<name> 结尾且详情主区就绪

## 失败排查

- 行不存在时先确认 PVC 已创建，再用搜索框定位；新对象的创建时间排序在最前
- 名称不可点时检查 StorageListPage 的 name 列是否仍输出 <a>
- 表头少列时确认视口宽度不小于 1280（访问模式与创建时间在 xl 才显示）

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 句柄变化时改 pages/storage.py
