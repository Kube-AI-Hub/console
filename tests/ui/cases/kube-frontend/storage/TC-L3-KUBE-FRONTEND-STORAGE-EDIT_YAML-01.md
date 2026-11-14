# TC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01 编辑 YAML · 先加载框再预填对象，取消不变

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `edit-yaml`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/edit-yaml.md`

## 产品功能

行操作「编辑 YAML」先打开加载对话框，取到完整对象后换成预填该对象的编辑器；取消后对象不变。

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

- 由用例的 fixture 创建一个 tc-e2e- 前缀的 PVC，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开存储卷列表并定位目标行
2. 记录打开前该 PVC 的 resourceVersion
3. 打开行操作菜单，点「编辑 YAML」
4. 观察加载对话框与编辑器的先后
5. 读取编辑器内容中的 metadata.name 与 namespace
6. 点取消，再读取该 PVC

## 期望结果

- 点「编辑 YAML」后先出现 [data-ai-id="dialog:loading"]，随后才出现编辑器
- 编辑器预填对象 YAML，包含 metadata.name=<name> 与 namespace=default
- 取消后对话框关闭
- PVC 仍存在，resourceVersion 与打开前一致（没有写回）

## 失败排查

- 编辑器为空时先看详情请求是否已返回；加载框一直不消失说明请求失败
- 加载框没出现时看 onAction 是否在取详情前 setDialog({kind:'loading'})
- 取消后对象被改时看 YamlDialog 是否在未提交时也调用了 update

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 编辑器结构变化时改 pages/storage.py
