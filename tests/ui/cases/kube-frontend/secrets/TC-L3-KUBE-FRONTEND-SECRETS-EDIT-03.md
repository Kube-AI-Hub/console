# TC-L3-KUBE-FRONTEND-SECRETS-EDIT-03 保密字典 · 编辑 YAML 拒绝改名

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `edit`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/edit.md`

## 产品功能

YAML 编辑器锁定名称；合法内容可提交。

### 关联需求

- `prd/kube-frontend/secrets/edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/edit.md`](../../../../prd/kube-frontend/secrets/edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-EDIT-03** — Given 打开「编辑 YAML」，When 把 `metadata.name` 改成别的名字，Then 提示「已有对象不支持改名，名称必须保持为 {name}。」且提交禁用；When 内容合法并提交，Then 对象被替换且弹窗关闭。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/edit.md`](../../../../design/kube-frontend/secrets/edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/edit.md`](../../../../prd/kube-frontend/secrets/edit.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为项目成员，在类型不可知的对象上改 YAML


**Independent Test**：对 `kubernetes.io/ssh-auth` 类型的 Secret 打开「编辑设置」，界面说明该类型没有表单编辑器；打开「编辑 YAML」修改 `data` 并保存，对象更新。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 行操作「编辑 YAML」
2. 把 metadata.name 改为另一个值
3. 改回原名称并追加一条注解后提交

## 期望结果

- 提示「已有对象不支持改名」且提交禁用
- 提交后弹窗关闭，对象带新注解

## 失败排查

- 提交后 409 说明未携带 resourceVersion

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
