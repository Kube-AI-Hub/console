# 保密字典（L2）

## 概述

项目内的 Secret 管理页，替代老控制台 `配置 → 保密字典`（`/clusters/:cluster/projects/:namespace/secrets`）。Secret 与配置字典一样是「键值对 + 注解」，区别在于**值必须保密**、**类型决定结构**：TLS 必须有 `tls.crt`/`tls.key`，镜像仓库必须有 `.dockerconfigjson`，用户名密码必须有 `username`/`password`。因此列表多一列「类型」，详情多了「明文遮挡」开关，创建与编辑按类型切换表单。

入口：`/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/secrets`，从侧栏「配置」组进入，与配置字典、服务账户并列。

## 用户故事

### US1 - 作为项目成员，看清本项目的敏感凭据有哪些

**Independent Test**：打开列表，确认能看到每条 Secret 的名称（有别名时显示别名）、描述、类型、字段数与创建时间；类型列把 `Opaque` 显示为「默认」、`kubernetes.io/tls` 显示为「TLS 信息」。

### US2 - 作为项目成员，创建一条用户名密码凭据

**Independent Test**：创建弹窗 → 填名称 → 数据设置里类型选「用户名和密码」→ 填用户名与密码 → 提交；列表出现该条，详情里用户名与密码默认以 `*` 遮挡，点眼睛后显示明文。

### US3 - 作为项目成员，查看但不出于意外泄露某个 Secret 的值

**Independent Test**：打开任意 Secret 详情，值全部以与原文等长的 `*` 显示；点击「显示明文」后才出现真实内容；刷新页面后又回到遮挡状态。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-SECRETS-01** — Given 项目内已有 Opaque / TLS / 镜像仓库 / 用户名密码四种 Secret，When 依次打开它们的详情，Then 每种类型的数据区都按该类型的结构展示（用户名密码显示两行、TLS 显示证书与私钥两块、镜像仓库逐条显示地址与账号），且初始均为遮挡状态。

## 页面结构

| 区域 | 内容 | 说明 |
|---|---|---|
| 页头 | 标题「保密字典」、一句说明 | 只出现一次 |
| 工具条 | 项目筛选、搜索框、「批量删除」、「创建」 | 主操作是「创建」 |
| 列表 | 名称（别名替换）、项目、类型、字段数、创建时间、操作 | 窄屏依次折叠字段数、类型、创建时间 |
| 分页 | 页码与总数 | 仅在 `ready` 态出现 |
| 详情 | 属性区（集群、项目、类型、创建时间、创建者）+ 数据区 | 数据区按类型渲染 |

## 异常态

| 状态 | 触发 | 呈现 |
|---|---|---|
| `loading` | 首次加载、翻页、改排序 | 骨架行，`aria-busy` |
| `empty` | 查询成功但无结果 | 「暂无保密字典」+ 引导 |
| `error` | 请求失败 | 一句人话 + 重试按钮 |
| 403 | 无权限（如没有 `secrets` 读权限） | 说明无权限，**不提供重试** |

## 设计目标

- **默认不泄露**：任何页面初次渲染都不展示明文，遮挡长度与原值一致，便于比对而不暴露内容。
- **类型驱动**：表单、详情、校验都按 `type` 分派，避免出现「TLS 里混进随意键」这种上游会拒绝的对象。
- **与老控制台一致**：列、行操作顺序、类型中文名、注解键与老控制台逐项对齐，见 `design/kube-frontend/secrets/_index.md` 的对照表。

## 约束与边界

- 读走 kapis `resources.kubesphere.io/v1alpha3/namespaces/{ns}/secrets`；写走 `/api/v1/namespaces/{ns}/secrets`（kapis 只注册 GET，写会 405）。
- 值以 **UTF-8 文本** 编辑，提交前 Base64 编码；老控制台用 `js-base64`（AGPL），本项目自行实现等价编码。
- 密钥类型沿用 KubeSphere 的 4 种：`Opaque`、`kubernetes.io/tls`、`kubernetes.io/dockerconfigjson`、`kubernetes.io/basic-auth`；其他类型可以查看，但不能在本页新建。
- 镜像仓库默认项的标记是注解 `secret.kubesphere.io/is-default-class: "true"`，同一项目只应有一个。
- 服务账户自动生成的 `kubernetes.io/service-account-token` 类型可查看、可删除，但不提供专门表单。

## UI 交互设计

- 列表行操作顺序与老控制台一致：编辑信息 → 编辑 YAML → 编辑设置 → 删除（详情页多一个「设为默认镜像仓库」）。
- 详情页数据区右上角一个眼睛按钮，在「遮挡」与「明文」之间切换，状态不持久化（`aria-pressed`）。
- 创建是两步表单（基本信息 / 数据设置），右上角可切到 YAML 模式；切换类型会清空已填数据，并有一句提示说明这一点。
- 删除采用**输入名称确认**，单条与批量文案不同；批量时要求输入 `a, b, c`。

## 功能需求

- **FR-FULL-KUBE_FRONTEND-SECRETS-01** — 四种已知类型的详情数据区必须各自按类型结构渲染，且默认遮挡。
- **FR-FULL-KUBE_FRONTEND-SECRETS-02** — 列表必须显示名称、类型、字段数、创建时间，并支持按名称与创建时间排序。

## 成功标准

- **SC-FULL-KUBE_FRONTEND-SECRETS-01** — 四种类型各建一条后，详情页展示的键与 `kubectl get secret <name> -o json` 的 `data` 键完全一致。

## 明确不做

- 不做 Secret 的「引用/被引用」分析（哪些工作负载挂载了它）。
- 不做 `kubernetes.io/ssh-auth`、`kubernetes.io/dockercfg` 等其余类型的专用表单；用 YAML 编辑。
- 不在列表里展示任何值（只展示字段数）。

## 假设

- kube-apiserver 接受 `kubernetes.io/tls` 的 `tls.crt`/`tls.key` 为任意内容：它只校验键存在，不校验证书链。
- 项目里默认镜像仓库至多一个；多于一个时本页不主动清理，只在「设为默认」时把旧的置回 `false`。

## 功能点

- 保密字典列表（`list`）
- 按名称搜索（`search`）
- 保密字典详情（`detail`）
- 创建保密字典（`create`）
- 编辑保密字典（`edit`）
- 删除保密字典（`delete`）
- 智能体可操作性（`ai-surface`）
- 移动端适配（`mobile`）

## 验收用例

- `TC-FULL-KUBE-FRONTEND-SECRETS-01`
