# TC-L3-KUBE-FRONTEND-STORAGE-DELETE-01 删除存储卷 · 行操作删除并确认

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-DELETE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `delete`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/delete.md`

## 产品功能

行操作「删除」要求输入对象名确认，提交后行从列表消失且 API 返回 404。

### 关联需求

- `prd/kube-frontend/storage/delete.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/delete.md`](../../../../prd/kube-frontend/storage/delete.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-DELETE-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/delete.md`](../../../../design/kube-frontend/storage/delete.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/delete.md`](../../../../prd/kube-frontend/storage/delete.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在删除存储对象上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的 PVC，用例结束后无条件删除（已删除时容忍 404）
- 只删除用例自己创建的 tc-e2e- 对象，不碰项目里已有的 PVC
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开存储卷列表并定位目标行
2. 打开目标行的更多操作并选择「删除」
3. 确认按钮在名称不完整时保持禁用
4. 输入完整对象名并提交

## 期望结果

- 对话框出现时确认按钮禁用
- 输入完整名称后确认按钮可用
- 提交后对话框关闭，目标行从列表消失
- 用 API 读取该 PVC 返回 404

## 失败排查

- 行不消失时看删除成功后是否 invalidateQueries 重新拉取
- 删除 404 但行仍在时看列表是否命中旧缓存
- 确认按钮一直禁用时看输入框是否绑定了 delete-input 句柄

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 确认框结构变化时改 pages/storage.py
