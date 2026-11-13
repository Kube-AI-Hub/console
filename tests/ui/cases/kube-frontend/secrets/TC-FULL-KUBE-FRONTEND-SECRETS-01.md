# TC-FULL-KUBE-FRONTEND-SECRETS-01 保密字典 · 四种类型的详情结构

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-SECRETS-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `secrets` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/_index.md`

## 产品功能

四种类型的 Secret 在详情页按各自结构展示，且默认遮挡。

### 关联需求

- `prd/kube-frontend/secrets/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/_index.md`](../../../../prd/kube-frontend/secrets/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-SECRETS-01** — Given 项目内已有 Opaque / TLS / 镜像仓库 / 用户名密码四种 Secret，When 依次打开它们的详情，Then 每种类型的数据区都按该类型的结构展示（用户名密码显示两行、TLS 显示证书与私钥两块、镜像仓库逐条显示地址与账号），且初始均为遮挡状态。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/_index.md`](../../../../design/kube-frontend/secrets/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/_index.md`](../../../../prd/kube-frontend/secrets/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，看清本项目的敏感凭据有哪些


**Independent Test**：打开列表，确认能看到每条 Secret 的名称（有别名时显示别名）、描述、类型、字段数与创建时间；类型列把 `Opaque` 显示为「默认」、`kubernetes.io/tls` 显示为「TLS 信息」。

### US2 - 作为项目成员，创建一条用户名密码凭据


**Independent Test**：创建弹窗 → 填名称 → 数据设置里类型选「用户名和密码」→ 填用户名与密码 → 提交；列表出现该条，详情里用户名与密码默认以 `*` 遮挡，点眼睛后显示明文。

### US3 - 作为项目成员，查看但不出于意外泄露某个 Secret 的值


**Independent Test**：打开任意 Secret 详情，值全部以与原文等长的 `*` 显示；点击「显示明文」后才出现真实内容；刷新页面后又回到遮挡状态。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 用例会创建 Opaque / TLS / dockerconfigjson / basic-auth 四条对象，结束后删除

## 测试步骤

1. 依次打开四条对象的详情，记录数据区结构
2. 对每一条读取遮挡状态的文本
3. 点击「显示明文」后再次读取

## 期望结果

- Opaque 显示键值列表，条目数等于 data 的键数
- TLS 显示「证书」「私钥」两块
- dockerconfigjson 显示 registry 地址与用户名/密码/邮箱
- basic-auth 显示「用户名」「密码」
- 四次打开时数据区文本都不含明文（全部为 *）
- 点击「显示明文」后出现明文

## 失败排查

- 先确认 Secret 已创建成功（kubectl get secret）
- 遮挡断言失败时检查 data-ai-id="secret-detail:toggle-values" 的 aria-pressed

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
