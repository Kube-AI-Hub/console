# TC-L3-KUBE-FRONTEND-SECRETS-LIST-01 保密字典 · 列表列与类型显示

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/list.md`

## 产品功能

列表显示名称、项目、类型、字段数、创建时间，类型显示为中文名。

### 关联需求

- `prd/kube-frontend/secrets/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/list.md`](../../../../prd/kube-frontend/secrets/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-LIST-01** — Given 项目内有多条 Secret，When 打开列表，Then 每行显示名称（别名替换名称，第二行为描述或 `-`）、项目、类型、字段数、创建时间；`Opaque` 显示「默认」，`kubernetes.io/tls` 显示「TLS 信息」，`kubernetes.io/dockerconfigjson` 显示「镜像仓库信息」，`kubernetes.io/basic-auth` 显示「用户名和密码」，其他类型原样显示。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/list.md`](../../../../design/kube-frontend/secrets/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/list.md`](../../../../prd/kube-frontend/secrets/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，看清每条 Secret 的类型与规模


**Independent Test**：打开列表，读出一条 TLS 类型的 Secret：类型列显示「TLS 信息」，字段数为 2；`Opaque` 类型的显示「默认」。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 至少存在一条 TLS 类型的对象

## 测试步骤

1. 打开列表
2. 核对表头
3. 读取 TLS 类型对象的类型列与字段数列

## 期望结果

- 表头依次为 名称、项目、类型、字段数、创建时间
- TLS 对象的类型列显示「TLS 信息」
- 字段数等于 data 的键数

## 失败排查

- 类型显示异常时先看 secretTypeLabel 映射与对象本身的 type 字段

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
