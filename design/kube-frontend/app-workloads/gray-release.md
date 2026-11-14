# 灰度发布列表（L3）— 技术方案

[子模块技术方案](./_index.md)

## 概述

项目作用域新增 `/grayrelease` 页：列表读取 servicemesh `Strategy` CRD（原生端点 `/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies`），映射成名称/类型/目标服务/状态四列；主操作打开最小创建向导，确认后 POST 同集合。状态由 `status.conditions` 派生；目标服务由虚拟服务 host 派生并带两级回退。空态、错误态与创建失败态分开呈现。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02`
- `prd/kube-frontend/app-workloads/gray-release.md`

## 设计目标与非目标

- **目标**：把已有的 `Strategy` 对象读出来并让人一眼看出实施状态；提供只采集最小字段的创建向导，生成控制器接受的 Strategy。
- **非目标**：不做完整发布配置（流量比例/匹配规则/版本选择/蓝绿切换）、详情页、编辑删除与监控曲线；不做集群级跨项目列表；不改 BFF。

## 关键约束

- servicemesh 是 CRD，不是核心资源：`Strategy` 只有 `governor/principal/selector/strategyPolicy/template/type` 六个 spec 字段，没有 `phase`。
- API 探测结论：原生端点与 kapis 代理都返回 200；原生端点返回完整对象（含 `status`），列表用它。
- 多集群环境下原生端点需要 `clusters/<id>` 段（与其他原生写路径同形），本环境只验证了 host 集群。
- 页面契约：字面量 `data-ai-id`、无裸 `<button>`；列表复用 `ResourceList` 与 `AiSurface`。
- 写入探测（2026-11-15）：POST 命名空间 strategies 集合，最小 manifest（type + selector.matchLabels.app + template.spec.hosts + principal/governor + strategyPolicy + v1/v2 路由）对 Canary/Bluegreen/Mirror 的 `?dryRun=All` 均 201；真实 Canary POST 201，列表可见，DELETE 200、计数回 0。
- CRD 会裁剪未声明字段：`template.metadata.labels` 在回读中消失，但 `template.spec.hosts/http` 与 selector 保留；创建后判断对象不能依赖被裁剪的字段。

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

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04 — 先只读、后补最小创建；完整发布配置仍留待详情

**为什么**：上一轮把创建留作独立功能，原因是多步向导（类型、版本、流量比例、匹配规则）与写 webhook 稳定性。写探测推翻了「不能写」：三种类型的最小 Strategy 都被 API 接受（dryRun 201、真实 Canary 201、DELETE 200）。因此本轮补一个**最小**创建向导：只采集名称/目标 Deployment/类型，其余字段由控制器默认值承担；完整流量配置仍属于发布详情。

**被否方案**：一次把多步向导全部做完。字段与交互面大，且流量比例/匹配规则需要发布详情与监控配合；最小可运行对象已足够让控制器接管发布。

**何时重新考虑**：发布详情（流量/匹配规则编辑）落地时，把向导扩展为多步。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05 — 目标工作负载从 Deployment 选择，app 标签同时做 selector 与 host

**为什么**：Strategy 的 selector 与 Istio host 需要一个稳定标识。项目内的 Deployment 带着 pod 模板的 app 标签（KubeSphere 场景基本都有），用它作为 selector.matchLabels.app 与 template.spec.hosts[0]，创建出的对象与手工按老 console 创建的形状一致；缺标签时退化为 Deployment 名，仍能生成合法对象。

**被否方案**：让读者手工输入 service/host。多一个必填字段、容易拼错，且本轮无法校验 Service 是否存在。

**何时重新考虑**：创建时需要选择真实 Service 或命名空间级 host 时，补查询与校验。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06 — 两步提交：本地校验后才允许确认

**为什么**：写操作一旦提交就落到控制器。向导把表单与确认拆成两步：第一步只做本地校验（名称 DNS label、已选 Deployment），第二步展示将要创建的 Strategy 摘要，确认按钮才发 POST。失败（409/403/422）在确认面板内显示归一后的原因，弹窗不关闭，草稿保留。

**被否方案**：点创建直接 POST，再靠 toast 报告结果。读者没有最后一次看到「将要创建什么」的机会，且错误会随弹窗关闭丢失。

## 系统现状

- 列表页与 registry（planned→ready）已交付；本轮在列表上加创建主操作与最小向导。
- 老 console 的灰度发布在项目控制台：分类页（蓝绿/金丝雀/镜像）+ 任务卡片页，卡片带监控曲线与详情弹窗；创建是多步（基础信息/服务/新版本/策略）向导。
- servicemesh 模块已开启：`strategies` 原生与 kapis 端点均 200；CRD 为 `servicemesh.kubesphere.io/v1alpha2`，Namespaced；创建探测见关键约束。

## 仓库落点

| 层 | 路径 | 改动 |
| --- | --- | --- |
| 接口 | `kube-frontend/packages/api-client/src/servicemesh.ts` | 新增：`strategiesApi.list/create/remove`、`toStrategySummary`、`strategyStatusOf`、`targetServiceOf` |
| 接口导出 | `kube-frontend/packages/api-client/src/index.ts` | 导出新模块与类型 |
| 页面 | `kube-frontend/apps/console-next/src/pages/app-workloads/CanaryReleasesPage.tsx` | 列表 + 创建主操作、成功提示 |
| 向导 | `kube-frontend/apps/console-next/src/pages/app-workloads/CreateGrayReleaseDialog.tsx` | 新增：名称/Deployment/类型 + 确认两步 |
| 路由 | `routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/grayrelease/{route.tsx,index.tsx}` | 新增列表路由与 Outlet 布局 |
| 注册表 | `kube-frontend/apps/console-next/src/areas/registry.ts` | grayrelease 页面 status: planned → ready |
| 文案 | `kube-frontend/packages/locales/src/index.ts` | `grayRelease.*` 追加中英成对键 |
| 用例 | `tests/ui/specs|tests/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01*` | 新增 spec 与 pytest |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `GET /apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies` | `StrategyList` | `items[]` 为 `Strategy`；页面读全部，不分页 | 灰度发布页 |
| `POST /apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies` | `Strategy` | 创建最小策略；dryRun 201（三种类型）/真实 201（Canary） | 创建向导 |
| `DELETE .../strategies/<name>` | — | 200；测试 finally 清理用 | 用例 |
| `StrategySummary.type` | 字符串 | `spec.type`：Canary / Bluegreen / Mirror，未知原样显示 | 类型列 |
| `StrategySummary.targetService` | 字符串 | `spec.template.spec.hosts[0]` → selector app → 模板名 | 目标服务列 |
| `StrategySummary.status` | `completed|failed|progressing|unknown` | 由 `status.conditions` 派生 | 状态徽章 |
| `grayrelease:surface` / `grayrelease:search` / `grayrelease:retry` / `data-ai-row` | `data-ai-id` | 页面四态、搜索、重试与行句柄 | 自动化与智能体 |
| `grayrelease:create` / `grayrelease:create-dialog` / `-name` / `-workload` / `-type` / `-next` / `-back` / `-confirm` / `-cancel` / `-error` / `grayrelease:created` | `data-ai-id` | 创建入口、向导字段、确认按钮、失败原因与成功提示 | 自动化与智能体 |

创建 manifest（探测通过的最小形状）：

    spec:
      type: Canary | Bluegreen | Mirror
      principal: v1
      governor: v2
      strategyPolicy: WaitForWorkloadReady
      selector: { matchLabels: { app: <target> } }
      template:
        metadata: { labels: { app: <target> } }   # CRD 会裁剪该字段
        spec:
          hosts: [<target>]
          http:
            - route:
                - destination: { host: <target>, subset: v1 }
                - destination: { host: <target>, subset: v2 }

其中 `<target>` = 所选 Deployment 的 app 标签，缺省为 Deployment 名。

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：唯一的写请求是确认后的 Strategy POST；页面不发编辑/删除请求。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02**：类型与状态只由对象字段派生，不做字符串猜测；未知值原样显示或标为「未知」。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03**：0 条策略是 empty 态，读取失败是 error 态，两者不互相伪装。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04**：点「下一步」不产生写请求；只有「确认创建」发 POST。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05**：创建成功后列表 refetch、行可见；失败时弹窗不关闭且显示服务端原因。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06**：创建的 selector 与 host 都来自所选 Deployment 的同一标识。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01** | 老 console 的 `spec.assemblyPhase` 在当前 CRD schema 中不存在 | 照抄 mapper 会永远读到空状态 | `strategyStatusOf` 改读 `status.conditions` |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02** | Istio host 是策略的目标服务，不是策略名 | 目标服务列显示策略名，读者以为发布了另一个服务 | `targetServiceOf` 优先 `hosts[0]` |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03** | CRD 列表无 `totalItems`、无分页参数 | 照搬服务端分页会传无效参数并显示错误总数 | 一次读全部，客户端过滤与分页 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04** | 刚创建的策略没有 condition | 把「无 condition」当失败或进行中都是错的 | 归为「未知」，等控制器写入 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05** | 原生端点在多集群需要 `clusters/<id>` 段 | 成员集群读不到策略 | 路径拼装与其他原生 kube 路径同形；本环境只验证 host |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06** | CRD 会裁剪 `template.metadata.labels` | 回读断言该字段会误判创建失败 | 只断言 selector/hosts/type 与控制器实际保留的字段 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07** | 刚创建的对象没有 condition | 列表立即显示「已完成/失败」都是猜的 | 派生规则归为「未知/进行中」 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08** | 写用例不留垃圾会污染全局 verify | 后续列表用例看到意外行、计数断言失败 | 用例 finally DELETE，并在末尾断言计数回到创建前 |

## 测试与可观测

- **单元**：`packages/api-client/test/servicemesh.test.ts` 固定状态派生（Complete/Failed/无 condition）、目标服务回退链与列表路径。
- **端到端**：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01` 覆盖空态可达、列头与行内容（API 创建临时策略后在 finally 删除）；`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02` 覆盖创建向导：下一步无写、确认后回读对象、列表可见、finally 删除并核对计数回零。
- **手动验证**：servicemesh 关闭或 404 时页面显示错误态与重试；策略创建后控制器写入 Failed 时徽章为红色并带原因。
- **日志 / 指标**：不适用；失败看 `strategies` 响应与错误面板。

## 后续改进

- 发布详情与流量配置：版本、流量比例、匹配规则、蓝绿切换。
- 列表行操作：编辑/删除策略（删除路径已在 api-client 暴露，待 UI）。
- 卡片化视图与请求量/成功率/延迟曲线（沿用老 console 的监控接口）。
- 集群级跨项目灰度发布列表。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02`
