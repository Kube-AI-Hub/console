# 集群日志收集 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/log-collections.md)

## 概述

只读展示日志收集器，并把输入/输出按日志组件的 `component` 标签分成容器日志 / 事件 / 审计三个页签；收集项可打开只读详情（属性、匹配与过滤摘要、原始 YAML）。收集器健康由其 Pod 推导。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02

## 设计目标与非目标

目标：一屏回答「采集是否在跑、收什么、写哪」；三类日志分开看，接收器的匹配规则与原文 YAML 可查。非目标：编辑管道、日志检索、按时间窗过滤、跨集群视图。

## 关键约束

- `/apis/logging.kubesphere.io/v1alpha2/{fluentbits,inputs,outputs}`（kapis 无聚合，实测 404）。
- Pod：`/api/v1/namespaces/<ns>/pods?labelSelector=app.kubernetes.io/name=fluent-bit`。
- 分类只认日志组件写在对象上的 `logging.kubesphere.io/component` 标签（实测值：logging / events / auditing）；缺标签的对象归入容器日志，不丢弃。
- 详情只用已经读到的对象，不再发请求；YAML 用 `<pre>` 渲染，页面里没有任何写请求。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01 — 健康度取自 Pod，不取 CR status

**为什么**：本集群的 FluentBit CR `status` 是空对象（实测），直接渲染会显示一个恒为「未知」的徽标，等于没有信息。收集器自有 Pod 的 Running 数才是「采集是否真的在跑」。
**被否方案**：用 `status.conditions`。该字段不存在，代码会永远走兜底分支。
**何时重新考虑**：operator 开始上报 conditions 时（届时两者都显示）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02 — 直接读 CR，不走 kapis

**为什么**：`/kapis/logging.kubesphere.io/v1alpha2/*` 在本集群全部 404，而 `/apis/logging.kubesphere.io/v1alpha2/*` 正常返回。硬等聚合接口会把一个可用页面卡成不可用。
**被否方案**：等 kapis 修复。
**何时重新考虑**：聚合接口可用时（届时可减少一次标签查询）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-03 — 分类页签按 component 标签，且三个面板都保留在 DOM

**为什么**：老 console 的三个页签就是按 `logging.kubesphere.io/component` 过滤，标签是 operator 自己写的，不由前端从 path/match 反推——反推会在自定义插件上猜错。三个面板都用 `forceMount` 保留在 DOM（只把非当前页签隐藏），是因为 AC-01 的自动化断言的是「输入/输出总条数」：三个面板各装自己分类的行，合计仍等于 CR 总数，页签切换与旧用例两不误，也没有重复渲染任何一行。
**被否方案**：切页签时卸载其它面板（Radix 默认）——AC-01 的总数断言会只剩当前分类的条数，等于把一条旧验收场景改坏。
**何时重新考虑**：旧用例改成逐页签断言后，可以恢复默认卸载以省内存。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-04 — 详情是弹窗，不是新路由

**为什么**：详情内容全部来自列表已经读到的对象（Output 原文），打开不需要新请求；弹窗不会新增一条需要 registry/面包屑/面包屑权限的页面。老 console 的 `/log-collections/:component/:name` 是路由，但它的详情只有「资源状态」一屏，用一个只读弹窗表达同样信息更轻。
**被否方案**：新增 `$name` 路由。收益是深链接，代价是给一个只读弹窗造路由、面包屑与返回逻辑，还要再补一条用例。
**何时重新考虑**：需要从日志检索/告警直接深链到某个接收器时。

## 系统现状

老 console 的集群日志收集是「开关 + 采集配置 + 输出配置」的可编辑页，并按 logging / events / auditing 分三个页签展示接收器、每个接收器有只读详情页。新页面保留了收集器与输入清单（老页面没有），补上三页签与接收器详情（只读）。编辑与创建按明确不做登记。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterLogCollectionsPage.tsx`
- 数据层：`apps/console-next/src/pages/cluster/logCollectionsQueries.ts`（读原始 inputs/outputs、按 component 分类、映射成行）
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/log-collections/`
- 接口：`packages/api-client/src/iam.ts` 的 `clusterLoggingApi`（收集器与 Pod 统计）
- 区域注册：`areas/registry.ts`（集群设置分组）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 收集器 | /apis/logging.kubesphere.io/v1alpha2/fluentbits |
| 输入 | /apis/logging.kubesphere.io/v1alpha2/inputs |
| 输出 | /apis/logging.kubesphere.io/v1alpha2/outputs |
| 收集器 Pod | /api/v1/namespaces/&lt;ns&gt;/pods?labelSelector=app.kubernetes.io/name=fluent-bit |

`inputs` / `outputs` 每项用到的字段：`metadata.name`、`metadata.namespace`、`metadata.creationTimestamp`、`metadata.labels[logging.kubesphere.io/{component,enabled}]`、`spec.match` / `spec.matchRegex`、`spec.&lt;plugin&gt;.{host,port,logstashPrefix}`（输出）或 `spec.&lt;plugin&gt;.{tag,path,systemdFilter,excludePath}`（输入）。插件名取 spec 里第一个非 match/matchRegex 的键。

## 不变量

1. 三区条数与对应 CR 条数一致。
2. 就绪 Pod = Running / 总数。
3. 任一区块读失败只影响该区块。
4. 三个页签的收集项合计 = 全部 Output CR；每类只含该 component 的行。
5. 页面不发起写请求；详情的 YAML 与对象原文一致，且不提供编辑控件。

## 已知坑

- **CR status 为空**：不要据此判断健康。
- **kapis 404**：日志 CR 只在 `/apis` 下，走 kapis 会得到「页面永远空」。
- **component 标签缺失**：归入容器日志，否则该对象会从三个页签里消失。
- **面板同时存在于 DOM**：三个页签内容都挂载（见上方「分类页签」决策），因此 `data-ai-id` 会在三处出现；按可见性断言时要用 `:visible`，按总数断言时会自动合计。
- **YAML 只读**：用 `<pre>` 渲染，不引入编辑器；引入 CodeMirror 会把 188 KB 拖进这一页的首屏。
- **matchRegex**：正则匹配与普通 tag 匹配在界面上必须可区分，否则读者会以为 `(?:kube|service)\.(.*)` 是一个 tag。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01.yaml`、`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02.yaml`
可观测点：`cluster-log-collections:surface`、`:collectors`、`:collector-list`、`:input-list`、`:output-list`（三个页签各一份，合计等于 CR 总数）、`:tab:{logging,events,auditing}`、`:panel:<class>`、`:row:<name>`、`:detail`、`:yaml`、`:retry`。

## 后续改进

- 收集器/输出编辑（需要独立校验流程）。
- 日志检索（工具箱）。
- 详情支持深链接（先有外部引用需求时再做，见上方「详情是弹窗」决策）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02