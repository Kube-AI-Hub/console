# TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01 配置字典 · 编辑信息只改注解

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `edit`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/edit.md`

## 产品功能

编辑信息弹窗中名称只读，别名与描述可改。

### 关联需求

- `prd/kube-frontend/configmaps/edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/edit.md`](../../../../prd/kube-frontend/configmaps/edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01** — Given 编辑信息弹窗打开，When 名称被尝试修改，Then 该字段只读；When 别名不符合规则，Then 提示「别名无效…」且不提交。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/edit.md`](../../../../design/kube-frontend/configmaps/edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/edit.md`](../../../../prd/kube-frontend/configmaps/edit.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，修改配置字典的别名与描述


**Independent Test**：打开编辑信息，改别名后提交，列表与详情的别名随之变化，`kubectl get` 的注解已更新。

## 前置与配置

- 已登录
- 项目 default 中至少存在一个配置字典

## 测试步骤

1. 打开行操作「编辑信息」
2. 尝试修改名称
3. 清空别名后提交

## 期望结果

- 名称字段为禁用状态
- 提交后 kubectl get 的 kubesphere.io/alias-name 被移除，description 更新

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
