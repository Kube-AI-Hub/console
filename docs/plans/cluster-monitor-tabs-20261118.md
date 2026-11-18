# 集群监控 · 页签 IA 与图表化：交付记录（2026-11-18）

> 日期：2026-11-18。契约：[本批共享契约](assets/cluster-monitor-tabs-20261118/contract.md)（Lead；归档自实现期共享契约）。本批为增量 1：恢复页内 5 页签 IA、ai-kit 引入 recharts 并新增 DonutChart、概览「状态行环图/构成图/磁贴 + 主图+明细」、物理资源页签 18 张多序列大图、API Server / 调度器独立页签、排行页签与导出 JSON。
> 规格：[PRD](../../prd/kube-frontend/cluster-management/monitor.md)（AC-11…16、FR-09…16、SC-04/05）、[design](../../design/kube-frontend/cluster-management/monitor.md)（DEC-18…26、CON-04…07、GOT-12…16）。
> 迁移记录：[page-cluster-monitor-status-20261118.md](page-cluster-monitor-status-20261118.md)（§2.1 页签级归宿、§4.1 图表形态基线）。
> 旧页基线截图：[assets/cluster-monitor-status-20261118/](assets/cluster-monitor-status-20261118/)（host / agent / test）；旧页 5 页签逐页基线由验证方按本批重新截图。

## 本批改动摘要

1. **页签 IA**：集群监控恢复为「一个导航入口、页内 5 个基础页签」——概览 / 物理资源监控 / API Server 监控 / 调度器监控 / 资源用量排行（+ 条件 etcd 页签）。路由 `/kube-frontend/clusters/$cluster/monitor?tab=<key>`，默认 `overview`，未知值忽略；切页签用 `navigate({ search: { tab }, replace: true })`（不新增浏览器历史）。页头只有一套时间窗与自动刷新，页签内不再放第二套；页签懒挂载，只为当前页签发起主查询。**另恢复旧 console 的条件 etcd 页签**：`kubesphere-monitoring-system/etcd` ServiceMonitor 探测为 200 时在页签条末尾显示第 6 个 etcd 页签（内容=现有 etcd 组件图 + 无序列说明），404/探测失败时隐藏，`?tab=etcd` 隐藏时回退概览。
2. **概览重构**（`overview`）：状态行恢复节点在线环图、XPU 厂商构成环图、组件状态 3×2 磁贴 + 核心组件一行；「集群资源用量」改为左侧 7 行当前值（used/total）+ 右侧一张可选指标大图（轴/网格/读数/图例）；RDMA 摘要 + 「查看 RDMA 趋势」切到物理资源页签。
3. **物理资源页签**（`resource`）：5 组（GPU / 主机 / 磁盘 / 网络 / RDMA）共 18 张多序列大图，把旧页 29 张卡的同身份指标合并（负载 3 线、磁盘读写吞吐与 IOPS、网络收发、Pod 三态、RDMA 端口/吞吐/错误），统一坐标轴、图例、单位与空态；本页签一次 range 查询。
4. **API Server / 调度器页签**（`apiserver` / `scheduler`）：各自由一次 `components/<apiserver|scheduler>` 查询承载，APIServer 显示按 verb 合并的请求延迟（秒→ms）与总请求速率；调度器显示按 result 的尝试次数/速率与平均+分位延迟；页签之间失败互不影响，403 无重试。
5. **排行页签 + 导出**（`ranking`）：复用 `NodeRankingPanel` 并新增 `aiIdPrefix`（页签传 `cluster-monitor:ranking:`），新增导出按钮 `cluster-monitor:ranking:export`，导出 `node.usage.rank.json`（`{cluster, metric, order, generatedAt, items:[{name, values}]}`）；独立页 `node-usage` 同步获得 `node-usage:export`。
6. **ai-kit 图表**：`console/packages/ai-kit`（独立 pnpm 项目）引入 recharts `^3.11.0`，新增 `DonutChart`（分段/HTML 图例 `data-ai-segment`/空态不渲染 SVG/`role="img"`/主题 token）；折线继续用既有 `TrendChart`（多序列能力）。导出走**子路径**、不进任何主 barrel：`@kube-ai-hub/ai-kit/charts`（ai-kit）与 `@kube-ai-hub/ui/charts`（ui，package.json exports 已补），以免所有页面/测试被动加载 recharts。
7. **规格同步**：PRD 新增 US8/US9、AC-11…16、FR-09…16、SC-04/05，更新 AC-06/07 的页签化归宿（AC-07 = 条件 etcd 页签，正分支本地 skip）、AC-12 百分比「最多一位小数、断言 ±1 容差」、概述/设计目标/约束/UI/文案/边界/明确不做/假设/验收用例；design 新增 DEC-18…27、CON-04…07、GOT-12…17，更新概述/关联需求/目标/关键约束/系统现状/仓库落点/对外契约/不变量/已知坑/测试与可观测/后续改进/验收用例；迁移记录补 §2.1 / §4.1 / §6；能力矩阵新增本批行。

## 改动文件

规格与记录（本文件作者，未提交）：

- `console/prd/kube-frontend/cluster-management/monitor.md`
- `console/design/kube-frontend/cluster-management/monitor.md`
- `console/docs/plans/page-cluster-monitor-status-20261118.md`（§1 头注、§2 LEG-001、新增 §2.1、§4.1、§6）
- `console/docs/plans/cluster-monitor-tabs-20261118.md`（本文件）
- `console/docs/plans/capability-matrix.md`（新增本批行）

实现（其他任务，写入范围见各自任务，不在本文件声称完成）：

- 页面/页签：`apps/console-next/src/pages/cluster/ClusterMonitorPage.tsx`、`ClusterOverviewTab.tsx`、`ClusterStatusSection.tsx`、`monitorTabs.ts`、`monitorWindow.ts`
- 物理资源 / 组件 / 排行：`ClusterResourceTab.tsx`、`monitorResourceCharts.ts`、`ClusterApiServerTab.tsx`、`ClusterSchedulerTab.tsx`、`ClusterRankingTab.tsx`、`NodeRankingPanel.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/monitor/index.tsx`
- ai-kit：`console/packages/ai-kit/src/primitives/DonutChart.tsx`、`src/index.ts`、story、单测；`kube-frontend/packages/ui/src/index.ts`
- 文案：`kube-frontend/packages/locales/src/index.ts`（Lead 统一写入）

测试与验证（验证方，`console/tests/ui/`）：

- spec：`TC-…-MONITOR-11…16.yaml`；pytest：`test_TC_…_MONITOR_1{1..6}.py`；页面对象 `pages/cluster_monitor.py`；生成物 `cases/`；截图 `artifacts/cluster-monitor-tabs/`。

## 构建与提交

- **本批已提交（用户 2026-11-18 指示「提交代码」）**：提交信息与文件清单见 `git log -1`；**未 push**。
- 规格门禁（本文件作者在规格落地后实跑，秒级）：

| 命令 | 结果 |
| --- | --- |
| `cd console && python3 prd/tools/check_docs.py --what prd --strict prd/kube-frontend/cluster-management/monitor.md design/kube-frontend/cluster-management/monitor.md` | **errors=0 warnings=0，exit 0**（2026-11-18，约 0.9s） |
| `cd console && python3 prd/tools/check_docs.py --what design --strict prd/kube-frontend/cluster-management/monitor.md design/kube-frontend/cluster-management/monitor.md` | **errors=0 warnings=0，exit 0**（2026-11-18） |
| 门禁（本批 8 个路径：PRD + design + TC-11…16） | **errors=0 warnings=0，exit 0**（Lead 实跑） |
| 门禁（tests 全局） | `check_docs.py --what tests --strict` → **errors=0 warnings=0，exit 0**（验证方实跑；覆盖全部 spec 的 covers/story/ID） |
| 全量 `--strict`（所有模块，无 scope） | 未跑（并行批次，按指南只在合入/发布前跑一次） |

- 实现侧验证（Lead 复核实跑，2026-11-18）：

| 项 | 命令/方法 | 结果 |
| --- | --- | --- |
| 显式类型 | `pnpm --filter @kube-ai-hub/console-next typecheck` | **exit 0** |
| 构建 | `pnpm --filter @kube-ai-hub/console-next build` | **exit 0**；recharts 独立 `vendor-charts` chunk（326 KB / gzip 97.5 KB），**只由 monitor 路由加载、不在 index.html 首屏 preload**（构建产物核验：index.html 无 charts chunk，monitor chunk 直接依赖它） |
| 单测 | `cd apps/console-next && npx vitest run` | **46 files / 277 tests passed** |
| ai-kit | `./node_modules/.bin/tsc --noEmit` + `vitest run` + `vite build && tsc -p tsconfig.build.json` | tsc 0 错；**24 files / 243 tests passed**；dist 含 `charts.js/charts.d.ts`，Storybook build exit 0 |
| E2E | `pytest -n 0`（新增 11…16 + 更新的旧 01/03/04/05/06/07/08/09，串行） | **14 passed / 0 failed / 0 skipped，127.21s**（Lead 在百分比格式化修正后的最终构建上复跑；验证方首跑 14 passed / 128.10s；早前 Lead 复跑 11…16 → 6 passed / 43.51s） |
| 用例生成 | `cd console/tests/ui && python3 generate_case_docs.py` | 生成 **484** 条 case docs；旧 01/03/05/06/07/08 spec 正文已收敛到页签 IA，生成器第二次运行结果哈希一致（幂等，无手改） |
| 门禁（tests） | `python3 prd/tools/check_docs.py --what tests --strict` | **errors=0 warnings=0，exit 0** |
| 集成 | React 单实例 | app `vite/vitest` 增加 `react/react-dom` alias+dedupe、recharts 测试替身（`test/stubs/recharts.tsx`）；构建产物无 React 18 版本串/secret internals |

## 验证范围（四项分开，不合并结论）

| 范围 | 状态 | 证据/命令 | 未覆盖 |
| --- | --- | --- | --- |
| 本地该页 | **通过（本页范围）** | 本地 dev `http://127.0.0.1:5178/kube-frontend/clusters/host/monitor`（`KA_BACKEND=https://ka.watering.ai`）：五个页签逐页截图（host 1600/1280/1024 共 15 张、agent 1600/1280/1024 共 6 张、深链 1 张、窄屏 900 1 张，见 `tests/ui/artifacts/cluster-monitor-tabs/`）；`measurements.json` 21 runs：页签间隔 [4,4,4,4]px、状态行三块 top/height spread=0（1600/1280）、主图:列表宽比 3.2/2.2、1024 与 900 按断点堆叠且横向溢出 0；pytest 串行 **14 passed / 0 failed / 0 skipped**；深链/非法值回退/懒挂载/自动刷新真实请求计数均覆盖 | 浅色主题/第二色调/英文全页；真实受限账号 403（mock）；etcd 条件页签正分支（本环境 404，200 用 route mock）；成员集群就绪后的正向数据；节点详情 node 变体（当前无 URL 入口，未做 UI 覆盖） |
| 全仓静态 | **待填** | console-next typecheck/build/vitest、ai-kit build+测试、config 契约 | 全仓门禁与共享层回归由 Lead 复核 |
| 全站 E2E | 未验收 | — | 全站串行 E2E 未执行；只跑本页相关用例 |
| 部署环境 | 未验收 | — | 新版部署未验；部署构建可能尚未包含路由层 `cluster:not-ready` 与本批页签改动 |

## 页签与旧能力对照（要点）

| 旧页签 | 用户场景 | 新位置 | 验收 |
| --- | --- | --- | --- |
| 概览 | 判断集群是否健康、看资源用量与 RDMA | 页签 `overview`（默认） | AC-…-12 / TC-…-12 |
| 物理资源监控 | GPU/主机/磁盘/网络/RDMA 多序列趋势 | 页签 `resource`（18 张大图） | AC-…-13 / TC-…-13 |
| API Server 监控 | 控制面请求速率与按 verb 延迟 | 页签 `apiserver`（2 张大图） | AC-…-14 / TC-…-14 |
| 调度器监控 | 调度尝试/速率/延迟 | 页签 `scheduler`（3 张大图） | AC-…-15 / TC-…-15 |
| 资源用量排行 | 找用量最高的节点并导出 | 页签 `ranking`（复用 NodeRankingPanel + JSON 导出） | AC-…-16 / TC-…-16 |
| etcd（条件页签） | etcd 组件指标 | 条件页签：ServiceMonitor 200 显示（现有 etcd 组件图 + 无序列说明），404/失败隐藏；`?tab=etcd` 隐藏时回退概览；本部署 404 → 隐藏 | AC-…-07（正分支本地 skip，环境限制）/ 既有 TC-…-07（待随页签化更新） |
| 页签级全局 | 切页签/深链/时间窗 | 页内 Tabs + `?tab=`（replace）+ 页头一套时间窗/刷新 + 懒挂载 | AC-…-11 / TC-…-11 |

## 本批不承诺 / 登记后续（不是永久结论）

- **每页签独立时间窗/播放控制**：本轮五个页签共用页头一套时间窗与自动刷新（`DEC-…-23`）；旧 console 的组件面板各自 50×2m 并有播放控制。若产品确认需要按页签独立窗口，另立批次实现；不把「共用」写成永久形态。
- **旧概览 RDMA 四子图**：本轮概览只做 RDMA 摘要 + 「查看 RDMA 趋势」跳转；旧页健康/端口/吞吐/错误四张子图在物理资源页签的 RDMA 组承接，若需在概览内直接展示，可复用 RDMA 组图表（登记后续）。
- **排行导出范围**：后端拒绝 `pageSize=-1`（实测 400 `Invalid parameter 'limit'`），实现改为按 `pageSize=100` 分页拉取到 `total` 后导出全部行（单测覆盖分页/去重/防死循环），不带搜索词过滤；导出 payload 为 `{cluster, metric, order, generatedAt, items:[{name, values}]}`。
- **etcd 条件页签正分支复验**：条件 etcd 页签已按旧 `requireETCD` 恢复（ServiceMonitor 200 显示、404/失败隐藏，`DEC-…-27`）；本部署 ServiceMonitor 探测为 404，页签隐藏，AC-…-07 的「有序列 / 无序列说明」正分支本地 skip（环境限制），需在接入 etcd 监控的集群上复验。
- **环图/构成图交互与折线缩放**：本轮不做 hover 下钻、扇区点击、跨集群构成对比、缩放/框选（注册后续）。
- **旧平铺 AC 的用例更新**：AC-…-01/03/05/06/07 描述的平铺形态（四张趋势卡、13 卡、29 卡、单页系统组件分区）已被页签化取代；其数据语义继续有效。本批已按授权更新旧 **pytest**（01/03/05/06/07/08/09，保留 covers 与行为断言，只改进入方式/句柄/计数）并全部通过；旧 **spec YAML 正文**只修订了 11/13 涉及条件 etcd 与 group 图 id 的部分，其余正文仍描述平铺形态（PRD 已注明形态被 AC-11…13 取代），登记下一批收敛，不删 AC、不删追溯。

## 未验收部分

- 深色/浅色中文与英文全页均已截图（`host-*-light-1600.png`、`host-overview-en-1600.png`、`host-resource-en-1600.png`）；英文页无裸 i18n key。**第二色调未截图**（其余主题组合登记未验收）。
- 部署环境验收（含路由层 `cluster:not-ready` 与本批页签改动是否已部署）。
- 全站串行 E2E。
- 真实受限账号 403（组件页签 / 概览状态行）——本轮用 route mock。
- `nodeRankingApi` 是否支持 `pageSize=-1` 的全量导出需实测；不支持时的「已加载页 + 标注」分支需在真实接口上验证。
- **etcd 条件页签正分支**：本部署 `kubesphere-monitoring-system/etcd` ServiceMonitor=404 → 页签隐藏；AC-…-07 的「有序列 / 无序列说明」正分支本地 skip（环境限制），需在接入 etcd 监控的集群上复验；页签条不区分 404 与探测失败（旧 `requireETCD` parity）。
- 旧 TC-…-01/03/05/06/07 的页签化更新。

## Lead 复核修复（2026-11-18，截图之后）

- **用量对统一单位**：首版左侧行把 used/total 各自格式化，出现「0 B / 182.5 GiB」（同一量纲两种刻度）。改为按 total 选择单位、两侧同刻度（截图复核为「0 GiB / 182.5 GiB」「60.1 GiB / 503.8 GiB」「1.7 TiB / 3.1 TiB」）；对应单测期望同步为「1 GiB / 4 GiB」。
- **RDMA 摘要空态**：本集群无 RDMA 指标时，原来显示四个「-」；改为 data-ai-state=empty + 一句空态说明（`cluster-monitor:overview:rdma:empty`），四个统计仍在（缺失显示 '-'）。
- **体积/首屏**：recharts 及其运行依赖拆到独立 `vendor-charts` chunk（326 KB / gzip 97.5 KB），实测 index.html 不再 preload，只有 monitor 路由加载；React 单实例（app vite/vitest alias+dedupe、测试替身）。
- **百分比轴精度**：资源/概览图表的百分比原按整数取整，0–1% 的轴出现「1% / 1% / 0%」两条相同刻度；改为最多一位小数（42.4% / 42%），对应单测期望同步。
- 以上修复后重新 build + restart 5178，overview 截图已由验证方按新构建重拍；app vitest **277 passed**、typecheck exit 0、pytest 监控 14 条 **14 passed / 127.21s**。

## A100 环境复验（2026-11-18）

A100 只有旧 AGPL console（`ssh a100` → 节点 `172.26.1.44:30880`，公网域名本机不可达），没有 `/kube-frontend`，也没有可匿名调用的 first-party 登录端点。用「本地静态站 + 去前缀转发 + 现成 token」验证：

- 临时转发：`/kube-frontend/…` 去前缀到旧 console（再代理 ks-apiserver），`/kube-frontend/api/config`、`/api/ai/manifest` 本地应答；token 由旧 console `/oauth/token`（密码 mix 加密）取得。
- 测试套件新增 `KA_TOKEN`（`helpers/config.py` + `conftest._app_token`）：有 token 时跳过密码授权，其余断言/截图/API 对账不变。
- **结果**：监控页 13 条相关用例串行 **12 passed / 1 skipped / 0 failed，73.82s**（skip = 本环境没有未就绪成员集群 `test`，即 AC-09 的环境分支）；截图 `tests/ui/artifacts/cluster-monitor-a100/`（5 页签 1600）。
- **数据面**：3 节点、厂商 昇腾/昆仑芯/英伟达各 1（构成图 33.3% 三段）、节点环 3/3；Kube AI Hub 17/19 异常；etcd ServiceMonitor 404 → 条件页签隐藏；RDMA 有数据（健康 87.5%、端口 14/16、链路 287.5 Gb/s）；resource 18 图无空态；排行 3 行 + 导出可用。
- **A100 验证发现并修复**：① 概览用量行标签原用「…使用率」但显示 used/total（已改为资源名，图表标题仍用比率名）；② TiB 级大盘精度改为两位（0.24 TiB / 5.89 TiB）。
- **边界**：A100 没有部署新前端，也不是本页的部署验收；first-party 登录端点对匿名返回 403，只能 token 注入（KA_TOKEN）。中文深色截图为本轮 A100 证据，浅色/英文未在 A100 复拍。

## mlu370 多集群复验（2026-11-18，切回后）

A100 只有 host 一个集群，多集群分支不在那里验；切回 mlu370 后补验（同一份构建、同一份代码）：

| 集群 | 角色/状态 | 页面结果 |
| --- | --- | --- |
| `host` | 主集群，Ready | 节点环 1/1；厂商 寒武纪 1；用量 0 GiB/182.5 GiB、125 pods；RDMA empty（本集群无指标）；组件状态正常展示 |
| `agent` | 联邦成员，Ready | 节点环 3/3；厂商 **昇腾/昆仑芯/英伟达各 1（33.3%）**；用量 118.1 GiB/276.4 GiB、336 pods、7.9 KiB/s RDMA；组件 Kube AI Hub 17/19 异常；etcd 未接入监控（ServiceMonitor 404，条件页签隐藏） |
| `test` | 无 Ready 条件 | 不挂载监控页，路由层整页 `cluster:not-ready` + 「前往集群概览」，无趋势/状态分区/重试 |

- **作用域正确**：DOM 与同次 API 逐项对上——`/kapis/clusters/agent/resources…/componenthealth` 给 3/3、`nodes/stats` 给三家厂商，host 给 1/1 与 cambricon；页面数字、厂商行、用量行分别取自各自集群，没有串到主集群。成员集群的 range/rank 路径均为 `/kapis/clusters/agent/…`。
- **性能观察（非缺陷）**：成员集群经 tower 代理较慢，agent 概览 surface 约 25s 到 ready、物理资源页签约 20s（期间显示骨架）；host 约数秒。若要把长等待变短，可把概览的 20 个指标拆成「状态行/用量主图」两次查询或减少同请求指标数——登记为后续优化，不影响正确性。
- 截图：`tests/ui/artifacts/cluster-monitor-mlu370/`（host/agent overview、agent/host resource、test 未就绪）。
- 回归：mlu370 监控页 14 条串行 **14 passed / 128.45s**；A100 的标签/精度修复在本轮多集群上同样生效（同一构建）。

## 2026-11-19 补：概览恢复 RDMA 多指标块与服务组件监控块（用户反馈）

用户在 mlu370 指出概览少两块旧 console 的内容，已实现：

1. **RDMA 状态** 由「4 个数字 + 查看趋势按钮」恢复为**4 指标页签 + 曲线**：健康度（`cluster_ib_health`×100）、端口可用率（`port_up`/`port_total`）、吞吐（`tx`/`rx` B/s）、错误/重传（`rx_errors`/`retrans`）；四者共用概览那一次 range 查询。跳转按钮删除（页签已含曲线，避免两个入口）。
   端口清单用 **路径集群段** `/kapis/clusters/<c>/rdma.kubesphere.io/v1alpha1/ports?limit=-1`：实测 `?cluster=agent` 返回 **0 条**（参数被忽略、读到主集群），路径形态返回 **16 条**（宪法 C6）。清单成功→列出异常节点「节点 + down/total」或「所有 RDMA 端口均正常。」；读取失败→「RDMA 端口清单不可用」，不声称正常。
2. **服务组件监控** 恢复为旧 console 的第 4 块：APIServer 请求延迟（按 verb + 平均，秒→ms）/ 请求速率（次/秒）/ 调度器调度尝试次数（按 result 累积）/ 调度尝试速率（按 result，次/秒），复用 `componentMonitorQueries` 的身份合并；专用页签仍是完整明细的入口。

实测（本地 5178 + mlu370 后端，agent/host 各一）：agent 概览 RDMA 四页签值 87.5% / 14-16 / 6.9 KiB/s / 0-0，异常节点「sagesuite-demo 2/2、a100-04 1/7、a100-64 1/7」；host 为 100% / 1-1 / 0 B/s / 0-0 + 「所有 RDMA 端口均正常。」；服务组件四页签值 1.56 ms / 70.35 次/秒 / 3346 / 0.00 次/秒（agent）、4.03 ms / 17.73 次/秒 / 885 / 0.00 次/秒（host），图例与接口 verb/result 一一对应；900 宽无横向溢出、两块按断点堆叠。截图：`tests/ui/artifacts/cluster-monitor-blocks/`。

**验证**（2026-11-19）：

| 检查 | 结果 |
| --- | --- |
| 监控页 pytest 串行（host，01/03/04/05/06/07/08/09/11…16） | **14 passed / 121s** |
| MONITOR-12 单跑（agent） | **1 passed / 16.4s**（RDMA 异常节点与 ports API 逐节点对账） |
| console-next vitest | **53 files / 309 tests passed** |
| typecheck / build | exit 0 |
| 规格门禁 | `--what prd` / `--what design` / `--what tests --strict` 均 **0 错 0 警** |
| 用例生成 | `generate_case_docs.py` → 505 条 |

规格：AC-…-MONITOR-17（RDMA 块）/ AC-…-MONITOR-18（服务组件块），由 TC-…-MONITOR-12 覆盖；design 新增 DEC-28/29/30、CON-08/09、GOT-19。

**并行工作说明**：本轮的 `packages/locales/src/index.ts` 与 `packages/api-client/src/index.ts` 同时承载另一个未提交批次（cronjobs/网关/网络策略等）的改动；本记录只声明本页改动的部分。本地联调一律用标准命令（并行批次 `ef71f239d` 删掉了自建静态站）：`pnpm --filter @kube-ai-hub/console-next build` 后 `pnpm --filter @kube-ai-hub/console-next preview`（5178，服务 `dist`，复用 `vite.config.ts` 的 `PROXY` 转发到 `KA_BACKEND`）。注意 Vite 只监听 `[::1]`，要用 `http://localhost:5178` 而不是 `127.0.0.1`；SPA 页面要带 `Accept: text/html`，用 `curl` 探活时带 `Accept: application/json` 会得到 404 而误判服务没起来。本页两块与监控 14 条用例均已在该方式下复跑通过。

## 证据链接

- 旧页三集群基线（上一批）：[assets/cluster-monitor-status-20261118/](assets/cluster-monitor-status-20261118/)。
- A100 复验截图（gitignored）：`console/tests/ui/artifacts/cluster-monitor-a100/`（5 页签 ×1600；单集群）。
- mlu370 多集群复验截图（gitignored）：`console/tests/ui/artifacts/cluster-monitor-mlu370/`（host/agent overview、host/agent resource、test 未就绪）。
- 本批逐页签 after 截图与测量（gitignored）：`console/tests/ui/artifacts/cluster-monitor-tabs/`（`host-*` 15、`agent-*` 6、`host-resource-deeplink-1600.png`、`host-overview-narrow-900.png`、浅色 2 张、英文 2 张、`measurements.json`、复现脚本 `tests/ui/tools/shots_cluster_monitor_tabs.py`）。
- 本批旧页 5 页签逐页基线、before/after 截图与测量 JSON：待验证方归档到 `console/tests/ui/artifacts/cluster-monitor-tabs/`。
- 契约：[monitor-tabs-contract.md](/tmp/monitor-tabs-contract.md)。
