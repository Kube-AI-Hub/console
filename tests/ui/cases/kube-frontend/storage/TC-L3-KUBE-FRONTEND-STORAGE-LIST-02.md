# TC-L3-KUBE-FRONTEND-STORAGE-LIST-02 存储 · 空项目不渲染表头

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-LIST-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/list.md`

## 产品功能

['没', '有', '存', '储', '卷', '时', '显', '示', '空', '态', '标', '题', '与', '说', '明', '，', '且', '不', '渲', '染', '表', '头', '。']

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

- 已登录，且在 host 集群中一个没有存储卷的项目空间
- 先通过 API 确认该项目确实没有存储卷

## 测试步骤

1. 打开该项目的存储卷列表
2. 读取页面状态与空态文案
3. 统计表头数量

## 期望结果

- data-ai-state 为 empty
- 显示空态标题与说明
- thead 数量为 0

## 失败排查

- 表头仍存在时看共享 Table 的 loading || rows.length > 0 条件

## 产品改版后如何更新自动化

- 空态文案变化时改 packages/locales/src/index.ts
