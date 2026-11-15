# 灰度发布列表与详情（L3）— 技术方案

[子模块技术方案](./_index.md)

## 概述

项目作用域有两个路由：`…/projects/:namespace/grayrelease`（列表）与 `…/grayrelease/:name`（详情）。两者都读 servicemesh `Strategy` CRD 的原生端点 `/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies`；列表映射成名称/类型/目标服务/版本/状态/创建时间六列，详情映射成基本信息、版本与流量、匹配规则、状态条件四个区块，并提供调整流量、暂停/恢复、删除三个写操作。状态由 `status.conditions` 派生，目标服务与版本由 VirtualService 的 host/route/match 派生。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08`
- `prd/kube-frontend/app-workloads/gray-release.md`

## 设计目标与非目标

- **目标**：把「一个发布现在分给谁、按什么规则、控制器怎么看」三件事在一页说完；把流量、接管、暂停恢复、删除做成可回读的写闭环；版本与工作负载的关系可下钻到工作负载页。
- **非目标**：不迁移监控曲线与逐 Pod 指标；不代建新版本工作负载、不内嵌容器编辑器；不做集群级列表、watch 实时刷新、流量历史与回滚；不改 BFF/kapis。

## 关键约束

- servicemesh 组只服务 **v1alpha2**：`GET /apis/servicemesh.kubesphere.io` 的 versions 只有 `v1alpha2`（实测 2026-11-15；PRD 早期写的 v1alpha3 不成立）。
- Strategy 的 spec 只有六个字段：`type`、`principal`、`governor`、`selector`、`strategyPolicy`、`template`（CRD openAPIV3Schema 实测）。没有 `phase`、没有 `versions`/`trafficMatchRules` 这类字段；版本与权重都在 `template.spec.http|tcp[]` 的 Istio VirtualService 结构里。
- CRD 没有 status 子资源（`subresources` 为空），嵌套字段没有 merge key：更新只能 **PUT 整对象**（带 `resourceVersion`）。PUT 会把请求体里的 `status` 原样保存，供测试注入条件。
- 本安装没有 servicemesh 策略控制器（`kubesphere-system` 与全集群 Deployment 中没有 servicemesh/strategy 控制器，只有 istiod），新建对象的 `status` 一直为空 → 真实对象状态恒为「未知」。这是环境事实，不是页面缺陷；派生逻辑用注入条件的对象验收。
- 页面契约：`data-ai-id` 字面量、无裸写确认框、复用 `ResourceList`/`AiSurface`/`DeleteDialog`/`DescriptionItem`。
- 写路径实测（2026-11-15，default 项目，产物已清理）：POST 201；PUT 权重 80/20→70/30 回读一致；PUT 注入 `status.conditions` 回读一致；DELETE 200 后 GET 404。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01 — 从 status.conditions 派生状态

**为什么**：CRD 没有 `phase`；控制器把结果写成 `conditions`（`Complete` / `Failed`，`status` 为 `True/False/Unknown`）。老 console 的 mapper 读 `spec.assemblyPhase`，但当前 CRD schema 里没有这个字段（写入会被裁剪），照抄会永远显示空值。

**被否方案**：直接显示 `conditions` 原文。读者关心的是「完成/失败/进行中」，条件数组是控制器视角的细节。

**被否方案**：把没有 condition 的对象当「进行中」。刚创建的对象还没有 condition，说「进行中」是猜测；单独显示「未知」更诚实。

**何时重新考虑**：CRD 增加 `phase` 字段时，直接读字段而不是派生。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02 — 目标服务从 Istio host 派生并回退

**为什么**：策略真正作用的对象写在 `spec.template.spec.hosts[0]`（Istio VirtualService 的 host，KubeSphere 用服务名作为 host）。部分由 API 直接创建的对象没有 template，此时用 `spec.selector.matchLabels.app` 与模板名回退，避免列显示「-」而对象其实有目标。

**被否方案**：只读 `spec.selector.matchLabels.app`。手工编写的策略可以不写选择器，host 才是路由目标。

**何时重新考虑**：CRD 增加显式的 target 字段时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03 — 用原生 CRD 端点，不用 kapis 代理

**为什么**：两个端点都 200；原生端点返回 `StrategyList`（含完整对象与 `status`，一次请求拿到列表与详情所需字段），kapis 代理返回资源代理信封且多集群拼接规则与原生不同。列表与详情都只需要读写这一个资源，原生端点更直接。

**被否方案**：走 kapis 代理，与老 console 的 store 一致。它在本环境也能用，但没有为这个页面增加任何能力。

**何时重新考虑**：需要在多集群上一致读取时，改用 kapis 代理或按集群切换到已验证的路径。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04 — 详情独立成路由；创建向导扩展为「名称 + 目标 + 类型 + 初始流量」

**为什么**：老 console 的详情是全屏弹窗，不可分享、刷新即丢；新 UI 的页面模式是「列表 + 详情路由」（工作负载、存储卷、PVC 都如此）。创建向导上一轮只采集三个字段；本轮的验收要求写入后立即是用户想要的分流，所以把初始流量纳入表单，并按类型生成正确的初始 VirtualService（Canary 可调权重、Bluegreen 100/0、Mirror 使用 `mirror` 字段）。

**被否方案**：详情继续用弹窗。无法深链，且弹窗里的写操作失败后上下文随关闭丢失。

**被否方案**：创建只生成最小对象，流量一律创建后再调。多一次写入、多一次失败面，且创建后瞬时 100% 走参考版本并非所有场景的意图。

**何时重新考虑**：发布需要「先创建草稿再启用」的状态机时，把初始流量改为可选并引入草稿态。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05 — 目标工作负载从 Deployment 选择，app 标签同时做 selector 与 host

**为什么**：Strategy 的 selector 与 Istio host 需要一个稳定标识。项目内的 Deployment 带 pod 模板的 app 标签（KubeSphere 场景基本都有），用它作为 `selector.matchLabels.app` 与 `template.spec.hosts[0]`，创建出的对象与手工按老 console 创建的形状一致；缺标签时退化为 Deployment 名，仍能生成合法对象。

**被否方案**：让读者手工输入 service/host。多一个必填字段、容易拼错，且本轮无法校验 Service 是否存在。

**何时重新考虑**：创建时需要选择真实 Service 或命名空间级 host 时，补查询与校验。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06 — 两步提交：本地校验后才允许确认

**为什么**：写操作一旦提交就落到控制器。向导把表单与确认拆成两步：第一步只做本地校验（名称 DNS label、已选 Deployment、初始流量 0–100 整数），第二步展示将要创建的 Strategy 摘要，确认按钮才发 POST。失败（409/403/422）在确认面板内显示归一后的原因，弹窗不关闭，草稿保留。

**被否方案**：点创建直接 POST，再靠 toast 报告结果。读者没有最后一次看到「将要创建什么」的机会，且错误会随弹窗关闭丢失。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07 — 流量/接管写入用整对象 PUT，并保持 governor 与权重一致

**为什么**：CRD 没有 status 子资源、嵌套 VirtualService 字段没有 merge key，`PATCH` 合并语义不可依赖；`PUT` 整对象（读到的 `resourceVersion` + 修改后的 `spec`）是唯一可解释的写形状，也与老 console 一致。`spec.governor` 非空时控制器把全部流量交给该版本，**权重不再生效**，因此写权重时必须同步维护 governor：100% → 新版本，0% → 参考版本，其余 → 空字符串。该一致性由 api-client 的 `withTrafficWeight` 单一实现保证并单测。

**被否方案**：只 PUT `spec.template.spec.http` 子路径。CRD 无该子资源，请求会被当作整对象替换，未提供的字段（selector、strategyPolicy）会被清掉。

**被否方案**：只改权重不动 governor。对象会停留在「某版本接管」的状态，权重改动对流量没有任何效果，读者以为保存失败。

**何时重新考虑**：CRD 增加 status 子资源或服务端 apply 支持时，可改小块写入。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08 — 暂停/恢复以 governor 表达（等价承接老 console 的接管/恢复）

**为什么**：CRD 没有暂停字段。把「暂停发布」定义为 `spec.governor = spec.principal`（参考版本接管全部流量），「恢复发布」定义为 `spec.governor = ''`。权重保持不变，因此恢复后回到暂停前的分流比例。这正是老 console 的「接管 / 恢复」语义（`handleTakeover` / `handleRecover`），同一个写路径、可回读、可逆，不需要新增自定义注解。

**被否方案**：新增 `kubesphere.io/paused` 注解并在控制器侧解释。控制器不读它，注解只是装饰，流量不会真的暂停。

**被否方案**：暂停时把权重改成 0/100。恢复需要记住原权重（无历史存储），会把「恢复」变成猜测。

**何时重新考虑**：上游控制器提供 pause/resume API 时改用官方语义。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-09 — 匹配规则按 Istio match 原样展开

**为什么**：老 console 的详情只展示 cookie/请求头/URL/客户端操作系统四行固定字段，且客户端操作系统把 `.*(Chrome|...).*` 反解成标签。新实现遍历每个 http 规则的 `match[]`：`headers`（cookie/User-Agent/自定义头）、`uri` 逐条成行，并保留未建模的键（如 `method`）为「其他」行。读者看到的是对象里真实存在的规则，新增匹配类型不会静默消失。

**被否方案**：照抄旧的四个固定字段。会把 method/queryParams 等规则显示成「没有匹配规则」，而这类策略实际是按内容分流的。

**何时重新考虑**：需要可视化编辑匹配规则时，在本表基础上加编辑入口。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-10 — 版本副本数取 Deployment，找不到显示「未找到对应工作负载」

**为什么**：老 console 用 `/kapis/servicemesh.../workloads/<name>/health` 取 available/desire；本环境该端点不可用（`klusters` 变体 404，`namespaces` 变体 200 但返回 `{"error":"unsupported query parameter 'namespaces'"}`），且没有控制器写这些状态。等价实现：同命名空间 Deployment 列表里按「注解 `oldWorkloadName`/`newWorkloadName` → 否则 `<host>-<version>`」匹配，命中则显示 `ready/replicas` 并链接到工作负载详情（容器组与监控在那里），未命中显示「未找到对应工作负载」并给出约定名称。

**被否方案**：显示 0/0。把「没有这个工作负载」和「有工作负载但 0 副本」混为一谈，读者会以为发布卡在扩容。

**被否方案**：不显示副本数。老 console 的第一屏就在回答「新版本起来了没」，删掉等于能力缺失。

**何时重新考虑**：servicemesh kapis 的 workload health 在本环境恢复时，可补一个精确来源，但要以实测 200 + 非空字段为前提。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-11 — 条件正分支用测试注入 status 验收，控制器缺失登记阻塞

**为什么**：本安装没有策略控制器，真实对象永远没有 condition，无法通过新增对象得到「已完成/失败」。但 CRD 允许普通 PUT 写入 `status`（无子资源），因此用例可以 PUT 一个 `Complete=True` / `Failed=True` 的条件再打开页面：这验证的是**页面派生与展示**（本单元的实现），不是控制器行为。控制器缺失作为阻塞登记在交付记录，不用 UI 模拟替代。

**被否方案**：跳过状态正分支，只测「未知」。等于把 `Complete`/`Failed` 映射交给未来，而映射代码已经存在。

**被否方案**：页面里 mock 数据。测不到真实请求链路，门禁也不认可。

**何时重新考虑**：servicemesh 控制器部署后，改用真实对象走完整链路并保留注入用例作为边界。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-12 — 删除只删 Strategy，不级联删除版本工作负载

**为什么**：老 console 在接管/镜像场景删除时会顺带删除它创建的非接管版本工作负载（`handleOffline`）。新 UI 无法区分「本策略创建的 Deployment」与「用户自己的 Deployment」：注解只是命名提示，不是所有权凭据。误删一个仍在服务其他用途的 Deployment 的代价远高于留下一个多余副本；因此删除只作用于 Strategy，并把「版本工作负载需要单独清理」写进已知坑与提示。

**被否方案**：按 `<host>-<version>` 约定级联删除。命名约定不是所有权，手工创建的 Deployment 可能正好符合该名称。

**何时重新考虑**：对象带上明确的所有者引用（ownerReferences 或专用注解）后，可以安全级联。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-13 — 权限用 SelfSubjectAccessReview，失败时 fail-open

**为什么**：老 console 用模块权限（`grayscale-release: create/delete`）判断。新 UI 直接查询集群：`create`/`delete` on `strategies`（group `servicemesh.kubesphere.io`），与真正发出的请求同源。只有明确 `allowed=false` 才禁用创建、隐藏删除；检查失败或未返回时保持可用——一次检查错误不应该拿走读者已有的权限（与 `useCreatePermission` 的既有约定一致）。

**被否方案**：把检查失败当无权限。BFF 老版本或网络抖动会让所有写入口消失，读者看到的是「功能没了」。

**何时重新考虑**：平台提供统一的权限上下文缓存时，改用它减少每页一次 SSAR。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-14 — 调整流量弹窗按发布模式提供不同控件

**为什么**：同一个入口在四种模式下的「可写事实」不同：按权重分流可调 0–100；按内容分流没有权重可调（只能选接管或保持规则）；蓝绿是二选一；镜像不改变接收方、没有可调项。用一个滑块覆盖全部四种模式会让三种模式的保存产生无效或无意义写入。

**被否方案**：只给按权重模式提供入口，其它模式不支持写。老 console 的接管/恢复（按内容）与版本选择（蓝绿）会变成能力缺失。

**何时重新考虑**：新增发布类型时，在弹窗里增加对应分支而不是复用滑块。

## 系统现状

- 列表页、最小创建向导、api-client 的 `strategiesApi` 与状态派生已交付；本轮补详情路由、流量/接管/暂停恢复/删除、创建初始流量、列表版本列与权限门控。
- 老 console 在项目控制台：分类页（蓝绿/金丝雀/镜像三张卡）+ 任务卡片页（含 3/2 张指标图）+ 全屏详情弹窗（版本卡片、Pod 列表、流量滑块、按内容匹配展示、接管/恢复、编辑新版本容器、删除）。
- 本环境：servicemesh 组可用（v1alpha2），全集群 0 个 Strategy；没有策略控制器；istiod 已部署但本页不依赖它。

## 仓库落点

| 层 | 路径 | 改动 |
| --- | --- | --- |
| 接口 | `kube-frontend/packages/api-client/src/servicemesh.ts` | 新增 `get/update`、`toStrategyDetail`、`StrategyDetail/StrategyVersion/StrategyMatchRule/StrategyCondition/StrategyRoute`、`withTrafficWeight/withGovernor/pausedStrategy/resumedStrategy/withBluegreenVersion`；列表摘要增加 `versionOrder/weights` |
| 接口导出 | `kube-frontend/packages/api-client/src/index.ts` | 导出上述值与类型 |
| 单测 | `kube-frontend/packages/api-client/test/servicemesh.test.ts` | 详情派生、匹配规则展开、四模式、写入/不可变、暂停恢复、蓝绿切换（18 例） |
| 列表 | `kube-frontend/apps/console-next/src/pages/app-workloads/CanaryReleasesPage.tsx` | 版本/创建时间列、名称链到详情、创建权限门控 |
| 详情 | `…/pages/app-workloads/canary/CanaryDetailPage.tsx` | 新增：四区块 + 写操作 + 删除 |
| 弹窗 | `…/pages/app-workloads/canary/TrafficDialog.tsx` | 新增：按模式调整流量/接管/蓝绿切换 |
| 标签 | `…/pages/app-workloads/canary/labels.ts` | 新增：类型/状态/模式/匹配项/匹配方式唯一映射 |
| 权限 | `…/pages/app-workloads/canary/useStrategyPermission.ts` | 新增：SSAR create/delete |
| 创建 | `…/pages/app-workloads/CreateGrayReleaseDialog.tsx` | 初始流量字段；三种类型的初始 VirtualService 与 governor |
| 路由 | `routes/…/grayrelease/{index.tsx,$name.tsx,route.tsx}` | 列表传入 workspace；新增详情路由 |
| 文案 | `kube-frontend/packages/locales/src/index.ts` | `grayRelease.detail/traffic/action/permission.*` 中英成对键 |
| 用例 | `tests/ui/specs|tests/kube-frontend/app-workloads/TC-L3-…-GRAY_RELEASE-0{1..8}*` | 规格 + 一一镜像的 pytest |
| 页面对象 | `tests/ui/pages/canary_page.py` | 新增：详情/弹窗/回读辅助 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `GET …/namespaces/<ns>/strategies` | `StrategyList` | `items[]` 为完整 Strategy；列表客户端过滤，不分页 | 列表页 |
| `GET …/strategies/<name>` | `Strategy` | 详情与写前读取（`resourceVersion`） | 详情页 |
| `POST …/strategies` | `Strategy` | 创建；Canary/Bluegreen/Mirror 的初始 VirtualService 见下 | 创建向导 |
| `PUT …/strategies/<name>` | `Strategy` | 整对象替换；流量、接管、暂停/恢复都用它 | 详情页 |
| `DELETE …/strategies/<name>` | — | 删除；404 视为已删除 | 详情页/用例 |
| `StrategySummary.versionOrder` | `string[]` | 版本子集，新版本在前、参考版本在后；空数组表示对象没有路由 | 列表版本列 |
| `StrategySummary.weights` | `Record<string, number>` | 每个版本的显式权重；没有条目表示对象未设置，不补 0 | 列表版本列 |
| `StrategyDetail.mode` | `traffic / content / bluegreen / mirror / unknown` | 由 type + http/tcp 规则形状派生 | 详情/弹窗 |
| `StrategyDetail.versions` | `StrategyVersion[]` | 版本、角色（principal/canary/mirror）、权重、是否接管 | 详情版本卡 |
| `StrategyDetail.matchRules` | `StrategyMatchRule[]` | 规则序号、匹配项与键、匹配方式、值、目标版本 | 详情匹配规则表 |
| `StrategyDetail.conditions` | `StrategyCondition[]` | type/status/reason/message/lastTransitionTime | 详情条件表 |
| `withTrafficWeight(item, weight)` | 纯函数 | 写两条权重并同步 governor（0/100/其余） | 详情/弹窗/单测 |
| `withGovernor/pausedStrategy/resumedStrategy/withBluegreenVersion` | 纯函数 | 接管、暂停、恢复、蓝绿切换 | 详情/弹窗/单测 |
| `grayrelease:surface/search/retry/create/open:<name>/created` | `data-ai-id` | 列表四态、搜索、创建、下钻、成功提示 | 自动化与智能体 |
| `grayrelease-detail:surface/back/edit-traffic/pause/resume/delete/notice/attributes/versions/match-rules/conditions/workload:<name>` | `data-ai-id` | 详情区块与操作 | 自动化与智能体 |
| `grayrelease-traffic:dialog/slider/weight/summary/mode:*/version:*/submit/cancel/error` | `data-ai-id` | 调整流量弹窗 | 自动化与智能体 |

初始 VirtualService（实测被 API 接受）：

    spec:
      type: Canary | Bluegreen | Mirror
      principal: v1
      governor: <Canary 0%→v1 / 100%→v2 / 其余空；Bluegreen/Mirror→v1>
      strategyPolicy: WaitForWorkloadReady
      selector: { matchLabels: { app: <target> } }
      template:
        spec:
          hosts: [<target>]
          http:
            - route: [{destination: {host: <target>, subset: v1}, weight: 100-w}, {destination: {host: <target>, subset: v2}, weight: w}]
    # Bluegreen: 100/0；Mirror: route v1 100 + mirror: {host: <target>, subset: v2}

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：写操作只有创建 POST、流量/接管 PUT、删除 DELETE；页面不发其它写请求。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02**：类型与状态只由对象字段派生，不做字符串猜测；未知值原样显示或标为「未知」。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03**：0 条策略是 empty 态，读取失败是 error 态，两者不互相伪装。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04**：点「下一步」不产生写请求；只有「确认创建」发 POST。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05**：创建成功后列表重新拉取、行可见；失败时弹窗不关闭且显示服务端原因。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06**：创建的 selector 与 host 都来自所选 Deployment 的同一标识。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07**：`spec.governor` 与权重始终一致：100% 时等于新版本、0% 时等于参考版本、中间值必须为空字符串；暂停只改 governor、不改权重。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08**：未设置权重显示「未设置（Istio 默认均分）」；真实 0 显示 0%，两者不混用。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-09**：找不到对应 Deployment 显示「未找到对应工作负载」，不显示 0/0、不生成死链。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-10**：匹配规则表中的每一行都来自对象 `match[]`；未建模类型以「其他」出现，不静默丢弃。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-11**：条件为空时状态为「未知」并显示解释；条件存在时按 Complete/Failed 派生。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-12**：权限检查仅在明确 `allowed=false` 时禁用/隐藏写入口。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01** | 老 console 的 `spec.assemblyPhase` 在当前 CRD schema 中不存在 | 照抄 mapper 会永远读到空状态 | `strategyStatusOf` 改读 `status.conditions` |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02** | Istio host 是策略的目标服务，不是策略名 | 目标服务列显示策略名，读者以为发布了另一个服务 | `targetServiceOf` 优先 `hosts[0]` |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03** | CRD 列表无 `totalItems`、无分页参数 | 照搬服务端分页会传无效参数并显示错误总数 | 一次读全部，客户端过滤与分页 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04** | 刚创建的策略没有 condition | 把「无 condition」当失败或进行中都是错的 | 归为「未知」，等控制器写入 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05** | 原生端点在多集群需要 `clusters/<id>` 段 | 成员集群读不到策略 | 路径拼装与其他原生 kube 路径同形；本环境只验证 host |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06** | CRD 会裁剪 `template.metadata.labels`（回读为 `{}`） | 回读断言该字段会误判创建失败 | 只断言 selector/hosts/type 与控制器实际保留的字段 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07** | 刚创建的对象没有 condition | 列表立即显示「已完成/失败」都是猜的 | 派生规则归为「未知」 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08** | 写用例不留垃圾会污染全局 verify | 后续列表用例看到意外行、计数断言失败 | 用例 finally DELETE，并断言计数回到创建前 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-09** | `spec.governor` 非空时权重不生效 | 调了权重但流量不变，被当成保存失败 | 写权重时同步维护 governor（`INV-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07`） |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-10** | 没有 servicemesh 控制器（全集群无该 Deployment） | 把「条件永远为空」当成页面 bug 反复排查 | 条件为空时显示原因说明；控制器缺失登记阻塞 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-11** | 未显式写 `weight` 时 Istio 按均分处理 | 把缺省权重显示成 0% 会误导读者关掉一个版本 | 缺省显示「未设置（Istio 默认均分）」，编辑器初始 50 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-12** | 内容分流对象有两条 http 规则，第一条没有 match | 只改第一条权重会破坏匹配语义，且第二条仍把流量送到新版本 | `withTrafficWeight` 拒绝「没有两条版本路由」的对象；内容模式走 governor |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-13** | 删除 Strategy 不会删除版本 Deployment | 留下一个仍在跑副本的 v2 工作负载，占用资源且无人认领 | 删除只删 Strategy，交付记录与提示说明需单独清理 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-14** | PUT 会把 body 里的 status 一起保存 | 以为 status 只读、测试无法造条件 | 用例用 PUT 注入 condition 验证派生（DEC-11） |

## 测试与可观测

- **单元**：`packages/api-client/test/servicemesh.test.ts`（18 例）覆盖状态派生、目标服务回退、摘要版本/权重、详情四模式、匹配规则展开（含未建模类型）、条件映射、`withTrafficWeight` 边界与 governor 一致性、暂停/恢复保留权重、蓝绿切换、不可变性。
- **端到端**：8 条 point 用例（GRAY_RELEASE-01..08）分别覆盖列表/版本列、创建（含初始流量与三类型字段）、详情四区块、条件（注入 Complete/Failed + 空条件）、流量编辑回读、暂停/恢复回读、删除回读 404、权限门控（拦截 SSAR 返回 false 分支 + 真实 admin 分支）。写用例 finally 删除并断言计数回到创建前。
- **手动验证**：1024/1280/1600 三档与中英文截图人工核对区块顺序、栅格、徽章可读性与无横向溢出。
- **日志 / 指标**：不适用；失败看 `strategies` 响应、SSAR 结果与错误面板。

## 后续改进

- 监控曲线（请求量/成功率/延迟/TCP 收发）在本环境有 kapis 指标端点问题与控制器缺失，登记待补；恢复后接入集群监控指标页的图表组件。
- 版本工作负载的所有者标记（ownerReferences/注解）落地后，删除可安全级联。
- 匹配规则可视化编辑（cookie/header/URL/OS）。
- 流量变更历史与回滚（依赖后端记录）。
- 成员集群路径与受限账号 403 分支验收。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08`
