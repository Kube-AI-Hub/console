# TC-L3-KUBE-FRONTEND-SECRETS-LIST-04 保密字典列表 · 设为默认镜像仓库（列表入口，先说明会取消谁）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-LIST-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `list`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/list.md`

## 产品功能

列表行可把镜像仓库 Secret 设为默认：确认框写明会取消谁；确认后当前对象标记为默认、旧默认被取消；非镜像仓库与已是默认的行不出现该操作。

### 关联需求

- `prd/kube-frontend/secrets/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/list.md`](../../../../prd/kube-frontend/secrets/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-LIST-04** — 已知列表里有一条未被设为默认的镜像仓库（`kubernetes.io/dockerconfigjson`）Secret 和一条其他类型的 Secret，当打开前者的行操作，则出现「设为默认镜像仓库」，确认框写明「将设为默认，原来标记为默认的 X 会取消标记」；确认后该对象的 `secret.kubesphere.io/is-default-class` 注解变为 `true`、原先的默认对象被置为 `false`；其他类型与已是默认的行不出现该操作。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/list.md`](../../../../design/kube-frontend/secrets/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/list.md`](../../../../prd/kube-frontend/secrets/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，看清每条 Secret 的类型与规模


**Independent Test**：打开列表，读出一条 TLS 类型的 Secret：类型列显示「TLS 信息」，字段数为 2；`Opaque` 类型的显示「默认」。

## 前置与配置

- 已登录，host 集群 default 项目
- 用例创建两条 dockerconfigjson Secret（唯一命名），结束后删除

## 测试步骤

1. 用 API 创建 A、B 两条镜像仓库 Secret
2. 打开保密字典列表，搜索到 A，打开行操作，核对出现「设为默认镜像仓库」
3. 点它，确认框正文含「A」与「将设为默认」；确认
4. 轮询 API：A 的 secret.kubesphere.io/is-default-class 注解为 true
5. 对 B 执行同样操作并确认
6. 轮询 API：B 为 true 且 A 变为 false（旧默认被取消）

## 期望结果

- 列表入口存在且仅对镜像仓库类型、非默认行出现
- 确认框说明会取消旧默认；确认前旧默认已查明
- 写入后只有一条 Secret 带默认标记

## 失败排查

- 两个都为 true：没有先清旧默认（useDefaultRegistrySecret 未参与）
- 确认按钮一直禁用：旧默认查询没返回（按行命名空间查，不是页面命名空间）

## 产品改版后如何更新自动化

- 行 data-ai-row=<namespace>/<name>；菜单项「设为默认镜像仓库」；确认按钮句柄 secrets:set-default-confirm
