# 集群监控 · 集群状态分区与未就绪接管：交付记录（2026-11-18）

> 日期：2026-11-18。本批为 Lead 契约（task-1 实现 / task-2 规格 / task-3 验证）。
> 规格：[PRD](../../prd/kube-frontend/cluster-management/monitor.md)、[design](../../design/kube-frontend/cluster-management/monitor.md)（AC-…-MONITOR-08/09/10、DEC-11…16、CON-03、GOT-07…11）。
> 迁移记录：[单页迁移记录](page-cluster-monitor-status-20261118.md)。旧页截图归档：[assets/cluster-monitor-status-20261118/](assets/cluster-monitor-status-20261118/)。

## 本批改动摘要

1. **集群监控页新增「集群状态」分区**（趋势分组之前）：节点在线状态（componenthealth.nodeStatus，健康/总数 + 在线比例，点击进节点页）、节点 XPU 厂商分布（nodes/stats，按数量降序列表 + 比例条 + 百分比；CPU 行表示无 XPU 的节点数，不是空态）、组件状态（服务组件 6 项按命名空间聚合 healthyBackends/totalBackends；configz 未启用显示「未安装」；核心组件 etcd=「已接入监控/未接入」、controller-manager/scheduler=「正常/异常/未上报」）。
2. **状态分区状态分支互不顶替**：加载 / 空 / 未上报 / 未安装 / 无权限（无重试）/ 失败（错误 + 重试）分别呈现；componenthealth 与 nodes/stats 两块数据源独立降级，不影响彼此与趋势分区。
3. **未就绪由集群作用域路由层接管**（既有能力 `cluster:not-ready` + `cluster:not-ready-overview`），监控页不挂载、页面内不新增第二套等待视图；页面就绪判断只认集群列表 `ready === false`。
4. **修正旧页数据缺陷**：厂商占比未 ×100（旧页显示「1.00%」实为 100%）；Kube AI Hub 因 `counts` 键名不匹配恒显 0/0。新页按接口真值计算/聚合。
5. **自动刷新同时驱动状态分区（AC-10）**：页面「自动刷新」开关开启时，componenthealth / nodes/stats / etcd ServiceMonitor 三个查询与趋势一起每 5 秒重取，关闭或卸载即停止。旧页是每 2 秒**无条件**递归轮询 componenthealth（关不掉、卸载时序不可靠）；新页收敛到显式开关 5 秒，属**改进**不是 parity（DEC-16）。
6. **规格同步**：PRD 新增 US6/US7、AC-08/09/10、FR-06/07/08、SC-03，更新概述/约束/UI 交互/明确不做/验收用例；design 新增 DEC-11…16、CON-03、GOT-07…11，更新系统现状/仓库落点/不变量/已知坑/可观测点；能力矩阵与迁移记录同步。

改动文件（只列本批规格与记录；源码/测试由 task-1/task-3 负责）：

- `console/prd/kube-frontend/cluster-management/monitor.md`
- `console/design/kube-frontend/cluster-management/monitor.md`
- `console/docs/plans/page-cluster-monitor-status-20261118.md`（新建）
- `console/docs/plans/cluster-monitor-status-20261118.md`（本文件）
- `console/docs/plans/capability-matrix.md`（更新集群监控行）
- `console/docs/plans/assets/cluster-monitor-status-20261118/old-host.png`、`old-agent.png`、`old-test.png`（旧页实测截图归档）
- `console/prd/catalog.yaml`（monitor 的 tests.L3 补 `TC-…-MONITOR-08/09`）、`console/prd/tools/tree.py`（同一来源同步，避免重建 catalog 时回退）

## 构建与提交

- **未提交（按用户要求）**：不 `git commit`、不 `git push`；工作树改动与其他并行任务共存。
- 本地构建与静态检查（Lead 复核，2026-11-18）：
  - `pnpm --filter @kube-ai-hub/console-next typecheck` → **exit 0**。
  - `pnpm --filter @kube-ai-hub/console-next build` → **✓ built in 4.69s，exit 0**；产物写回 `apps/console-next/dist`（本地静态站服务的就是该产物）。
  - `cd apps/console-next && npx vitest run` → **43 files / 252 tests passed**（含新增 `test/cluster-monitor-status.test.tsx` 7 passed）。
  - config 契约 `config/consistency-contracts.test.ts` + `config/ai-surface-contract.test.ts` → 343 passed（task-1 报告）。
  - `@kube-ai-hub/api-client` 包 typecheck 存在**既有基线错误**（`test/cluster-import.test.ts:247`，该文件本批未修改，`git status` 可证），非本批引入；bundle 消费方直接吃 src，由 console-next typecheck 覆盖。
- 规格门禁：`cd console && python3 prd/tools/check_docs.py --strict prd/kube-frontend/cluster-management/monitor.md design/kube-frontend/cluster-management/monitor.md`。实测（2026-11-18 16:10，PRD + design + 两条 TC spec 一起跑；task-2 跑过一次、Lead 独立复跑同一命令一次）：**errors=0 warnings=0（exit 0）**，耗时约 4 分 30 秒（全量扫描 tests/ui 的耗时，不是挂死）。AC-08/09/10 分别由 TC-…-MONITOR-08/09 的 `covers` 覆盖（AC-10 已由 task-3 加入 TC-08），US6/US7 由对应 spec 的 `story` 引用。`prd/catalog.yaml` 的 monitor tests.L3 已补 TC-…-08/09（`prd/tools/tree.py` 同源同步）。

## 验证范围（四项分开，不合并结论）

| 范围 | 状态 | 证据/命令 | 未覆盖 |
| --- | --- | --- | --- |
| 本地该页 | **通过（本页范围）** | pytest 串行 `-n 0`：`test_TC_L3_..._MONITOR_08.py` + `_09.py` → **`2 passed in 41.59s`**（Lead 复跑，无 skip/fail；task-3 首跑 `2 passed in 39.28s`）；本地 dev 站（`http://127.0.0.1:5178` + `KA_BACKEND=https://ka.watering.ai`）host/agent 正常态、test 未就绪态；三卡 top 184/184/184、列间距 12/12、宽 445.3，分区标题与趋势分组标题同 14px/600，900 宽纵向堆叠且 `scrollWidth=clientWidth`；host 1/1·100%·寒武纪 1·100%·服务组件 12/12、6/6、未安装、10/10、12/12、6/6·etcd 未接入监控；agent 3/3·英伟达 3·100%·Kube AI Hub 17/19 异常；test 仅 `cluster:not-ready`（无 surface/趋势/状态分区/重试）；自动刷新真实浏览器 OFF/ON/OFF 请求数 = 0/3/0。截图：`tests/ui/artifacts/cluster-monitor-status/`（before/after/测量 json）、`tests/ui/artifacts/test_TC_L3_..._MONITOR_08[chromium]/`、`_09[chromium]/` | 真实受限账号 403（用 page.route 模拟）、纯 CPU-only 集群实图、浅色/第二色调与英文全页截图；旧页 agent 基线当前偶发整页 spinner，未作断言依据 |
| 全仓静态 | **通过（本批相关包）** | console-next typecheck exit 0、build exit 0、vitest 43 files/252 passed；api-client 包 typecheck 有既有基线错误（未触碰文件），不计为本批失败；全仓全量 `check_docs --strict` 未跑（并行批次，按指南只在合入/发布前跑） | 全仓门禁未跑；api-client 基线错误未修 |
| 全站 E2E | 未验收（本批未跑全站串行） | — | 全站串行 E2E 未执行；只在本地跑本页相关用例 |
| 部署环境 | 未验收 | — | 新版部署未验；且**部署构建可能尚未包含路由层 `cluster:not-ready`**（本地/新构建才有），未就绪分支在旧部署构建上不能按本记录验收 |

## 未验收部分

- **成员集群真实就绪后的状态分区正向数据**：本轮实测样本为 `host`（就绪）、`agent`（就绪）、`test`（无 Ready 条件）；成员集群从「未就绪」变为「就绪」后的状态分区数据未实测。
- **真实受限账号 403**：componenthealth / nodes/stats 的 403 分支用 route mock 验证，未用真实受限账号。
- **部署环境验收**：新版部署未验收；部署构建是否含路由层 `cluster:not-ready` 需先确认，否则未就绪分支不成立。
- 浅色主题、第二色调与英文全页截图（以 task-3 实际覆盖为准）。
- 旧页服务组件点击进入组件页（LEG-CLUSTER-STATUS-022）**本轮不做（登记待补，批准依据见 PRD 明确不做）**，不计入通过。
- AC-10 自动刷新（5s 重取 / 关闭停止）：已由 TC-…-MONITOR-08 的 covers 覆盖并实际执行（含按请求计数的 ON/OFF 断言，2 passed）；**真实浏览器人工核对**只做了 host 一页（OFF/ON/OFF = 0/3/0），未逐集群复核。
- 全站串行 E2E 未跑（本批按单页范围交付）。

## 证据链接

- 旧页正常态（host / agent）与未就绪态（test）：[assets/cluster-monitor-status-20261118/](assets/cluster-monitor-status-20261118/)。
- 旧页缺陷证据：厂商占比「1.00%」（old-agent.png）、Kube AI Hub 0/0（old-agent.png、`src/stores/monitoring/component.js`）、未就绪 0/0 + 暂无数据 + 已禁用（old-test.png）。
