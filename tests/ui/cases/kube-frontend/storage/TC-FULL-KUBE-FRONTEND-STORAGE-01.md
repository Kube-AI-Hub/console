# TC-FULL-KUBE-FRONTEND-STORAGE-01 存储 · 页签切换、工作区上下文与编辑 YAML 的加载反馈

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-STORAGE-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `storage` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/_index.md`

## 产品功能

存储是一个功能区：存储卷与存储卷快照共用工作区栏，页签切换是客户端跳转不刷新文档；编辑 YAML 先弹加载框再出现编辑器。

### 关联需求

- `prd/kube-frontend/storage/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/_index.md`](../../../../prd/kube-frontend/storage/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-STORAGE-01** — 已知已登录且有项目权限，当从存储卷页签切到存储卷快照，则两次都显示对应列表（或空态），页签高亮跟随，工作区栏项目不变。
- **AC-FULL-KUBE-FRONTEND-STORAGE-02** — 已知在存储卷列表，当点「编辑 YAML」，则先出现加载对话框再出现编辑器；当取消，则对象不变。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/_index.md`](../../../../design/kube-frontend/storage/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/_index.md`](../../../../prd/kube-frontend/storage/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开存储区就能看到两张表 (Priority: P1)

作为 **项目运维**，我希望 **在同一个功能区的两个页签之间切换**，以便 **不用回侧栏找入口**。

**Independent Test**：从存储卷切到存储卷快照，核对页签高亮变化且没有整页刷新。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的 PVC，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开存储卷列表，确认目标行出现
2. 打开该行的更多操作，点「编辑 YAML」，观察加载对话框与编辑器的先后
3. 取消编辑，用 API 读取该 PVC
4. 依次点击存储卷快照、存储卷页签
5. 每次切换后读取 URL、当前页签的 aria-current、页签文案与工作区栏项目
6. 整个切换过程监听 document 类型的请求

## 期望结果

- 点「编辑 YAML」后先出现 [data-ai-id="dialog:loading"]，随后出现预填 metadata.name 的编辑器
- 取消后对话框关闭，PVC 的 resourceVersion 与打开前一致
- URL 依次落到 …/volumesnapshots、…/persistentvolumeclaims
- 两个页签各自高亮，文案为 存储卷快照 / 存储卷
- 工作区栏始终显示 default 项目
- 快照页为空态且不渲染表头；回到存储卷页目标行仍在
- 两次切换期间 document 请求数为 0

## 失败排查

- 页签切换出现 document 请求时先看 AreaTabs 的点击是否被 preventDefault
- 加载对话框没出现时先看 StorageListPage 是否在取详情前就 setDialog({kind:'loading'})
- 工作区栏为空时先看项目列表请求是否返回 200

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 句柄变化时改 pages/storage.py
