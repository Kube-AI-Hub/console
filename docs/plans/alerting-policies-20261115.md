# 项目级告警策略页族迁移交付记录（2026-11-15）

> 单元：告警策略页族（项目级列表/详情/写入 + 集群级两页签复用）。
> 方法依据：[迁移指南](../legacy-ui-migration-guide.md)、[单页模板](./page-migration-template.md)、[SDD](../SDD.md)。
> 事实源：本文 §2 的旧能力表独立于新 PRD 建立；新 AC/用例见 `prd|design/kube-frontend/monitoring/{alerts,alerts-write,rules}.md` 与 `tests/ui/specs/kube-frontend/monitoring/`。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目运维/管理员在项目控制台：看告警消息 → 打开策略详情核对规则与当前告警 → 创建/编辑/删除/启停项目策略；只读成员不显示点不通的写入口。作用域为项目；集群级「告警策略/告警消息」两页签复用同一共享实现（`RuleGroupBody`），本单元不修改集群页文件。 |
| 旧入口、源码版本、部署 URL | `console/src/pages/projects/containers/Alerting/{Messages,Policies}`：`Policies/index.jsx`（列表 + 创建 + 行操作）、`Policies/Detail/{index.jsx,routes.js,AlertRules/**,AlertMessages/**}`（详情两页签）、`Messages/index.jsx`（消息列表）、`Policies/AlertingStatus`（规则状态计数）；集群级在 `clusters/routes` 复用同一批组件（`/clusters/:c/alert-rules[/builtin/:name]`、`/clusters/:c/alerts`）。源码版本 KubeSphere Console 3.4.2。实际契约以 2026-11-15 对本地全栈（BFF 8092，upstream 隧道 18088）的探测为准。 |
| 新入口、提交及工作树、构建 | `/kube-frontend/:ws/clusters/:cluster/projects/:ns/{alerts,alertingrules}`、详情 `/alertingrules/:name?scope=global|cluster|project`；集群级 `/clusters/:cluster/alerting-policies|alerting-messages`（既有）。工作树：`pages/monitoring/**`、`routes/…/alertingrules/$name.tsx`、`packages/api-client/src/{alerting,index}.ts`、`packages/locales/src/index.ts`、PRD/design/specs/tests；构建 `apps/console-next: npx vite build`（23:18 通过）。 |
| 环境、集群、角色 | 本地全栈（BFF 8092 kapis 模式 → 隧道 18088；静态站 5178），集群 `host`，角色 `admin`；未在 member 集群/生产前端验收。 |
| 视口、主题、语言 | 1024×900 / 1280×900 / 1600×900，深浅色默认深色主题、默认色调；中文与英文截图均人工核对。浅色主题与第二色调未逐页截图（见 §6）。 |
| 子页面与状态范围 | 项目消息列表（筛选/分页/详情抽屉/空态/错误）、策略列表（搜索/状态筛选/项目筛选/刷新/空态/错误）、策略详情（属性/规则逐条+规则状态/告警消息时间线+分页/空态/局部错误重试）、创建/编辑弹窗、删除确认、启停、SSAR 拒绝/允许/失败三种门控；集群级两页签 + 详情弹窗复用。 |
| 明确排除及批准 | 编辑 YAML、模板规则（`exprBuilder`/阈值模板）、别名与检查间隔写、批量启停、集群级/全局级策略写、通知渠道、告警消息删除——各有接口或旧能力证据（§2/§3）。均**不**把阻塞或未做写成“批准不做”。 |
| 并行文件与安全边界 | 共享文件 `locales/index.ts`、`api-client/index.ts`、`tree.py`、`catalog.yaml`、`tests/ui/cases/**` 仅局部 edit；未改 `pages/cluster/**`、`pages/app-workloads/**`、`package.json`、`docs/plans/capability-matrix.md`。凭据未写入文档/日志/截图。 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-POL-01 | `Alerting/Policies/index.jsx` + `projects/routes` | 项目内始终 | 侧栏「告警策略」入口，页签在告警消息/策略/自定义监控之间切换 | 新 `…/alertingrules` + 区域页签 | TC-FULL-KUBE-FRONTEND-MONITORING-01（页签切换无文档请求） | 通过 |
| LEG-POL-02 | `clusters/routes/index.js:221-225`、`detail.js:78` | 集群作用域 | 集群级消息/策略入口；`?type=builtin` 两页签 | 既有 `ClusterAlertingPoliciesPage` / `ClusterAlertingMessagesPage`（本单元未改） | 集群页既有实现与用例 | 通过（复用） |
| LEG-POL-03 | `Policies/index.jsx` 列 NAME | 有数据 | 显示名 = alias > name，副行 `description` | 新列表：name + 副行「作用域 · 描述」 | AC-RULES-01 / TC-RULES-01：名称列在主位、副行含描述（无描述时含作用域） | 改进：alias 不读取（PRD 明确不做），作用域为新信息 |
| LEG-POL-04 | 同上列 POLICY_STATUS | 有数据 | 已启用/已停用徽标（服务端 `enabled`） | 新列表「策略状态」徽标 | AC-RULES-01/02；TC-RULES-02 回读 enable 标签 | 通过 |
| LEG-POL-05 | `Policies/AlertingStatus/index.jsx` | 有数据 | 规则状态计数 firing/pending/inactive（tooltip） | 详情规则表「状态」列（告警中/待触发/正常）+ 消息时间线 | AC-RULES-05；TC-RULES-05 断言状态词只为三词之一 | 改进：规则组无 `status.rulesStatus`，状态由活动告警推导（DES-RULES-06） |
| LEG-POL-06 | 列表列 TIME_SPENT | 有数据 | 评估耗时（秒） | 详情「检查间隔」显示 `spec.interval` | AC-RULES-05 属性区 | 改进：规则组无 evaluationTime 字段，改示评估间隔并记录（design/rules 已知坑） |
| LEG-POL-07 | 列表列 RECENT_DETECT_TIME | 有数据 | `status.lastEvaluation` | 详情/列表显示创建时间 | AC-RULES-01/05 | 改进：规则组无该字段，不编造（design/rules 系统现状） |
| LEG-POL-08 | 列 `enable` filters | 有数据 | 已启用/已停用 | 列表「策略状态」筛选（前端过滤已合并集合） | AC-RULES-01 扩展断言：已停用过滤后行数 = 接口 disabled 数 | 通过 |
| LEG-POL-09 | withList 列搜索 | 有数据 | 名称搜索（服务端 keyword） | 列表搜索框（前端对已合并集合过滤） | AC-RULES-01 / TC 既有 | 通过 |
| LEG-POL-10 | withList 分页 | 有数据 | 服务端 page/limit/totalItems（10/20/50） | 合并后前端分页 10/页，总数=合并条数 | AC-RULES-01 断言 footer 共 18 条 | 通过（三来源各自分页，合并后切页 DES-RULES-02） |
| LEG-POL-11 | BaseInfo/EditBasicInfo 表单 | 行操作 > 编辑信息 | name 只读、alias、检查间隔、描述 | 编辑弹窗：名称禁用、描述可改；alias/检查间隔不做 | AC-WRITE-01（描述回读）+ PRD 明确不做 | 部分：描述通过；alias/检查间隔明确不做 |
| LEG-POL-12 | 行操作 > 编辑 YAML | 行操作 | `alerting.yaml.edit` | 不迁移 | PRD 明确不做：编辑 YAML 作为独立能力另行登记 | 明确不做 |
| LEG-POL-13 | 行操作 > 编辑告警规则 | 行操作 | 多步规则表单（模板/自定义） | `RuleGroupDialog` 整表编辑自定义 PromQL 规则 | AC-RULES-04、AC-WRITE-01；TC-RULES-04 / ALERTS_WRITE-01 | 通过（模板规则明确不做） |
| LEG-POL-14 | `stores/alerting/policy.js` label patch | 行/详情 | 启用/停用写 `alerting.kubesphere.io/enable` | 列表行与详情页启停（merge-patch 只写标签） | AC-RULES-02；TC-RULES-02 回读标签且规则体不变 | 通过 |
| LEG-POL-15 | 行操作 > 删除 | custom 行 | 删除 custom 策略 | 列表行与详情页删除（确认输入名称） | AC-RULES-04 / AC-WRITE-01；TC-RULES-04 回读 404 | 通过 |
| LEG-POL-16 | builtin 行 > RESET | builtin 行 | 恢复安装器初始配置 | 集群页 `cluster-alerting-policies:reset`（既有） | 集群页既有实现；项目详情不提供 | 等价承接（项目作用域无 builtin 写所有权） |
| LEG-POL-17 | 批量 selectActions 启停 | 勾选行 | 批量启用/停用 | 未迁移（当前无批量选择） | — | 待补（见 §6） |
| LEG-POL-18 | create 表单 | 项目内 | 名称/alias/间隔/描述/规则，重名校验 | 创建弹窗（名称/描述/规则；重名由服务端 409 回显） | AC-WRITE-01；TC-ALERTS_WRITE-01 | 通过 |
| LEG-POL-19 | withList emptyProps | 空列表 | NO_DATA_DESC | 空态标题+说明（不渲染表头） | AC-RULES-01/ALERTS-01 | 通过 |
| LEG-POL-20 | 所有列表刷新 | 有数据 | 刷新按钮 | `useListRefresh`（列表与空态出口） | TC-LIST_REFRESH-01 | 通过 |
| LEG-POL-21 | `Policies/Detail/routes.js` | 行「详情」 | `/alert-rules/:name` 与 `/alert-rules/builtin/:name` | `/alertingrules/$name?scope=`；集群页弹窗 | AC-RULES-05/06；TC-RULES-05/06 | 通过（项目路由；集群为弹窗，见 LEG-POL-23） |
| LEG-POL-22 | `Policies/Detail/index.jsx` getAttrs | 详情 | 策略状态、检查间隔、耗时、创建时间、创建者 | 详情属性区 6+ 行 | AC-RULES-05 | 通过（耗时无字段，改检查间隔） |
| LEG-POL-23 | Detail getOperations | 详情 | 编辑信息/启停/编辑规则/编辑 YAML/builtin reset/custom delete | 编辑/启停/删除（按所有权+SSAR）；YAML 不做；reset 在集群页 | AC-RULES-05/06、AC-WRITE-02；TC-ALERTS_WRITE-02 | 通过（不含 YAML；reset 等价承接） |
| LEG-POL-24 | `Detail/AlertRules/RuleList/Item.jsx` | 详情规则页签 | 每规则：名称、severity、状态、监控目标、触发时长、表达式、摘要、消息、最近检测；展开查看 | 规则表：状态/名称/严重度/持续/说明（含消息）/完整表达式 | AC-RULES-05；TC-RULES-05 行数与表达式全文 | 改进：模板监控目标与最近检测无对应字段；全部字段直接可见，无需展开 |
| LEG-POL-25 | 同上 RuleList | 详情规则页签 | 规则搜索、分页 10、刷新、展开/收起 | 全量规则表（无搜索/分页） | — | 待补（见 §6；规则通常 ≤18，全量展示无展开） |
| LEG-POL-26 | `Detail/AlertMessages/index.jsx` | 详情消息页签 | 列 message/severity/监控目标/触发时间；`label_filters=rule_group`、activeAt 倒序、分页 10、空态 NO_DATA_DESC | 详情「告警消息」时间线（时间/状态/级别/摘要/正文/目标/当前值、总数、分页、空错态） | AC-RULES-06；TC-RULES-06（真实 globalalerts 数据、倒序、总数、空态、失败重试） | 通过 |
| LEG-POL-27 | AlertingStatus tooltip | 有数据 | 三类状态计数 | 规则级状态 + 消息时间线 | AC-RULES-05/06 | 改进（见 LEG-POL-05） |
| LEG-MSG-01 | `Alerting/Messages/index.jsx` | 项目/集群 | 入口 + 集群 custom/builtin 页签 | 项目 `…/alerts`；集群页既有 | TC-FULL-01 / 集群页既有 | 通过 |
| LEG-MSG-02 | Messages getColumns | 有数据 | 六列：message、state、severity、policy（链接详情）、监控目标（链接资源）、触发时间 | 六列：消息、状态、级别、告警策略、监控目标、触发时间（policy/target 为文本） | AC-ALERTS-02；TC-ALERTS-02 列顺序 | 改进/待补：两列下钻链接待补（无项目活动告警可验证 scope 推断） |
| LEG-MSG-03 | 列 filters | 有数据 | state（pending/firing）、severity（critical/error/warning） | 状态/级别筛选（服务端 `state`、`label_filters=severity`） | AC-ALERTS-02 扩展断言：请求含 `state=firing`、`label_filters=severity=critical` | 通过 |
| LEG-MSG-04 | withList + AlertStore | 有数据 | 服务端分页、activeAt 排序、totalItems | 服务端分页/排序/总数（sortBy=activeAt&ascending） | TC-ALERTS-02 断言「共 N 条」=接口 totalItems | 通过 |
| LEG-MSG-05 | `itemActions={[]}` | 所有 | 只读，无删除 | 只读；行详情抽屉 | AC-ALERTS-02/INV-ALERTS-02 | 通过（聚合 API 无 item DELETE，实测 404） |
| LEG-MSG-06 | emptyProps desc | 空 | ALERTING_MESSAGE_EMPTY_DESC | 空态标题/说明，不渲染表头 | AC-ALERTS-01/02 | 通过 |
| LEG-MSG-07 | `console/src/stores/alerting/message.js` | 所有 | `kapis/alerting.kubesphere.io/v2beta1/{namespaces/<ns>/}alerts`、`clusteralerts`、`globalalerts` | `alertMessagesApi`（scope global/cluster/project） | TC-ALERTS-02 断言请求命中 v2beta1 namespaced alerts、不请求 v1alpha2 | 通过（修正迁移前 v1alpha2 错组） |

计数（按原子 ID 去重，共 34 行）：通过 22；改进 7；等价承接 2；明确不做 2；待补 3（LEG-POL-17 批量启停、LEG-POL-25 规则搜索/分页、LEG-MSG-02 两列下钻链接）。待补项不从分母移除。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 字段或指标/标签 | 单位/精度/分母规则 | API 映射→页面位置 | 缺值/零/异常/过期规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-POL-01/03/04/10 | `GET /apis/alerting.kubesphere.io/v2beta1/{globalrulegroups,clusterrulegroups}` + 选定项目时 `…/namespaces/<ns>/rulegroups` | `metadata.name/creationTimestamp/labels[alerting.kubesphere.io/enable]`、`spec.rules[]`、注解 `kubesphere.io/description` | 规则数=数组长度（整数，不四舍五入）；分页在客户端合并后切页 | `toRuleGroupSummary` → 行 name/scope/enabled/ruleCount/type/createdAt/description | 空标签视为启用；缺描述显示「未填写描述」；三来源任一失败→错误面板 | TC-RULES-01 用 18 条 global 组对账规则数与合并总数；TC-RULES-02 回读标签 |
| LEG-POL-05/24/27 | `GET …/globalrulegroups/<name>` + `GET /kapis/alerting.kubesphere.io/v2beta1/globalalerts?label_filters=rule_group=<name>` | 规则 `alert/expr/for/severity/annotations`；告警 `labels.alertname/state` | 状态词三选一；表达式全文（无截断/无单位换算） | `toRuleGroupDetail` + `alertMessagesApi` → 规则表状态/字段、消息时间线 | 无匹配告警→「正常」；活动告警>100 条提示只读部分；规则 0 条→说明而非空表 | TC-RULES-05 规则行数=规则组 spec.rules；TC-RULES-06 消息区总数=过滤后 totalItems、行数≤10、倒序 |
| LEG-POL-14/15/18 | `POST/PUT/DELETE /apis/…/namespaces/<ns>/rulegroups[/<name>]`；`PATCH …/<name>`（merge-patch 只写 enable 标签） | `metadata.resourceVersion`、既有注解合并、`spec.rules` 整表、`annotations.summary/message` | 规则数=编辑器行数；不写 0 值填充；描述空→删除注解 | `ruleGroupsWriteApi` → 列表/详情刷新；启停只 patch 标签 | 409 冲突回显、草稿保留；空规则列表客户端拦截；编辑先 GET 合并注解 | TC-RULES-02/04、TC-ALERTS_WRITE-01：创建/编辑/删除/启停均 API 回读 |
| LEG-POL-21/22/23/26 | 详情读 `GET /apis/…/<scope 集合>/<name>`；消息 `GET /kapis/…/{globalalerts,clusteralerts,namespaces/<ns>/alerts}?label_filters=rule_group=<name>&sortBy=activeAt&ascending=false&page&limit` | 作用域/状态/类型/规则数/间隔/创建时间/创建者；消息 activeAt/state/labels.severity/annotations/实值 | 时间 `YYYY-MM-DD HH:mm:ss`（本地时区，单一格式化器）；分页 10/页，总数=totalItems；页数=ceil | 详情页三区块；时间线行 | 404→错误面板+返回列表；403→无权限说明不重试；消息失败→区内错误+重试；空→「该策略当前没有告警消息」 | TC-RULES-05/06 实测 global 组：规则 15 行、消息共 50 条/10 行、首行=最新；空组 alertmanager-rules→empty |
| LEG-MSG-02/03/04/07 | `GET /kapis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/alerts?page&limit&sortBy=activeAt&ascending&keyword&state&label_filters=severity` | `activeAt/state/labels.severity/labels.rule_group/labels.namespace/pod/workload/node/annotations.summary/message/value` | 服务端排序只按 activeAt；分页/总数服务端；severity 归一 high/medium/low→critical/warning/info | `alertMessagesApi` → 六列 + 详情抽屉（标签/注解摘要） | 0 条→empty（不渲染表头）；非 2xx→错误；target 由 labels 推导（不按 rule_type=template 门槛） | TC-ALERTS-02：请求命中 v2beta1、筛选参数下发、列顺序与总数对账 |
| LEG-POL-20/18 等 SSAR | `POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews` | `resourceAttributes.group=alerting.kubesphere.io`、`resource=rulegroups|clusterrulegroups|globalrulegroups`、verb、namespace | 明确的 allowed=false 才隐藏；检查失败 fail-open | `useRuleGroupPermissions` → 列表创建/行编辑/删除/启停、详情操作 | 403 写失败在 UI 错误区显示；检查失败不隐藏 | TC-ALERTS_WRITE-02：deny/allowed/500 三态在同一测试对象上验证 |

实测探测（2026-11-15，本地 BFF kapis → 隧道，admin）：

- `GET /apis/alerting.kubesphere.io/v2beta1/namespaces/default/rulegroups` → 200，0 条；`globalrulegroups` → 18 条（全部 builtin）；`clusterrulegroups` → 0 条。
- `GET /kapis/alerting.kubesphere.io/v2beta1/namespaces/default/alerts` → 200 `{items: [], totalItems: 0}`；`globalalerts` 随评估变化：33 → 44 → 65 条（kubernetes-apps 17→30、kubernetes-resources 13→14），`clusteralerts` 0 条。
- `label_filters=rule_group=<name>` 服务端生效（44 → 30；`state=firing` 65→23；`label_filters=severity=warning` 65→51）。
- `GET /apis/alerting.kubesphere.io/v2beta1/alerts` → 404；`DELETE …/namespaces/default/alerts/<name>` 与 `…/globalalerts/<name>` → 404 Page Not Found（无 item 删除路由）。
- v1alpha2 项目告警组返回 200 空体（旧实现误当空列表）——已改读 v2beta1（DES-ALERTS-03）。
- SSAR：`POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews` → 201 `{status}`，用于写门控。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 列表首屏回答「有哪些策略、哪些停用、各多少规则」；详情按「返回 → 标题/徽标/描述 → 操作 → 基本信息 → 规则 → 告警消息」纵向顺序；消息页首屏回答「现在有什么告警」 | `/tmp/alerting-policies-list-{zh,en}-{1024,1280,1600}.png`、`/tmp/alerting-policies-detail-…png` 人工核对区块顺序 |
| 字段栅格 | 属性区 label/value 两列（窄屏堆叠）；规则表固定百分比列宽，状态/名称/严重度/持续/说明/表达式，表达式换行不截断；消息时间线时间→状态→级别→摘要→正文→目标/值 | 1024/1280/1600 截图；修复前 1024 表达式与长规则名溢出（见 §5 过程），修复后表内换行 |
| 主题 | 复用 ai-kit token（`text-ai-fg*`、`border-ai-line`、`bg-ai-surface-*`、Badge tone），不写十六进制 | 默认深色主题三档截图人工核对；对比度依赖 ai-kit token（未单独跑对比度断言，见 §6） |
| 图标与图表 | 仅用 Badge/Icon（chevron/无）；无图表，不存在空值画 0 条问题 | 视觉核对 |
| 通用控件 | 列表/分页/搜索/筛选/刷新/空态/错误/确认框全部复用 ai-kit + 应用公共组件（`ResourceList`、`DeleteDialog`、`ResourceErrorPanel`、`DefinitionRow`、`Modal`）；未新建业务专用公共组件，因此无需新增 Storybook | 契约测试 `config/*.test.ts` 通过；页面未出现裸 `<button>` |
| 表单与弹窗 | 创建/编辑：名称锁定、规则整表增删、客户端校验（名称格式/至少一条/告警名与表达式必填/告警名唯一）、保存中禁用、失败保留草稿；删除要求输入名称 | TC-RULES-04 / ALERTS_WRITE-01 覆盖 |
| 链接与状态 | 返回链接回列表；列表/详情/消息区各有 loading/empty/error；403 不自动重试；筛选变化页码回 1 | TC-RULES-05/06、TC-ALERTS-02、TC-ALERTS_WRITE-02 |
| 集群级复用 | 集群页两页签的详情弹窗复用 `RuleGroupBody`，其内新增告警消息时间线（同一 `AlertMessagesTimeline`），因此集群页同样获得规则逐条 + 消息历史 | `/tmp/alerting-policies-cluster-detail-modal-zh-{1024,1280,1600}.png` |

复用决定：现有 `ResourceList`/`Modal`/`DeleteDialog`/`ResourceErrorPanel`/`DefinitionRow` 足以承载，仅新增应用内组件（`RuleGroupDetailPage`、`AlertMessagesTimeline`、`alertLabels`、`permissions`），没有扩展 ai-kit 公共组件 API，故不新增 Storybook 故事；共享组件消费者回归见 §5 的契约套件与集群页截图。

## 5. 编码与回归

- PRD/design 覆盖功能、数据语义、状态、权限、交互与视觉：AC-RULES-05/06、AC-ALERTS-02、AC-ALERTS_WRITE-02 及对应 DES/DEC/CON/INV/GOT 完整 ID。
- YAML 与 Python 一一镜像：新增 4 个 spec + 4 个测试文件；既有 RULES-01/ALERTS-02 断言扩展了筛选与数据源；一文件一函数、docstring 首行字面 TC ID。
- 旧能力表独立比对：§2 逐行核对；可自动检出的回归（v2beta1 数据源、列顺序、删除入口不存在）写入测试；其余人工核对。
- 显式类型/构建：`npx tsc --noEmit -p tsconfig.json`（console-next；本单元文件 0 错误，基线存在并行方的 federated 错误，未改动其文件）；`npx vite build` 通过。api-client `npx tsc` 仅有既有 test 目录错误（network-create/workspace-groups，非本单元）；本单元源码无错误。
- 契约套件：`npx vitest run --config config/vitest.config.ts` → **8 files / 1426 tests passed**（2026-11-15 23:18）。
- E2E（串行）：`pytest tests/kube-frontend/monitoring -m ui -q -n 0` → **13 passed / 0 failed / 0 skipped**（23:17，~79s），含既有 9 条与本单元新增 4 条。
- 写用例：`tc-e2e-` 唯一前缀创建；回读断言；`finally` DELETE 兜底，未删除他人对象。
- 视觉：zh/en × 1024/1280/1600 列表、详情、空消息详情、告警消息页截图 + 集群两页签/详情弹窗截图；人工核对发现并修复两处 1024 溢出（长 PromQL 表达式与长规则名），修复后重新截图确认。
- 门禁：`python3 prd/tools/check_docs.py --strict prd/kube-frontend/monitoring design/kube-frontend/monitoring tests/ui/specs/kube-frontend/monitoring` → 见 §6 最终结果；`build_prd.py` 与 `generate_case_docs.py` 已执行。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 部分完成（通过 22/34，改进 7，等价承接 2，明确不做 2，待补 3） | §2 表 + 实测探测 | 待补：批量启停、详情规则搜索/分页、消息→策略/资源下钻链接 |
| 数据语义 | 通过（本地） | §3 请求→映射→展示；TC-RULES-01/02/05/06、ALERTS-02、ALERTS_WRITE-01 回读；实测 v1alpha2 错组已修正 | member/生产环境的真实活动告警分布未验收 |
| 交互与权限 | 通过（本地 admin + 拦截 SSAR 三态） | TC-ALERTS_WRITE-02（deny/allow/500）；删除/启停/创建回读 | 真实非 admin 角色的 403 未在部署环境验收 |
| 视觉与主题 | 部分通过 | zh/en 三档截图（默认深色主题）；1024 溢出已修复 | 浅色主题、第二色调、真实 member 视觉未验收 |
| 静态/类型/构建/测试 | 通过（本单元范围） | tsc（本单元 0 错误）、vite build、契约 1426 passed、E2E 13 passed、docs gate 见下 | console-next 全仓 tsc 有并行方 federated 文件基线错误，已在 §5 记录，不改他人代码 |
| 本地全栈/B200 读取 | 本地全栈已验收 | BFF 8092 → 隧道 18088，admin，cluster host；真实接口数据（18 个 global 组、30–65 条活动告警） | B200 新版生产前端未部署/未验收 |
| 新版部署/member/全站 | 未验收 | — | 全站串行 E2E、member 集群/角色、生产部署均未执行 |

结论：**本地该页交付完成（核心任务），部分完成（3 项旧能力待补）**；新版部署/member/全站未验收，不声称“全部完成”。

门禁最终结果（本文件写入后重跑）：见下方追加行。

## 追加：门禁最终结果

```bash
python3 prd/tools/check_docs.py --strict prd/kube-frontend/monitoring design/kube-frontend/monitoring tests/ui/specs/kube-frontend/monitoring
# errors=0 warnings=0 what=all scopes=['prd/kube-frontend/monitoring', 'design/kube-frontend/monitoring', 'tests/ui/specs/kube-frontend/monitoring']  EXIT=0
```

生成物：`prd/tools/build_prd.py`（catalog 同步，0 新文件）→ `tests/ui/generate_case_docs.py`（398 份用例文档 + traceability）。新用例文档：`tests/ui/cases/kube-frontend/monitoring/TC-L3-KUBE-FRONTEND-MONITORING-{RULES-05,RULES-06,ALERTS-02,ALERTS_WRITE-02}.md`。


## 7. 追加（2026-11-16 第 5 轮）：批量启停与告警消息下钻

本单元交付时登记了 3 项「待补」；本批关闭其中 2 项，第 3 项（详情规则搜索/分页）仍待补。

| 待补项 | 本批结论 | 证据 |
| --- | --- | --- |
| 批量启停（LEG-POL-17） | **关闭**：列表多选 + 批量启用/停用，逐条 PATCH enable 标签并汇总结果；不可写的行不出现复选框 | AC-RULES-07；TC-RULES-07（E2E 通过）；DEC/CON-RULES-07 |
| 消息 → 策略/资源下钻（LEG-MSG-02） | **关闭**：详情新增「相关入口」——策略链接（scope 由 rule_level 推断）+ 对象链接（pod/deployment/…，工作空间由命名空间标签解析） | AC-ALERTS-03；TC-ALERTS-03（E2E 通过）；DEC/ALERTS-03/04 + GOT-ALERTS-03 |
| 详情规则搜索/分页（LEG-POL-25） | 仍待补（本批未做，保留在分母） | — |

实现要点：
- 批量启停没有批量端点：按选中集合**串行**调用既有 `setEnabled`，客户端汇总成功/失败；并发会把 API server 连接打满且无法说清哪条失败。
- 下钻全部基于告警自身标签：`rule_group`+`rule_level` 决定策略与作用域（缺省 project），`namespace`+对象键决定监控对象；标签缺失时不渲染链接，不猜对象。
- 集群「告警消息」页没有工作空间段：按告警里的 namespace 读一次命名空间对象取 `kubesphere.io/workspace` 标签（react-query 缓存 5 分钟），项目页则直接使用路由上下文。

验证（同批实跑，2026-11-16）：
- 门禁：`python3 prd/tools/check_docs.py --strict prd/kube-frontend/monitoring design/kube-frontend/monitoring tests/ui/specs/kube-frontend/monitoring` → errors=0 warnings=0；
- 监控目录串行 E2E `-n 0`：**15 passed / 0 failed / 0 skipped**（93.84s，含新增 RULES-07、ALERTS-03）；
- 批量启停回读：两个自建 rulegroup 的 `alerting.kubesphere.io/enable` 由 true→false→true；不可写行无复选框；
- 下钻回读：告警消息链接 href = `/kube-frontend/system-workspace/clusters/host/projects/<ns>/alertingrules/<rule_group>?scope=global`，按 scope 回读 `globalrulegroups/<name>` 200，点击进入策略详情页。

未验收：受限账号 403 分支、member 集群、浅色/第二色调、生产前端与全站串行 E2E。
