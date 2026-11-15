# 集群监控 · 系统组件面板补齐（APIServer / Scheduler / etcd）

> 单元：task-8（CHECK-07 监控/图表/组件中的「系统组件面板」剩余项）。日期 2026-11-15。
> 方法：docs/legacy-ui-migration-guide.md；模板：docs/plans/page-migration-template.md。
> 规格：prd|design/kube-frontend/cluster-management/monitor.md（AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06/07、DEC-07…10、CON-02、GOT-03…06）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务 | 集群管理员在集群监控页判断控制面是否正常：APIServer 哪个 verb 变慢、Scheduler 调度成功/失败、etcd 是否被监控 |
| 旧入口/源码 | `clusters/containers/Monitor/Cluster/Monitor/{APIServer,Scheduler,Etcd}/index.jsx` + `stores/monitoring/component.js` + `stores/monitoring/base.js`（checkEtcd/requireETCD）；组件端点 `${apiVersion}/components/<module>` |
| 新入口/文件 | `/kube-frontend/clusters/<cluster>/monitor`；`pages/cluster/ClusterMonitorPage.tsx`（增量保留已有 5 组 29 张物理资源卡）、新建 `componentMonitorQueries.ts`、`monitorFormat.ts` |
| 环境/角色 | 本地全栈（5178 → BFF 8092 → 隧道 18088 → B200），host 集群，admin；深色主题，中文为主 + 英文复核 |
| 视口/语言 | 1024 / 1280 / 1600 × 900；中文与英文；浅色与第二色调未验收 |
| 子页面与状态 | 无独立子页；三个组件子组 × 加载/有数据/无数据(未上报)/错误/无权限；页面时间窗与自动刷新共用 |
| 明确排除及批准 | 旧 `ETCDNodes` 每节点服务状态卡（LEG-COMPONENT-014）登记待补，理由：本部署 etcd 无任何序列、无法验收；系统组件页已有组件健康数，但不冒充 leader/leader 变化明细 |
| 并行边界 | 只改 task-8 写作用域；工作树中 `pages/monitoring/**`、`ClusterAlertingMessagesPage.tsx`、`MonitoringListPage.tsx`、`RuleGroupsPage.tsx`、`prd|design/monitoring/*`、`docs/plans/capability-matrix.md` 等为并行同事在途，未触碰 |

## 2. 旧能力全集与归宿（原子 ID）

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-COMPONENT-001 | APIServer/index.jsx 的 MonitoringController title | 始终 | 面板标题「API Server 监控」 | 改进：页内「系统组件」下的 API Server 子组标题 | AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06；TC-…-MONITOR-06 断言子组顺序 API Server → Scheduler → etcd | 通过 |
| LEG-COMPONENT-002 | APIServer getMonitoringCfgs[0]：request_latencies_total + request_latencies_apis，unit ms | 有数据时 | 按 verb 的延迟 + TOTAL_AVERAGE，图例 10 项（CREATE/DELETE/DELETECOLLECTION/GET/POST/PATCH/PUT/UPDATE/LIST/TOTAL_AVERAGE） | 保留并改进：`apiserver_request_latencies`（平均）+ `apiserver_request_by_verb_latencies`（按 verb），单位秒→ms；图例按实际返回身份（DEC-09） | AC-…-MONITOR-06；TC-…-MONITOR-06 断言图例身份=接口有限值 verb 集合+平均、GET 显示值≈接口秒值×1000 | 通过（正分支实测） |
| LEG-COMPONENT-003 | APIServer getMonitoringCfgs[1]：apiserver_request_rate，unit TIMES_PER_SECOND | 有数据时 | 请求速率单序列 | 保留：请求速率卡片，次/秒；与按 verb 速率同请求 | AC-…-MONITOR-06；TC-…-MONITOR-06 断言总速率>0 且与各 verb 线之和偏差<20% | 通过 |
| LEG-COMPONENT-004 | named_metrics.go/APIServerMetrics 有 `apiserver_request_by_verb_rate`；旧 APIServer/index.jsx 未请求 | 有数据时 | 旧 console 未展示 | 新增（明确标注）：请求速率（按 verb）多序列卡 | AC-…-MONITOR-06；TC-…-MONITOR-06 断言 9 个 verb 身份齐全且各一条线 | 通过 |
| LEG-COMPONENT-005 | Scheduler getMonitoringCfgs[0]：scheduler_schedule_attempts，result scheduled/error/unschedulable | 有数据时 | 累积尝试次数，3 条线 | 保留：调度尝试次数卡，整数 | AC-…-MONITOR-06；TC-…-MONITOR-06 断言三条 result 线、整数、落在接口累积区间 | 通过（实测 4843/8/259） |
| LEG-COMPONENT-006 | Scheduler getMonitoringCfgs[1]：scheduler_schedule_attempt_rate | 有数据时 | 每秒尝试速率，3 条线 | 保留：调度尝试速率卡，次/秒 | AC-…-MONITOR-06；TC-…-MONITOR-06 断言三条线存在且为 x.xx 次/秒（本部署真实 0 显示 0.00，不是空态） | 通过 |
| LEG-COMPONENT-007 | Scheduler getMonitoringCfgs[2]：scheduler_e2e_scheduling_latency(_quantile) | 有数据时（旧 isEmpty 不渲染） | 99/90/50 分位 + 平均，ms | 保留：调度延迟卡，秒→ms；本部署 0 序列→显式空态 | AC-…-MONITOR-06；TC-…-MONITOR-06 断言该卡 no-data 且无曲线 | 通过（空态分支） |
| LEG-COMPONENT-008 | Etcd getMonitoringCfgs[0]：etcd_mvcc_db_size，unitType memory | 有数据时 | 数据库大小 | 保留：etcd DB 大小卡，字节按 1024 缩放 | AC-…-MONITOR-07（未上报分支）；实现与渲染路径见 §5 | 实现完成；本部署无序列，正分支未验收 |
| LEG-COMPONENT-009 | Etcd getMonitoringCfgs[1]：client grpc received/sent bytes，traffic | 有数据时 | 客户端收/发流量 | 保留：客户端流量卡，字节/秒 | 同上 | 实现完成；正分支未验收 |
| LEG-COMPONENT-010 | Etcd getMonitoringCfgs[2]：grpc_server_msg received/sent rate | 有数据时 | gRPC 消息速率 | 保留：gRPC 消息速率卡，次/秒 | 同上 | 实现完成；正分支未验收 |
| LEG-COMPONENT-011 | Etcd getMonitoringCfgs[3]：wal_fsync_duration(_quantile) | 有数据时 | 99/90/50 + 平均，ms | 保留：WAL fsync 延迟卡，秒→ms | 同上 | 实现完成；正分支未验收 |
| LEG-COMPONENT-012 | Etcd getMonitoringCfgs[4]：backend_commit_duration(_quantile) | 有数据时 | 99/90/50 + 平均，ms | 保留：backend commit 延迟卡，秒→ms | 同上 | 实现完成；正分支未验收 |
| LEG-COMPONENT-013 | Etcd getMonitoringCfgs[5]：proposals committed/applied/failed rate + pending count 同一张图、单位 TIMES_PER_SECOND | 有数据时 | 4 条线，其中 pending 是「个数」却共用每秒单位 | 改进：提案速率卡（3 条速率线）+ 待处理提案数独立卡（个数），理由见 GOT-04；被否方案：照搬旧混单位图 | AC-…-MONITOR-07（未上报分支）；实现与渲染路径见 §5 | 实现完成；正分支未验收 |
| LEG-COMPONENT-014 | `clusters/components/Cards/Monitoring/ETCDNodes`：每节点 online/hasLeader/isLeader/leaderChanges + 节点链接 | requireETCD | 服务状态卡 | 待补：本部署 etcd 无序列，无法读取与验收；系统组件页的组件健康数不等价于 leader 明细 | 未映射（登记待补，不计入通过） | 待补 |
| LEG-COMPONENT-015 | base.js checkEtcd + Cluster/index.jsx `requireETCD`：按 servicemonitor 探测隐藏 etcd 页签 | etcd 未安装时隐藏 | 整组显隐 | 改进：不隐藏整组，改为 etcd 子组「本集群未上报该组件指标」说明（DEC-08）；被否方案：隐藏整组/渲染 0 值卡 | AC-…-MONITOR-07；TC-…-MONITOR-07 断言 empty 态、说明文案、0 张卡、无曲线 | 通过 |
| LEG-COMPONENT-016 | APIServer/Scheduler/Etcd 的 MonitoringController step=2m times=50 + 播放/暂停 | 始终 | 固定 100 分钟窗口，每个面板独立自动刷新 | 改进：复用页面 1h/6h/24h/7d 与全局自动刷新（DEC-10）；被否方案：组件区域独立时间窗 | AC-…-MONITOR-06（同一次接口响应对账依赖同一窗口）；TC-…-MONITOR-06 切换 6h/1h 触发重取 | 通过 |
| LEG-COMPONENT-017 | APIServer/Scheduler/Etcd 的 getSpecificData + legend 固定顺序：按位置取第 i 条序列 | 有数据时 | 图例顺序与数据位置绑定 | 改进：按 `verb`/`result`/`quantile` 标签身份精确匹配（DEC-09）；被否方案：按位置配对（会把 APPLY 标成 REST_CREATE） | AC-…-MONITOR-06；TC-…-MONITOR-06 断言身份集合与线数一致、不合并、NaN-only 身份不出现 | 通过 |

统计：17 条原子能力；通过 9（001/003/004/005/006/007/015/016/017）、通过但仅部分维度 5（002 正分支实测通过；008–013 六张 etcd 图表实现完成、正分支因部署无序列未验收）、待补 1（014）、改进并入 002–017 若干。未映射数 = 1（014，已登记待补），未经证明承接数 = 0。

## 3. 数据契约与全链路（实测 2026-11-15/16，B200 host）

- 查询：`GET /kapis/monitoring.kubesphere.io/v1alpha3/components/<apiserver|scheduler|etcd>?cluster=<cluster>&metrics_filter=m1$|m2$&start&end&step`；`metric_name` 下 `data.result[]` 每条序列的身份在 `metric.verb` / `metric.result` / `metric.quantile`。查询键含 cluster + 组件 + 窗口 + start/end。
- APIServer：`apiserver_request_rate` 1 序列（实测末值 23.78 次/秒）；`apiserver_request_by_verb_rate` 9 序列（APPLY/CONNECT/DELETE/GET/LIST/PATCH/POST/PUT/WATCH，末值 0.00–9.25 次/秒）；`apiserver_request_latencies` 1 序列（4.19 ms）；`apiserver_request_by_verb_latencies` 6 序列（APPLY 11.11 / DELETE 5.08 / GET 2.97 / PATCH 12.67 / POST 3.03 / PUT 5.35 ms；APPLY 在更早一次采样中整条为 NaN，说明 NaN 分支真实存在）。
- Scheduler：`scheduler_schedule_attempts` 3 序列（scheduled 4843 / error 8 / unschedulable 259，累积计数）；`scheduler_schedule_attempt_rate` 3 序列（当前均 0.00 次/秒，真实 0 有序列）；`scheduler_e2e_scheduling_latency` 与 `_quantile` 均 0 序列。
- etcd：13 个指标名全部返回、`data.result` 全为空数组（0 序列）→「本集群未上报该组件指标」；不是 404、不是 0。
- 单位与映射：延迟/fsync/commit 秒→ms（×1000，两位小数）；速率为次/秒（两位小数）；调度尝试与待处理提案为整数；DB 大小为字节（1024 缩放）；客户端流量为字节/秒；全部经 `monitorFormat.ts` 的 `formatComponentValue`。
- 缺值/异常：非有限值（NaN/±Inf）在 api-client 层丢弃；整条无有限点的身份不画线（也不进图例），整卡无数据→空态；有序列且值为 0→显示 0；查询失败→错误面板（403 无重试，其他有重试）。
- 同次响应对账（TC-…-MONITOR-06 实跑）：GET 延迟显示 ≈ 接口末值×1000（容差 5 倍内，实测 2.97 ms）；按 verb 速率之和与总速率偏差 <20%（实测 23.78）；调度尝试显示值落在接口窗口首末累积值之间；调用率三线均显示 0.00 而非空态。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 系统组件分区在物理资源五组之后；子组固定 APIServer → Scheduler → etcd；组内两列，<1280 单列 | 全页截图确认位置；`cluster-monitor:group:*` 顺序 |
| 字段栅格 | 每卡标题 + 当前值（单序列）或多序列图例（色点 + 身份 + 当前值）；无值显示 — | 结构断言：`:latest`、`:series:<identity>:value`；1024/1280/1600 无横向溢出 |
| 主题 | 复用 ai-kit 语义 token；多序列新增 `--ai-chart-1…6`（深/浅两套），SVG 用 `rgb(var(--ai-chart-N))`（裸 var() 不渲染） | 计算样式取样 `stroke=rgb(var(--ai-chart-1))`；深色主题截图；浅色/第二色调未验收 |
| 图标与图表 | 复用共享 TrendChart（新增 series 输入，单序列 points 兼容）；线按全部序列同一刻度缩放；空值不画 0 条 | ai-kit Storybook 新增 MultipleSeries；SSR 行为 6 项断言；3 个既有消费者回归 |
| 通用控件 | 无新控件；错误面板复用 ResourceErrorPanel，分组与卡片为页面布局 | 403 无重试、5xx 有重试并可重试成功（E2E） |
| 链接与状态 | 无下钻链接（旧面板也无）；空态/失败有重试出口 | TC-…-MONITOR-07 覆盖 5xx 重试与恢复 |

复用决定：扩展公共 TrendChart（`series` + `TREND_SERIES_COLORS` + 两套主题 token），补齐 Storybook 的 MultipleSeries 故事与单测；消费者为 ClusterMonitorPage、NodeTrendPanel、GpuMonitorPanel 三处，均不改调用、回归已跑。

## 5. 编码与回归

改动文件：

- `kube-frontend/apps/console-next/src/pages/cluster/ClusterMonitorPage.tsx`（增量：系统组件分区 + 组件卡；保留 5 组 29 卡与既有时间窗/自动刷新）；新增 `componentMonitorQueries.ts`（图表配置、身份合并、query key）、`monitorFormat.ts`（统一字节/速率/ms/整数格式化，物理卡复用）。
- `kube-frontend/packages/api-client/src/cluster.ts`（新增 `rangeMetricsApi.component` 与 `ComponentMetricSeries`）、`index.ts`（导出类型）。
- `packages/ai-kit/src/primitives/TrendChart.tsx`（多序列 + 调色板常量）、`src/index.ts`、`src/styles/tokens.css`（`--ai-chart-*`）、`stories/TrendChart.stories.tsx`、`test/trend-chart.test.tsx`；`kube-frontend/packages/ui/src/index.ts` 透出。
- `packages/locales/src/index.ts`（仅 cluster.monitor.* 新键，中英同批）。
- `prd|design/kube-frontend/cluster-management/monitor.md`（追加 US4/US5、AC-06/07、DEC-07…10、CON-02、GOT-03…06、INV 5–7，更新明确不做/系统现状/仓库落点/对外契约/后续改进）；`prd/tools/tree.py`（monitor 追加 TC-06/07）→ build_prd → generate_case_docs。
- `tests/ui/specs|tests/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06/07`、`tests/ui/pages/cluster_monitor.py`（组件句柄与组件 API 助手，物理分组访问器收窄到 GROUPS 避免与组件子组混淆）。
- 文档修复：design monitor.md 在提交 d409507c3 中混入了一段重复的「文件头 + 概述 + DEC-01…03」块（嵌在 DEC-05 句子中间），本次删除重复块、恢复 DEC-05 原句；不影响既有 DEC 编号与语义。

验证命令与结果：

- `cd console/kube-frontend/apps/console-next && npx tsc --noEmit -p tsconfig.json` → exit 0。
- `cd console/kube-frontend/packages/api-client && npx tsc --noEmit` → 仅 3 个既有基线错误（`test/network-create.test.ts:9`、`test/workspace-groups.test.ts:78/106`，exactOptionalPropertyTypes，均为未改动文件）；`cluster.ts` 无错误。
- `cd console/packages/ai-kit && pnpm build` → ✓（vite + d.ts）。
- `cd console/packages/ai-kit && pnpm test` → 16 个 suite 全部 collect 失败：当前离线 node_modules 缺 `@testing-library/jest-dom` 与 `@testing-library/dom`（`Error: Cannot find package '@testing-library/jest-dom'`），属基线环境问题；改用等价 SSR 行为脚本（react-dom/server + 源码 TrendChart）验证 6 项：单序列 NaN/越界过滤与真实 0、空态、多序列逐身份画线/调色板/rgb(var()) 包装、NaN-only 身份不画线、全空→空态、maxGap 分段，全部通过。
- `cd console/kube-frontend && npx vitest run --config config/vitest.config.ts` → 1431 passed / 1 failed：失败为 `apps/console-next/src/pages/cluster/ClusterEventsPage.tsx uses raw <button>`（该文件属并行同事提交 6c8a3377d，非本单元范围，未改动；契约套件总数从 1426 变为 1432 亦因并行新增用例）。
- `cd console/kube-frontend/apps/console-next && (串行锁) npx vite build` → ✓ built，`/tmp/kf-build.lock` 已释放。
- E2E（`KA_APP_URL=http://localhost:5178 python3 -m pytest … -m ui -q -p no:cacheprovider -n 0`）：MONITOR-06 与 MONITOR-07 2 passed（8.61s）；相关回归 MONITOR-01/03/04/05 + NODES-06/11 + CUSTOM_MONITORING 共 9 passed（86.79s，另含一次 MONITOR_RESOURCE-01 失败）；MONITOR_RESOURCE-01 单跑 1 passed（12.82s）——首次失败为上游返回空数据的瞬时抖动，与本次改动无交集（未触碰该页与 /pods 查询）。
- `python3 prd/tools/check_docs.py --strict prd/kube-frontend/cluster-management/monitor.md design/kube-frontend/cluster-management/monitor.md tests/ui/specs/kube-frontend/cluster-management/TC-…-MONITOR-06.yaml TC-…-MONITOR-07.yaml` → errors=0 warnings=0。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 部分通过 | 17 条原子 ID：通过 9、实现完成但正分支未验收 5（etcd 6 图共用渲染路径）、待补 1（014）、未映射 1=已登记待补 | LEG-COMPONENT-014（etcd 每节点服务状态）登记待补，不进通过数 |
| 数据语义 | 通过（APIServer/Scheduler） | 2026-11-15/16 B200 host 实测；同一窗口接口对账见 §3；NaN/真实 0/无序列分支分别有断言 | etcd 六张图的正分支（有序列时）本部署无法验收 |
| 交互与权限 | 通过 | TC-…-MONITOR-06/07 实跑：空态/未上报、403 无重试、5xx 有重试且重试真的重发、移除失败后恢复 ready | 真实受限账号（非 admin）未验，403 分支用 route mock |
| 视觉与主题 | 部分通过 | 深色 × 1024/1280/1600 × zh/en 人工核对；`/tmp/cluster-monitor-components-{zh,en}-{1024,1280,1600}.png` 及 `…-section.png`；无横向溢出；多序列色 = `--ai-chart-*` | 浅色主题、第二色调未验收 |
| 静态/类型/构建/测试 | 部分通过 | console-next tsc 0；ai-kit build ✓；vite build ✓；scoped check_docs 0/0；E2E 2 passed + 9 passed 回归 | ai-kit 单测环境基线坏（见 §5）；contract 套件 1 failed 来自并行文件 ClusterEventsPage；api-client tsc 3 个既有基线错误；全仓串行 E2E 未跑 |
| 本地全栈/B200 读取 | 通过 | BFF 8092 → 18088 → B200，admin，host；真实指标非模拟；mock 仅用于 NaN/403/5xx 分支 | 新版部署环境未验 |
| 新版部署/member/全站 | 未验收 | — | 生产前端、member 集群、全站串行 E2E 未执行 |

结论：本页在「本地该页」范围内交付完成（APIServer/Scheduler 正分支 + 组件无数据/错误/权限分支 + 视觉三档中英）；etcd 正分支、LEG-COMPONENT-014、浅色/第二色调、部署/member/全站为未验收或待补，不能写成整页完整迁移。