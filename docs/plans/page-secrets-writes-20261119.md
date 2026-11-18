# 保密字典写能力（项目列表 + 集群作用域）（2026-11-19）

> 本页记录：保密字典页面族的两个写入口补齐——项目列表行的「设为默认镜像仓库」，
> 以及集群级保密字典的行操作（编辑信息 / 编辑 YAML / 删除 / 设为默认）。
> 方法见[迁移指南](../legacy-ui-migration-guide.md)，模板见[单页交付模板](page-migration-template.md)。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目作用域：在列表里比较并切换默认镜像仓库；集群作用域：在跨项目列表里就地编辑或删除某条 Secret |
| 旧入口、源码 | `projects/containers/Secrets/index.jsx:85-95`（设为默认只在**详情页**）；`clusters/containers/Secrets/index.jsx:45-80`（编辑信息 / 编辑 YAML / 编辑设置 / 删除） |
| 新入口、构建 | `pages/secrets/SecretsPage.tsx`（行操作 + `SetDefaultSecretDialog`）、`pages/cluster/ClusterSecretsPage.tsx`（四个行操作 + 设为默认） |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai` + 本地 preview 5178；admin |
| 子页面与状态范围 | 列表行操作可见性（类型 / 是否已是默认 / 联邦托管）、确认框（旧默认已知/未知）、编辑与删除的按行寻址 |
| 明确排除及批准 | 不做批量设默认（默认是单值语义）；集群级不做批量删除（同配置字典批次） |
| 并行文件与安全边界 | 只改上述两个页面、新对话框、locale、该功能 PRD/design/spec/tests 与记录；E2E 创建唯一命名 Secret 并删除 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码证据 | 显示条件 | 字段/动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-SECRETS-DEFAULT-001 | `Secrets/index.jsx:85-95` | 镜像仓库类型且非默认 | 设为默认镜像仓库 | 列表行操作 + 确认框（详情页入口保留） | AC-SECRETS-LIST-04 / TC-LIST-04 | 通过 |
| LEG-SECRETS-DEFAULT-002 | 旧 store `setDefault` | 同上 | 先清旧默认再设新默认 | `secretsApi.setDefault`（已有）+ `useDefaultRegistrySecret` 查旧默认 | 同上（E2E 验证只有一个默认） | 通过 |
| LEG-CLUSTER-SECRET-001 | `clusters/containers/Secrets/index.jsx:45-80` | 非联邦托管行 | 编辑信息 / 编辑 YAML / 删除 | 集群页行操作（按行命名空间） | AC-CLUSTER_CONFIG-04 / TC-CLUSTER_CONFIG-04 | 通过 |
| LEG-CLUSTER-SECRET-002 | 同上 | 镜像仓库类型且非默认 | 设为默认镜像仓库 | 集群页行操作 + 同一确认框 | 同上 | 通过 |

## 3. 数据契约与全链路

| 能力 ID | 请求 | 返回类型 | 字段 | 显示/写 | 缺值规则 | 对账 |
| --- | --- | --- | --- | --- | --- | --- |
| 001–002 | `PATCH /api/v1/namespaces/<ns>/secrets/<old>`（置 false）+ `PATCH …/<new>`（置 true） | JSON | `secret.kubesphere.io/is-default-class` | 行操作 + 确认框 | 旧默认未知时确认按钮禁用（查询未返回） | E2E 依次断言 A=true、B=true 且 A=false |
| 003 | `PATCH/PUT/DELETE /api/v1/namespaces/<行ns>/secrets/<name>` | JSON | 整对象 / 注解 | 集群页行操作 | 按行命名空间 | E2E 回读描述注解；删除用列表确认 |
| 004 | 同 001–002（按行命名空间） | JSON | 默认标记注解 | 集群页行操作 | 同上 | 单测/E2E 覆盖 |

## 4. 交互、视觉与复用基线

- 确认框写明「将设为默认，原来标记为默认的 X 会取消标记」，并在旧默认查明前禁用确认。
- 行操作顺序：设为默认 → 编辑信息 → 编辑 YAML →（集群页）删除；联邦托管行不渲染操作。
- 复用详情页已有的 `useSetDefaultSecret` / `useDefaultRegistrySecret` 与项目页的编辑/删除对话框，不新增表单。

## 5. 编码与回归

- [x] AC/design/spec/tests 同步；生成物重跑（505 篇）。
- [x] 两条新 E2E：项目列表设默认（含旧默认取消）、集群页编辑信息回读 + 删除确认。
- [x] 复用既有 hooks；新增一个页面级确认框 `SetDefaultSecretDialog`。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 4 条原子 ID | — |
| 数据语义 | 通过 | 只有一个默认；旧默认被清；按行命名空间 | — |
| 交互与权限 | 通过 | 可见性规则、确认框、联邦保护 | 真实非 admin 403 分支未在部署验证 |
| 视觉与主题 | 部分通过 | 1280 深色截图（`secrets-set-default`、`cluster-secrets-writes`） | 1024/1600、浅色、英文 |
| 静态/类型/构建/测试 | 部分通过 | **本批文件 typecheck 0 error**；build 成功；strict 门禁 0/0 | 全量 typecheck 当前有 **9 条错误，全部在并行会话正在改的文件**（`ClusterOverviewRdmaBlock`/`ClusterOverviewTab`/`ClusterMonitorPage` 与 locale 重复键），不在本批范围 |
| 本地全栈/mlu370 | 通过 | E2E 见 §7 | — |
| 新版部署/member/全站 | 未验收 | — | 生产、member、全站串行 E2E |

## 7. E2E（mlu370，`-n 0`）

| 用例 | 结果 |
| --- | --- |
| TC-…-SECRETS-LIST-04（新增，项目列表设默认 + 旧默认取消） | 通过（9.13s） |
| TC-…-CLUSTER_CONFIG-04（新增，集群页编辑信息回读 + 删除确认） | 通过 |
| 保密字典既有用例（17 条，含列表/详情/编辑/删除/创建） | 通过（59.48s） |

复跑中发现并修掉一条**既有用例的测试侧缺陷**：`SECRETS_LIST_03` 自己构造 `ApiClient` 时用页面 origin（`secrets_page.base.split('/kube-frontend/')[0]`），请求因此丢掉 `/kube-frontend` 前缀，被 ks-apiserver 以「public base URL of /kube-frontend/」拒绝（看起来像权限问题）。改为 `ui_config.app_api` 后通过。
