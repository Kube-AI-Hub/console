# 灰度发布列表（L3）— 技术方案

[子模块技术方案](./_index.md)

## 概述

项目作用域新增只读页 `/grayrelease`，列表读取 servicemesh `Strategy` CRD：原生端点 `/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies`，映射成名称/类型/目标服务/状态四列。状态由 `status.conditions` 派生；目标服务由虚拟服务 host 派生并带两级回退。空态与错误态分开呈现。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- `prd/kube-frontend/app-workloads/gray-release.md`

## 设计目标与非目标

- **目标**：把已有的 `Strategy` 对象读出来并让人一眼看出实施状态；只读、不新增写路径。
- **非目标**：不做创建向导、详情页、流量比例/匹配规则编辑、删除与监控曲线；不做集群级跨项目列表；不改 BFF。

## 关键约束

- servicemesh 是 CRD，不是核心资源：`Strategy` 只有 `governor/principal/selector/strategyPolicy/template/type` 六个 spec 字段，没有 `phase`。
- API 探测结论：原生端点与 kapis 代理都返回 200；原生端点返回完整对象（含 `status`），列表用它。
- 多集群环境下原生端点需要 `clusters/<id>` 段（与其他原生写路径同形），本环境只验证了 host 集群。
- 页面契约：字面量 `data-ai-id`、无裸 `<button>`；列表复用 `ResourceList` 与 `AiSurface`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01 — 从 status.conditions 派生状态

**为什么**：CRD 没有 `phase`；控制器把结果写成 `conditions`（`Complete` / `Failed`，`status` 为 `True/False/Unknown`）。老 console 的 mapper 读 `spec.assemblyPhase`，但当前 CRD 的 spec schema 里没有这个字段（写入会被裁剪），照抄会永远显示空值。

**被否方案**：直接显示 `conditions` 原文。读者关心的是「完成/失败/进行中」，条件数组是控制器视角的细节。

**被否方案**：把没有 condition 的对象当「进行中」。刚创建的对象还没有 condition，说「进行中」是猜测；单独显示「未知」更诚实。

**何时重新考虑**：CRD 增加 `phase` 字段时，直接读字段而不是派生。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02 — 目标服务从 Istio host 派生并回退

**为什么**：策略真正作用的对象写在 `spec.template.spec.hosts[0]`（Istio VirtualService 的 host，KubeSphere 用服务名作为 host）。部分由 API 直接创建的对象没有 template，此时用 `spec.selector.matchLabels.app` 与模板名回退，避免列显示「-」而对象其实有目标。

**被否方案**：只读 `spec.selector.matchLabels.app`。手工编写的策略可以不写选择器，host 才是路由目标。

**何时重新考虑**：CRD 增加显式的 target 字段时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03 — 用原生 CRD 端点，不用 kapis 代理

**为什么**：两个端点都 200；原生端点返回 `StrategyList`（含完整对象与 `status`，一次请求拿到全部列表所需字段），kapis 代理返回资源代理信封且多集群拼接规则与原生不同。列表页只需要读，原生端点更直接。

**被否方案**：走 kapis 代理，与老 console 的 store 一致。它在本环境也能用，但没有为这个页面增加任何能力。

**何时重新考虑**：需要在多集群上一致读取时，改用 kapis 代理或按集群切换到已验证的路径。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04 — 只读一轮，创建留作独立功能

**为什么**：创建灰度发布是多步向导（类型、版本、流量比例、匹配规则），且写类 webhook 在集群恢复初期不稳定。把只读列表与创建混在一轮会让页面一半可用、一半不可靠；先交付可验证的读路径，再按向导设计写路径。

**被否方案**：同时提供最小创建表单。灰度发布的核心字段是版本与流量比例，缺少它们的「创建」会产出无法使用的策略。

**何时重新考虑**：写 webhook 稳定且创建向导的字段范围确定后，按 `prd` 新功能点补创建。

## 系统现状

- registry 已将 `app-workloads/grayrelease` 登记为 planned，tree 已登记 `gray-release` 与用例 id；缺页面与路由。
- 老 console 的灰度发布在项目控制台：分类页（蓝绿/金丝雀/镜像）+ 任务卡片页，卡片带监控曲线与详情弹窗。
- servicemesh 模块已开启：`strategies` 原生与 kapis 端点均 200，当前 0 个对象；CRD 为 `servicemesh.kubesphere.io/v1alpha2`，Namespaced。

## 仓库落点

| 层 | 路径 | 改动 |
| --- | --- | --- |
| 接口 | `kube-frontend/packages/api-client/src/servicemesh.ts` | 新增：`strategiesApi.list`、`toStrategySummary`、`strategyStatusOf`、`targetServiceOf` |
| 接口导出 | `kube-frontend/packages/api-client/src/index.ts` | 导出新模块与类型 |
| 页面 | `kube-frontend/apps/console-next/src/pages/app-workloads/CanaryReleasesPage.tsx` | 新增：只读列表 |
| 路由 | `routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/grayrelease/{route.tsx,index.tsx}` | 新增列表路由与 Outlet 布局 |
| 注册表 | `kube-frontend/apps/console-next/src/areas/registry.ts` | grayrelease 页面 status: planned → ready |
| 文案 | `kube-frontend/packages/locales/src/index.ts` | `grayRelease.*` 追加中英成对键 |
| 用例 | `tests/ui/specs|tests/kube-frontend/app-workloads/TC-L3-...-GRAY_RELEASE-01*` | 新增 spec 与 pytest |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `GET /apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies` | `StrategyList` | `items[]` 为 `Strategy`；页面读全部，不分页 | 灰度发布页 |
| `StrategySummary.type` | 字符串 | `spec.type`：Canary / Bluegreen / Mirror，未知原样显示 | 类型列 |
| `StrategySummary.targetService` | 字符串 | `spec.template.spec.hosts[0]` → selector app → 模板名 | 目标服务列 |
| `StrategySummary.status` | `completed|failed|progressing|unknown` | 由 `status.conditions` 派生 | 状态徽章 |
| `grayrelease:surface` / `grayrelease:search` / `grayrelease:retry` / `data-ai-row` | `data-ai-id` | 页面四态、搜索、重试与行句柄 | 自动化与智能体 |

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：页面不发起任何写请求；策略的创建、修改与删除都不经过此页。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02**：类型与状态只由对象字段派生，不做字符串猜测；未知值原样显示或标为「未知」。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03**：0 条策略是 empty 态，读取失败是 error 态，两者不互相伪装。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01** | 老 console 的 `spec.assemblyPhase` 在当前 CRD schema 中不存在 | 照抄 mapper 会永远读到空状态 | `strategyStatusOf` 改读 `status.conditions` |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02** | Istio host 是策略的目标服务，不是策略名 | 目标服务列显示策略名，读者以为发布了另一个服务 | `targetServiceOf` 优先 `hosts[0]` |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03** | CRD 列表无 `totalItems`、无分页参数 | 照搬服务端分页会传无效参数并显示错误总数 | 一次读全部，客户端过滤与分页 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04** | 刚创建的策略没有 condition | 把「无 condition」当失败或进行中都是错的 | 归为「未知」，等控制器写入 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05** | 原生端点在多集群需要 `clusters/<id>` 段 | 成员集群读不到策略 | 路径拼装与其他原生 kube 路径同形；本环境只验证 host |

## 测试与可观测

- **单元**：`packages/api-client/test/servicemesh.test.ts` 固定状态派生（Complete/Failed/无 condition）、目标服务回退链与列表路径。
- **端到端**：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01` 覆盖空态可达、列头与行内容（API 创建临时策略后在 finally 删除）。
- **手动验证**：servicemesh 关闭或 404 时页面显示错误态与重试；策略创建后控制器写入 Failed 时徽章为红色并带原因。
- **日志 / 指标**：不适用；失败看 `strategies` 响应与错误面板。

## 后续改进

- 创建向导（蓝绿/金丝雀/流量镜像）与详情页：版本、流量比例、匹配规则。
- 卡片化视图与请求量/成功率/延迟曲线（沿用老 console 的监控接口）。
- 集群级跨项目灰度发布列表。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
