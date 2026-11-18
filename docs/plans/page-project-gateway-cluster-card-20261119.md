# 项目网关页 · 集群网关卡片（2026-11-19）

> 本页记录：项目设置 › 网关页补回旧 console 的「集群网关」卡片（只读 + 链到集群网关详情），
> 以及本轮对**服务拓扑图**接口的探测结论（环境阻塞）。方法见[迁移指南](../legacy-ui-migration-guide.md)，
> 模板见[单页交付模板](page-migration-template.md)。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目作用域：在网关设置页回答「项目的应用路由从哪个网关出去、地址是什么」 |
| 旧入口、源码 | `projects/containers/Gateway/index.jsx`：先渲染集群网关卡片（`renderOperations` 的「查看详情」→ `/gateways/:gatewayName`），再渲染项目网关卡片 |
| 新入口、构建 | `apps/console-next/src/pages/settings/GatewayPage.tsx` 顶部新增 `gateway:cluster-gateway` 卡片；「查看详情」链到集群作用域的 `/kube-frontend/clusters/<c>/gateways/<name>`（四视图详情已交付） |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai` + 本地 preview 5178；admin |
| 子页面与状态范围 | 有集群网关（显示卡片）/ 没有（不渲染卡片）/ 集群网关读取失败（不阻断项目网关区块） |
| 明确排除及批准 | 不在项目页编辑集群网关（安装器职责，DEC-GATEWAY-04 记被否方案） |
| 并行文件与安全边界 | 只改该页、locale、该功能 PRD/design/spec/tests 与记录；无写入 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码证据 | 显示条件 | 字段/动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-GATEWAY-CLUSTER-001 | `Gateway/index.jsx:77-90` | 集群有网关 | 集群网关卡片（名称） | `gateway:cluster-gateway` | AC-GATEWAY-04 / TC-04 | 通过 |
| LEG-GATEWAY-CLUSTER-002 | 同上 | 同上 | 访问方式与访问地址 | 卡片内 `:cluster-type` / `:cluster-address` | 同上 | 通过 |
| LEG-GATEWAY-CLUSTER-003 | 同上 `renderOperations` | 同上 | 「查看详情」跳转 | `:cluster-gateway-detail` → 集群网关详情页 | 同上 | 通过 |

## 3. 数据契约与全链路

| 能力 ID | 请求 | 返回类型 | 字段 | 显示 | 缺值规则 | 对账 |
| --- | --- | --- | --- | --- | --- | --- |
| 001–003 | `GET /apis/gateway.kubesphere.io/v1alpha1/gateways`（集群级列表，含 Service 地址 join） | JSON | `name`、`type`、`address` | 卡片三行 | 地址未分配显示 `-`；集群无该对象 → 卡片不渲染 | 用例按同一列表读到的名称/类型/地址逐项核对 |

**选行规则**：API 客户端把 `kubesphere-system` / `kubesphere-controls-system` 里的 Gateway 都标为 cluster scope，但老式安装也把**项目**网关放在那里（`kubesphere-router-<project>`）。因此卡片只认安装器固定名 `kubesphere-router-kubesphere-system`，不会把某个项目的路由当成集群网关。

## 4. 交互、视觉与复用基线

- 卡片在项目网关区块**之上**（旧页顺序）；标题「集群网关」+ 右上「查看详情」链接。
- 三行属性复用 `DefinitionRow`；末尾一行说明「集群网关由安装器管理，项目内只读查看」。
- 集群没有网关时不渲染空卡。

## 5. 编码与回归

- [x] AC/design/spec/tests 同步；生成物重跑（502 篇）。
- [x] E2E 按同一列表读到的对象逐项核对名称/类型/地址与链接；集群没有该对象时 skip 而不是失败。
- [x] 网关相关既有用例同批复跑。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 3 条原子 ID | — |
| 数据语义 | 通过 | 与列表同源；地址缺省 `-` | — |
| 交互与权限 | 通过 | 只读 + 跳转；无编辑入口 | — |
| 视觉与主题 | 部分通过 | 1280 深色截图（`project-gateway-cluster-card`） | 1024/1600、浅色、英文 |
| 静态/类型/构建/测试 | 通过 | typecheck 0；build；strict 门禁 0/0；契约/单测见批次报告 | — |
| 本地全栈/mlu370 | 通过 | E2E 见 §7 | — |
| 新版部署/member/全站 | 未验收 | — | 生产、member、全站串行 E2E |

## 7. E2E（mlu370，`-n 0`）

| 用例 | 结果 |
| --- | --- |
| TC-…-PROJECT_SETTINGS-GATEWAY-04（新增） | 通过（4.17s） |
| 网关相关既有用例（01/02/03） | 通过（同一 `-k GATEWAY` 轮次：3 passed；新增用例首轮因选行标签写错而 skip，修正后单跑通过） |

附：本轮同时把 `test/list-page-size.test.tsx` 的 `waitFor` 默认 1s 超时提到 5s——全量并行跑时它偶发超时（单跑与再跑均通过），属测试自身对负载敏感，不是产品问题。

## 8. 本轮探测：服务拓扑图（环境阻塞，未实现）

旧 console 的服务页有「拓扑图」视图（条件入口 `network.topology`），数据来自后端聚合接口：

- 请求：`GET /kapis/network.kubesphere.io/v1alpha2/namespaces/<ns>/topology`
- 2026-11-19 在 mlu370（admin）实测：**500**，正文 `Get "http:///api/topology/services?namespace=<ns>": http: no Host in request URL`
- 结论：接口已注册但**所依赖的网络组件地址为空**（该部署未安装/未配置拓扑后端）。这不是「新 UI 没做」，也不是可以靠前端补齐的渲染问题——旧页同样拿不到数据。
- 复查条件：集群安装并配置拓扑后端后，重新探测该路径返回 200 且 `nodes`/`edges` 非空，再按「服务拓扑图」单元迁移（节点/边渲染、平移缩放、节点详情、自动刷新开关）。
