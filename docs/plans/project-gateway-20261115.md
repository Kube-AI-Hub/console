# 项目网关 · 编辑设置与集群侧项目网关列表

> 单元：task-9（项目网关写能力与集群侧项目网关列表）。日期 2026-11-16。
> 方法：docs/legacy-ui-migration-guide.md；模板：docs/plans/page-migration-template.md。
> 规格：prd|design/kube-frontend/project-settings/gateway.md（US2/US3、AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02/03、DEC-03…08、CON-01、GOT-01…06）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务 | 项目管理员改网关访问方式/副本数/追踪/注解/NodePort；集群管理员在集群侧盘点项目网关并直接编辑/删除 |
| 旧入口/源码 | `src/pages/projects/containers/Gateway/index.jsx`（项目网关卡+创建/编辑/删除）、`src/actions/gateways.js`、`src/pages/projects/components/Modals/GatewaySetting/index.jsx`（访问方式/追踪/LB 注解/controller.config）、`src/stores/gateway.js`、`src/pages/clusters/containers/Gateway/Components/{GatewayCard,ProjectGatewayList}/index.jsx`（宿主机网关卡、项目网关列表 名称/访问方式/IP/NodePort/副本数/追踪 + 行编辑/升级/删除） |
| 新入口/文件 | `/kube-frontend/system-workspace/clusters/<c>/projects/<ns>/gateways`（项目页）、`/kube-frontend/clusters/<c>/gateways/project`（集群侧项目页签，既有两视图路由）；`pages/settings/GatewayPage.tsx`、新建 `pages/settings/GatewayEditDialog.tsx`、`pages/cluster/ClusterGatewaysPage.tsx`、`packages/api-client/src/gateways.ts` |
| 环境/角色 | 本地全栈 5178 → BFF 8092 → 隧道 18088 → B200，host 集群，admin；深色主题，中文为主 + 英文复核 |
| 视口/语言 | 1024/1280/1600 × 900，中文与英文（浅色/第二色调未验收） |
| 子页面与状态 | 项目页两态 + 编辑弹窗；集群侧项目页签（列表/空态/无权限说明）；加载/有数据/空/错误/无权限分开 |
| 明确排除及批准 | 集群网关（宿主网关）的创建/编辑/删除仍属集群安装流程与兄弟单元（`GatewayDetailPage` 只读、在途）；批量删除、旧版网关升级入口不做（见 §2 与 §6） |
| 并行文件与边界 | 只改 task-9 写作用域；未触碰 `pages/cluster/GatewayDetailPage.tsx`、`api-client/{dashboards,promql}.ts`、`pages/cluster/{DashboardPanelsPage,ClusterCustomMonitoringPage}.tsx`、`docs/plans/capability-matrix.md`；locales/api-client index/tree.py 用局部 edit 追加 |

## 2. 旧能力全集与归宿（原子 ID）

| 旧能力 ID | 旧证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-GATEWAY-001 | projects Gateway 页 + GatewayCard | 始终 | 空态（创建）/信息态 | 保留：项目页两态 | AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01；TC-…-GATEWAY-01 | 通过（既有） |
| LEG-GATEWAY-002 | GatewayCard.get gatewayConfig | 有网关 | 类型/创建者/创建时间/地址/端口/副本数/追踪 | 补齐：信息区新增 NodePort、副本数、链路追踪、创建者、创建时间、provider（仅在存在时） | TC-…-GATEWAY-02 断言信息区字段；TC-…-GATEWAY-03 断言列表同源 | 通过 |
| LEG-GATEWAY-003 | GatewaySettingModal RadioGroup `spec.service.type` | 有网关 | NodePort / LoadBalancer，必选 | 实现：编辑弹窗 Select，默认当前值；本地必选校验 | AC-…-GATEWAY-02；TC-…-GATEWAY-02 默认值 + 切换 LoadBalancer 回读 | 通过 |
| LEG-GATEWAY-004 | GatewaySettingModal Toggle `spec.deployment.annotations['servicemesh.kubesphere.io/enabled']` | 集群启用 servicemesh 时显示 | 开/关，值字符串 true/false | 实现：开关无条件显示（GOT-06 记录未启用服务网格时只写注解不保证生效）；值字符串化 | AC-…-GATEWAY-02；TC-…-GATEWAY-02 打开后回读 true | 通过 |
| LEG-GATEWAY-005 | GatewaySettingModal AnnotationsInput `spec.service.annotations` | 仅 LoadBalancer | 键值可增删；旧按厂商预置键 | 改进：自由键值编辑器（任意厂商键），DEC-07；NodePort 时清空注解（沿用旧行为） | AC-…-GATEWAY-02；TC-…-GATEWAY-02 LoadBalancer 下写入并回读 | 通过 |
| LEG-GATEWAY-006 | GatewaySettingModal PropertiesInput `spec.controller.config` | 始终 | 键值（默认 worker-processes=4） | 实现：配置选项键值编辑器 | AC-…-GATEWAY-02；TC-…-GATEWAY-02 弹窗含配置项（无写入断言，保存后 config 回读） | 通过 |
| LEG-GATEWAY-007 | GatewayCard replicas / Detail scale `spec.deployment.replicas` | 有网关 | 正整数（旧只有显示与详情页扩缩） | 实现：编辑弹窗副本数（≥0 整数校验） | AC-…-GATEWAY-02；TC-…-GATEWAY-02 副本数 2 回读；TC-…-GATEWAY-03 行编辑 3 回读 | 通过 |
| LEG-GATEWAY-008 | 旧实现无 NodePort 编辑 | — | 只读展示 NodePort | 新增（任务要求）：编辑弹窗 NodePort 输入，写项目 Service，范围校验 30000–32767 | AC-…-GATEWAY-02；TC-…-GATEWAY-02 越界/重复被阻止、31000/31001 回读 | 通过 |
| LEG-GATEWAY-009 | actions/gateways.js 成功/失败 Notify | 始终 | 保存成功提示；失败提示；resourceVersion 冲突提示 | 实现：成功关闭弹窗并刷新；失败在弹窗内显示；冲突先重读重试一次 | AC-…-GATEWAY-02（错误显示）；TC-…-GATEWAY-02 非法值错误可见 | 通过（无真实冲突场景，重试路径单测级实现） |
| LEG-GATEWAY-010 | `GATEWAY_UPDATING_TIP` 版本冲突 | 冲突时 | 提示后重试 | 实现：update 先 GET 最新对象再 PUT，409 重试一次；仍失败显示错误 | 同上 | 实现完成；未构造真实 409 场景 |
| LEG-GATEWAY-011 | GatewayCard 宿主网关菜单 view/edit/delete | 集群侧 | 集群网关编辑/删除 | 待补（本单元范围外）：`pages/cluster/GatewayDetailPage.tsx` 由并行单元在途且只读；本单元不修改 | — | 待补（非本单元） |
| LEG-GATEWAY-012 | ProjectGatewayList.getColumns | 集群侧项目视图 | 名称/访问方式/IP/NodePort/副本数/追踪 + 名称标记（旧对象 update 图标） | 实现：项目页签列 名称/所属项目/访问方式/IP/NodePort/副本数/追踪/状态；数据=Gateway spec + Service join | AC-…-GATEWAY-03；TC-…-GATEWAY-03 表头、行单元格与 Service 端口对账 | 通过 |
| LEG-GATEWAY-013 | ProjectGatewayList itemActions edit/update/delete | 行操作 | edit（有 createTime）/update（无 createTime 的旧对象）/delete | 实现 edit/delete 复用同一弹窗与删除确认；update（旧版升级）明确不做：当前集合对象均带 creationTimestamp/Helm 注解，无旧对象，升级接口 `.../upgrade` 无对象可作用 | AC-…-GATEWAY-03；TC-…-GATEWAY-03 行编辑/删除 | 通过（update 明确不做，有证据） |
| LEG-GATEWAY-014 | ProjectGatewayList selectActions 批量删除 | 勾选后 | 批量删除 | 明确不做（本轮）：任务只要求行操作；批量选择涉及删除风险与额外确认交互，登记后续 | — | 明确不做 |
| LEG-GATEWAY-015 | withList 搜索/刷新 | 始终 | 按名称搜索、刷新、排序 | 保留：项目页签搜索/刷新沿用 ResourceList；排序未做（旧列 sorter 仅 name） | AC-…-GATEWAY-03（列表可用） | 通过 |
| LEG-GATEWAY-016 | DeleteModal 输入资源名确认 | 删除时 | 输入名称确认 | 保留：项目页删除；集群侧行删除复用同一 `DeleteDialog`（输入网关名） | AC-…-GATEWAY-01/03；TC-…-GATEWAY-03 行删除 | 通过 |
| LEG-GATEWAY-017 | GatewayCard canEdit（enabledActions） | 无权限 | 隐藏写入口 | 实现（新增要求）：SSAR update/delete 按命名空间，fail-open；无 update 隐藏编辑并说明，无 delete 隐藏删除 | AC-…-GATEWAY-03；TC-…-GATEWAY-03 mock SSAR 拒绝 | 通过（mock 验；真实受限账号未验） |
| LEG-GATEWAY-018 | 旧 i18n 键 | 始终 | 中英文 | 实现：settings.gateway.* / cluster.clusterGateways.* 新键中英成对；所有控件 data-ai-id | 契约套件：中英键集合 3142/3142 一致、字面键存在；TC 用句柄断言 | 通过 |
| LEG-GATEWAY-019 | 旧两视图 gateways/cluster、gateways/project | 集群侧 | 集群/项目两视图切换 | 保留：既有 `$name` 路由识别 cluster/project；本次只增强项目视图 | TC-…-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01 回归通过 | 通过 |
| LEG-GATEWAY-020 | GatewayMapper `metadata.annotations['kubesphere.io/annotations']`（LB 提供商） | LB 时 | 厂商下拉 + 预置注解键 | 改进（DEC-07）：读取并在信息区显示 provider（存在时）；不内置厂商预置键表，写注解走自由键值 | CON-01；TC-…-GATEWAY-02（注解自由键） | 通过（provider 写入未做，等价能力由自由注解覆盖） |

统计：20 条原子能力；通过 16；实现完成但部分场景未验证 2（009/010 的真实 409）；待补 1（011，非本单元）；明确不做 2（013 的旧版升级、014 批量删除）；未映射 0。

## 3. 数据契约与全链路（实测 B200 host，2026-11-15/16）

- 项目网关对象：`gateway.kubesphere.io/v1alpha1` Gateway，命名空间=项目。`spec` 结构与 CRD schema 一致：`controller{replicas,annotations,config,scope}`、`deployment{replicas,annotations}`、`service{type,annotations}`；CRD 无 nodePort 字段。
- 地址/端口：Gateway `status` 只有 `conditions` 与 `deployedRelease`；项目 Service `kubesphere-router-<ns>` 持有 `spec.ports[].nodePort` 与 `status.loadBalancer.ingress`。列表用一次集群级 Service 读取 join（`/kapis/resources.kubesphere.io/v1alpha3/services?limit=-1`，实测 112 条 / 195–279KB），单对象页读该 Service；读失败显示 `-`，不让整表失败。
- 写入：原生 `POST/PUT/DELETE /apis/gateway.kubesphere.io/v1alpha1/namespaces/<ns>/gateways[/<name>]`（成员集群加 `clusters/<c>/` 前缀）。实测 PUT `spec.deployment.replicas=2`、`spec.service.type=LoadBalancer`、追踪注解 `false`、`spec.service.annotations` 后回读一致，控制器把 Deployment 副本数改为 2。
- NodePort：Gateway CRD 无字段；Nginx CR 由 operator/Helm 拥有（PUT 409）；Service merge patch 需完整端口对象（只带 `{name,nodePort}` 422），实测 `PATCH /api/v1/namespaces/<ns>/services/kubesphere-router-<ns>` 后端口回读 31000/31001，网关 reconcile 后仍保持；`nodePort=1234` 被服务端 422，前端本地按 30000–32767 先拒绝。
- 创建：旧 body `spec.type/replicas/ports` 被 CRD 剪枝成空 spec → 控制器按 Helm 默认装 LoadBalancer（与页面文案不符）；改成 `spec.controller.scope={enabled:true,namespace}`、`spec.deployment.replicas=1`、`spec.service.type=NodePort` 后，Nginx/Service 均为 NodePort。
- kapis 写限制：全局网关存在时 kapis `CreateGateway` 被后端守卫拒绝、`UpdateGateway` 返回 namespace mismatch（实测 500），所以保持原生写路径（DEC-03、GOT-03）。
- 权限：`SelfSubjectAccessReview` update/delete `gateways.gateway.kubesphere.io` 按项目命名空间；仅明确 `allowed:false` 隐藏入口（fail-open）。
- 同次对账断言（TC-…-GATEWAY-02/03）：编辑后 Gateway spec 副本数/类型/追踪注解与 Service NodePort 回读等于所填；列表行的 NodePort/副本数/追踪与接口一致。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 项目页信息区 8–9 行 + 右上状态徽标 + 右下编辑/删除；集群侧两视图（集群只读、项目列表带行操作） | `/tmp/project-gateway-*-info.png`、`-cluster.png`；TC-…-GATEWAY-03 表头断言 |
| 字段栅格 | 定义列表 label/value 两列；列表 8 列（宽屏）/隐藏低优先级列（IP<md、NodePort<lg、状态始终） | 1024/1280/1600 截图无横向溢出；计算样式边框 `rgb(62,76,146)`（主题 token） |
| 主题 | 只取 ai-kit 语义 token（border-ai-line、bg-ai-surface、text-ai-fg*、danger 等），无十六进制约 | 人工三档中英核对；浅色/第二色调未验 |
| 图标与图表 | 无新增图表；状态用 Badge；行操作用共享 Dropdown | 按钮/菜单均有 aria-label 与 data-ai-id |
| 通用控件 | 复用 Modal/FormField/Input/Select/Switch/Button/AiButton/DeleteDialog/ResourceList，无自造弹窗 | 契约套件：页面无裸 button、页面有 AiSurface 与 state= |
| 表单与弹窗 | 弹窗默认值=当前 spec；非法值本地阻止；保存中禁用关闭；失败保留输入并显示错误 | TC-…-GATEWAY-02 校验与错误断言 |
| 链接与状态 | 集群侧项目视图的名称/项目链到项目网关页；空态给说明；无权限说明与空/错误分开 | TC-…-GATEWAY-03 |

复用决定：扩展共享 API 层 `gateways.ts`（不新建业务专用公共组件）；编辑弹窗是被两个页面复用的应用内组件，没有新增 ai-kit 公共组件，因此不需要 Storybook。

## 5. 编码与回归

改动文件：

- `kube-frontend/packages/api-client/src/gateways.ts`（重写：`GatewayDetail` 映射、`projectGatewaysApi` list/get/create/update/remove/setNodePorts、`toGatewayDetail/toClusterGateway`；成员集群 clusters 前缀；Service join；409 重试）；`index.ts` 追加导出。
- `apps/console-next/src/pages/settings/GatewayEditDialog.tsx`（新建，共享编辑弹窗）；`GatewayPage.tsx`（信息区字段 + 编辑入口 + SSAR 门控）；`pages/cluster/ClusterGatewaysPage.tsx`（项目页签列/行编辑/删除/空态/无权限说明，集群视图保持只读与既有句柄）。
- `packages/locales/src/index.ts`（settings.gateway.* 与 cluster.clusterGateways.* 中英成对新增，共 34+ 键）。
- `prd|design/kube-frontend/project-settings/gateway.md`（US2/US3、AC-02/03、DEC-03…08、CON-01、GOT-01…06、不变量 3–6、明确不做更新）；`prd/tools/tree.py` 追加 TC-02/03 → build_prd → generate_case_docs。
- `tests/ui/specs|tests/kube-frontend/project-settings/TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02/03`；`tests/ui/pages/project_settings.py` 追加网关页面/API 助手方法（仅追加）。

验证命令与结果：

- `cd console/kube-frontend/apps/console-next && npx tsc --noEmit -p tsconfig.json` → 本单元文件 0 错误；当前工作树另有 2 个并行同事提交的 `pages/cluster/juicefsQueries.ts` 错误（不在本单元作用域，已记录）。
- `cd console/kube-frontend/packages/api-client && npx tsc --noEmit` → 仅既有 `test/network-create.test.ts`、`test/workspace-groups.test.ts` 基线错误；`gateways.ts` 0 错误。
- `cd console/kube-frontend && npx vitest run --config config/vitest.config.ts` → 1444 passed / 0 failed（含页面 AiSurface/裸 button/中英键集合契约）。
- 串行构建：console-next `npx vite build`（/tmp/kf-build.lock 串行）→ ✓ built。
- E2E：`KA_APP_URL=http://localhost:5178 python3 -m pytest tests/kube-frontend/project-settings/...GATEWAY-01/02/03 + cluster-management/...CLUSTER_GATEWAYS-01 + ...GATEWAY_DETAIL-01 -m ui -q -p no:cacheprovider -n 0` → **5 passed**（127.32s）；单跑 02、03 亦通过（03 58.90s）。
- 门禁：`python3 prd/tools/check_docs.py --strict prd/kube-frontend/project-settings/gateway.md design/kube-frontend/project-settings/gateway.md tests/ui/specs/...GATEWAY-02.yaml ...03.yaml` → errors=0 warnings=0。
- 清理：所有写入使用唯一前缀命名空间 `e2e-gw-<random>`；用例 finally 删除自己的 Gateway（含 Helm finalizer 兜底）与命名空间；运行后核对 `gateways` 集合只剩全局网关、无 `e2e-gw-*` 命名空间。

环境记录：测试期间 `ks-controller-manager` 有重启（restarts=10），曾出现新建 Gateway 长时间无 Deployed 条件的瞬时停滞；控制器恢复后同一用例通过。该现象属共享控制面抖动，已用较长等待与清理兜底处理，不据此判定产品缺陷。

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 部分通过 | 20 条原子 ID：通过 16、部分验证 2、待补 1（非本单元）、明确不做 2、未映射 0 | LEG-GATEWAY-011 集群网关写操作（非本单元）；批量删除与旧版升级明确不做 |
| 数据语义 | 通过 | 实测写读回：replicas 2/3、type LoadBalancer、追踪 true/false、service.annotations、Service nodePort 31000/31001；列表与 Service 对账 | 真实 409 冲突路径未构造（实现为重读重试） |
| 交互与权限 | 通过（mock） | TC-…-GATEWAY-02/03：默认值、校验、保存关闭、行编辑/删除、SSAR 拒绝隐藏编辑并说明；删除确认输入名称 | 真实受限账号（非 admin）未验，SSAR 分支用 route mock |
| 视觉与主题 | 部分通过 | 深色 × 1024/1280/1600 × zh/en 人工核对；截图 `/tmp/project-gateway-{zh,en}-{1024,1280,1600}.png`、`-info/-edit/-cluster.png`；无横向溢出；计算边框=主题 token | 浅色主题、第二色调未验收 |
| 静态/类型/构建/测试 | 部分通过 | 本单元 tsc 0；契约 1444 全绿；build ✓；E2E 5 passed；scoped 门禁 0/0 | 并行 `juicefsQueries.ts` 2 个类型错误（非本单元）；全仓串行 E2E 未跑 |
| 本地全栈/B200 读取 | 通过 | 5178→8092→18088→B200，admin，host；真实对象/Service，非模拟（SSAR 拒绝分支用 mock） | 新版部署环境未验 |
| 新版部署/member/全站 | 未验收 | — | 生产前端、member 集群、全站串行 E2E 未执行 |

并发文档提示：兄弟单元 `prd|design/kube-frontend/cluster-management/cluster-gateways.md` 仍写「项目写操作由既有项目网关页承接」。本轮按 Lead 任务在集群页项目视图增加行编辑/删除（复用项目页弹窗），不是集群网关写操作；建议该单元所有者/Lead 在矩阵或该文档同步一句，以免两处口径漂移（我未修改该文件）。

结论：本项目在「本地该页」范围内交付完成（编辑设置 + 校验 + 回读 + 集群侧项目网关列表/行操作 + 权限门控 + 三档中英视觉）；集群网关写操作、批量删除/旧版升级、浅色/第二色调、真实受限账号、部署/member/全站为待补或未验收，不能写成整页完整迁移。