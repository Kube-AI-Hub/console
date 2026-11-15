# 告警策略的创建与编辑 · 技术方案（L3）

[需求](../../../prd/kube-frontend/monitoring/alerts-write.md)

## 概述

项目级告警策略（命名空间 `rulegroups`）的写通道：创建、编辑、删除，以及既有策略列表上的启用 / 停用。页面读取侧（列表、详情、两代模型的探测）已在 `rules.md` 落定，本方案只描述**写**：写什么路径、整对象还是字段补丁、哪些对象不给入口、字段落在资源模型的哪个位置。

## 关联需求

- AC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01
- AC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-02

## 设计目标与非目标

目标：一次保存完整表达一条策略（描述 + 规则列表）；写入不覆盖本编辑器没有展示的字段；写入口只出现在能成功且不会被协调覆盖的行上。

非目标：集群级 / 全局级策略编辑、旧 `alertingrules` 模型的写、YAML 编辑、规则模板生成、改名。

## 关键约束

- API 只有 v2beta1 的规则组可写：`/apis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/rulegroups`。`/kapis` 与 v1alpha2 路径只读或不存在。
- `spec.rules` 是数组；JSON merge patch 整体替换数组，因此 PUT 整对象而不是逐字段 patch。
- PUT 必须带 `metadata.resourceVersion`；否则两个编辑者会静默覆盖对方。
- 描述写 `metadata.annotations['kubesphere.io/description']`；规则说明/消息写 `spec.rules[].annotations.summary` / `annotations.message`。
- 启用 / 停用只 patch `alerting.kubesphere.io/enable` 标签，不动 `spec`（与 `rules.md` 的 DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-03 一致）。
- 写入口先问 `SelfSubjectAccessReview`：资源 `rulegroups`（项目级，带 namespace）/ `clusterrulegroups` / `globalrulegroups`（集群级，不带 namespace），动词 create/update/delete。只有明确的 `allowed: false` 才隐藏入口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01 — 写入口放在列表的模态框里，不新增详情路由

**为什么**：创建、编辑、删除都围绕列表中的一行；读者在列表上判断「这条策略该不该改」，弹窗把草稿与行放在同一上下文里，失败也不用离开列表。项目级规则的字段量小（描述 + 若干规则），弹窗足够承载。

**被否方案**：独立创建 / 编辑路由。需要多一条路由、多一次详情请求和返回列表时的滚动位置恢复，收益只是「URL 可收藏」；策略编辑不是需要分享链接的场景。

**何时重新考虑**：规则编辑需要导入导出、模板选择或 YAML 双栏对照时。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-02 — 复用列表已有的读取模型与规则表格 schema，而不是另建一套写 schema

**为什么**：页面已把 `RuleGroupSummary` / `RuleGroupDetail` 与规则表格的列语义定义清楚（名称、级别、持续、说明、表达式）。写对话框直接以 `RuleGroupRuleInput` 映射同一组字段，读与写在字段名上只有一处转换（`name` ↔ `alert`），回读验证与详情展示说同一件事。另建一套只在写里用的 schema 会产生两份真值：详情显示「持续」、编辑器写 `for`，读者与代码都要记两种说法。

**被否方案**：为创建/编辑单独定义 `AlertPolicyDraft`。字段几乎重复，后续加字段要改三处（读模型、表格、草稿）。

**何时重新考虑**：编辑器需要读取模型没有的字段（例如模板参数）时。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-03 — 描述用 `kubesphere.io/description` 注解

**为什么**：规则组 CRD 没有描述字段；老 console 的 `BaseInfo` / `EditBasicInfo` 把描述写在 `metadata.annotations['kubesphere.io/description']`，平台侧也按这个键读取。探测确认：POST 时带该注解、GET 回读一致；PUT 与 merge patch 都能更新它。写别的键会「保存成功但没人读得到」。

**被否方案**：塞进 `spec`。CRD 没有该字段，写入会被拒绝或静默丢弃；塞进标签不可行，标签值上限 63 字符且会进入选择器语义。

**何时重新考虑**：规则组 CRD 增加正式描述字段时。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-04 — 只对项目级、非内置策略提供编辑 / 删除

**为什么**：`alerting.kubesphere.io/builtin: true` 的规则组由安装器写入，编辑后下一次协调会覆盖，控制台与安装器各存一份真值；集群级 / 全局级没有项目归属，不在项目页的职责内。写入口的可见性就是这条边界：不能成功的操作不出现在行操作里。

**被否方案**：允许编辑但保存后提示「可能被覆盖」。这是把不可靠的写入伪装成成功。

**何时重新考虑**：平台提供自定义集群级策略的所有权声明时。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-05 — PUT 整对象，注解做合并而非替换

**为什么**：`spec.rules` 是数组，merge patch 以数组替换语义处理，等于每次都整表覆盖；既然要整表替换，就显式 PUT 整对象并携带读到的 `resourceVersion`，让并发编辑变成 409 而不是静默覆盖。同时把新描述合并进**现有** `metadata.annotations`：控制器与安装器会写自己的注解，保存时丢掉它们等于为了一个描述字段破坏对象。

**被否方案**：PATCH 只发 `{spec:{rules}}`。数组替换语义相同，但拿不到资源版本、也不会合并注解；描述只能另发一次请求，两次请求之间可能失败一半。

**何时重新考虑**：服务端支持 `spec.rules` 的服务端补丁（server-side apply）且需要字段级所有权时。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-06 — 集群级 / 全局级与旧模型不做写，并保留探测证据

**为什么**：探测发现 API 在权限上并不阻止写：`POST /clusterrulegroups?dryRun=All` 与 `POST /globalrulegroups?dryRun=All` 返回 201，真实 `POST` 后 `DELETE` 也能清理；但全局组全部带 `builtin: true`（本集群 18 个），集群组没有项目归属、也不在「告警策略」页的写模型里。旧模型 `/apis/.../v1alpha2/.../alertingrules` 返回 404，`/kapis/.../v1alpha2` 返回 200 空体（聚合层的空响应），说明本集群没有旧模型可写。因此本功能点只实现「API 允许写 **且** 归属于项目 **且** 不会被协调覆盖」的那一部分，其余写进需求的「明确不做」。

**被否方案**：既然 API 允许就全部支持。能写不等于该写：对安装器对象写入会制造控制台与平台的分歧，且没有回读证据能证明协调器不会覆盖。

**何时重新考虑**：平台为集群级自定义策略提供独立所有权（例如用户可创建的非 builtin 集群规则组）时。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-07 — 写入口先过 SSAR，再决定渲染

**为什么**：角色绑定是权限的唯一事实，前端没有第二套权限模型。`SelfSubjectAccessReview` 用与真实写入相同的 verb/resource/namespace 提问，结论与 403 一致；这样只读成员看不到「创建策略」，不会填完表单才被拒绝。创建是项目级写（必须选定项目），编辑/删除只在项目级非内置策略上出现，启停按行所属 scope 分别检查。

**被否方案**：先渲染入口，403 时再提示。把一次确定的拒绝变成一次填表实验；旧 console 的 `authKey` 只控制菜单可见性，不判断具体资源动词，不能直接照搬。

**何时重新考虑**：平台提供批量权限查询端点（一次返回多个 verb）时，可减少请求数而不改变判定语义。

### DEC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-08 — 权限检查失败 fail-open

**为什么**：检查请求失败（BFF 旧版本、网络抖动、上游 5xx）不代表用户没有权限。此时隐藏入口会拿走一个本来可用的操作，而真正的写入仍会被服务端 403 拒绝——错误会在对话框里如实显示。因此只有 `status.allowed === false` 才隐藏；`undefined`/抛错一律按允许渲染。

**被否方案**：检查失败也隐藏（fail-closed）。对只读用户更安全，但对有权限的用户是功能丢失，且与「服务端仍是最终裁决」的事实矛盾。

**何时重新考虑**：产品要求严格 fail-closed（例如高风险生产环境）时，改为显示禁用 + 明确「权限未知」，而不是静默隐藏。

## 系统现状
老 console 的告警策略是独立表单页：`Alerting/Policies` 列表 + 创建页 + 编辑基本信息 / 编辑告警规则两个弹窗，字段来自 3.3 的 `alertingrules`。本集群没有该资源（页面探测结果见 `rules.md`），实际模型是 KubeSphere 3.4 的 rule groups。新的写实现只覆盖当前模型，字段沿用老 console 自定义规则的语义（告警名、PromQL、持续、级别、说明、消息），但不照搬它的模板化 `exprBuilder` 与多步表单。

## 仓库落点

- 页面：`apps/console-next/src/pages/monitoring/RuleGroupsPage.tsx`（行操作与创建入口）、`RuleGroupDialog.tsx`（创建 / 编辑模态框）、`RuleGroupDetailPage.tsx`（详情页的编辑 / 删除 / 启停）、`permissions.ts`（SSAR 门控 hook）
- 接口：`packages/api-client/src/alerting.ts` 的 `ruleGroupsWriteApi`（create / update / remove）与 `toRuleGroupSummary` / `toRuleGroupDetail` / `toRule`（读取描述与消息）；`accessReviewApi`（SSAR）
- 文案：`packages/locales/src/index.ts` 的 `monitoring.ruleGroups.*`、`monitoring.ruleGroups.permission.createDenied`
- 用例：`tests/ui/specs/kube-frontend/monitoring/TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01.yaml`、`…-ALERTS_WRITE-02.yaml` 与对应测试

## 对外契约

| 用途 | 路径 | 方法 | 探测结果 |
| --- | --- | --- | --- |
| 项目级策略列表 | /apis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/rulegroups | GET | 200，`{items}` |
| 创建 | 同上（集合） | POST | 201；服务端为每条规则补 `labels.rule_id` |
| 编辑 | 同上 + /<name> | PUT（整对象） | 200；描述注解与规则列表回读一致 |
| 删除 | 同上 + /<name> | DELETE | 200；随后 GET 返回 404 |
| 启用 / 停用 | 同上 + /<name> | PATCH（merge-patch+json） | 200；只改 enable 标签 |
| 集群级（不提供 UI） | /apis/alerting.kubesphere.io/v2beta1/clusterrulegroups | POST / DELETE | 201 / 200（dryRun 也是 201） |
| 全局级（不提供 UI） | /apis/alerting.kubesphere.io/v2beta1/globalrulegroups | POST（dryRun） | 201；本集群 18 个组均为 builtin |
| 旧模型 | /apis/alerting.kubesphere.io/v1alpha2/namespaces/<ns>/alertingrules | GET | 404 |
| 旧模型（kapis） | /kapis/alerting.kubesphere.io/v1alpha2/namespaces/<ns>/alertingrules | GET | 200，空体 |

请求体形状：

    {
      "apiVersion": "alerting.kubesphere.io/v2beta1",
      "kind": "RuleGroup",
      "metadata": {
        "name": "<policy-name>",
        "namespace": "<ns>",
        "annotations": { "kubesphere.io/description": "<description>" }
      },
      "spec": {
        "rules": [
          {
            "alert": "HighCpuUsage",
            "expr": "up == 0",
            "for": "5m",
            "severity": "warning",
            "annotations": { "summary": "<summary>", "message": "<message>" }
          }
        ]
      }
    }

## 不变量

1. `spec.rules` 的长度等于编辑器里规则行的数量；保存不会删掉编辑器展示过的规则。
2. 描述以 `kubesphere.io/description` 注解持久化；回读值等于最后保存的值（空描述则注解不存在）。
3. 只有项目级、非 `builtin` 的策略有编辑 / 删除入口。
4. 写请求失败时对话框保留草稿，列表不刷新成「已保存」。
5. 启用 / 停用不重写 `spec`。
6. 入口可见性 = 所有权（项目级非内置）× 权限（SSAR allowed），两者都为真才渲染；检查失败按 allowed 处理。
7. 无 create 权限时列表给出固定说明，不出现创建按钮。

### CON-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-03 — 写权限检查契约

`POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews`，body 的 `spec.resourceAttributes` 为 `{group: alerting.kubesphere.io, resource, verb, namespace?}`：项目级 `resource=rulegroups` 且带 namespace；`clusterrulegroups`/`globalrulegroups` 不带 namespace。响应 `status.allowed` 为 `true`/`false`；缺失或请求失败按允许处理（DEC-08）。

## 已知坑

- **旧模型读 200 空体**：`/kapis/alerting.kubesphere.io/v1alpha2/...` 对不存在的资源返回 200 与空体，不能当成「写成功」或「模块未安装」的唯一证据；v2beta1 的 `/apis` 才是权威路径。
- **rule_id 注入**：POST 后服务端会给每条规则补 `labels.rule_id`；断言规则体时只比较自己写入的字段，否则回读会被注入字段干扰。
- **PUT 会带出读到的注解**：实现里先 GET 再合并描述、再 PUT；如果直接拿列表行构造对象会丢 `resourceVersion` 与安装器注解。
- **空规则列表被接受**：接口不会拒绝 0 条规则，客户端必须拦住，否则创建出「看起来正常、什么也不评估」的策略。
- **数组替换语义**：merge patch 对 `spec.rules` 是替换而非合并；这也是编辑器必须持有整条列表的原因。
- **名称不可改**：编辑时名称输入禁用；改名需要新建再删除，中间存在双对象的窗口，本期不做。
- **SSAR 资源名是复数且分作用域**：用 `rulegroup` 或漏掉 namespace 会得到错误的 allowed 结论；三种规则组资源在 API 里是三个独立资源。
- **SSAR 结果会被缓存一分钟**：刚授予的角色可能一分钟后才出现入口；刷新页面可立即重查。
- **fail-open 不是 fail-silent**：检查失败时入口出现，但真正写入若 403，错误必须在对话框/详情内可见，不能吞掉。

## 测试与可观测

- E2E：创建（1 条规则 + 描述）→ API 回读逐字段断言 → 列表搜索出现该行 → 行操作编辑描述与级别 → 回读 → 删除 → 回读 404；`finally` 中按名称兜底删除。
- 可观测的 `data-ai-id`：`monitoring-alerts:create` / `:edit` / `:delete` / `:enable` / `:disable` / `:dialog` / `:name` / `:description` / `:rules` / `:rule:<i>:*` / `:rule-add` / `:rule-remove:<i>` / `:save` / `:error`。列表与详情的读取句柄保持 `alertingrules:*` 不变（既有用例依赖）。
- 失败时先看：对话框是否已加载完现有规则、`resourceVersion` 是否冲突、描述注解是否写到了 `metadata.annotations`。
- 权限门控：可观测 `alertingrules:no-create-permission`（列表说明）、行菜单条目集合、`alertingrules:detail:edit` / `:detail:delete` / `:detail:toggle` 是否存在；权限用例用 route 拦截 `**/selfsubjectaccessreviews` 控制 allowed/失败两种结论。

## 后续改进

- 编辑 YAML / 导入导出策略。
- 别名与检查间隔（老 console 有，本期未做）。
- 告警模板（按节点 / 工作负载生成表达式）。
- 集群级自定义策略的所有权模型明确后再开放集群级写。

## 验收用例

- TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01
- TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-02
