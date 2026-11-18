# 定时任务运行记录（CronJob runs）迁移记录（2026-11-19）

> 本页记录：项目作用域「定时任务」详情页的运行记录页签（读 + 「立即运行一次」写）。
> 方法见[迁移指南](../legacy-ui-migration-guide.md)，模板见[单页交付模板](page-migration-template.md)；
> 同一页族的列表与其它页签已在[容器组页面族记录](page-pods-20261118.md)与更早批次交付。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目作用域：回答「昨晚那次跑成功了吗、跑了几次、每次多久」，并在需要时立刻补跑一次 |
| 旧入口、源码版本、部署 URL | `/<ws>/clusters/<c>/projects/<ns>/cronjobs/<name>/records`（index 路由即 `records`）；源码 `src/pages/projects/containers/CronJobs/Detail/{routes.js,JobRecords/index.jsx}`、`stores/workload/record.js`；部署 `https://ka.watering.ai/` |
| 新入口、提交及工作树、构建 | `…/cronjobs/<name>` 的「运行记录」页签；`apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx`、`packages/api-client/src/cronjobs.ts`、`packages/api-client/src/{resources,workloads}.ts` |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai`（新架构）+ 本地 preview 5178 代理；admin。B200/A100 不用于登录后验收 |
| 视口、主题、语言 | 1280 深色中文为主；与页族其余页签同批截图 |
| 子页面与状态范围 | 运行记录页签：有记录 / 无记录（空态）/ 读取失败（可重试）/ 无创建任务权限（按钮禁用 + 原因）；默认页签为运行记录 |
| 明确排除及批准 | 不做「每行重跑」（老页的图标按钮）：同一能力放在页头「立即运行一次」，避免每行一个不可发现入口（DEC-DETAIL-12 记被否方案） |
| 并行文件与安全边界 | 只改上述文件 + 本记录/矩阵 + 该功能 PRD/design/spec/tests；写入用例只创建唯一命名的定时任务与任务并清理 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-CRONJOB-RUNS-001 | `CronJobs/Detail/routes.js:25-40`（`records` 为 index 路由） | 始终 | 详情默认停在「运行记录」 | 页内 Tab，默认选中 | `AC-…-DETAIL-08` / `TC-…-DETAIL-08`：`aria-selected=true`、面板可见 | 通过 |
| LEG-CRONJOB-RUNS-002 | `JobRecords/index.jsx:78-138` | 有任务时 | 任务表：任务名（链到任务详情）、状态、资源请求、资源限制、开始时间、结束时间 | 同页签表格（新增「耗时」列，见 DEC-DETAIL-11） | 同上：行出现、名称链接 `href` 指向 `/jobs/<name>`、结果三态之一 | 通过 |
| LEG-CRONJOB-RUNS-003 | `getJobStatus`（`utils/status.js:92-112`） | 有任务时 | 状态：Completed / Failed / Running（按 conditions） | 结果徽标 + 成功/失败/运行中计数 | 同上：结果列出现「已完成/失败/运行中」 | 通过 |
| LEG-CRONJOB-RUNS-004 | `JobRecords/index.jsx:133-144`（每行 rerun 图标） | 有任务时 | 按任务 spec 再建一个任务 | 页头「立即运行一次」（按 jobTemplate 建任务），SSAR 门控 | `AC-…-DETAIL-09` / `TC-…-DETAIL-09`：点按钮后出现带 `instantiate=manual` 注解的新任务且表格新增该行 | 通过 |
| LEG-CRONJOB-RUNS-005 | 老页无（`Table` 自带空态） | 无任务 | 空表 | 空态说明「这个定时任务还没有运行记录。」+ 提示「立即运行一次」 | `AC-…-DETAIL-08`：空态可见且不渲染空表 | 通过 |
| LEG-CRONJOB-RUNS-006 | 老页无 | 读取失败 | 老页只有空白 | 失败说明 + 重试按钮 | `AC-…-DETAIL-08`（失败分支由组件测试覆盖） | 通过（组件测试） |

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 返回类型 | 字段或指标/标签 | 原单位→显示单位/精度 | API 映射→页面位置 | 缺值/零/异常/过期值规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001–003 | `GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/jobs?limit=-1&labelSelector=<jobTemplate 标签>` | JSON | 原始 Job：`status.conditions`、`status.startTime/completionTime`、`spec.template.spec.containers[].resources` | 时间 RFC3339→本地 `YYYY-MM-DD HH:mm:ss`；耗时秒→「N 秒 / N 分」 | `cronJobRunsApi.list` → 结果徽标/计数/资源列/起止/耗时 | 无 `conditions` → 运行中；无 `completionTime` 且失败 → 取 Failed 条件的 `lastProbeTime`；未结束的耗时显示 `-`（不显示 0）；按 `ownerReferences` 收敛，避免模板标签相同的另一定时任务串台 | 用例用 API 读到的任务名与页面行名逐一对应 |
| 004 | `POST /apis/batch/v1/namespaces/<ns>/jobs`（body = jobTemplate 的 spec，名称 `<cronjob>-manual-<base36>`，注解 `cronjob.kubernetes.io/instantiate=manual`） | JSON | 新建 Job | — | `cronJobRunsApi.runNow` | 权限由 `create jobs` 的 SSAR 决定；失败保留弹窗/提示，不静默 | 用例读回新任务的标签与注解，并与表格行对账 |

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 默认页签＝运行记录；区块标题 + 说明 + 「刷新」「立即运行一次」在右上；表在下方 | 首屏截图（`cronjob-runs`） |
| 字段栅格 | 任务 / 结果 / 资源请求 / 资源限制 / 开始 / 结束 / 耗时；结果列徽标 + 计数两行 | 行文本断言 |
| 字号层级 | 区块标题 `text-sm`、说明 `text-[11px]` 次色、表头同正文 | 关系断言（标题不小于正文） |
| 主题 | ai-kit 语义 token；结果色用 `Badge` tone（success/danger/warning） | 深浅主题截图（本页沿用页族截图基线） |
| 通用控件 | 表格与按钮复用页面既有形态（`Button` + `actionProps`），不新增私有控件 | 契约测试 |
| 链接与状态 | 任务名链到 `/jobs/<name>`；空/失败/无权限三态文案不同 | 用例断言 |

复用决定：只组合既有组件（`Button`、`Badge`、`Skeleton`、`MutationAlert`），不新增公共组件 API 与故事。

## 5. 编码与回归

- [x] PRD 的 AC 承接功能、数据语义、状态、权限、交互与视觉；design 写 DEC（含被否方案）。
- [x] YAML 与 Python 一一镜像（`DETAIL-08`/`DETAIL-09`），夹具抽到 `helpers/cronjobs.py` 避免两份清理逻辑分叉。
- [x] API/mapper 单测（`cronjobs.test.ts` 6 条）、组件测试（`cronjob-runs.test.tsx` 3 条）、显式类型检查与构建、严格规格门禁。
- [x] 相关及受共享影响的 E2E 串行判定（mlu370，`-n 0`）。
- [x] 改过 AC 后重跑 `generate_case_docs.py`（498 篇）与 strict 门禁（errors=0 warnings=0）。
- [x] 展示型区块断言内容：行名、结果文案、计数、`href` 全部来自同次 API 读取。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 6 条原子 ID：5 条实现（001–005）、1 条失败分支（006，组件测试覆盖）；批准不做 0 | — |
| 数据语义 | 通过 | 结果来自 `status.conditions`；耗时按起止计算、未结束为 `-`；标签 + ownerReferences 双条件 | — |
| 交互与权限 | 通过 | 默认页签、空态、立即运行一次（含 SSAR 门禁）均有用例；写用例读回注解与标签 | 真实非 admin 403 分支未在部署验证（SSAR 单测 + 组件测试覆盖） |
| 视觉与主题 | 部分通过 | 1280 深色截图；与页族其余页签同一套 token | 1024/1600、浅色、英文未单独截图（与页族共用基线） |
| 静态/类型/构建/测试 | 通过（含 1 条并行失败） | typecheck 0 error；api-client **501 passed / 52 files**；本批 3 个组件测试文件 **16 passed**；build 成功；strict 门禁 errors=0 | 全量 console-next 套件当前 **299 passed / 3 failed**，3 条都在 `test/nodes-stats-filter.test.tsx`（节点状态本地化），来自并行会话正在改的 `NodesPage.tsx`/`NodeDetailPage.tsx`，与本批无关，未代为修复 |
| 本地全栈/mlu370 | 通过 | 两条例例在 mlu370 上串行通过（见 §7） | — |
| 新版部署/member/全站 | 未验收 | — | 生产部署、member、全站串行 E2E 未做 |

## 7. E2E（mlu370，`-n 0`）

命令：`KA_BASE_URL=https://ka.watering.ai KA_PASSWORD=<mlu370> pytest tests/kube-frontend/app-workloads/test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_0{8,9}.py -q -n 0`

| 用例 | 结果 | 说明 |
| --- | --- | --- |
| DETAIL-08 | 通过 | 创建每分钟触发的定时任务，等第一个任务出现；默认页签、任务行、结果列、任务名链接；另一个未触发的定时任务显示空态 |
| DETAIL-09 | 通过 | 创建 suspend 的定时任务，点「立即运行一次」，读回带 `instantiate=manual` 注解且标签匹配的新任务，表格出现该行 |
