# 网络策略详情规则视图（2026-11-19）

> 本页记录：项目作用域「网络策略」详情页补上规则内容（入站/出站分块），并把规则投影抽成
> 项目规则视图与详情页共用的一个模块。方法见[迁移指南](../legacy-ui-migration-guide.md)，模板见[单页交付模板](page-migration-template.md)。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目作用域：打开一条网络策略，回答「它到底放通了哪些来源/去向与端口」 |
| 旧入口、源码 | 旧 console `Network/Policies/Detail/routes.js` + `Viewer/index.jsx`（按方向渲染「目标 / 目的地」两段表） |
| 新入口、构建 | `apps/console-next/src/pages/settings/NetworkPolicyDetailPage.tsx`（新增「规则视图」区块）；投影抽到 `networkPolicyRules.ts`，项目规则视图 `NetworkRulesPanel.tsx` 同步改为引用 |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai` + 本地 preview 5178；admin |
| 子页面与状态范围 | 规则区块：入站有/无规则、出站有/无规则、允许全部（`*`）；详情本身加载/失败沿用页面既有分支 |
| 明确排除及批准 | 不在详情页内嵌项目级规则视图（DEC-NETWORK_RULES-02 记被否方案）；规则编辑仍在隔离页对话框与编辑 YAML |
| 并行文件与安全边界 | 只改上述三个文件 + 该功能 PRD/design/spec/tests 与记录；E2E 只创建唯一命名的 NetworkPolicy 并删除 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码证据 | 显示条件 | 字段/动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-NP-DETAIL-001 | `Viewer/index.jsx:36-90` | 有策略 | 按方向（ingress/egress）分块列出规则 | 详情页「规则视图」区块，两块 | AC-NETWORK_RULES-02 / TC-02 | 通过 |
| LEG-NP-DETAIL-002 | 同上 `:90-140` | 有规则 | 目标：作用对象（podSelector） | 区块标题右侧「作用于 app=web」 | 同上 | 通过 |
| LEG-NP-DETAIL-003 | 同上 | 有规则 | 目的地：namespaceSelector / podSelector / ipBlock（含 except）/ 端口 | 每行「允许来源/去向」+「端口」两列 | 同上 | 通过 |
| LEG-NP-DETAIL-004 | 老页无显式空态 | 某方向无规则 | 空白 | 「这个策略没有入站/出站规则。」 | 同上 | 通过 |
| LEG-NP-DETAIL-005 | 老页无（`{}` 视为任意） | 规则允许全部 | 渲染为空 | 打印 `*`（与「没有规则」区分） | 单测覆盖 | 通过 |

## 3. 数据契约与全链路

| 能力 ID | 请求 | 返回类型 | 字段 | 显示 | 缺值规则 | 对账 |
| --- | --- | --- | --- | --- | --- | --- |
| 001–005 | 详情对象本身（`networkPoliciesApi.get`，已取） | JSON | `spec.podSelector`、`spec.ingress[].from/ports`、`spec.egress[].to/ports` | 规则表两列 | 无 `from/to` 或空数组 → `*`；无 `ports` → `*`；端口缺 `port` → 只显示协议（`TCP`），不显示 0；`endPort` → `TCP/5432-5433` | 属性区的规则数与表行数同源（同一对象） |

## 4. 交互、视觉与复用基线

- 区块标题「规则视图」+ 右侧「作用于 …」；入站/出站各一块，各带表头（允许来源/去向、端口）。
- 复用 ai-kit token 与页面既有表格样式；不新增公共组件。
- 空方向显示说明而不是空表；「允许全部」显示 `*`。

## 5. 编码与回归

- [x] 投影抽成 `networkPolicyRules.ts`（`toRuleRows` / `policyRuleSections` / `selectorText` / `peerText` / `portsText`），项目规则视图与详情页共用；无第二份格式化。
- [x] 单测 `test/network-policy-rules.test.ts` 4 条（双选择器对端、ipBlock except、端口区间、协议无端口、空方向、`*` 语义、多策略排序）。
- [x] E2E `TC-…-NETWORK_RULES-02`（mlu370）通过；项目规则视图与隔离页用例同批复跑。
- [x] AC/design/spec/tests 同步，生成物重跑（500 篇）。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 5 条原子 ID | — |
| 数据语义 | 通过 | 与对象同源；`*` 与空分开；端口区间 | — |
| 交互与权限 | 通过 | 只读；无写入口变化 | — |
| 视觉与主题 | 部分通过 | 1280 深色截图（`networkpolicy-detail-rules`） | 1024/1600、浅色、英文 |
| 静态/类型/构建/测试 | 通过 | typecheck 0；应用单测 **307 passed / 52 files**（含 4 条新增）；契约套件 **1615 passed / 20 files**；build；strict 门禁 0/0 | 与并行 E2E 叠跑时，`list-page-size.test.tsx` 曾超时一次；单跑与再次全量均通过（负载相关，已记录） |
| 本地全栈/mlu370 | 通过 | E2E 见 §7 | — |
| 新版部署/member/全站 | 未验收 | — | 生产、member、全站串行 E2E |

## 7. E2E（mlu370，`-n 0`）

| 用例 | 结果 |
| --- | --- |
| TC-…-NETWORK_RULES-02（新增：双向规则逐行断言 + 空方向说明） | 通过（4.73s） |
| TC-…-NETWORK_RULES-01（项目规则视图，受本次抽取影响） | 通过 |
| TC-…-NETWORK_ISOLATION-01/02/04（隔离页，受本次抽取影响） | 02/04 通过；01 跳过（`spaces` 项目没有网络策略，数据条件） |

命令：`pytest tests/kube-frontend/project-settings -q -n 0 -k "NETWORK"` → **4 passed, 1 skipped, 24 deselected in 19.15s**。
