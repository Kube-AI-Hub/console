# TC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01 存储 · 编辑 YAML 先弹加载框

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `edit-yaml`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/edit-yaml.md`

## 产品功能

['点', '击', '编', '辑', None, 'Y', 'A', 'M', 'L', None, '后', '先', '出', '现', '加', '载', '对', '话', '框', '，', '再', '出', '现', '预', '填', '当', '前', '对', '象', '的', '编', '辑', '器', '；', '取', '消', '不', '修', '改', '对', '象', '。']

### 关联需求

- `prd/kube-frontend/storage/edit-yaml.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/edit-yaml.md`](../../../../prd/kube-frontend/storage/edit-yaml.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/edit-yaml.md`](../../../../design/kube-frontend/storage/edit-yaml.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/edit-yaml.md`](../../../../prd/kube-frontend/storage/edit-yaml.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在编辑 YAML上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 由夹具创建一个 tc-e2e- 前缀的存储卷，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 在列表对该行点「编辑 YAML」
2. 观察加载对话框
3. 等待编辑器出现并读取内容
4. 点取消

## 期望结果

- 点击后立即出现 data-ai-id=dialog:loading
- 编辑器预填包含该对象名
- 取消后对象仍存在且内容未变

## 失败排查

- 没有加载框说明读取详情的顺序被改成了先取后弹

## 产品改版后如何更新自动化

- 弹窗结构变化时改 pages/storage.py
