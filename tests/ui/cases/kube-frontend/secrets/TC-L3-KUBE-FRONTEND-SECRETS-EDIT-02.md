# TC-L3-KUBE-FRONTEND-SECRETS-EDIT-02 保密字典 · 编辑设置锁定类型并更新数据

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `edit`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/edit.md`

## 产品功能

编辑设置中类型不可改；子表单打开时提交禁用。

### 关联需求

- `prd/kube-frontend/secrets/edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/edit.md`](../../../../prd/kube-frontend/secrets/edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-EDIT-02** — Given 一条用户名密码类型的 Secret，When 打开「编辑设置」，Then 类型选择器禁用并显示当前类型；修改密码后保存，`data.password` 更新而 `data.username`、`type` 不变；子表单展开时提交按钮禁用。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/edit.md`](../../../../design/kube-frontend/secrets/edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/edit.md`](../../../../prd/kube-frontend/secrets/edit.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，改用户名密码而不是重建对象


**Independent Test**：打开「编辑设置」，修改密码值并确认；详情里密码变为新值，用户名与类型保持不变。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 存在一条 basic-auth 类型对象

## 测试步骤

1. 行操作「编辑设置」
2. 读取类型选择器
3. 点击某个键的编辑按钮
4. 修改密码后保存

## 期望结果

- 类型选择器为禁用状态且显示当前类型
- 子表单打开时确认按钮禁用
- data.password 更新，data.username 与 type 不变

## 失败排查

- 类型被改动时检查传给 SecretSettingsEditor 的 lockType

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
