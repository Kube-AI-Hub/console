# TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02 配置字典 · 编辑设置拒绝重复键

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `edit`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/edit.md`

## 产品功能

数据编辑器拒绝空键、重复键与含斜杠的键。

### 关联需求

- `prd/kube-frontend/configmaps/edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/edit.md`](../../../../prd/kube-frontend/configmaps/edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02** — Given 编辑设置弹窗打开，When 把某个键改名成已存在的键，Then 提示重复且不提交，原有键值不丢失。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/edit.md`](../../../../design/kube-frontend/configmaps/edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/edit.md`](../../../../prd/kube-frontend/configmaps/edit.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，增删配置项


**Independent Test**：打开编辑设置，新增一个键、修改一个已有键的值、删除另一个键，提交后详情与 `kubectl get` 一致。

## 前置与配置

- 已登录
- 项目 default 中至少存在一个配置字典

## 测试步骤

1. 打开行操作「编辑设置」
2. 添加一条键与已有键同名
3. 保存

## 期望结果

- 提示键名重复
- 不提交，原有键值不丢失

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
