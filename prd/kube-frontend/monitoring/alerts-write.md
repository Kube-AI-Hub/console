# 告警策略的创建与编辑（L3）

[子模块需求](./_index.md) · 读列表与详情见 [rules.md](./rules.md)

## 概述

项目级告警策略（命名空间级 `rulegroups`）的写入口。读者在这个功能点里完成三件事：**创建**一条自定义策略（名称 + 描述 + 至少一条规则）、**编辑**它（描述、规则列表、级别）、**删除**它；启用与停用沿用既有策略列表的标签开关。内置（`alerting.kubesphere.io/builtin: true`）、集群级与全局级策略不在本功能点内，只读。

规则字段沿用老 console 的自定义规则模型：告警名称、PromQL 表达式、持续时间、严重度、说明（`annotations.summary`）与消息（`annotations.message`）。策略描述写 `metadata.annotations` 的 `kubesphere.io/description`，与老 console 的 `BaseInfo` / `EditBasicInfo` 表单一致。

## 用户故事

### US1 - 自己建一条策略并改它 (Priority: P1)

作为 **项目管理员**，我希望 **在页面上创建、修改、删除本项目自己的告警策略**，以便 **不必写 YAML 就能给项目加一条阈值告警，并在阈值变化时调整它**。

**Independent Test**：以 `tc-e2e-` 前缀创建一条带 1 条规则和描述的策略 → 回读对象核对描述注解与 `spec.rules` → 编辑描述与级别 → 回读确认 → 删除 → 回读 404。

## 验收场景

- **AC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01** — 已知选定了某个项目，当在告警策略页创建一条策略（策略名 + 描述 + 一条规则：告警名称、表达式、持续时间、严重度、说明与消息）并提交，则该项目命名空间下出现对应的 `rulegroups` 对象，其 `metadata.annotations['kubesphere.io/description']` 等于填写的描述、`spec.rules` 与填写内容逐条一致（告警名、表达式、持续时间、严重度、`annotations.summary`、`annotations.message`），且列表中出现该策略；当通过行操作「编辑」修改描述与规则级别并提交，则回读对象的描述与规则级别均已更新且其余规则未被删除；当通过行操作「删除」并确认，则该对象不再存在（回读 404、列表不再包含）；内置与集群级策略不提供编辑/删除入口。

## 设计目标

1. 写操作只落在「用户自己的策略」上：项目级、非内置；其余策略明确不给入口，而不是点了再报错。
2. 一次保存整体替换规则列表：编辑多规则策略不得删掉没显示出来的规则。
3. 描述与消息写入平台与老 console 都在读的注解键，回读即可验证，不引入新协议。

## 约束与边界

- 读：`/apis/alerting.kubesphere.io/v2beta1/{globalrulegroups,clusterrulegroups}`；选定项目时追加 `/namespaces/<ns>/rulegroups`。
- 写：`POST /apis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/rulegroups`、`PUT .../<name>`（整对象，携带 `metadata.resourceVersion` 与既有注解）、`DELETE .../<name>`。
- 创建与编辑都只在已选定项目时提供：命名空间级资源在「全部项目」视图下没有可写的命名空间。
- 策略名创建后不可改；改名等价于「新建再删除」，中间会同时存在两个对象。
- 描述上限 256 字符；规则说明上限 63 字符、消息上限 256 字符（与老 console 表单一致），超出部分由输入框截断。
- 规则级别取值 `critical` / `warning` / `info`，与既有读取映射一致；不在前端做 PromQL 语义校验，非法表达式由服务端拒绝并在对话框内回显。

## UI 交互设计

- 列表主操作：选定项目后出现「创建策略」；未选定项目时不出现。
- 创建 / 编辑共用一个模态框：策略名称（编辑时禁用）、描述多行输入、规则列表；规则列表可「添加规则」「删除规则」（最后一条不可删），每条含告警名称、表达式、持续时间、严重度、说明、消息。
- 行操作：详情、启用 / 停用（互斥显示）、编辑、删除；编辑与删除只对项目级、非内置策略显示。
- 对话框内草稿在点击「确认」前不写集群：半成品规则一旦落库，告警控制器会立即按它评估。
- 对话框内错误分两类：客户端校验错误（名称不合法、规则为空、告警名重复）与接口错误（权限、资源版本冲突、服务端校验），都在对话框内就地显示，错误文案经既有 `errorMessage` 归一。

## 文案与校验

- 创建标题「创建告警策略」，编辑标题「编辑告警策略」；按钮「确认」「取消」。
- 必填：策略名、每条规则的告警名称与表达式；至少一条规则。
- 校验文案：策略名格式、规则不能为空、告警名称必填、表达式必填、同一策略内告警名称不能重复。
- 名称提示：小写字母、数字、点与连字符；创建后不可改名。
- 描述为空时不写注解；编辑时清空描述会删除该注解。

## 边界情况

- 策略没有规则：不提交（接口接受空规则列表，但创建出的策略不评估任何内容）。
- 规则列表为空时删除最后一条：按钮禁用，避免把策略保存成空策略。
- 同名策略已存在：服务端返回 409，错误回显在对话框内，草稿保留。
- 另一个管理员同时编辑：PUT 携带读取到的 `resourceVersion`，冲突时服务端拒绝并回显，不静默覆盖。
- 编辑过程中规则被并发删除：详情查询失败则对话框显示加载态/错误，不拿空列表覆盖。
- 项目筛选切到「全部项目」：创建入口消失；已打开的对话框在切换后保存失败并提示无命名空间。
- 内置或集群级策略：只显示详情与启用/停用，不显示编辑 / 删除。

## 明确不做

- **集群级与全局级策略的创建、编辑**：探测确认 API 允许写（`POST /clusterrulegroups` 与 `POST /globalrulegroups` 在 `?dryRun=All` 下均返回 201，真实 `POST` + `DELETE` 也可用），但这些对象由安装器维护、没有项目归属，页面不提供入口；改了下一次协调会被覆盖。
- **旧模型 `alertingrules` 的写**：本集群 `GET /apis/alerting.kubesphere.io/v1alpha2/.../alertingrules` 返回 404，`/kapis/alerting.kubesphere.io/v1alpha2/...` 返回 200 且响应体为 `{}`，旧模型在本集群只读/不存在，因此只实现 v2beta1 规则组的写。
- **编辑 YAML**：本功能点只做表单编辑；YAML 编辑作为独立能力另行登记。
- **别名（`kubesphere.io/alias-name`）与检查间隔（`spec.interval`）**：老 console 有，本期不做；读取与写入均不涉及这两个字段。
- **模板规则（`exprBuilder` / 阈值模板）**：只支持自定义 PromQL 表达式。
- **改名**：名称创建后不可改。
- **规则的排序与分组**：规则按录入顺序写入，Prometheus 不区分顺序。

## 假设

- 集群提供 `alerting.kubesphere.io/v2beta1` 的 `rulegroups` / `clusterrulegroups` / `globalrulegroups` CRD，且 `/apis` 路径可写。
- 服务端会为每条规则补 `labels.rule_id`；该字段不由前端维护，回读断言不依赖它。
- 注解 `kubesphere.io/description` 与规则注解 `annotations.summary` / `annotations.message` 是平台与老 console 共用的读取键。

## 功能需求

- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01** — 选定项目后可创建项目级策略，提交后对象带描述注解与规则列表。
- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-02** — 编辑策略时加载现有规则列表；保存整体替换 `spec.rules`，未修改的规则必须保留。
- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-03** — 编辑可修改描述、每条规则的表达式、持续时间、严重度、说明与消息。
- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-04** — 删除项目级自定义策略后对象不存在。
- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-05** — 提交前校验：名称格式、至少一条规则、告警名称与表达式必填、告警名称在同策略内唯一。
- **FR-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-06** — 写操作只对项目级非内置策略出现；内置与集群级策略不提供编辑 / 删除。

## 成功标准

- **SC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01** — 创建、编辑、删除三步均以 API 回读为证：创建后描述与规则逐字段一致，编辑后描述与级别更新且其余规则仍在，删除后回读 404。

## 验收用例

- `TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01`
