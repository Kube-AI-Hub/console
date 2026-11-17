# 集群切换与作用域侧栏（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-switch.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-05

## 概述

侧栏按作用域取菜单；集群作用域在侧栏顶部提供切换器。

## 系统现状

- 老 console：集群控制台侧栏 = `Selector`（当前集群，点击开 `ClusterSelectModal`）+ 集群 Nav；
  平台页 `/access`、`/settings` 有平台侧栏；`/clusters` 无侧栏。
- 本应用此前侧栏固定为项目区：平台页与集群页都显示项目条目，点击会进入 `default` 项目。

## 仓库落点

- `apps/console-next/src/shell/AppShell.tsx`（作用域判定与侧栏数据源）
- `apps/console-next/src/shell/ClusterSwitcher.tsx`
- `apps/console-next/src/shell/useMulticluster.ts`
- `apps/console-next/src/lib/lastCluster.ts`

## 对外契约

读 `/kapis/config.kubesphere.io/v1alpha2/configs/configz`（`multicluster`）与集群列表；
不做写操作。

## 设计目标与非目标

目标：侧栏永远对应当前作用域；切换一步到位。非目标：跨集群聚合、在切换器里管理集群。

## 关键约束

- 侧栏数据源不新增第三份清单：项目/集群取注册表，平台取头部已有的 `MODULES.platform.children`。
- `Menu` 用 `activeKey` 高亮，不认 `items[].checked`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-01 — 列表保持页面，另加切换器

**为什么**：老 console 两者都有且职责不同——列表承担增删改与深链接，切换器承担"已在集群里"的快速跳转。把列表改成弹窗会让添加/编辑/移除无处安放，也让 URL 无法直接定位某集群。

**被否方案**：把 `/clusters` 改成弹窗、从任意页面唤起。代价是丢失深链接与管理入口。

**何时重新考虑**：平台只有一两个集群且几乎不管理成员时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-02 — 平台页也显示平台导航

**为什么**：老 console 的 `/clusters` 无侧栏，但本应用若有侧栏却显示项目条目，就是在误导；统一为平台导航，同时修掉 `/access`、`/settings` 上的同一问题。

**被否方案**：仅隐藏 `/clusters` 的侧栏。代价是同类页面行为不一致。

**何时重新考虑**：平台页改为全宽布局时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-04 — 搜索与刷新共用一行，刷新靠右

**为什么**：搜索框和刷新按钮作用于同一份列表。刷新单独占一行时，它夹在搜索框与列表之间，读起来像一个与两边都无关的控件，还多吃掉一行高度（512px 宽弹窗里那一行 36px 全是空白）。

**被否方案**：把刷新放进弹窗 footer 的按钮组。footer 是「关闭/管理集群」这类页面级动作，刷新是列表级动作，混在一起会让人以为刷新会关掉弹窗。

**何时重新考虑**：弹窗里出现第二个列表级控件（如筛选）时，那时该抽一条工具栏。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-05 — 别名单独记忆，且列表随外壳加载

**为什么**：触发按钮的标签是别名，而别名只存在于集群列表响应里。列表原先只在弹窗打开时请求，于是整页刷新后按钮退回集群名——同一个集群在一次刷新前后换了个称呼。别名是「读者认识的名字」，不应该因为刷新而消失。

两层修正：列表随外壳加载（`staleTime` 60s，与集群列表页、工作区栏共用同一 query key，不产生额外请求语义），标签在列表未到达时读 `localStorage` 里按用户+集群记忆的别名。

**被否方案**：把别名写进 URL 或路由状态。URL 是对象标识，塞展示名会让同一集群有多个地址；也不能解决直接输入地址进入的场景。

**何时重新考虑**：平台提供一次返回「当前集群概要」的接口时，可直接替代这份记忆。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-06 — 监控读取一律把集群放进路径

**为什么**：monitoring 处理器只从 `req.PathParameter` 读 `cluster`（`pkg/kapis/monitoring/v1alpha3/helper.go`），`?cluster=` 被忽略后由主集群作答。mlu370 实测（2026-11-17）：`?cluster=4paradigm` 返回主集群的 128 核，路径形态返回成员集群的 384 核。这不是报错而是**静默错数据**——面板有值、值属于另一个集群，比空白危险。

因此 `clusterMetricsApi`、`componentMetricsApi`、`rangeMetricsApi`（cluster/node/pod/workload/component）、`nodeRankingApi`、`nodeListApi.metrics`、`nodeInsightsApi.instant`、`nodeUsageApi`、`workloadRankingApi` 全部改走 `clusterScoped`，并停止发送无效的 `cluster=` 查询参数。

**被否方案**：在页面里判断集群再决定路径。监控调用点有十余处，逐个判断必然改漏，且漏掉的那一处不会报错。

**何时重新考虑**：后端开始识别 `cluster` 查询参数时（届时路径与查询二者等价，但仍建议保留路径形态）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-07 — 5xx 保留上游原因，不一律说「网络异常」

**为什么**：未就绪成员集群的所有读取都被 apiserver 拒绝为
`Internal Server Error: "/kapis/...": cluster <name> is not ready`。原实现把 5xx 一律映射成「网络异常，请稍后重试」——这句话既不对（不是网络问题），又引导读者去重试一个不会成功的请求。而在客户端，整串报错先被截到 300 字符，监控请求的路径与查询串把 300 字符用完后，真正的原因根本没进消息。

两处修正：客户端剥掉 `Internal Server Error: "<path>":` 包装再截断；共享的 `errorMessage` 在 5xx 携带具体原因时优先显示原因，仅当原因就是 `Internal Server Error` 这类无信息量的短语时才回退到本地化的「网络异常」。

**被否方案**：在概览页单独判断「集群未就绪」并特判文案。同一句话对所有 kapis 请求都成立，特判会让其他页面继续显示错误的「网络异常」。

**何时重新考虑**：后端开始返回结构化错误码（如 `cluster_not_ready`）时，改为按码取文案。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-03 — 切换后落到概览

**为什么**：与老 console 的 `enterCluster` 一致；并非每个集群都装了当前页所属模块，落到概览避免 404 观感。

**被否方案**：保持当前页面段。跨集群模块差异会让跳转后落到错误页。

**何时重新考虑**：集群模块信息可提前获知并在切换器里过滤。

## 不变量

1. 切换后侧栏的当前项就是「集群概览」。
2. 侧栏永不把平台/集群作用域的读者放进某个项目。
3. 切换器按钮的文字在一次整页刷新前后一致（别名优先，其次集群名）。
4. 任何区块的数值只属于地址里的那个集群：切换后重新读取，失败时不留上一集群的值。

## 已知坑

- `Menu` 只认 `activeKey`；给条目传 `checked` 不会产生 `aria-current`。
- Playwright 的 `to_have_url` 对 `**/...` 形式在含协议的完整 URL 上可能不匹配，用正则断言路径更稳。
- **监控 API 的 `cluster` 查询参数会被忽略**：只认路径段，详见 DEC-06。查询形态返回主集群数据且状态 200，看起来完全正常。
- **别名只存在于集群列表响应**：列表未加载时按钮只能退回集群名，所以要记忆（DEC-05），不能只在渲染处 `find`。
- **未就绪集群的错误是 500 而不是 404**：`cluster <name> is not ready`，走的是 5xx 分支，容易被映射成「网络异常」（DEC-07）。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`：切换往返、三处作用域侧栏内容与高亮、弹窗布局与刷新后标签、未就绪集群无上一集群数据。
接口契约见 `packages/api-client/test/monitoring-cluster-scope.test.ts`：每个监控读取的集群路径段。

## 后续改进

- 切换器内显示集群告警摘要。
- 记住每个集群上次访问的页面。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-04`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-05`
