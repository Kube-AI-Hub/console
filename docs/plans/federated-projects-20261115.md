# 联邦项目页族迁移交付记录（2026-11-15）

> 任务：task-6 联邦项目页族写能力与详情深化。本记录按[单页交付模板](page-migration-template.md) §1–§6 填写，
> 旧能力清单独立于新 PRD 建立（先源码/部署行为，再关联 AC/TC）。
> 矩阵行由 Lead 统一更新，本记录不修改 `capability-matrix.md`。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 企业空间（workspace）管理员维护多集群项目：列表核对、创建、编辑信息、调整部署集群、单条/批量删除、详情与联邦资源下钻 |
| 旧入口、源码版本、部署 URL | `console/src/pages/workspaces/containers/FedProjects/index.jsx`（列表 + 行操作 edit/add cluster/delete + 批量删除 + 创建），`console/src/actions/federated.js`（`federated.project.create/delete/delete.batch/add.cluster`），`console/src/components/Modals/FedProjectCreate/index.jsx`，`console/src/pages/fedprojects/**`（22 条详情路由 + 集群差异设置），旧部署入口 `/:workspace/federatedprojects` |
| 新入口、提交及工作树、构建 | `/kube-frontend/workspaces/<ws>/federatedprojects`（列表/详情/资源详情）；工作树含并行同事改动（未提交整体）；本单元改动见 `git status` 的 federated 相关路径；构建 `apps/console-next npx vite build`（本次 5.28s 增量，dist 已更新） |
| 环境、集群、角色 | 本地全栈：BFF 8092 + 静态站 5178 + 隧道 18088 → B200（`console-dev.brightaitoken.ai`）；主集群 host（唯一集群，Ready）；平台管理员账号；未验证 member / 受限账号 |
| 视口、主题、语言 | 1024×768 / 1280×800 / 1600×900；深色主题（唯一主题）；zh 与 en。截图见 §6 |
| 子页面与状态范围 | 列表（加载/就绪/空/无匹配/失败/删除中）；创建弹窗；编辑信息弹窗；调整部署集群弹窗；删除确认（单条/批量）；详情六页签（概览/应用负载/配置/存储/元数据/事件）；资源详情两页签（模板与分发/事件）；未找到/无权限/读取失败 |
| 明确排除及批准 | 联邦资源写操作、逐集群 overrides 编辑器、22 条详情中的网关/日志收集/配额/成员页签、跨企业空间列表、资源页签搜索分页——逐项写入 PRD「明确不做」，理由见 design 的非目标与被否方案 |
| 并行文件与安全边界 | 独占：`pages/federated/**`、`packages/api-client/src/federated.ts`、本页 PRD/design、`tests/ui/pages/federated_page.py`、本页 spec/test、本记录。共享文件仅局部 edit：`packages/locales/src/index.ts`（仅 fedprojects.*）、`packages/api-client/src/index.ts`（追加导出）、`prd/tools/tree.py`（只追加 TCs）、生成物 `prd/catalog.yaml`/`tests/ui/cases/**` 由脚本更新。未删除/回滚他人对象，测试对象全部唯一前缀并清理。 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-fed-001 | FedProjects/index.jsx getColumns | 有联邦项目 | 名称列：别名/名称 + 描述副行，链接到详情 | 保留（名称链接 + 别名副行） | AC-01/TC-01 行数与名称集合一致 | 通过 |
| LEG-fed-002 | nodeName columnSearch name/alias search:true | 有项目 | 名称与别名搜索 | 改进：单一搜索框匹配名称/别名/描述/命名空间（前端，250ms 防抖） | AC-01/TC-01（列表）、TC-04 搜索定位 | 通过（服务端无 name 过滤契约，见 DEC-12） |
| LEG-fed-003 | withList 刷新按钮 | 始终 | 刷新列表 | 保留 | AC-01/TC-06 刷新后行消失 | 通过 |
| LEG-fed-004 | `federated.project.create` + FedProjectCreate | 有创建权限 | 名称（必填/格式/重名检查）、别名、描述、集群数组（必选、未就绪禁用） | 保留并升级：企业空间只读、集群多选默认 host、提交前 SSAR、两步写入 + 失败回滚 | AC-04/TC-04 | 通过 |
| LEG-fed-005 | `resource.baseinfo.edit` + updateFederatedAnnotations | 有编辑权限 | 编辑别名/描述 → 对象注解 + overrides | 保留（对象注解 + 每集群 /metadata/annotations override） | AC-05/TC-05 | 通过 |
| LEG-fed-006 | `federated.project.add.cluster` | 有编辑权限 | 添加集群（placement 数组追加） | 改进：调整部署集群（集合替换，移除前警告） | AC-05/TC-05（单集群只验证回显与不变量；增删集群受环境限制） | 部分通过：单集群环境无法验证增删；API 单测覆盖替换与 override 同步 |
| LEG-fed-007 | `federated.project.delete` + DeleteModal（输入名称） | 有删除权限 | 单条删除，输入名称确认 | 保留（删除宿主命名空间，级联联邦对象） | AC-06/TC-06 | 通过 |
| LEG-fed-008 | `federated.project.delete.batch` | 有删除权限 | 批量删除（旧确认要输入所有名称，实际无法完成） | 改进：确认输入数量；部分失败保留原因 | AC-06/TC-06（成功分支）；失败分支由 api-client 单测覆盖 | 通过（失败分支 E2E 未构造 403） |
| LEG-fed-009 | fedprojects/containers/Overview | 有项目 | 概览：基本信息 + 配额 + 用量 + 引导 | 部分承接：基本信息 + 传播条件 + 资源类型；配额/用量归项目页族 | AC-07/TC-07；PRD 明确不做配额/用量 | 通过（范围收缩已入 PRD/design） |
| LEG-fed-010 | fedprojects/routes/index.js | 有项目 | 22 条详情路由：应用负载/配置/存储/网关/日志收集/配额/成员等 | 部分承接：三类资源页签（名称/类型/创建时间 + 资源详情）；其余页签不做 | AC-02/TC-02 | 通过 |
| LEG-fed-011 | 同上 | 有项目 | 网关、日志收集、配额、成员、基础信息等页签 | 明确不做，由各自页族承接（PRD 明确不做） | — | 批准不做（范围记录在 PRD/design） |
| LEG-fed-012 | fedprojects/containers/*/Detail | 有资源对象 | 资源详情：模板/各集群状态/编辑/监控等 | 部分承接：模板 YAML + 完整对象 YAML + 分发条件 + 事件；不做写/监控 | AC-03/TC-03（既有）、AC-08/TC-08（新增） | 通过 |
| LEG-fed-013 | fedprojects/components/ClusterDiffSettings、ConfigTemplate | 有资源对象 | 集群差异设置/调度偏好/模板编辑 | 明确不做（无写路径） | — | 批准不做 |
| LEG-fed-014 | FedProjects tabs projects/federatedprojects + 菜单权限 | 企业空间成员 | 项目/多集群项目页签切换、菜单按角色显示 | 等价承接：普通项目页签由项目列表承接（不在本页）；写入口按 SSAR 门控 | AC-04/AC-05/AC-06；单测权限探针 | 通过（只验证管理员 allowed=true；受限账号未验收） |
| LEG-fed-015 | FederatedMapper status=FED_ACTIVE_STATUS | 有项目 | 状态列恒显示 Active（不反映传播） | 改进：传播状态三态（已传播/未就绪/未回报），来源 status.conditions | AC-01/AC-07；TC-01 断言状态列、TC-04 断言 Propagation=True | 通过 |
| LEG-fed-016 | withList 空态/错误态 | 始终 | 空态、错误、重试 | 保留并细分：空/无匹配/失败/403/未找到/删除中 | AC-01/AC-07/AC-08；TC-01 空态、TC-07/TC-08 未找到、TC-06 删除中 | 通过 |
| LEG-fed-017 | locales zh/en 键 | 始终 | 中英文 | 保留：新增键双语，locale 契约测试通过 | FR-14；契约测试「locale keys 一致」 | 通过（分页器的 range/pageSize 等已显式传入，英文截图核对） |
| LEG-fed-018 | getCheckboxProps disabled: record.deletionTime | 有项目 | 删除中对象不可勾选 | 保留：deletionTimestamp 行不可勾选、不提供删除 | AC-06/TC-06；INV | 通过（代码与单测；E2E 删除中窗口短暂未断言） |

计数：18 条原子能力；通过 13；部分通过/环境受限 2（LEG-fed-006、LEG-fed-008 失败分支）；批准不做 2（LEG-fed-011、LEG-fed-013）；等价承接 1（LEG-fed-014 的一半）；未映射 0；未经证明承接 0。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 字段/标签 | 原单位→显示单位/精度/分母 | API 映射→页面位置 | 缺值/零/异常/过期值规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-fed-001/002 | `GET /apis/types.kubefed.io/v1beta1/federatednamespaces`（cluster-wide） | template labels workspace、metadata.name/namespace/creationTimestamp/annotations、status.clusters/conditions | 时间为 ISO8601 → `formatTimestamp` 到秒；不换算单位 | api-client `listProjects` → 列表行；详情同集合查找 | 无注解显示 `-`；status 缺失回退 placement；status 明确为空显示 `-`；失败走错误面板 | TC-01 行数 = 该企业空间对象数；TC-04 回读 labels/placement/annotations |
| LEG-fed-004 | ① `POST /kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>/namespaces` ② `POST /apis/.../namespaces/<name>/federatednamespaces` | labels `kubesphere.io/workspace`、`kubefed.io/managed=true`；placement.clusters；template.labels；overrides[/metadata/annotations] | 无单位；名称 ≤63 DNS label；别名 ≤63；描述 ≤256 | `createProject` → 创建弹窗 → 列表/详情 | 名称重复 409 → 对话框提示；第二步失败 → 删除命名空间并抛原错误；探测失败不阻塞 | TC-04 回读：宿主命名空间 managed=true、template 无注解、placement=[host]、override 注解=对象注解 |
| LEG-fed-005 | `PUT /apis/.../namespaces/<name>/federatednamespaces/<name>`（完整对象） | metadata.annotations、spec.overrides | 无单位 | `updateProjectInfo` → 编辑信息弹窗 → 详情/列表 | 清空别名/描述 = 删除对应键；其它注解保留；404 视为对象已删 | TC-05 回读：新注解、override 同步、placement 与 creator 不变 |
| LEG-fed-006 | 同上 PUT（placement 整体替换） | spec.placement.clusters、spec.overrides[].clusterName | 无单位 | `updateProjectPlacement` → 调整部署集群弹窗 | 空集合拒绝（422，前端也校验 ≥1）；新增集群补 override、移除集群删 override | TC-05 回读 placement/override 一致；api-client 单测覆盖多集群替换 |
| LEG-fed-007/008 | `DELETE /api/v1/namespaces/<name>` | metadata.deletionTimestamp | 无单位 | `deleteProject(s)` → 单条/批量确认框 → 列表刷新 | 200 只表示受理；回读 404 才算完成；批量失败逐项返回 | TC-06 轮询 404 与列表行消失 |
| LEG-fed-012/LEG-fed-0015 | `GET /apis/.../namespaces/<ns>/<plural>[/<name>]`、`GET /apis/.../v1beta1` | kind/name/creationTimestamp、spec.template、status.clusters/conditions | 时间同上 | 资源页签/资源详情/类型列表 | 404→未找到；无 status→明确说明；未知 segment→未知类型 | TC-02、TC-03（既有）、TC-08 |
| LEG-fed-016 | `GET /api/v1/namespaces/<ns>/events?fieldSelector=involvedObject.name=...,involvedObject.kind=...` | type/reason/message/count/lastTimestamp|eventTime|firstTimestamp/source.component | 时间为 ISO → 秒 | 事件页签（项目/资源） | 空事件显示「暂无事件。」；读取失败显示失败+重试；时间取三者之一，空显示 `-` | TC-07/TC-08 表头与空态断言；实测事件 reason 含 CreateInCluster/UpdateInCluster/AnnotationsNotSupported |
| LEG-fed-014 | `POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews` | verb/resource/namespace/name | — | 创建按钮 disabled+hint；行操作打开前询问 | 探测失败放行；明确 base=false 才禁用/提示 | TC-04 断言创建按钮 enabled（管理员）；拒绝分支未构造 |

实测写入证据（2026-11-15，B200 via 本地全栈）：
- `POST` 宿主命名空间（managed=false）→ FederatedNamespace：`status.conditions=[Propagation False reason=CheckClusters]`，事件 `UpdateInClusterFailed: Unable to manage the object which has label kubefed.io/managed: false`、`CreateInClusterFailed: An update will be attempted instead of a creation due to an existing resource`。
- 同一创建改 managed=true → 0.3s 内 `Propagation=True`，事件 `UpdateInCluster`。
- 向 `spec.template.metadata.annotations` 写注解 → 事件 `AnnotationsNotSupported: metadata.annotations cannot be set via template to avoid conflicts`。
- `DELETE /api/v1/namespaces/<name>` → 200；FederatedNamespace 约 4s 后 404；命名空间约 6–7s 后 404。
- 单条/批量删除用例均实际创建 3 个唯一前缀项目并清理；回读证据见测试日志与 artifacts。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 列表：标题/说明 → 工具行（搜索/刷新/批量/创建）→ 五列表格 → 分页；详情：返回 + 标题 + 三个写入口 → 六页签；概览按「基本信息 → 传播条件 → 资源类型」 | 截图 `/tmp/federated-projects-list-1600-zh.png`、`/tmp/federated-projects-detail-1280-zh.png`（人工核对顺序与首屏重点） |
| 字段栅格 | 名称（别名副行）/命名空间/部署集群/传播状态/创建时间；1024 隐藏创建时间、1280 显示 | `/tmp/federated-projects-list-1024-zh.png` 与 1280/1600 对比：无横向溢出，列隐藏符合断点 |
| 主题 | ai-kit 语义 token（ai-fg/ai-fg-secondary/ai-fg-muted/ai-line/ai-surface-2/ai-accent/ai-danger/success/warning），深色主题；无十六进制色值 | 截图人工核对：正文/次要文字可读，状态徽标色区分；契约测试无裸 hex（页面无 SCSS） |
| 图标与图表 | 仅 chess 左箭头/刷新图标（共享组件提供）；无自绘图表；空值不画 0 | 截图中无空图表；`-` 用于未知值 |
| 通用控件 | ai-kit ResourceList/Modal/Input/MultiSelect/Badge/Tabs/Skeleton/Button；共享 DeleteDialog、EditInfoDialog、ResourceErrorPanel、useListRefresh、useResourceListState | 契约测试：无裸 button、无手写确认框、actionProps 顺序、search/sort/selection/pagination 接线全部通过 |
| 表单与弹窗 | 校验在提交时显示在字段下；服务端错误保留在弹窗；取消不写；名称只读 | TC-04 校验分支、TC-05 编辑回读；截图 `/tmp/federated-projects-create-1280-zh.png` |
| 链接与状态 | 名称链接可中键（纯 a href）；页签切换不刷新；删除中不可选 | TC-06 勾选与刷新；INV 列表项 |
| 控制台 | 不适用（无终端/日志） | — |

复用决定：未新增/扩展公共组件。新增的 `FederatedProjectDialogs.tsx`、`FederatedEventsPanel.tsx` 是本页业务组合（表单字段、事件表、元数据表），不进入 ai-kit；共享弹窗/表格/空态/错误面板直接复用。因此无需新增 Storybook 故事，也没有共享组件消费者回归范围（契约测试覆盖 ui/api-client 边界）。

## 5. 编码与回归

- [x] PRD 的 AC 同时承接功能、数据语义、状态、权限、交互与视觉（AC-04..08 + FR/SC/UI 句柄）；design 写决策与被否方案（DEC-10..17）。
- [x] YAML 与 Python 一一镜像（TC-04..08）；既有 TC-01..03 保持不变并回归通过。
- [x] 旧能力表独立比对实现；可自动检出的项（locale 键、列表能力接线、无裸 button、无手写确认框、api-client barrel）由契约测试覆盖；其余人工逐行核对（§2）。
- [x] 单测 12 passed（federated.test.ts）；全仓契约 1426 passed；显式类型检查 console-next 通过、api-client `src` 无错误（`test/network-create.test.ts`、`test/workspace-groups.test.ts` 为并行同事在途文件的既有错误，未改动）；构建通过。
- [x] 固定构建后重跑 E2E：本批相关 8 条串行 **8 passed in 150.40s**（2026-11-15 23:21–23:24，最终 dist）；契约测试最终 **1426 passed / 8 files**；同次响应回读（对象/命名空间删除轮询）。
- [x] 写入用安全数据：唯一前缀 `pwfed*`、失败也清理；未删除他人对象。
- [x] 新旧同角色 host 集群首屏/全页 + 1024/1280/1600 + zh/en 截图人工复核（§6）。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 部分完成 | 2026-11-15；§2 共 18 条：通过 13、部分/环境受限 2、批准不做 2、等价承接 1；未映射 0、未经证明承接 0 | LEG-fed-006 增删集群（单集群环境）；LEG-fed-008 批量删除部分失败分支（未构造 403） |
| 数据语义 | 通过 | 列表/详情/创建/编辑/放置/删除/事件均请求→映射→展示对账；§3 实测证据 | 成员集群副本创建/清理（无 member 集群）；服务端分页不可用（DEC-12，前端分页已如实记录） |
| 交互与权限 | 通过（管理员） | E2E 8 passed in 150.40s（最终构建；04 创建、05 编辑/放置、06 删除、07/08 详情、01/02/03 回归）；实际写入回读与清理；测试对象零残留（仅剩既有 kubesphere-monitoring-federated） | 受限账号 403 分支、SSAR 拒绝分支未构造；member 未验收 |
| 视觉与主题 | 部分通过 | 1024/1280/1600 × zh/en 截图；深色主题；英文分页文案已修并核对 | 第二色调（accent palette）未逐页截图；浅色主题不存在（产品深色）；member 视图未验证 |
| 静态/类型/构建/测试 | 通过（本页范围） | `npx tsc --noEmit`（console-next）0 错误；`npx vitest run packages/api-client/test/federated.test.ts` 12 passed；`npx vitest run --config config/vitest.config.ts` 1426 passed；`npx vite build` 成功（5.28s 增量） | api-client 全量 typecheck 有为 2 个并行在途测试文件报错（非本页）；未运行全站串行 E2E |
| 本地全栈/B200 读取 | 通过 | BFF 8092 + 静态站 5178 + 隧道 18088；E2E 实际经 B200 读写；本次运行时间 2026-11-15 23:10–23:20 | — |
| 新版部署/member/全站 | 未验收 | — | 生产新前端未部署；member 集群、非 admin 角色、全站串行 E2E 未执行 |

**结论**：本地该页交付完成（覆盖列表/创建/编辑信息/调整放置/单条+批量删除/详情深化/资源详情深化，功能、数据、权限、状态、中英文同批）；**部分完成**项为单集群环境下的增删集群与成员集群分支、受限账号权限分支、第二色调/全站回归与部署验收，均已在 §6 与 PRD「明确不做/阻塞」中登记，不折算为完成。

证据路径：
- PRD：`console/prd/kube-frontend/access-control/federated-projects.md`
- Design：`console/design/kube-frontend/access-control/federated-projects.md`
- Specs：`console/tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-{01..08}.yaml`
- Tests：`console/tests/ui/tests/kube-frontend/access-control/test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_{01..08}.py`；页面对象 `console/tests/ui/pages/federated_page.py`
- 单测：`console/kube-frontend/packages/api-client/test/federated.test.ts`
- 截图：`/tmp/federated-projects-list-{1024,1280,1600}-{zh,en}.png`、`/tmp/federated-projects-detail-{1024,1280,1600}-{zh,en}.png`、`/tmp/federated-projects-create-1280-zh.png`、`/tmp/federated-projects-detail-metadata-1024-zh.png`、`/tmp/federated-projects-detail-events-1024-zh.png`
- 生成物：`console/prd/catalog.yaml`、`console/tests/ui/cases/kube-frontend/access-control/TC-L3-...-FEDERATED_PROJECTS-{04..08}.md`、`console/tests/ui/cases/_traceability.md`
