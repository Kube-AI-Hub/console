# TC-L3-KUBE-FRONTEND-STORAGE-LIST-02 存储卷列表 · 空态标题与说明且无表头

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-LIST-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/list.md`

## 产品功能

项目内没有存储卷时，列表显示空态标题与说明，且不渲染表头。

### 关联需求

- `prd/kube-frontend/storage/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-02** — 已知项目内没有存储卷，当打开该页，则显示空态标题与说明，且不渲染表头。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/list.md`](../../../../design/kube-frontend/storage/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些存储卷、是否绑定 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到绑定状态、容量与访问模式**，以便 **判断有没有卷没绑上**。

**Independent Test**：打开 `…/projects/<ns>/persistentvolumeclaims`，核对五列与状态徽章。

## 前置与配置

- 目标项目没有 PVC；用例依次用 API 读取 kube-frontend-demo、kube-public、default 的 totalItems，取第一个为 0 的项目；三个都非空时跳过而不是伪造空态
- 已登录，且在 host 集群（default 是共享项目，可能被其它套件临时占用）

## 测试步骤

1. 用 API 读取该项目的 PVC 总数
2. 打开存储卷列表
3. 读取主区的 data-ai-state 与文本
4. 统计主区内的 thead 数量

## 期望结果

- API 返回 totalItems=0
- 主区 data-ai-state="empty"
- 文本包含「暂无存储卷」与「创建存储卷后，这里会列出它们。」
- 主区内 thead 数量为 0

## 失败排查

- 空态却仍有表头时看共享 Table 是否按 rows.length 分支渲染
- data-ai-state 不是 empty 时先看请求是否 403 或落到了错误态
- 项目里出现残留 tc-e2e- PVC 时先跑一次清理，再复跑

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 句柄变化时改 pages/storage.py
