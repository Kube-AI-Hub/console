# TC-L3-KUBE-FRONTEND-SECRETS-CREATE-03 保密字典 · 切换类型清空数据与 YAML 模式

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/create.md`

## 产品功能

切换类型清空数据并提示；YAML 模式带出已填内容。

### 关联需求

- `prd/kube-frontend/secrets/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/create.md`](../../../../prd/kube-frontend/secrets/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-CREATE-03** — Given 在数据设置中切换到其他类型，Then 已填数据被清空并显示「切换类型会清空已填写的数据」；Given 切到 YAML 模式，Then 表单已填的内容（名称、别名、描述、类型、数据）出现在初始文档中。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/create.md`](../../../../design/kube-frontend/secrets/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/create.md`](../../../../prd/kube-frontend/secrets/create.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为项目成员，粘贴一份现成的 YAML 创建


**Independent Test**：创建 → 切到 YAML 模式 → 粘贴含 `type: kubernetes.io/basic-auth` 与 `data` 的对象 → 提交；对象按 YAML 内容创建。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 创建 → 名称 → 下一步 → 在 Opaque 下添加一个键值对
2. 切换类型为 TLS
3. 切到 YAML 模式并读取初始文档

## 期望结果

- 已填数据被清空
- 显示「切换类型会清空已填写的数据。」
- 初始文档包含名称、类型与 data

## 失败排查

- YAML 初始文档缺字段时检查 template 的构造

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
