# TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03 配置字典 · 编辑 YAML 校验与提交

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `edit`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/edit.md`

## 产品功能

YAML 编辑拒绝改名与非法语法，合法时整对象替换。

### 关联需求

- `prd/kube-frontend/configmaps/edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/edit.md`](../../../../prd/kube-frontend/configmaps/edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03** — Given 编辑 YAML 打开，When YAML 中的名称与当前对象不一致，Then 拒绝提交；When YAML 合法且名称一致，Then 提交后详情刷新为新内容。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/edit.md`](../../../../design/kube-frontend/configmaps/edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/edit.md`](../../../../prd/kube-frontend/configmaps/edit.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为项目成员，直接用 YAML 修改任意字段


**Independent Test**：打开编辑 YAML，改动一个键值后提交，对象被替换为 YAML 的内容。

## 前置与配置

- 已登录
- 项目 default 中至少存在一个配置字典

## 测试步骤

1. 打开行操作「编辑 YAML」
2. 把 metadata.name 改成别的名称并提交
3. 改回原名并修改一个值后提交

## 期望结果

- 改名时拒绝提交并提示
- 合法提交后详情显示新值

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
