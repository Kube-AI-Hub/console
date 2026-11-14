# 服务与应用路由创建（L3）— 技术方案

[子模块技术方案](./_index.md)

## 概述

服务与应用路由列表页各自打开一个定制弹窗：表单收集类型、端口、选择器（服务）或域名/路径/后端（路由），生成完整 Kubernetes 清单后 POST 原生集合。列表页的创建入口是 primaryAction，权限不足时保持可见但禁用并显示原因。保留「切换 YAML」模式，多端口与高级字段仍可手写。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01`
- `prd/kube-frontend/app-workloads/resource-create.md`

## 设计目标与非目标

- **目标**：用表单完成最常见的服务/路由创建；条件字段按类型显隐；失败不丢输入；无权限的入口可解释。
- **非目标**：不做多端口表单、LoadBalancer 表单、证书申请；不改 Job/CronJob 创建与工作负载创建；不新增服务/路由详情页。

## 关键约束

- 核心组与分组写路径不同：Service 是 `/api/v1`，Ingress 是 `/apis/networking.k8s.io/v1`；写成 `/apis/v1` 会 404。
- 选项来自数据：项目列表来自 `useProjectOptions`，选择器候选来自项目内控制器的 `app` 标签（三个列表请求）。
- 权限检查是 `SelfSubjectAccessReview`（create-only 资源，POST 提问）。
- 页面契约：不允许裸 `<button>`，每个动作有字面量 `data-ai-id`；英文文案中的撇号用双引号包裹。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01 — 专用弹窗替代通用清单表单

**为什么**：之前的通用创建弹窗（`NetworkResourceCreateDialog` + `ManifestCreateDialog`）用 `ResourceForm` 一次渲染一个端口、一条路由规则，且 NodePort 没有节点端口字段。两个清单的形状差异很大（Service 按类型分支、Ingress 是规则数组），用一个 schema 表达会把条件字段与数组状态塞进 schema 层。专用弹窗可以直接表达「NodePort 才显示 nodePort」「规则可增删」，并给每个动作稳定的 `data-ai-id`。

**被否方案**：继续扩展通用弹窗的 schema。需要给 schema 增加数组字段、条件显隐联动与跨行校验，复杂度超过两个独立组件之和；而且 Job 创建仍在用通用弹窗，改动会牵连它。

**何时重新考虑**：当第三种清单（例如 Gateway）也要创建且字段形状与这两个相似时，抽共享的表单分节组件，而不是再写第三个弹窗。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-02 — 权限用 SelfSubjectAccessReview，且失败放行

**为什么**：平台没有客户端权限模型，角色绑定是唯一事实源；SSAR 用与服务端相同的 verb/resource/namespace 评估，按钮状态与实际写入一致。权限检查本身失败（旧 BFF、网络抖动）时放行：把「检查不了」当成「不允许」会让有权限的人无法创建，而这正是检查想避免的失败。

**被否方案**：不检查权限，等 POST 返回 403 再显示错误。读者要填完整张表单才知道没权限；而且列表页入口看起来可用。

**被否方案**：读 IAM 角色模板在客户端推导。规则形状复杂且会漂移，推导错误会显示可点的按钮然后 403。

**何时重新考虑**：当 BFF 提供聚合的权限接口（一次返回多个资源的 can-create）时，用它替换逐资源 SSAR。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-03 — 路由行按 host 分组成 rules

**为什么**：表单是「主机 + 路径 → 后端」的扁平行，Kubernetes 的对象是 `rules[] → http.paths[]`。同一个 host 的两行若不是一条规则的两个 path，而是两条规则，服务端会视为重复 host 并整单拒绝。分组放在 `ingressManifest` 这个纯函数里，组件只负责行状态。

**被否方案**：让表单直接编辑嵌套的 rules 数组。读者与测试都要写 `rules[0].http.paths[1]` 这类路径，且新增路径会变成新增规则，语义错位。

**何时重新考虑**：需要按 host 维度的批量编辑（一次改整个 host 的路径）时，表单改成两级结构。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-04 — 保留 YAML 模式

**为什么**：表单只覆盖一个端口与常用字段；多端口、TLS 证书细节与其它高级字段仍需要手写的出口。切换 YAML 时用当前表单生成的清单作为初稿，读者改几行而不是从空白写起；这一模式沿用已发布的通用弹窗，不新增第二套编辑器（复用 `YamlEditor`）。

**被否方案**：只保留表单，把高级配置推给 kubectl。会让「建一个带两个端口的服务」从控制台消失。

**何时重新考虑**：当表单覆盖了多端口列表后，YAML 模式仍作为逃生口存在，不删除。

## 系统现状

- 已发布的 `network-create` 功能用通用清单弹窗创建服务/路由，支持单端口、单规则与 YAML 模式；`ManifestCreateDialog` 仍被 Job/CronJob 创建复用。
- 新 UI 没有权限前置检查；无权限时只能等写操作返回 403。
- 列表页 primaryAction 之前只能渲染可用按钮，没有禁用态与说明位。

## 仓库落点

| 层 | 路径 | 改动 |
| --- | --- | --- |
| 组件 | `kube-frontend/apps/console-next/src/pages/app-workloads/CreateServiceDialog.tsx` | 新增：服务表单 + YAML 模式 |
| 组件 | `kube-frontend/apps/console-next/src/pages/app-workloads/CreateIngressDialog.tsx` | 新增：路由表单（规则增删）+ YAML 模式 |
| 纯函数 | `kube-frontend/apps/console-next/src/pages/app-workloads/networkManifest.ts` | 重写：校验 + Service/Ingress 清单构建 |
| 权限 | `kube-frontend/apps/console-next/src/pages/app-workloads/useCreatePermission.ts` | 新增：SSAR 查询（fail-open） |
| 页面 | `kube-frontend/apps/console-next/src/pages/app-workloads/WorkloadListPage.tsx` | primaryAction 禁用态；创建弹窗接线 |
| 数据 | `kube-frontend/apps/console-next/src/pages/app-workloads/queries.ts` | `useWorkloadAppLabels` |
| 接口 | `kube-frontend/packages/api-client/src/permissions.ts` | 新增 `accessReviewApi.allowed` |
| 列表框架 | `packages/ai-kit/src/schema/ResourceList.tsx` | `primaryAction` 增加 `disabled` / `disabledHint` |
| 页面对象 | `tests/ui/pages/app_workloads.py` | 新弹窗的字段与选择器辅助 |
| 文案 | `kube-frontend/packages/locales/src/index.ts` | `networkCreate.*` 追加中英成对键 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `POST /api/v1/namespaces/<ns>/services` | Kubernetes 对象 | `spec.type`、`spec.selector`、`spec.ports[0]` | apiserver |
| `POST /apis/networking.k8s.io/v1/namespaces/<ns>/ingresses` | Kubernetes 对象 | `spec.rules[]`（按 host 分组）、可选 `ingressClassName` / `tls` | apiserver |
| `POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews` | `SelfSubjectAccessReview` | `status.allowed` 决定创建按钮是否禁用 | 列表页 |
| `services-create:dialog` / `:submit` / `:name` / `:type` / `:port` / `:target-port` / `:node-port` / `:selector` / `:selector-manual` / `:error` | `data-ai-id` | 服务表单句柄 | 自动化与智能体 |
| `ingresses-create:dialog` / `:submit` / `:rule-add` / `:rule-remove:<id>` / `:host:<id>` / `:path:<id>` / `:backend:<id>` / `:backend-port:<id>` / `:error` | `data-ai-id` | 路由表单句柄；规则行 id 稳定 | 自动化与智能体 |
| `services:create` / `ingresses:create`（+ `:disabled-hint`） | `data-ai-id` | 列表页入口与禁用说明 | 自动化与智能体 |

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01**：提交的清单只包含表单字段与该类型的默认值；未填写的可选字段不出现（例如 ClusterIP 没有 nodePort、留空的 selector 不出现）。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-02**：同一个 host 的多条路径合并为一条 `rules` 条目，路径顺序与表单顺序一致。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-03**：创建失败时弹窗保持打开，表单状态与 YAML 文本都不被重置。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-04**：只有 SSAR 明确返回 `allowed: false` 才禁用入口；查询失败或未完成时入口可用。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01** | 核心组是 `/api/v1`，没有 `/apis/v1` | 服务创建 POST 到 `/apis/v1/...` 得到 404，且报错看起来像权限问题 | `createManifest` 走 `resourceApi.create` 的 `kubePrefix` |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-02** | Ingress 的 TLS `hosts` 需要去重，rules 需要按 host 合并 | 重复 host 被服务端拒绝；TLS hosts 重复虽被接受但语义混乱 | `ingressManifest` 统一分组与去重 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-03** | Radix Select 不允许空字符串作为选项值 | 用 `value: ''` 表示「手动填写」会让组件抛错、整页白屏 | 用 `__manual__` 哨兵值，状态里再映射 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-04** | SSAR 是集群级资源，多集群 BFF 的请求落到直连集群 | 非 host 集群上按钮状态可能按 host 的权限显示；实际写入仍由目标集群裁决 | 按钮状态只做提示，服务端拒绝照常显示；后续接聚合权限接口 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-05** | NodePort 的合法范围由 apiserver 配置决定，默认 30000–32767 | 表单按默认范围校验，改过范围的集群会拦下表单认为合法的值 | 服务端拒绝消息原样显示，不吞掉 |

## 测试与可观测

- **单元**：`packages/api-client/test/permissions.test.ts` 固定 SSAR 的请求形状与 status 缺失时的 false；`apps/console-next/test/network-create.test.tsx` 固定两个清单构建函数（NodePort 条件字段、host 分组、TLS 去重）与「409 时保留输入」；`test/areas-page.test.tsx` 固定 SSAR 拒绝时入口禁用并有说明。
- **端到端**：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01` 覆盖 NodePort+选择器、同名报错、路由多规则增删与回读。
- **手动验证**：用无创建权限的账号打开服务列表，确认按钮禁用且说明可见；用有权限账号切换 YAML 提交多端口服务。
- **日志 / 指标**：不适用；失败看 POST 响应的 `status.message` 与弹窗错误文本。

## 后续改进

- 多端口列表表单：把 `ports[0]` 扩成可增删的端口行，YAML 仍保留。
- 后端服务名与端口改为从项目内 Service 列表选择，减少拼写错误。
- 权限检查合并为一次批量查询，减少列表页的额外请求。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01`
