# TC-L3-KUBE-FRONTEND-STORAGE-DELETE-01 存储 · 删除存储卷

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-DELETE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `delete`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/delete.md`

## 产品功能

['确', '认', '删', '除', '后', '对', '话', '框', '关', '闭', '，', '该', '行', '消', '失', '，', '对', '象', '在', None, 'A', 'P', 'I', None, '上', '也', '不', '存', '在', '。']

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

- 由夹具创建一个 tc-e2e- 前缀的存储卷
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开列表并定位该行
2. 行操作点删除并确认
3. 核对行消失
4. 用 API 核对对象返回 404

## 期望结果

- 确认后对话框关闭
- 该行不再出现在列表中
- API 返回 404

## 失败排查

- 行仍在时看列表是否重新拉取

## 产品改版后如何更新自动化

- 删除确认文案变化时改 locales
