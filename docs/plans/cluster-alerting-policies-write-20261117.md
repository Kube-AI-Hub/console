# 集群告警策略页面族：状态列表、详情与自定义策略生命周期（2026-11-17）

> 本批交付证据。范围是**集群作用域告警策略**（`/clusters/<cluster>/alerting-policies`）这一个完整页面族：
> 列表（两个页签/状态列/筛选/分页）、详情页（属性/规则/消息/指标数据）与自定义集群策略的创建、编辑、编辑 YAML、
> 启停、批量启停、删除。内置策略的启停与 reset 复用上一批交付。**不是**全站功能审计。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群管理员在**集群作用域**查看/管理告警策略：判断哪些策略在运行、哪条规则在触发，创建与维护自己的集群级策略 |
| 旧入口、源码版本、部署 URL | `/clusters/:cluster/alert-rules`（列表）与 `/clusters/:cluster/alert-rules/:name/rules`（详情），老 console 部署 `http://10.1.37.18:30880`（mlu370），2026-11-17 实拍 |
| 新入口 | `/kube-frontend/clusters/<cluster>/alerting-policies`；详情 `.../alerting-policies/<name>?scope=cluster|global` |
| 环境、集群、角色 | mlu370（host 单集群，k8s 1.28.15，KubeSphere 3.3.2 形态的 ks-apiserver）；账号 `admin`（sysadmin）。B200 与 member 未用于本批写验证 |
| 视口、主题、语言 | 1600×900 / 1280×900 / 1024×900；深色+紫色、浅色+紫色、深色+绿色、深色+英文；详情同上 3 档 |
| 子页面与状态范围 | 列表两页签、搜索、策略状态/规则状态筛选、排序、分页档位、显示列、刷新；创建/编辑/编辑 YAML/停用（确认）/启用/删除/恢复初始配置；批量启停；详情页属性、规则表（状态/最近检查）、查看指标数据弹窗、告警消息时间线 |
| 明确排除及批准 | 内置策略的编辑/编辑 YAML/删除（PRD 明确不做：安装器所有）；模板规则构建器（项目级早已采用 PromQL 编辑器）；旧列表顶部「如何在告警策略触发后接收告警？」帮助横幅（通知配置属平台设置，且本环境投递受阻）；边缘节点/告警消息页不属本单元 |
| 并行文件与安全边界 | 并行线改动的 `AddClusterDialog`、`packages/ai-kit` 表单/Select、`api-client` 的成员集群路径未回退；本批唯一临时对象为 `ui-check-<ts>-a/b`，用例 finally 通过 API 删除；未改任何内置策略的规则体 |

## 2. 旧能力全集与归宿

原子 ID 以 `CAP-xx` 编号；"旧源码/部署证据"来自 `console/src/pages/projects/containers/Alerting/Policies`、
`console/src/actions/alerting.js` 与 mlu370 老 console 实拍（`assets/.../old/`）。
**旧列表在 1024 宽出现横向溢出**（实测 `scrollWidth > innerWidth`），新页三档均无溢出。

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| CAP-01 | 老列表页签「自定义规则组 1 / 内置规则组 18」 | 集群作用域 | 两个页签 + 计数 | 保留 `ClusterAlertingPoliciesPage` tabs | AC-WRITE-04；TC-WRITE-03 断言页签含 kapis totalItems | 通过 |
| CAP-02 | 老列表「名称」列（名称/描述） | 均有 | 主名 + 副行描述；别名优先 | 改进：别名/对象名/描述三行 | AC-WRITE-03/04；创建后断言别名行出现 | 通过 |
| CAP-03 | 老列表「规则组状态」列 | 均有 | 已启用/已停用 | 保留 | AC-WRITE-04；筛选与徽标断言 | 通过 |
| CAP-04 | 老列表「规则状态」列 | 均有 | 未触发/验证中/已触发/已禁用四态计数（tooltip 形式） | 改进：带文案的徽标 + 计数；数据来自聚合 kapis `status.rulesStats` | AC-WRITE-04；TC-WRITE-03 逐态比对 | 通过 |
| CAP-05 | 老列表「耗时」列 | 有 status 时 | 秒，如 `0.002 秒` | 保留；三位小数 + 秒 | AC-WRITE-04；断言 `{:.3f} 秒` | 通过 |
| CAP-06 | 老列表「最近检查」列 | 有 status 时 | 本地时间 | 保留 | AC-WRITE-04；断言与 `status.lastEvaluation` 一致 | 通过 |
| CAP-07 | 老列表搜索框 | 均有 | 按名称搜索 | 改进：名称/别名/描述 | AC-WRITE-04 | 通过 |
| CAP-08 | 老列表「规则组状态」筛选 | 均有 | 已启用/已禁用 | 保留（服务端 labelSelector 语义改为本地过滤；集合一次取全） | AC-WRITE-04 | 通过 |
| CAP-09 | 老列表「规则状态」筛选 | 均有 | 未触发/验证中/已触发 | 保留；kapis 忽略 `state`（实测），因此客户端过滤全集 | AC-WRITE-04；TC-WRITE-03 用 kapis 计数核对结果行数 | 通过 |
| CAP-10 | 老列表排序/分页 | 均有 | 默认 createTime 降序；每页 10/20/50/100；总数 | 保留；默认 50（页签计数覆盖，已有 AC-ALERTING-01 固定该口径） | AC-WRITE-04；现有 TC-ALERTING-01 通过 | 通过 |
| CAP-11 | 老列表刷新 | 均有 | 刷新列表与状态 | 保留 | AC-WRITE-04 | 通过 |
| CAP-12 | 老列表列设置（列显隐） | 均有 | 可隐藏规则状态/耗时/最近检查等 | 保留/改进：列显隐 + 本地持久化 | 契约 + 截图 | 通过 |
| CAP-13 | 行操作「详情」 | 均有 | 进入详情页 | 保留：独立详情页 | AC-WRITE-03/04；TC-WRITE-03 | 通过 |
| CAP-14 | 行操作「编辑信息」 | 自定义 | 别名/检查间隔/描述 | 与 CAP-16 合并为一个对话框（改进，记录于 design） | AC-WRITE-03；回读注解/间隔 | 通过 |
| CAP-15 | 行操作「编辑 YAML」 | 自定义（老内置也可） | 整对象 PUT；名称锁定 | 保留（仅自定义；内置属安装器） | AC-WRITE-03；YAML 改别名后回读 | 通过 |
| CAP-16 | 行操作「编辑告警规则」 | 自定义（老内置也可） | 规则列表编辑器 | 合并进 CAP-14 的对话框；集群作用域复用项目级编辑器（PromQL） | AC-WRITE-03 | 通过 |
| CAP-17 | 行操作「启用/停用」 | 两个页签 | 写 enable 标签；停用有确认 | 保留；停用确认（列表与详情一致） | AC-WRITE-01/05；TC-WRITE-03 停用确认 + 回读 | 通过 |
| CAP-18 | 行操作「删除」 | 自定义 | 输入名称确认 | 保留 | AC-WRITE-03；详情与列表两条删除路径 | 通过 |
| CAP-19 | 行操作「恢复初始配置」 | 内置可恢复 | 确认后写回注解 spec | 上一批已交付，本批回归 | AC-WRITE-02；现有 TC-WRITE-02 通过 | 通过（上一批证据） |
| CAP-20 | 批量启用/停用 | 两个页签 | 选中行逐条写；停用确认 | 保留；只允许可写行勾选，停用确认，汇总成功/失败 | AC-WRITE-05；TC-WRITE-03 两条临时策略批量停用/启用回读 | 通过 |
| CAP-21 | 创建策略（两步向导：基本信息 + 告警规则） | 自定义 | 名称/别名/检查间隔/描述/规则（≥1） | 改进：单对话框同屏；字段不减（模板规则构建器除外，见 CAP-28） | AC-WRITE-03；创建后 API 回读 | 通过 |
| CAP-22 | 详情属性 | 均有 | 规则组状态/检查间隔/耗时/创建时间/创建者 | 保留 + 新增别名/最近检查/类型/作用域 | AC-WRITE-04；展示断言 | 通过 |
| CAP-23 | 详情规则表 | 均有 | 状态/告警/严重度/持续/说明/目标/最近检查 | 保留：状态/告警名称/严重度/持续/说明/表达式/最近检查；目标列由表达式列替代（自定义规则无模板目标） | AC-WRITE-04 | 通过（目标列差异见下） |
| CAP-24 | 规则行「查看指标数据」 | 有表达式的规则 | 打开近 1 小时曲线 | 保留：新建 `RuleMetricDialog`，Prometheus query_range；空/失败/加载分态 | AC-WRITE-04；TC-WRITE-03 打开并断言状态 | 通过（本表达式为比较式，返回空态） |
| CAP-25 | 详情「告警消息」页签 | 均有 | 该策略的消息列表 | 保留：详情页消息时间线（服务端 rule_group 过滤 + 分页） | AC-WRITE-04；TC-WRITE-03 断言区块存在 | 通过 |
| CAP-26 | 详情操作：编辑/编辑 YAML/启停/删除 | 自定义；内置启停 | 同列表 | 保留 | AC-WRITE-03/04 | 通过 |
| CAP-27 | 顶部帮助横幅「如何在告警策略触发后接收告警？」 | 均有 | 链接到通知接收配置 | 批准不做：帮助横幅不是独立任务；通知渠道配置位于平台设置（页面存在，投递受环境限制） | PRD 明确不做 | 批准不做 |
| CAP-28 | 模板规则构建器（模板规则 + 指标/目标选择器） | 创建/编辑规则 | 按节点/工作负载/指标生成表达式 | 批准不做：项目级规则组此前已采用「直接编辑 PromQL」模型，两作用域保持一致；模板规则对象仍原样展示、可用 YAML 编辑 | PRD/design 明确不做；已记录被否方案 | 批准不做 |
| CAP-29 | 内置策略编辑/编辑 YAML/删除 | 内置 | 老 console 也提供 | 批准不做：安装器所有，协调会覆盖；保留启停与 reset | AC-WRITE-01/02 的边界 | 批准不做 |
| CAP-30 | 告警消息下钻 | 消息页 | 详情弹窗 | 上一批交付，本批不重复 | TC-WRITE-01 通过 | 通过（上一批） |

**计数**：29 项原子能力（CAP-01…CAP-29；CAP-30 是上一批已交付能力，仅回归、不计入本批分母）；
通过 26、批准不做 3（CAP-27/28/29）、待补/阻塞 0、未映射 0。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 字段或指标/标签 | 原单位→显示单位/精度/分母 | API 映射→页面位置 | 缺值/零/异常/过期值规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| CAP-04/05/06 | `GET /kapis/alerting.kubesphere.io/v2beta1/{cluster,global}rulegroups?limit=-1`（host） | `status.rulesStats`、`status.evaluationTime`、`status.lastEvaluation`、`status.rulesStatus[]` | evaluationTime 秒→三位小数；lastEvaluation ISO→本地时间 | `toRuleGroupStatus` → 列表列/详情属性；rulesStatus 按**索引**对齐 spec.rules | 缺 status → `-`；真实 0 显示 0；非数值/NaN 丢弃 | TC-WRITE-03 用同次 kapis 响应逐态比对列表文案与耗时 |
| CAP-03/17/20 | `PATCH /apis/alerting.kubesphere.io/v2beta1/{cluster,global}rulegroups/<name>`（merge-patch） | `metadata.labels["alerting.kubesphere.io/enable"]` | boolean 字符串 | api-client `setEnabled` | 失败显示 MutationAlert；列表不乐观改动 | TC-WRITE-03 停用/启用后 API 回读标签 |
| CAP-13/22/23/25 | `GET /apis/.../clusterrulegroups/<name>`（编辑种子）与 `/kapis/.../<name>`（带 status 的详情） | spec.rules、annotations、status | 原样 | 详情页/编辑弹窗/消息时间线 | 消息无 → 空态；status 无 → `-` | 详情属性/规则表与 kapis POST 状态对账 |
| CAP-14/15/16/18/21 | `POST/PUT/DELETE /apis/alerting.kubesphere.io/v2beta1/clusterrulegroups[/<name>]` | kind ClusterRuleGroup；annotations description/alias-name；spec.interval/rules | 间隔字符串 s/m/h；规则字段 alert/expr/for/severity/annotations | `ruleGroupsWriteApi`（scope=cluster） | 名称锁定；更新先 GET 合并资源版本与陌生人注解；YAML 写入前剥离 status | 每次操作后 GET 回读注解/间隔/规则/labels |
| CAP-24 | `GET /api/v1/namespaces/kubesphere-monitoring-system/services/http:prometheus-k8s:9090/proxy/api/v1/query_range` | 规则的 `expr`，start=now-1h，step=60s | 原始数值；单位由表达式决定 | `RuleMetricDialog` → TrendChart | 无序列=空态（比较式只返回超阈值点）；失败=错误 + 重试；不画 0 线 | TC-WRITE-03 断言图表离开 loading 且状态合法 |

多集群：读路径支持 `clusterScoped`（`clusters/<id>` 紧跟 `/kapis`/`/apis`），本批只在 host 验证；写路径同样带集群段，member 写入未验证（4paradigm 未连接）。
**同次响应证据**：2026-11-17 11:16:30（host）kapis 返回 `test` 状态 `{evaluationTime:0.002,evaluationTime…,rulesStats:{inactive:1,pending:0,firing:0,disabled:0}}`，页面列表显示「未触发 1 / 验证中 0 / 已触发 0 / 已禁用 0、0.002 秒、2026-11-17 11:16:30」，截图 `list-custom-dark-1600.png`。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 页面标题 + 两页签 + 工具条 + 表格；主操作「创建策略」在工具条右端；行内更多菜单放低频/危险操作 | 1600 首屏 + 全页截图；创建按钮位置与老 console 一致（右侧） |
| 字段栅格 | 名称（别名/对象名/描述三行）、状态、规则状态、耗时、最近检查、规则数、创建时间；1024 下隐藏耗时刻/创建时间（hideBelow） | 1024/1280/1600 computed 与截图；1024 无横向溢出（老 console 有） |
| 主题 | 复用 ai-kit 语义 token；无字面颜色；深/浅主题与紫/绿色调 | `config/colour-token-contract` 1490 条契约通过；深色 computed bodyBg `rgb(11,24,77)`、文字 `rgb(222,235,246)`、表边框 `rgb(62,76,146)`、accent `169 129 248`；浅色/绿色截图 |
| 图标与图表 | 指标弹窗不画 0 线；空态说明原因；图例与线色一致 | 截图 `detail-metric-dialog-dark-1600.png`（空态文案）；TrendChart 复用 |
| 通用控件 | 列表/分页/筛选/对话框/YAML/删除/确认全部复用共享实现 | `config` 契约（无裸 button、弹层只走 ai-kit、空态契约、写失败可见）通过 |
| 表单与弹窗 | 名称锁定、停用确认、删除输入名称、失败保留输入 | TC-WRITE-03：编辑/YAML/停用/删除均验证 |
| 链接与状态 | 详情返回链接回告警策略列表；规则「查看指标数据」有稳定句柄 | 截图 + E2E |
| 控制台 | 不适用（本页无终端/日志） | — |

复用决定：不新增 ai-kit 公共组件；复用 `RuleGroupDialog`（扩展 scope/别名/间隔）、`RuleGroupDetailPage`（cluster 变体）、`ResourceList`、`DeleteDialog`、`YamlDialog`、`TrendChart`。公共扩展仅 `api-client`（status 映射、cluster 写路径）与 locales；未新增 Storybook（无新组件 API）。

## 5. 编码与回归

- [x] PRD 的 AC 同时承接功能、数据语义、状态、权限、交互与视觉；design 写完整决策及被否方案（DEC-WRITE-05/06/07）。
- [x] YAML 与 Python 一一镜像（TC-WRITE-03）；原能力回归保留（TC-ALERTING-01/02、TC-WRITE-01/02）。
- [x] 旧能力表独立比对新实现；能机械检查的交给 `config` 契约，其余人工逐行核对。
- [x] API/mapper 单测、应用组件单测、显式类型检查与构建、严格规格门禁分别记录（见 §6）。
- [x] 固定本批构建（`pnpm --filter @kube-ai-hub/console-next build`，dist 由 `dev-static-server` 以 BFF=8094 提供）后截图；相关 E2E 串行 `-n 0`。
- [x] 实际采样按同次响应核对；写用例唯一命名、失败与成功后均回读并清理。
- [x] 新旧同角色同集群首屏/全页、详情、弹窗及三档截图人工复核（旧 console 1024 溢出，新无）。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 29 项：通过 26、批准不做 3、待补/阻塞 0、未映射 0 | 模板规则构建器（CAP-28）、内置编辑/删除（CAP-29）、帮助横幅（CAP-27） |
| 数据语义 | 通过（host） | kapis status 与列表/详情同次对账；缺失→`-`、真实 0 保留；写回读 | member 集群状态未验；大量策略（>50）分页/筛选未用模拟规模验证 |
| 交互与权限 | 通过（admin） | 创建/编辑/YAML/停用（确认）/启用/删除/批量/详情/指标弹窗；SSAR fail-open | 真实非 admin 403 分支未验（mlu370 只有 admin）；member 写未验 |
| 视觉与主题 | 通过（已测组合） | 深+紫 3 档、浅+紫 3 档、深+绿 1600、深+英 1600；详情 3 档+浅色；computed style 记录 | 浅+绿、浅+英、深+绿 1024/1280 未逐张截图；未做设计评审签收 |
| 静态/类型/构建/测试 | 通过（有基线失败） | `verify.py --no-e2e` 本轮在文档门禁（1003.6s，并行负载下）、一致性核对、缺口清单单测/清单、弱断言提示各阶段通过；完整运行未作为本批通过依据（本机门禁耗时与既有 console-next 单测基线失败）；`check_docs --strict` 全仓 errors=0/warnings=0；console-next tsc 0 error；api-client tsc 0 error（源码；test 文件 3 处既有 TS2379 基线）；contracts 18 文件/1490 passed；api-client 38 文件/405 passed；console-next 33/35 文件通过（2 个基线失败：`configmaps-page` 143 行、`gpu-parity` 37 行，均不在本批改动文件）；build ✓ | 两个基线失败未修（属并行/既有范围）；api-client test 文件 TS 基线未修 |
| 本地全栈/B200 读取 | 通过（mlu370 为后端） | 本地 Vite 5175 + BFF 8094 + 直连 mlu370 ks-apiserver（18093 隧道）；登录 admin | 未使用 B200 作为本批后端 |
| 新版部署/member/全站 | 未验收 | — | 本批未重新构建/部署镜像到 mlu370；member 集群（4paradigm）未连接；全站串行 E2E 未跑 |

## 7. 测试命令与结果（原文摘录）

```text
# 规格门禁（本批范围）
python3 prd/tools/check_docs.py --strict prd/.../cluster-alerting.md prd/.../cluster-alerting-write.md   design/.../cluster-alerting.md design/.../cluster-alerting-write.md tests/ui/specs/kube-frontend/cluster-management
→ errors=0 warnings=0

# 生成物
cd tests/ui && python3 generate_case_docs.py → generated 442 case docs

# 架构契约
cd kube-frontend && npx vitest run --config config/vitest.config.ts → 18 files / 1490 passed

# API 客户端
pnpm --filter @kube-ai-hub/api-client test → 38 files / 405 passed

# 应用单测
pnpm --filter @kube-ai-hub/console-next test → 33 passed / 2 failed（基线见 §6）
npx vitest run test/cluster-alerting-policies.test.tsx → 6 passed

# 类型与构建
npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
npx tsc --noEmit -p packages/api-client/tsconfig.json → 0 error（源码）
pnpm --filter @kube-ai-hub/console-next build → ✓ built

# 本批 E2E（mlu370 后端，串行 -n 0）
KA_APP_URL=http://localhost:5175 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=***   pytest tests/kube-frontend/cluster-management -k ALERTING -n 0 → 5 passed
  pytest tests/kube-frontend/monitoring -k RULES -n 0 → 8 passed
# 固定构建复跑（dist 由 dev-static-server:5176 + BFF:8094 提供）
KA_APP_URL=http://localhost:5176 … pytest … -k ALERTING -n 0 → 5 passed (151.31s)
```

## 8. 截图与记录

截图目录：[assets/cluster-alerting-policies-20261117](./assets/cluster-alerting-policies-20261117)。

新 UI（固定 dist，BFF=mlu370）：`list-custom-{dark,light}-{1600,1280,1024}.png`、`list-custom-green-zh-1600.png`、
`list-custom-violet-en-1600.png`、`list-builtin-dark-1600.png`、`list-builtin-filter-firing-dark-1600.png`、
`bulk-disable-confirm-dark-1600.png`、`create-dialog-dark-1600.png`、`detail-custom-{dark,light}-1600.png`、
`detail-custom-dark-{1280,1024}.png`、`detail-builtin-dark-1600.png`、`detail-metric-dialog-dark-1600.png`、
`detail-yaml-dialog-dark-1600.png`。
旧 console（同环境同账号）：`old/list-custom-{1600,1280,1024}.png`、`old/list-builtin-1600.png`、
`old/detail-custom-1600.png`、`old/detail-builtin-1600.png`。

三档实测：新 UI 列表/详情 1024/1280/1600 均无横向溢出；旧列表在 1024 有横向溢出（`scrollWidth>innerWidth`）。

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| member 集群告警读写 | 未验收 | 4paradigm agent 连上后，按 TC-WRITE-03 在 member 上跑一遍；确认路径带 `clusters/<id>` 且写不落到 host |
| 真实非 admin 403 | 未验收 | 提供一个在 host 只有只读权限的账号，验证创建/编辑/删除入口隐藏与写失败提示 |
| 浅+绿/浅+英 组合截图 | 未验收 | 设计走查时补 1024/1280/1600 |
| 大规模集合（>50 策略）分页/筛选 | 未验证 | 在测试集群造 60+ 临时 clusterrulegroups 后验证客户端分页与规则状态筛选的全局性，再清理 |
| 部署到 mlu370 的固定版本 | 未执行 | 构建并推送 `kube-frontend` 镜像后，按 [kube-frontend 集成记录](./kube-frontend-integration-20261117.md) 滚动并复测 |
| 全站串行 E2E | 未执行 | 按链路健康协议确认稳定窗口后跑 `pytest tests/kube-frontend -n 0` |
| 两个应用单测基线失败 | 保留 | `configmaps-page.test.tsx:143`、`gpu-parity.test.tsx:37`，由并行/既有范围修复；不属本批改动 |
| api-client test 文件 TS2379 | 保留 | `network-create.test.ts`、`workspace-groups.test.ts` 既有类型错误；不属本批改动 |

## 10. 流程反思（已并入方法文档，不另建清单）

| 本批踩到的事 | 已写入 |
| --- | --- |
| `vite dev` 不剥 `/kube-frontend` 前缀，只配 `/api` 时登录 POST 落到 SPA 兜底（`Not Found`）；固定产物可直接用 `dev-static-server.mjs` 起静态站跑 E2E/截图 | 指南 §7.2 |
| 聚合 kapis 读带 `status`、`/apis` 原对象没有：状态列按 0 兜底会伪造「没有规则触发」 | 指南 §8 #21；模板 §3 |
| 默认页大小/排序/列顺序是已交付 AC 的用户可见契约（改默认 10 导致既有 `CLUSTER_ALERTING-01` 失败） | 指南 §8 #22；模板 §5 |
| 表格内联动作用裸 `<button>` 被 `ai-surface-contract` 拦截 | 指南 §8 #23 |
| 并行负载下全量 `check_docs` 实测 1003.6s；批次判定应使用本批路径门禁 | 指南 §9；SDD §5 |

README / 宪法 / 路线本期无新增事实（入口、铁律与优先级未变），不改，避免与上述正文重复。

## 11. 关联文档

- PRD：[cluster-alerting-write.md](../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md)、[cluster-alerting.md](../../../prd/kube-frontend/cluster-management/cluster-alerting.md)
- design：[cluster-alerting-write.md](../../../design/kube-frontend/cluster-management/cluster-alerting-write.md)
- 用例：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03
- 上一批：内置启停/reset/消息下钻见 [alerting-policies-20261115.md](./alerting-policies-20261115.md) 与 [cluster-alerting-write PRD](../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md)
