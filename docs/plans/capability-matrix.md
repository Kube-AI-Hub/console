> 环境受限的 skip 逐项归因见 [环境受限的验证项](environment-blocked-verifications-20261115.md)。

# 能力矩阵：功能级缺口的登记与归宿

> 当前复核台账，2026-11-15 原地整合；是路线、区域方案和旧 GAP 的唯一待办索引。
> 本次没有重验全站；§0 记录已有批次证据与下一步核对范围，不把旧31项归宿统计当成迁移完成率。
> §1/§2/§3 及附录保留历史快照，**不作当前状态或执行建议**；正文中旧“已补/仍缺/当前”均限于当时基线。
> 页面段级归宿看 `gap_check.py`，原子能力和五项验收看[交付模板](page-migration-template.md)与对应页记录。

---

> 汇总状态见 [迁移收口状态](migration-status-20261116.md)（页面映射 **93** 迁移 / 0 缺口，2026-11-18 复跑；有环境阻塞项与判定方式说明）。

**验收结论带时效**：每一行的「已验收」都是**某个时间、某套环境**上的测量。

> ⚠️ **2026-11-18 05:35 起**：`4ff017afa` 把登录改为 ks-apiserver 进程内完成，而当前部署未注册该路由，
> 新 console 在这两个环境上**无法登录**。此前所有绿灯属于**重构前**的构建；矩阵各行在重新验收前只代表历史。
> 见[记录](bff-retirement-state-20261118.md)。环境会变（2026-11-18 A100 的成员集群 `xc`
被移除，多集群结论因此不可复现），所以每行要能回答三个问题：**何时测的、在哪测的、什么条件下能复验**。
答不出来的行不算「已验证」，只算「当时验证过」。

## 0. 当前复核台账

### 已有批次证据

以下是有记录的交付范围，不是今日重跑结果；不因保留记录而免除后续回归。

| 页面/能力 | 已验收范围 | 提交/证据 | 未覆盖的范围 |
| --- | --- | --- | --- |
| 集群概览 | OVR-01至08、九维排行/组件/工具、左列状态、五字段对齐、图标和主题边框；节点块环图左置并铺满1:2槽、头部与排行等高；基本信息/Kubernetes状态改行式密集属性表（14px中等标签+12px次色值+行分隔线）；10概览+6关联回归 | `597e4e437`、`b93ec2f80`；[补齐](cluster-overview-completion-20261115.md)、[布局](cluster-overview-layout-review-20261115.md)、[密度](cluster-overview-density-20261117.md) | **主题 × 语言已走查**（2026-11-18：zh/en × 4 主题色调组合，6 组全 ready、0 溢出、0 裸标识符，[记录](cluster-overview-theme-language-20261118.md)）；新版生产、真实 member、全站回归未验收 |
| 节点列表/详情 | 统计/筛选/GPU/Pod/NTP/模式入口；详情负载/趋势/健康/Requests/Limits、硬件与拓扑；真实节点终端 | `67be3c456`、`38d5eb47d`；[节点记录](node-detail-overview-execution-20261115.md) | 生产GPU模式切换未执行；member硬件路由/拓扑契约边界保留 |
| GPU列表/单卡详情 | 全局统计、筛选/分页、NUMA/模式、五指标监控、关联Pods及节点事件 | `c37467da7`；[GPU记录](gpu-parity-execution-20261114.md) | 单卡拓扑/高级图表及member支持须独立核实 |
| 用户列表 + 用户详情 | 四列与 `status.lastLoginTime`、默认 createTime 降序、创建 uninitialized/描述、行与批量启停、预置/自己保护（省略 checkbox）、登录历史服务端分页四列、管理员重置 `{ password }` | 未提交；[用户记录](users-user-detail-execution-20261115.md) | 企业空间/项目成员、配额、部门/用户组、跨作用域授权；生产前端与 member；英文分页句柄残留 |
| 访问控制根路径 | `/kube-frontend/access` 与侧栏「访问控制」落到用户表，三页签可见 | `aafd0484f`；[入口记录](access-landing-20261115.md) | 生产前端未部署（`/settings` 根路径已改为重定向到 `/settings/info`） | 生产前端未部署 |
| 租户(企业空间)成员 列表+详情 | 搜索/邮箱/活跃态/尚未登录/自我保护/批量移除；详情属性与项目/DevOps 页签（404 空态）；中文产品名「租户(企业空间)」 | `23e566649`；[成员记录](workspace-members-20261115.md) | 跨作用域授权；生产前端与 member；**英文页已用 `--locale-scan` 走查（无裸标识符）** | 跨作用域授权；生产前端与 member；**「项目角色」列已补**（2026-11-18：按命名空间查 rolebindings 并用 `rolesForUser` 过滤，无绑定显示 `-`；**项目角色列是超出对等的增强**（旧版该项目页签只有 NAME/CREATION_TIME 两列，已核对源码）；正例与多角色都已验（临时绑定 viewer/editor → `default` 行显示 `editor, viewer`，已清理；聚合网关对 RoleBinding 只读，写走原生 RBAC）；角色编辑不做（属「项目 → 成员」页职责）） |
| 项目成员 列表+写入 | 搜索/邮箱/活跃态/尚未登录/自我保护/批量移除；邀请/改角色/单人与批量解绑；无详情页（旧 `noLink`） | 未提交；[项目成员记录](project-members-20261115.md) | 跨作用域授权；生产前端与 member；**英文页已用 `--locale-scan` 走查（无裸标识符）** |
| 租户(企业空间)配额 | 项目 × 资源只读表；空态「这些项目还没有设置资源配额」；空间级 CR 编辑批准不做 | 未提交；[配额记录](workspace-quota-20261115.md) | 跨作用域授权；**空态已验证**（2026-11-18：`system-workspace` 下无项目 → 显示「暂无数据 / 这些项目还没有设置资源配额。」，不是 0）；四列表仍需一个有配额的项目才能截到 |
| 租户(企业空间)用户组 树+写入 | 部门树（parent 标签）、创建/编辑/删除（空间角色数组 POST）、成员按用户名增删；无成员时隐藏搜索；有下级拒绝删除 | 未提交；[用户组记录](workspace-user-groups-20261115.md) | 项目/DevOps 角色数组、未分配双栏、watch 批准不做；跨作用域授权与专用角色能力仍缺；生产前端未部署 |
| 项目存储卷（PVC）页面族 | 列表五列+持久卷列、创建（新建/从快照）、详情四页签（属性/元数据/事件/快照）、克隆、创建快照、扩容/编辑/删除；写用例均回读并清理 | 未提交；[存储记录](storage-pvc-completion-20261115.md) | 全站串行 E2E、部署环境与 member 写入未执行；快照创建流程已端到端验证；就绪态受集群限制（手工建 VolumeSnapshotClass 后 content 绑定但 `readyToUse` 恒 false，无 snapshotter） |
| 工作负载「编辑设置」 | 资源限额、更新策略、选择节点、容器组标签与注解、健康检查与优雅终止、存储挂载、容器组安全上下文与 IP 池已补齐（容器组标签保留选择器依赖项）；写用例回读并清理 | 未提交；[编辑设置记录](workload-edit-settings-20261115.md) | **亲和性已补**（2026-11-18：整个 `spec.template.spec.affinity` 做成一段 YAML 文本域，预填/校验/阻断保存/留空删除/差异预览，[记录](workload-affinity-field-20261118.md)）；**保存回读已验**（临时 Deployment 写入 nodeAffinity → 回读一致 → 删除复核 404）；**清空即删除也已验**（预填 213 字符 → 清空保存 → 回读 `affinity` 为 ABSENT → 删除复核 404）；仍未覆盖容器模板与高级设置两个页签、全站 E2E 与部署环境 |
| 应用商店页族（应用仓库/应用模板/已安装应用/项目内应用） | 仓库列表（创建者/搜索/刷新/空态出口）+ 新增/编辑/删除/同步索引 + 仓库详情（基本信息/事件）；应用模板列表 + 上传（validate→create）+ 版本审核流转 + 应用实例页签；已安装应用列表（跨项目汇总，如实标注无服务端分页）+ 详情五页签 + 卸载（用 rls id）；商店详情安装弹窗 values（conf 为 YAML 字符串）；**项目作用域「应用」页**（项目集合、安装选择器+目标锁定、隐藏项目列、详情+卸载，E2E 3 passed）；写用例均回读并清理 | 未提交；[应用商店记录](appstore-workspace-20261115.md) | 商店管理写操作、模板图标/截图/分类编辑、版本 YAML 编辑、升级/回滚（无接口）、CRD 组装应用（另立单元）；浅色主题与第二色调未逐页截图；全站 E2E、部署环境与 member 未验收 |
| DevOps 工程详情页族（流水线/凭证/成员角色/CD） | 工程创建/编辑信息/删除；详情七页签；流水线列表（服务端分页/搜索/类型筛选/健康）；流水线创建（Jenkinsfile 与多分支 SCM）/编辑/复制/删除；流水线详情 + Jenkinsfile 保存（专用路由 mode=raw）；触发运行链路（pipelinerun 创建与状态如实展示、日志错误如实呈现）；凭证四类型 CRUD；成员邀请/改角色/移除；角色查看；代码仓库导入；CD 白名单；12 条用例串行通过 | 未提交；[DevOps 记录](devops-pipelines-20261115.md) | BLOCK-1：devops-controller CrashLoopBackOff（Jenkins 令牌不匹配）→ 运行成功状态/耗时正分支/日志正文不可验收；BLOCK-2 新工程无 adminNamespace 时集合回退；视觉三档/主题/英文、全站 E2E、部署与 member 未验收 |
| 镜像构建器（S2I/B2I）页族 | 列表（服务端分页/搜索/刷新/列显隐/批量删除/状态轮询）、两步创建（S2I 源码构建自动触发首个 S2iRun、B2I 二进制上传请求链路）、详情五页签（构建记录/资源状态/镜像制品/环境变量/事件）、编辑信息与编辑 YAML、运行/重新构建（含 donotautoscale 两分支）、删除；写用例回读并清理（12 passed） | 未提交；[镜像构建器记录](image-builder-20261115.md) | 阻塞：s2ioperator 运行账号无 cluster-scope list/watch → 无 Job/status/logURL，构建成功状态、日志正文、Job 依赖页签真实数据不可验收；minio 缺失 → B2I 上传成功与制品下载正文不可验收；git/verify 恒 500；真实非 admin 身份、member、浅色主题、生产前端未验收 |
| 灰度发布页族（列表+详情+流量+删除） | 列表六列（名称/类型/目标服务/版本权重/状态/创建时间）与下钻、详情（基本信息/版本与流量/匹配规则/状态条件）、调整流量弹窗（权重/内容分流/蓝绿/镜像只读）、暂停（参考版本接管）与恢复、删除、创建含初始流量与三类 manifest、SSAR 创建门控；8 条用例串行通过 | 未提交；[灰度发布记录](gray-release-20261115.md) | 阻塞：本集群无 servicemesh 策略控制器 → 真实 status.conditions 恒空（正分支用 PUT 注入条件验收）；kapis 工作负载 metrics/health 404 → 监控曲线待补；受限账号 403、member、浅色主题、生产前端未验收 |
| 联邦项目页族（写能力 + 详情深化） | 列表五列（名称+别名/命名空间/部署集群/传播状态/创建时间）+ 搜索/排序/分页/刷新；创建联邦项目（两步写入+失败回滚，宿主命名空间 `kubefed.io/managed=true`）、编辑信息（对象注解 + 每集群 override）、调整部署集群、单条与批量删除；详情六页签（概览/传播条件/三类资源/元数据/事件）、资源详情（模板 YAML/完整对象 YAML/分发条件/事件）；SSAR 门控；8 条用例串行通过 | 未提交；[联邦项目记录](federated-projects-20261115.md) | 单集群无法验证增删集群与 member 副本；受限账号 403/SSAR 拒绝分支、第二色调、新版部署与全站串行 E2E 未验收；22 条老详情中的网关/日志/配额/成员页签与逐集群 overrides 编辑器批准不做 |
| 集群列表「添加集群」对话框 | 导入路径完整：两段式表单（基本信息/连接设置）、名称失焦查重（`x-check-exist`）、别名/标签（四项含 demo）/供应商（七项，Azure 拼写已修正）/描述、直接连接的 kubeconfig 懒加载编辑器与文档链接、代理连接无 kubeconfig 键、先校验后创建、失败在对话框内映射 JSON/纯文本两种 400、成功通知、主操作 SSAR 门控；20 项旧能力 17 通过 3 批准不做 | 未提交；[记录](cluster-add-dialog-20261117.md) | 部署环境、member 集群、全站串行 E2E 未验收；真实非 admin 403 分支用 SSAR 拦截模拟；kubeconfig 文件上传/下载批准不做 |
| 集群成员页族（列表 + 邀请/改角色/移除/批量移除） | 列表四列保留；补齐写入：邀请（POST clustermembers 数组 body，角色候选只列 `cluster-*` 与含 aggregation-roles 注解的集群角色）、行内改角色（PUT）、单条移除（输入用户名确认）与批量移除（不可写/自己的行不可勾选）、自我保护（当前账号无复选框与行操作）、SSAR 写门控（失败 fail-open）；修掉「角色列表到达时清空已输入用户名」的表单重置缺陷；6 条用例串行通过 | 未提交；[成员写能力记录](cluster-members-write-20261116.md) | 真实非 admin 身份的 403 分支、浅色/第二色调、新版部署与 member 集群、全站串行 E2E 未验收 |
| 列表每页条数选择器（分页档位） | **33 个列表**接入 10/20/50/100 档位（项目侧 4、集群侧 8、监控/平台/设置/联邦/商店/构建器 8、告警消息与快照类/资源监控/工作空间配额与角色 6）；服务端分页切换后 `page=1&limit=<size>`，客户端分页只渲染当前页；不足一页时不渲染分页器（与旧 console 一致）；修掉「页大小没进 queryKey」「切片用常量」「请求参数仍是常量」「缺 sortAiPrefix 无句柄」四类缺陷，并加 `config/page-size-contract.test.ts` 三条机械守卫；**2026-11-19 收口**：灰度发布/集群成员/系统组件/自定义资源及实例/多集群/持久卷 7 个「一次读全」的列表改为客户端切片（`total` 仍取全部行、页码按 `min(page, ceil(total/size))` 夹住、切档回第 1 页），并加第 4 条守卫「有 `pagination` 必须有 `pageSizeOptions`」、`config/column-visibility-contract.test.ts` 四条机械守卫（声明选择器必须接处理器、请求不得用常量、查询键必须含页大小）——守卫当场抓到商店评论表同款缺陷并修掉 | 未提交；[档位收口](page-list-page-size-20261119.md)；[一](list-page-size-20261116.md)、[二](list-page-size-cluster-20261116.md)、[三](list-page-size-apps-20261116.md)、[四](list-page-size-tail-20261116.md) | 明确不适用：商店浏览（load more）、日志/事件/审计（无分页器）、登录历史（数据不足一页）；浅色主题、部署环境与全站串行 E2E 未验收 |
| 网络策略详情 · 规则视图（2026-11-19） | 详情页新增「规则视图」区块：按入站/出站分块，逐行显示允许来源/去向（namespaceSelector + podSelector、ipBlock 含 except）与端口（`TCP/80`、`TCP/5432-5433`、无端口显示协议名），并显示作用对象；某方向无规则显示说明而不是空表，`{}`/空数组表示「允许全部」打印 `*`；规则投影抽到 `networkPolicyRules.ts`，与项目规则视图共用一份（无第二份格式化） | 未提交；[交付记录](page-network-policy-rules-20261119.md) | 非 admin、member、生产部署与全站串行 E2E 未验收；1024/1600 与浅色/英文未单独截图 |
| 存储快照详情页签（2026-11-19） | 快照详情由单列改为旧 console 的**两个页签**：数据来源（属性）/ 事件；事件读按 `VolumeSnapshot` kind（数据本来就在取，补页签不增加请求），无事件显示空态；改正 PRD 里「快照详情不增加事件页签」的旧结论 | 未提交；[交付记录](page-snapshot-detail-tabs-20261119.md) | 非 admin、member、生产部署与全站串行 E2E 未验收；1024/1600 与浅色/英文未单独截图 |
| 项目网关页 · 集群网关卡片（2026-11-19） | 项目设置 › 网关页顶部补回旧 console 的集群网关卡片：名称/访问方式/访问地址 + 「查看详情」链到集群网关详情页（四视图）；只读（安装器职责）；集群没有该对象时不渲染卡片；选行只认安装器固定名 `kubesphere-router-kubesphere-system`，不会把老式安装里同命名空间的项目路由当成集群网关 | 未提交；[交付记录](page-project-gateway-cluster-card-20261119.md) | 非 admin、member、生产部署与全站串行 E2E 未验收；1024/1600 与浅色/英文未单独截图 |
| 集群级配置字典写能力（2026-11-19） | 集群作用域「配置字典」页补回旧 console 的四个行操作：编辑信息（merge-patch 注解）/ 编辑 YAML / 编辑设置 / 删除（输入名称确认），复用项目页四个对话框；**写按行所属项目寻址**（用页面的空命名空间会拼出没有 `namespaces/<ns>` 段的 404 路径）；`kubefed.io/managed=true` 的联邦对象不渲染操作；失败由 MutationAlert 显示服务端原因；不逐行 SSAR、不做跨项目批量删除（DEC 记录） | 未提交；[交付记录](page-cluster-configmaps-writes-20261119.md) | 真实非 admin 403 分支、member、生产部署与全站串行 E2E 未验收；1024/1600 与浅色/英文未单独截图 |
| 保密字典写能力（项目列表 + 集群作用域，2026-11-19） | 项目列表行补「设为默认镜像仓库」（旧 console 只在详情页有）：确认框写明会取消哪个旧默认、旧默认查明前禁用确认，写入后只有一个默认标记；集群级保密字典补四个行操作（设为默认 / 编辑信息 / 编辑 YAML / 删除），按行命名空间寻址、联邦托管行无操作；复用详情页既有 hooks 与项目页对话框 | 未提交；[交付记录](page-secrets-writes-20261119.md) | 真实非 admin 403 分支、member、生产部署与全站串行 E2E 未验收；1024/1600 与浅色/英文未单独截图 |
| 集群级服务账号写能力（2026-11-19） | 集群作用域「服务账号」页补回旧 console 的四个行操作（编辑 / 编辑 YAML / 修改角色 / 删除），复用项目页对话框；写按行所属项目寻址，角色列表来自该行所属项目；联邦托管行无操作。至此三张跨项目配置页（配置字典 / 保密字典 / 服务账号）写入口径一致 | 未提交；[交付记录](page-cluster-serviceaccounts-writes-20261119.md) | 真实非 admin 403 分支、member、生产部署与全站串行 E2E 未验收；1024/1600 与浅色/英文未单独截图 |
| 集群级工作负载筛选与写能力（2026-11-19） | 集群级七类负载列表补「按项目筛选」（服务端 namespace，空值=全部项目，切项目回第 1 页）与三类通用行操作（编辑信息 / 编辑 YAML / 删除）+ 批量删除（按行所属项目分组发出，部分失败可见）；联邦托管行无操作；重新部署/停止启动/扩缩容明确留给项目页（DEC 记录） | 未提交；[交付记录](page-cluster-workloads-writes-20261119.md) | 真实非 admin 403 分支、member、生产部署与全站串行 E2E 未验收；1024/1600 与浅色/英文未单独截图 |
| 非 admin 验收（V-3） | **环境阻塞**：mlu370 有账号体系（IAM v1alpha2，10 个用户，可建号可登录），但**没有可达的「授予项目只读权限」路径**——KubeSphere Role/RoleBinding 资源未提供（404）、原生 RBAC 绑定不参与 kapis 授权（建了 201 但读取仍 403）、SA token 被 ks-apiserver 拒绝（401）。因此无法构造「能读不能写」的账号来验收权限门控 | 未提交；[验收记录](verification-20261119.md) | 解除条件：提供 IAM Role/RoleBinding、或给出已知密码的项目成员账号、或 ks-apiserver 接受 SA token |
| 串行回归（V-4，已迁移模块） | 首轮 `project-settings + secrets` 串行 **3 failed / 43 passed / 1 skipped**，逐条定位：1 条**真实缺陷**（企业空间用户组页两个按钮共用同一 `data-ai-id`，已修复为 `:refresh-tree`）、2 条**用例对环境数据的过度假设**（配额空态、依赖不存在的账号）已改为自带前置数据；复跑全部通过 | 未提交；[验收记录](verification-20261119.md) | 全站串行 E2E 仍未做（本轮覆盖 project-settings + secrets，其余模块待下一批） |
| 服务拓扑图（条件入口 `network.topology`） | **环境阻塞，未实现**：旧页数据来自 `GET /kapis/network.kubesphere.io/v1alpha2/namespaces/<ns>/topology`；2026-11-19 在 mlu370（admin）实测 **500**，正文 `Get "http:///api/topology/services?namespace=<ns>": http: no Host in request URL` —— 接口在、依赖的网络组件地址为空。旧页在同一部署同样拿不到数据 | 未提交；[记录 §8](page-project-gateway-cluster-card-20261119.md) | 复查条件：集群装好拓扑后端、该路径返回 200 且 nodes/edges 非空后再按单元迁移（节点/边渲染、平移缩放、节点详情、自动刷新） |
| 列表「显示列」（列显隐） | 配置字典/保密字典/服务账号/项目存储/告警策略/联邦项目/集群告警消息**42 个多列列表全部接入**（含面板子表与详情内表）；唯一未接入的是企业空间用户组的**单列**成员表（按设计不接入，树上半部非 ListSchema）（含集群网关双页签、集群配置/存储六页、集群存储与扩展资源六页、企业空间家族四页与项目网络隔离）：只列可隐藏列（名称不可隐藏）、取消勾选即时隐藏并持久化（`kube-frontend.columns.<页面键>`）、刷新保持、重置恢复；接入需两步（schema 声明 + 列上 `hideable: true`），只做第一步时菜单只剩「重置」 | 未提交；[列显隐记录](list-column-visibility-20261116.md)；[41 页 E2E 结果](column-visibility-e2e-41pages-20261116.md)（**41 passed/132.39s**，含面板型 `node-usage` 与 4 个页签内表格） | 仅剩 `installed-app-resources`：需要已安装实例，而本部署**删不掉实例**（DELETE 返回 200 但对象不消失），故不上线该用例；定位该键时**修掉两处真实缺陷**（资源页签与「集群」显示行都把 OpenPitrix runtime id 当集群名；前者 404、后者显示 `default`），已改为使用路由的控制台集群）；浅色主题、部署环境、member 与全站串行 E2E 未验收 |
| 长跑判据（链路健康探测） | 新增 `tests/ui/tools/link_health.py`：探测 静态站/BFF/隧道/kube 上游四跳，给出 ok / degraded / down 三档判决并支持持续采样成 JSONL 时间线，把「全站失败」区分为基础设施故障与产品缺陷 | 未提交；[协议文档](link-health-protocol-20261116.md) | 全站串行 E2E 判决仍待链路稳定期跑出 |
| 多集群（成员集群） | 在 A100（`host` + `xc`）实测并修复：成员集群的 `clusters/<id>` 段必须紧跟 `/kapis`、`/apis`（拼在 group 之后会让集群级与项目级读取全部 404）；新增 `clusterScoped`/`corePath` 收敛全部路径。工具 `tools/multicluster_sweep.py` 提供八段式基线（集群读/项目读/企业空间读/身份/详情/**Tab**/交互/写入）。**取证方式：路径与写落点结论来自 curl 实测；页面状态来自浏览器读数（工具修好登录态之后）**。可信基线：**A100 八段式 789 秒全绿**（72+34+16 次访问、12 详情、24 个 Tab、6 张列表交互、2 次写入，0 失败请求；`xc` 无告警组件的两个页面已白名单）；**B200 单集群八段式 384 秒同样全绿**（36+17+8 次访问、6 详情、12 个 Tab、3 张列表交互、1 次写入）。集群切换器实测全站生效 | [巡检工具](multicluster-sweep-tool-20261117.md)、[路径修复](multicluster-path-fix-20261117.md)、[结论有效性](multicluster-conclusions-validity-20261117.md) | 成员集群的写：**core 资源只能读**（ks-apiserver 无成员形态，控制台已改为明确拒绝而不是写到主集群）；**分组资源可写可删**（curl 实测 Ingress 创建→落在 xc→删除，未污染 host）。监控/告警深度页的图表未逐一验证 | 生产前端与全站回归未在该批验收；**A100 的 `xc` 已于 2026-11-18 移除，多集群结论暂不可复验**（[记录](a100-member-cluster-removed-20261118.md)） |
| 浅色/深色主题（颜色令牌） | 新增机械守卫 `config/colour-token-contract.test.ts`（5 条）：应用代码零字面颜色、`rgb()` 必须来自 `var(--ai-*)`、原始色阶只允许在登记例外中用（含理由与反向守卫）；现状 0 违规、1 处有理由例外 | 未提交；[契约记录](colour-token-contract-20261116.md) | 令牌取值在浅色下是否合理仍需目视截图（链路阻塞） |
| 空态/错误态区分（空态契约） | 新增机械守卫 `config/empty-state-contract.test.ts`（3 条）：每个 `ResourceList` 必须声明 `schema.empty` 说明「为什么空」；自行渲染空态块的唯一例外须保持状态机与句柄。现状 58 个列表全合规、例外 1 处 | 未提交；[契约记录](empty-state-contract-20261116.md) | 空态文案的措辞质量仍需目视/用例抽查 | 空态文案的措辞质量仍需抽查；「无匹配」已由共享层统一处理（页面可覆盖） |
| 键盘可达与弹层归属 | 新增机械守卫 `config/keyboard-contract.test.ts`（3 条）：非交互元素不得挂 onClick、弹层必须交给 ai-kit（禁止自绘 role=dialog 与手工 Escape）、按钮必须有可访问名称。现状三类均为 0；**浏览器走查已做**（`--keyboard` 可重跑：两集群 × 3 页 × 10 个 Tab，0 缺焦点环、首个停靠点为跳过导航；弹层焦点陷阱与 Esc 已验，关闭后焦点归还触发按钮为修复项） | 未提交；[契约记录](keyboard-contract-20261116.md) | 静态检查，tab 顺序/焦点环/朗读顺序仍需浏览器走查 | 朗读顺序（屏幕阅读器）与浅色主题下的焦点环对比度未走查 |
| 读取失败 vs 不存在（测试侧） | 新增 `helpers/reads.py`：只有 200 且 `items` 是数组才返回（空列表=真的没有），其余抛 `ReadError`（AssertionError，报 failed 而非 skip）；改造 11 个用例，接口挂掉不再伪装成「集群没数据」；已双向实测（健康窗口里 PV 用例 passed 60.8s；接口 502 时 CRD 与集群配置用例 failed 并带出 `ECONNREFUSED 127.0.0.1:18088`）。实证：BFF 502 时原用例报「集群没有 CRD」 | 未提交；[记录](read-vs-absent-20261116.md) | 7 个用例的行为变化需链路恢复后 E2E 复核 |
| 大响应体对验证的限制 | 实测确认本环境（含集群侧）无法稳定承载 MB 级响应：同一端点 `customresourcedefinitions?limit=1` 半小时内测到 200/1.2s、502/93.8s、200/1.5s；`secrets?limit=20` 1.34MB/120s：CRD 用例在 454KB / 768KB / 8.4MB 三处被截断（`IncompleteRead`）。已把该用例的**自身读取**从整份列表降到 `?limit=1` + `remainingItemCount`（>380s → 67.93s），剩余失败来自页面自身的数 MB 数据 | 未提交；[记录](crd-read-cost-20261116.md) | 需链路能承载大响应，或集群 CRD 数下降，才能给该用例定论 |
| 链路抖动隔离（隧道代理） | 新增 `tests/ui/tools/tunnel-proxy.mjs`：监听 18088 永不关闭、转发到 18089 的 ssh，上游不可达时内部重试（250ms/20s 预算）。实测 kill -9 掉 ssh 后立即请求仍 `200`（21s）而非 `502 ECONNREFUSED`；自检 4 条（含 4MB 不截断）全过 | 未提交；[记录](tunnel-proxy-20261116.md) | MB 级响应体截断仍存在，无法归因于代理 |
| 隧道挂死检测（看门狗） | 新增 `tests/ui/tools/tunnel-watchdog.mjs`：带超时的 HTTP 探测（TCP 层会误判健康），连续 2 次失败执行重启命令。实测挂死后杀掉进程 4 秒恢复；自检 3 条全过，且**先证明篡改生效**后确认自检确实会失败 | 未提交；[记录](tunnel-watchdog-20261116.md) | 只是运维兜底，不改变「大响应体截断」这一环境限制 |
| 挂起用例的结论（第 50 轮） | `NODE_USAGE_01` 与 `CUSTOM_MONITORING_01` 在代理+看门狗链路下**首次通过**；`CLUSTER_CONFIG_01` 的用例侧读取已从 1.34MB 降到 190KB，剩余失败前移到「页面进入 error 状态」（页面自身的集群级 secrets 读取），`CUSTOM_RESOURCES_01` 同类 | 未提交；[记录](pending-e2e-outcome-20261116.md) | 这两条需集群侧恢复后单条复跑才能定论 |
| 写请求失败必须可见 | 新增 `config/mutation-failure-contract.test.ts`（3 条）：49 个含 `useMutation(` 的文件都必须把 rejection 送到可见处（含「把 error 传给弹窗」这一最常见形态），且提交路径不得乐观关闭弹窗。反向验证过 | 未提交；[契约记录](mutation-failure-contract-20261116.md) | 静态检查只证明「有地方显示」；真实渲染与文案需端到端验证 |
| 主题可读性（对比度） | `config/theme-contrast-contract.test.ts`（**3 条**）：解析 `tokens.css` 按级联链计算 6 种主题 × 4 背景 × 4 文本令牌共 96 组 WCAG 对比度（AA 正文 4.5:1），另有**焦点环契约**（SC 1.4.11 非文本 3:1，查 `--ai-ring` 对 `--ai-bg`），并含解析器自检。**2026-11-17 修复契约自身的假绿**：`resolve()` 的级联查找方向反了，六个主题组合其实都在测深色调色板；修正后暴露四处差距并全部修掉（深色/浅色/green-light 焦点环、violet-light 悬停面文字），`KNOWN_TOKEN_GAPS` 与 `KNOWN_RING_GAPS` **均为空** | [级联修复记录](theme-contrast-cascade-fix-20261117.md)、[契约记录](theme-contrast-contract-20261116.md) | 渲染层：`theme/…THEME_CONTRAST_01`（5 页 × 2 主题 = 10 用例）走的是**文字节点**，**不检查焦点环**；焦点环目前只有令牌层判据 + `--keyboard` 的「可见」断言 |
| 导航与路由一致性 | 新增 `config/navigation-route-contract.test.ts`（4 条）：直接 import `areas/registry.ts`，验证 93 个 `status: ready` 的侧栏页都有真实路由目录（按 scope 映射，允许嵌套）、平台页在四个路由组可达、planned 不越界。反向验证过（改一个 path 即失败） | 未提交；[契约记录](navigation-route-contract-20261116.md) | 只查存在性；不查渲染顺序，也不反查「有路由未声明」 |
| 安装弹窗 · 企业空间与项目的有效组合 | 修复真实缺陷：切换企业空间时项目立即清空并按新空间列表回落到首项（此前会保留上一个空间的项目，可能装错空间或被服务端拒绝）；无项目的企业空间保持为空并由本地校验提示「请选择项目。」且不发请求；新增用例 INSTALL-03，INSTALL-01 恢复通过 | 未提交；[安装组合记录](app-install-workspace-project-20261116.md) | 部署环境、member 集群、全站串行 E2E 未验收 |
| 主题（浅色 / 第二色调）与禁用态可读性 | 浅色 + violet 与浅色 + green 两种组合在集群概览/节点/监控/成员/项目配置字典四页三档走查，无横向溢出，`data-accent` 生效；修复禁用态实心按钮「白字 + 半透明实心色」对比度约 2:1 的缺陷（改中性表面 + 弱化文字 + opacity 1），并加架构契约测试禁止回归；theme 用例 3 passed | 未提交；[主题记录](theme-light-20261116.md) | 深色 + green 已补走查（项目概览页 1280 无溢出）；部署环境、member 集群与全站串行 E2E 未验收 |
| 项目概览 · 资源使用排行（Top 5） | 新增排行区块：CPU / 内存两页签，各列 5 个工作负载（序号/名称/类型/数值），数据取自监控 `namespaces/<ns>/workloads` 排序聚合，`metric.workload` 解析 Kind 与名称；Deployment/StatefulSet/DaemonSet 可下钻；空态/失败可重试、不显示假 0；修掉 `TabsContent` 写成兄弟节点导致整页进错误边界的缺陷 | 未提交；[排行记录](project-overview-ranking-20261116.md) | 网络收发排行与旧「应用模板」区块不做（后者属别处承接）；部署环境、member 与全站串行 E2E 未验收 |
| 项目概览 · 资源用量趋势（1h/6h/24h） | 新增趋势区块：CPU 与内存两条独立曲线（核与字节不共用纵轴），时间窗 1h（60s 步长）/6h、24h（300s 步长）切换后重新取数；无采样显示空态、失败可重试，NaN 采样表现为断点而非 0 | 未提交；[趋势记录](project-overview-trend-20261116.md) | 旧「物理资源/应用资源」分组不迁移（本部署无该粒度数据源）；部署环境、member 与全站串行 E2E 未验收 |
| 自制 CRD 应用（N-01 部分） | 新增树节点 crd-apps；项目 /applications/composing 只读列表 + /composing/<name> 详情：Application（app.k8s.io）按 selector 聚合 Deployment/StatefulSet/Service/Ingress，健康用 readyReplicas/replicas 三态（健康/更新中/异常，无工作负载或 desired=0 为未知），显示组件数/版本/创建时间；详情含 selector、工作负载就绪、Service 类型/ClusterIP、Ingress hosts；应用列表页入口；多组件创建（dry-run+回滚）+ 删除 + 编辑信息 + 详情四视图（组件/事件、流量、链路、灰度）+ 添加 Ingress 路由；API 单测 20 条 + B200 十条 E2E（7.21/7.62/6.86/6.83/12.07/5.65/7.34/6.64/6.16/5.38s），清理已复核；灰度写走项目级向导、tracing 检索登记后续 | 未提交；[CRD 应用记录](crd-apps-20261117.md) | 空态/错误态、深色/1280/1024/旧站对照、非 admin、部署/全站未验收 |
| ks-apiserver 部署（N-10/权限） | B200 部署 `ks-apiserver:node-join-20261118c`（85db2a5 + 本次两提交，避免 develop 未验证提交）；admin/viewer 权限、节点 join、viewer UI、节点 E2E 5.75s、权限 E2E 5/73.36s 通过；首次从 develop 构建登录故障已回滚 | 已提交 console f499ca0b5 / kube-server d472dec55 + f0643379e；[部署记录](kube-server-deploy-20261118.md) | 部署分支合回 develop、mlu370 升级、console 镜像未部署 |
| 权限检查（非 admin 正确性） | ks-apiserver 新增 IAM `POST /selfsubjectaccessreviews`，以请求用户调用 Authorizer；控制台 `accessReviewApi` 改用该路由，旧后端 404 回退；`useCreatePermission` 覆盖 deployments/statefulsets/daemonsets/jobs/cronjobs；Go 单测 2 + api-client 5 通过；旧后端 500 "no matches" 回退，权限 E2E 5 条回归通过（60.01s） | 未提交；[权限检查后端记录](permission-review-backend-20261117.md) | 部署新后端后以 viewer 复测创建入口；写身份已审计为正确（403） |
| 全站串行 smoke（B200） | 18 条 TC-FULL 用例一次 pytest 进程：**18 passed / 64.08s**，覆盖集群管理、工作负载、配置字典、保密字典、项目设置、应用商店、监控、访问控制、平台设置、工作台、存储、服务账号、用户设置、集成等页面 | 未提交；[迁移路线](migration-execution-roadmap.md) | 旧站对照、非 admin、部署镜像仍待验收 |
| 成员集群读/写（mlu370） | 节点列表 + 详情（NODES-01/03/06）通过（13.49s / 32.29s）；配置字典创建+删除通过（4.08s，写后清理），证明成员集群路径与写链路可用 | 未提交；[多集群手册](multicluster-playbook-20261117.md) | 其他成员写能力、生产、全站未验收 |
| 节点加入（N-10） | kube-server 新增 `POST /kapis/resources.kubesphere.io/v1alpha3/nodes/join-command`（cluster-info → 24h bootstrap token → kubeadm join + CA hash，ttlHours 1-168，按 create nodes 授权）；控制台节点列表「添加节点」弹窗展示/复制命令与到期时间，404/405 显示升级后端、403 显示无权限；Go 单测 3 条 + 真实集群集成 1 条（B200 cluster-info，发/删 token）+ B200 E2E 旧后端分支通过 | 未提交（kube-server + console）；[节点加入记录](node-add-backend-20261117.md) | 真实后端部署后的正向 E2E（弹窗正向已用契约 mock 验证）；非 kubeadm 集群说明 |
| 集群网关编辑 + 详情四视图（N-29） |
| 集群网关编辑 + 详情四视图（N-29） | 集群网关页签「编辑」（复用项目网关 GatewayEditDialog）；详情元数据/资源状态/日志/监控（CPU/内存；ingress 指标有则追加、缺失明确说明）；创建/删除按职责边界不提供（安装器/入口控制器）；B200 五条 E2E 通过 | 未提交；[集群网关编辑/四视图记录](cluster-gateway-edit-20261117.md) | 非 admin、旧站对照、部署/全站未验收 |
| 第三方登录状态（N-02） | 平台设置 › 第三方登录只读状态页：identityproviders（/kapis 与 /apis 两种拼写回退）可用时显示身份源卡片（显示名/对象名/类型/已配置）或「尚未配置」；404/400/501/5xx 显示「本部署未提供身份源读取接口」+ 原因 + 重试；403 仍错误面板；老页面 Configure 弹窗 onOk 只关闭，无写能力可迁（明确不做凭据编辑）；B200 E2E 通过 | 未提交；[第三方登录记录](third-login-20261117.md) | 接口可用分支未在真实部署观察；深色/1280/1024/旧站、非 admin、部署/全站未验收 |
| 集群作用域角色（N-06） | /clusters/<c>/roles 列表（名称/系统徽标/规则数/创建时间）+ 详情两页签（权限规则按 API 组/资源/动作；已授权用户来自 IAM users?clusterrole=，空集合显示空态）；host 与成员集群按集群前缀读取；平台 /access/clusterroles 加集群选择器（host 可写、成员只读，单集群隐藏）；B200 E2E + mlu370 多集群切换 E2E 通过 | 未提交；[集群角色记录](cluster-roles-20261117.md) | 有 IAM 绑定的用户行、非 admin、深色/旧站对照、部署/全站未验收 |
| 浮动工具箱与资源消费（N-03） | 全站右下角可拖拽悬浮球（位置 localStorage 持久、拖拽与点击互斥、Esc 关闭），展开 6 个集群工具入口（日志/事件/审计/资源消费/kubeconfig/kubectl）；资源消费页按项目展示 1h/6h/24h 窗口内 CPU/内存/存储/GPU，CPU 降序，未启用计量时独立说明（403 仍错误）；B200 计量实测 200（25 个项目），E2E 通过 | 未提交；[工具箱/消费记录](bill-toolbox-20261117.md) | 深色/1280/1024 与旧站对照未生成；未启用真实页面、成员集群计量、非 admin、部署/全站未验收 |
| 企业空间角色写能力（N-21） | 列表页创建（权限模板 19 选，服务端按 aggregation-roles 聚合规则）、行操作编辑信息（merge-patch，清空键 null）/编辑权限（替换模板集合）/删除（输入对象名）；平台预置（creator=system）与 role-template-* 角色不渲染写入口；写后回读集合；6 项原子能力（1 既有+5 写）实现完成，API 5 + 组件 4 单测 + B200 E2E 通过 | 未提交；[企业空间角色写记录](workspace-roles-write-20261117.md) | 1280/1024 与旧站对照未生成；非 admin、部署/全站未验收 |
| 存储类型写能力（N-12） | 创建（名称/供应者/回收策略/绑定模式/卷能力）、编辑信息（merge-patch，清空键 null）、编辑 YAML（整对象 PUT）、设为默认（先清旧默认三种拼写 + 替换提示）、卷功能（克隆/快照注解、扩容 spec，关闭移除而非写 false）、单条/批量删除；删除守卫用实时 PVC 集合（不信 pvc-count 注解），读取失败停用删除/隐藏批量；7 项原子能力（2 既有+5 新）实现完成，API 6 + 组件 6 单测 + B200 E2E 通过（三档深浅/创建/保护态截图） | 未提交；[存储类型写记录](storage-class-writes-20261117.md) | B200 读回丢弃 clone/snapshot 注解（环境差异，单测覆盖请求体）；成员集群写、非 admin、部署/全站未验收 |
| 帮助 / 文档入口（N-28） | 顶栏新增帮助菜单：用户指南 / API 文档两项，按当前语言取 URL；地址由 BFF `GET /api/config` 运行时下发（env `KS_DOCS_*` 覆盖），未配置用旧 console 的 `/kube-docs/...` 兜底，显式空隐藏、两项全空不渲染；新窗口 `noopener`；5 项原子能力实现完成，BFF 5 + api-client 2 + 组件 4 单测 + B200 E2E（新窗口 noopener）通过，菜单截图已生成 | 未提交；[帮助入口记录](help-entry-20261117.md) | 旧站对照未生成；部署 env 覆盖实测、跨域文档站未验收 |
| 企业空间用户组实时刷新（N-27） | 用户组页 watch 原生 `groups` 集合：另一处创建/删除部门后树自动增删（无需刷新）；页面头 live-state 三态可见，断开显示「可手动刷新」；groupbindings 无 watch 的本部署上成员数走手动刷新（登记限制，不轮询）；4 项原子能力实现 3 + 受限回退 1；B200 E2E 验证手动刷新回退后 skip，深浅截图已生成 | 未提交；[用户组 watch 记录](workspace-user-groups-watch-20261117.md) | WATCH 自动路径在 B200 与 mlu370 均不投递事件（环境不支持，已验证回退）；断开/重连模拟、非 admin、部署/全站未验收 |
| 集群持久卷写能力（N-11） | 详情/列表提供编辑信息（merge-patch，只发 metadata.annotations，清空键为 null）、编辑 YAML（整对象 PUT 带 resourceVersion）、单条删除（输入名称确认）与批量删除；Bound/Released 的删除入口置灰并说明原因，批量跳过并汇总成功/跳过/失败；列表多选/全选、策略提示条与结果行 | 未提交；[持久卷写记录](persistent-volumes-write-20261117.md) | host 写路径已验证（临时 Available 卷编辑/删除+Bound 跳过）；member/非 admin/生产/全站未验收；卷创建仍不做 |
| 企业空间 DevOps 工程入口 | 空间侧栏新增「DevOps 工程」页（workspace 作用域，URL 无集群段）：按各就绪且 `configz.devops` 的集群读 kapis workspace 聚合，合并为工程列表（名称/别名/描述、集群、同步状态、创建者、创建时间），行链接到集群作用域工程详情；搜索/排序/列显示/分页/刷新；无工程、未启用 DevOps、部分集群失败分别有说明；创建/编辑/删除按重纳决策 N-07 留在集群作用域 | 未提交；[DevOps 入口记录](workspace-devops-entry-20261117.md) | host 单集群行已验证（临时工程创建→列表/链接/搜索→删除→空态）；member 集群行合并、未启用/部分失败分支、非 admin/生产/全站未验收 |
| 企业空间概览 · 资源用量、项目排行与集群信息 | 资源页签保留「资源用量」（CPU/内存/容器组/网络收发，缺失指标显示 `-`）与「项目用量排行（Top 5）」（CPU/内存页签，名称链到项目概览）；新增「集群信息」页签：按 tenant 聚合为每个可见集群渲染卡片（别名/就绪/供应商/K8s 版本/节点数/可见性 + CPU/内存/容器组/磁盘使用率），就绪卡链接集群概览、未就绪卡说明，空态与读取失败分开；修复监控成员集群指标路径（`cluster=` 查询参数无效，会显示主集群数字）；11 项原子能力通过 10、未验收 1；空间控制台串行 E2E：dev 合并套件 8 passed，固定构建 TC-08 + WC-05 单条通过（WC-05 合并套件偶发刷新竞态，单条复跑通过） | 未提交；[空间概览记录](workspace-overview-usage-20261116.md)、[集群信息记录](workspace-overview-clusters-20261117.md) | 单集群「显示单卡」、非 admin/无空间权限、指标缺失/失败分支、浅+绿/浅+英组合未验收；部署环境、member 与全站串行 E2E 未验收；空间级存储用量仍不做（无空间级指标，DEC-15） |
| 集群可见性 · 企业空间授权 | 私有集群下列出所有企业空间与授权状态，勾选即对该空间 Workspace 发 json-patch（add/remove `spec/placement/clusters`）并回读；按标签选择集群的空间只读并说明；公开时整块只读。实测该聚合 API 要求每个 op 都带 `value`（`remove` 亦然），`replace`/merge patch 均被拒绝 | 未提交；[可见性授权记录](cluster-visibility-workspaces-20261116.md) | 部署环境、member 集群、全站串行 E2E 未验收 |
| 项目级告警策略页族（列表/详情/告警消息/批量/下钻） | 新增策略详情页（基本信息/规则逐条含完整 PromQL/告警消息时间线分页）；告警消息列表改读聚合 v2beta1（六列 + 服务端筛选 + 抽屉）；SSAR 写门控；集群两页签复用同一 body；**批量启用/停用**（多选 + 逐条 PATCH + 结果汇总，不可写行不可选）；**告警消息下钻**（策略链接按 rule_level 推断 scope，对象链接按 namespace+对象键，工作空间由命名空间标签解析）；15 条用例串行通过 | 未提交；[告警策略记录](alerting-policies-20261115.md) | 详情规则搜索/分页已补（客户端过滤 + 每页 10 条，见[规则搜索记录](rule-search-paging-20261116.md)）；未验收：浅色/第二色调、受限账号 403、member、生产前端、全站串行 E2E |
| 集群监控 · 物理资源面板（R-29 剩余） | GPU 显存/使用率/已分配卡数、磁盘读/写吞吐与 IOPS、RDMA 健康度/端口可用率/收发与链路速率/错误·重传·丢弃·链路中断；按 GPU→主机→磁盘 I/O→网络→RDMA 五组显示；比值×100、吞吐 B/s、链路速率 bit/s→Gb/s、无数据显示空态；29 张卡片，监控 E2E 5 passed | 未提交；[监控面板记录](cluster-monitor-panels-20261115.md) | etcd/apiserver/scheduler 组件面板未做（`/kapis/.../cluster` 对组件指标返回 0 序列，需另一路径）；浅色/第二色调、新版部署与全站串行 E2E 未验收 |
| 集群告警策略页族（列表状态 + 自定义策略写 + 详情） | 两个页签列表（名称/别名/描述、策略状态、规则状态四态计数、耗时、最近检查、规则数、创建时间）；搜索、策略状态/规则状态筛选、名称/创建时间排序、10/20/50/100 档位、列显隐、刷新；自定义策略创建/编辑（描述/别名/间隔/规则）/编辑 YAML/停用（确认）/启用/删除；批量启用/停用；独立详情页（属性、规则表含每条状态与最近检查、查看指标数据弹窗、告警消息时间线、返回链接）；SSAR 门控；13 条相关串行 E2E（含新增 1 条）通过，其中 5 条在固定构建上复跑 | 未提交；[记录](cluster-alerting-policies-write-20261117.md) | 真实非 admin 403、member 集群读写、浅+绿/浅+英截图、>50 策略规模、部署环境与全站串行 E2E 未验收；内置策略编辑/删除与模板规则构建器为 PRD 明确不做 |
| 集群监控 · 系统组件面板（apiserver/scheduler/etcd） | 页内「系统组件」三子组：APIServer 请求速率（总量 + 按 verb 多序列）、请求延迟（按 verb，秒→ms）；Scheduler 调度尝试按 result（scheduled/error/unschedulable）多序列 + 尝试速率 + 调度延迟；etcd 6 图（DB 大小/客户端流量/gRPC 速率/WAL fsync/backend commit）由 requireETCD 隐藏改为「本集群未上报该组件指标」说明；复用页面时间窗与自动刷新；TrendChart 支持多序列（向后兼容单序列）并补 Storybook 与单测 | 未提交；[组件监控记录](cluster-monitor-components-20261115.md) | etcd 6 图正分支未验收（本部署 components/etcd 200 但 13 指标全 0 序列）；旧 ETCDNodes 每节点服务状态待补（无序列可读）；浅色/第二色调、真实受限账号 403（用 mock 验）、新版部署与全站串行 E2E 未验收 |
| 集群监控 · 集群状态分区 + 未就绪接管（2026-11-18） | 趋势之前新增「集群状态」分区：节点在线（componenthealth `nodeStatus`，healthy/total + 在线比例，点击进节点页；totalNodes 缺失=未上报、0=空态）、厂商分布（nodes/stats，数量降序 + 比例条 + 百分比，healthy/total 不计入；CPU 行=无 XPU 的节点数，不是空态，仅合计为 0 时空态）、组件状态（服务组件 6 项按命名空间 ΣhealthyBackends/ΣtotalBackends，configz 未启用=未安装；核心组件 etcd=已接入监控/未接入、controller-manager/scheduler=正常/异常/未上报）；状态分支加载/空/未上报/无权限/失败互不顶替，componenthealth 与 nodes/stats 独立降级；未就绪由集群作用域路由层既有 `cluster:not-ready` 整页接管（页面不挂载、页面内不再实现等待视图）；修正旧页厂商占比未 ×100 与 Kube AI Hub 恒 0/0 的缺陷（2026-11-18 旧页 host/agent/test 实测） | 已提交 `43ef20757`（未推送）；[交付记录](cluster-monitor-status-20261118.md)、[迁移记录](page-cluster-monitor-status-20261118.md) | 成员集群真实就绪后的正向数据、真实受限账号 403（mock 验）、部署环境与全站串行 E2E 未验收；**部署构建可能尚未含 `cluster:not-ready` 路由层**（本地/新构建才有）；旧页服务组件点击入口本轮不做（登记待补，批准依据见 PRD 明确不做）；**页签 IA 与概览图表形态未承接（2026-11-18 用户反馈：5 页签被平铺、节点健康/厂商分布图表缺失）**；浅色/第二色调未验收 |
| 集群监控 · 页签 IA 与图表库（2026-11-18） | 恢复页内 5 页签（概览/物理资源监控/API Server 监控/调度器监控/资源用量排行），一个导航入口 + `?tab=` 深链（默认 overview、非法值忽略、切页签 replace 不进历史）；页头只有一套时间窗与自动刷新，页签懒挂载、各自主查询；恢复旧 console 的条件 etcd 页签（ServiceMonitor 200 显示，404/失败隐藏；`?tab=etcd` 隐藏时回退概览；本部署 404 → 隐藏）；概览恢复节点环图/厂商构成环图/组件 3×2 磁贴 + 7 指标「主图+明细」+ RDMA 摘要与跳转；物理资源页签 5 组 18 张多序列大图（负载/磁盘读写/网络收发/Pod 三态/RDMA 端口·吞吐·错误）；API Server 与调度器各自页签（按 verb/result/quantile 合并，秒→ms）；排行页签复用 NodeRankingPanel + `aiIdPrefix` + 导出 `node.usage.rank.json`（node-usage 页同步）；ai-kit（独立 pnpm 项目）引入 recharts `^3.11.0` 并新增 DonutChart（story/单测/构建/桶导出） | 未提交；[交付记录](cluster-monitor-tabs-20261118.md)、[迁移记录](page-cluster-monitor-status-20261118.md) | 浅色/第二色调、英文全页、部署环境与全站串行 E2E 未验收；每页签独立时间窗（本轮共用页头）、旧概览 RDMA 四子图（本轮摘要+跳转）、etcd 条件页签归宿（本部署未接入，待定）、排行全量导出需实测、旧 TC-01/03/05/06/07 的平铺断言已授权本批由验证方更新；AC-…-07 正分支因本部署 etcd ServiceMonitor=404 而 skip（环境限制） |
| 容器组页面族（列表筛选 + 调度信息/环境变量页签 + 容器详情四页签与单容器监控，2026-11-18） | 项目作用域容器组列表补**状态筛选**（服务端 `status=Waiting/Running/Completed/Error`，实测 `fieldSelector=status.phase=` 返回 0 条、未知键静默空表）与**节点列下钻**（节点名 + 节点 IP 链到该集群节点详情），状态列在徽标后显示 kubectl 式原因（`CrashLoopBackOff` 等）；容器组详情新增**调度信息页签**（调度结果/调度时间/GPU 分配按注解解析并链到单卡页/PodScheduled·Initialized·ContainersReady·Ready 四项条件及明细）与**环境变量页签**（init 优先、首卡展开、`valueFrom` 读 ConfigMap/Secret 解析、password/secret 掩码、读不到显示来源），概览补**资源请求/资源限制**聚合行（含 init 容器、GPU 简化名）；容器详情由单列改回**四页签**（资源状态/监控/环境变量/日志）并补**镜像 ID**、**生命周期 postStart/preStop**、**单容器监控**（GPU/显存/CPU/内存，1h/6h/24h，失败/无采样/真实 0 三态分离）；集群作用域容器组列表补同一筛选与节点下钻。E2E 在 **mlu370（新架构）** 首次跑通：`conftest.py` 新增 `api_base()` 修掉接口缺 `/kube-frontend` 前缀的问题 | 未提交；[交付记录](page-pods-20261118.md) | mlu370 串行 E2E：**24 通过 / 2 跳过 / 0 未通过（26 条，114.81s）**，本批 13 条新增用例全部通过；容器级监控在本部署无采样（cAdvisor 缺 `container`/`image` 标签，旧页同样为空，正分支仅单测覆盖）；第二色调与 1024/1600 全页、英文全页未截；非 admin、member、生产部署与全站串行 E2E 未验收 |
| 定时任务运行记录（2026-11-19） | 定时任务详情新增「运行记录」页签并设为**默认**：列出它创建的任务（名称链到任务详情、结果三态 + 成功/失败/运行中计数、资源请求/限制、起止时间、耗时）；空态「还没有运行记录」与失败可重试分开；页头「立即运行一次」按 jobTemplate 建任务（带 `cronjob.kubernetes.io/instantiate=manual` 注解）并用**任务的** create 权限门控；读路径用 kapis `labelSelector`（模板标签）+ `ownerReferences` 收敛，手动创建的任务（无 owner）仍计入；老页「每行重跑」改为页头一次入口（DEC-DETAIL-12 记被否方案） | 未提交；[交付记录](page-cronjob-runs-20261119.md) | 非 admin 403 分支、member、生产部署与全站串行 E2E 未验收；1024/1600 与浅色/英文未单独截图（沿用页族基线） |

### 待核对与发布收口

“待复核”不是已经确认代码缺失；选页后读现有源码、PRD/design和真实接口，
拆为原子 ID 再判定补齐/批准不做/已通过。旧表的“已补”同样不得直接升级为该页完整迁移。

| 台账 ID | 复核范围 | 状态/开始条件 | 原始线索与退出条件 |
| --- | --- | --- | --- |
| CHECK-01 | 概览生产/member、主题及语言范围 | 本地B200后端支持的16条相关浏览器回归通过；深浅×紫/绿×中英文×三档已检查，生产/member及全站未验收 | [仪表盘记录](cluster-overview-dashboard-execution-20261117.md)：六资源趋势、节点统计/排行1:2、整卡交互、入口对齐、次要刷新与主终端；不重做已补八项 |
| CHECK-02 | 全仓显式类型、构建、共享回归、全站E2E | 显式类型检查与契约套件本轮已复核为绿；全站串行 E2E 已完整跑一遍（64 分 37 秒：151 failed / 218 passed / 19 skipped），失败呈「长跑退化」形态，同批用例按区单跑全绿，故不作为判定；并发跑亦不可作为判定 | 见[全站基线记录](full-suite-baseline-20261116.md)：并发大面积失败 vs 串行全绿（configmaps 24 passed、monitoring+app-store 33 passed）；部署环境与 member 仍未验收 |
| CHECK-03 | 节点/GPU成员集群、硬件、终端及高级图表 | 待复核，禁止生产模式切换 | R-05/13/14/15/29及节点/GPU记录；保留已验证统计、筛选和真实stdout证据，未支持不能回退host |
| CHECK-04 | 日常资源完整表单、详情、创建与写闭环 | 存储卷页面族、工作负载编辑设置的资源限额与更新策略已闭环（见各自记录）；**容器组页面族**（列表状态筛选与节点下钻、调度信息/环境变量页签、容器详情四页签与单容器监控，[记录](page-pods-20261118.md)）已闭环；**定时任务运行记录**（[记录](page-cronjob-runs-20261119.md)）已闭环；其余资源仍待复核 | R-01/02/03/06/07/09/16/22/30；工作负载资源限额/存储/更新策略、快照与别名、项目写入、网关等逐项核实 |
| CHECK-05 | 成员/角色/用户全任务 | 平台用户列表+详情、访问控制根路径、租户(企业空间)成员列表+详情、项目成员列表+写入、租户(企业空间)配额只读表、租户(企业空间)用户组树+写入+实时刷新、集群成员列表+写入本地已验收。其余待复核并协调并行修改 | R-12/17/18/20/24；用户页退出条件已关闭。根路径见[入口记录](access-landing-20261115.md)。租户成员见[成员记录](workspace-members-20261115.md)。项目成员见[项目成员记录](project-members-20261115.md)。配额见[配额记录](workspace-quota-20261115.md)。用户组见[用户组记录](workspace-user-groups-20261115.md)、[实时刷新记录](workspace-user-groups-watch-20261117.md)；企业空间角色写见[角色写记录](workspace-roles-write-20261117.md)。仍缺跨作用域授权及专用角色能力 |
| CHECK-06 | 新开启区域的深度能力 | 应用商店页族（含项目内应用）、DevOps 工程页族、镜像构建器页族、灰度发布页族、联邦项目页族已按页面族闭环，见各自记录与上表；DevOps 另外补了企业空间作用域入口（[记录](workspace-devops-entry-20261117.md)，重纳 N-07） | 镜像构建器依赖 s2ioperator RBAC 与 minio、灰度依赖 servicemesh 控制器、联邦受单集群限制（均已登记阻塞与复查条件） |
| CHECK-07 | 监控/图表/组件/日志与通知 | **复核完毕**：项目级告警策略页族已闭环（[记录](alerting-policies-20261115.md)）；集群告警策略页族的自定义策略写、列表状态列与独立详情页已闭环（[记录](cluster-alerting-policies-write-20261117.md)）；集群监控物理资源面板（GPU/磁盘 I/O/RDMA，[记录](cluster-monitor-panels-20261115.md)）与系统组件面板（apiserver/scheduler/etcd，[记录](cluster-monitor-components-20261115.md)）已补齐；资源事件查询补齐时间段选择与实时刷新（`CLUSTER_EVENTS-03`）；仪表板面板只读渲染（`DASHBOARD_PANELS-01`，[PRD](../../prd/kube-frontend/cluster-management/dashboard-panels.md)）；告警消息按状态/级别服务端筛选（`CLUSTER_ALERTING-02`）；集群监控自动刷新（`MONITOR-04`）；集群监控状态分区与未就绪路由层接管（`MONITOR-08/09`，[记录](cluster-monitor-status-20261118.md)） | R-04/08/10/11/19/21/23/29；**明确不做**：仪表板面板编辑器（完整 Grafana 编辑器，另立单元）；**环境受限**：通知渠道写入（集群缺 notification webhook server，见[环境受限记录](environment-blocked-verifications-20261115.md)）；不以配置替代事实 |
| CHECK-08 | 通用列表、详情结构及公共组件接入 | 复核完毕：刷新与空态出口覆盖全部带列表页面（十二个页族，见[列表刷新记录](list-refresh-config-secrets-20261115.md)）；每页条数档位已接入 26 个列表并加三条机械契约（见[档位记录](list-page-size-tail-20261116.md)、[契约记录](page-size-contract-20261116.md)）；排序/列显隐/分页在清单页族已接入；共享 API 存在不等于所有页已接入这一点已按页核对 | [列表刷新记录](list-refresh-config-secrets-20261115.md)、[档位记录](list-page-size-tail-20261116.md)、[契约记录](page-size-contract-20261116.md) | 剩余列表（约 27 个）仍固定档位（同一套状态已就绪，按页族推进）；列显隐仍未逐页铺开；面板型列表不适用刷新 |
| CHECK-09 | 壳、帮助/关于、独立登录与应用任务 | **帮助入口已重纳并交付（N-28）**：关于/版本、配置入口已交付；顶栏帮助菜单（用户指南/API 文档）由 BFF `GET /api/config` 运行时配置，未配置走旧 console 相对路径兜底，显式空隐藏（[记录](help-entry-20261117.md)）。第三方登录/账单仍待重纳实现（N-02/N-03）；自制CRD应用→扩展资源、商城模板→应用商店**别处承接** | [壳层范围复核](check09-shell-scope-20261115.md) | 文档站/身份源的部署提供情况已可配置化；若平台要求按租户定制文档站，另立登录后配置接口 |
| CHECK-11 | **2026-11-17 重纳批次（14 项）** | **登记完成，实现开始回归**：PRD「明确不做」已删对应条目、design 已改写 DEC（原被否方案逐字保留并注明重纳）、`gap_check.py` 与 `parity_check.py` 已同步。N-05 只改登记；**N-01(应用列表/详情/多组件创建/删除/编辑/事件/路由)/N-02(状态)/N-03/N-06(集群作用域+平台切换)/N-07/N-09/N-11/N-12/N-21/N-27/N-28 已交付/部分**（AC/TC/截图/记录见上表与各自记录；2026-11-17 新交付回归：帮助 + 存储类型写 + 资源消费 + 集群角色 + 企业空间角色 + 第三方登录 + CRD 应用 7 条 **13 passed in 109.73s**；N-27 自动路径在 B200/mlu370 均无事件投递（环境不支持，已验证刷新回退）），其余待排期 | [重纳决策与执行计划](reinclusion-decisions-20261117.md)：页面级 8（N-01/02/03/05/06/07/09/10）+ 能力级 5（N-11/12/21/27/28）+ 集群网关 N-29 |
| CHECK-10 | 全部旧页面与条件入口完整清点 | 持续维护，各页选定前完成 | 路由脚本范围有限；动态子页、独立终端及非导航入口人工补充，原子清单不从新AC反推 |

不再汇总“已补26/总31”之类覆盖率：R编号是历史疑似回归集合，不是旧能力全集，
且旧小计与表格存在漂移。按本次选页的原子 ID 计数，记录通过、批准不做、待补、阻塞及未验证。
本台账是原有有效待办的整合索引，不宣称本次完成了全站功能审计或修改了产品实现。

---

<details>
<summary>查看过期 R 表、四列矩阵和当时建议（仅历史证据，不用于当前执行）</summary>

## 1. 历史 R-01至31 归宿快照（停止更新）

| # | 项 | 归宿 | 依据 / 阻塞点 |
| --- | --- | --- | --- |
| R-01 | 集群级应用负载 8 页 | **已补** | `d4fd0ea92`（七个集群级负载页）+ `b926a3e46`（容器组列表带项目列）；路由 `kube-frontend.clusters.$cluster/{deployments,statefulsets,daemonsets,jobs,cronjobs,pods,services,ingresses}` |
| R-02 | 集群级配置 3 页（configmaps/secrets/serviceaccounts） | **已补** | `b8ca9ae49`：三页只读、带项目列、跳转所属项目页；行键用 `项目/名称`（`kube-root-ca.crt` 每项目都有） |
| R-03 | 集群级网络策略 / Pod IP 池 | **已补** | 路由 `kube-frontend.clusters.$cluster/{networkpolicies,ippools}` 已存在（原登记 `§5.11 network 模块未开启` 已过期，`gap_check.py` 已改为自动判为已迁移） |
| R-04 | 集群级告警消息 / 策略 / 策略详情 | **已补** | `48485c1f8`（消息合并 cluster+global，来源列；策略两页签）、`46874b2b6`（内置可启停 + 消息下钻）、`452e2800f`（内置 reset，只写 spec 保留启用状态） |
| R-05 | GPU 卡列表 / GPU 卡详情 / GPU 资源监控 | **已补** | `5e3296584`（列表 + 单卡详情；无 `/gpus/<uuid>` 路由，详情用 `?uuid=` 过滤）、`1d6a9d7a7`（`/gpu-resource` 趋势，命名指标 `cluster_gpu_*`） |
| R-06 | 集群级全命名空间 PVC 列表 | **已补** | `e0a0a2c64`：跨项目 PVC 21 条、行键 `ns/name`、名称链回项目详情 |
| R-07 | 卷快照 / 快照类型 / 快照内容 / JuiceFS 共享存储 | **已补** | `a6673e591`（卷快照、快照类型；CRD 存在但 0 对象，空态与未安装两分支）、`a91366bf8`（快照内容详情 + `/snapshots` 别名重定向）、`728b94a35`（JuiceFS 三页签：3 卷/11.2TB，性能走监控区间） |
| R-08 | 系统组件详情页（副本数 + Pod 列表） | **已补** | `8f8afd4e2`：`components/$name` 详情显示健康徽标/后端数/启动时间 + 后端容器组（按名称前缀推导，标签各模块不统一）；`component-detail.md` |
| R-09 | 集群下的项目详情（配额/LimitRange） | **已补（只读）** | `189a3f165`：基本信息/标签、ResourceQuota used/hard、LimitRange 默认值、空态；编辑仍登记为不做 |
| R-10 | 集群网关设置 + 网关详情 | **已补** | `449be408c`：`nginxes` 现返回 1 个对象（NodePort 31193/32066，Service clusterIP 10.233.49.117），详情页属性 + 关联应用路由（当前 0 条，空态即路径），只读；同时修正 `toClusterGateway` 只认旧命名空间的分类 bug |
| R-11 | 集群日志收集的 3 类页签 + 收集器详情 | **已补（只读）** | `93bb78e75`：三页签取 operator 写的 `logging.kubesphere.io/component` 标签分类；收集项详情 + 只读 YAML |
| R-12 | 集群角色在集群作用域的入口 | **不迁移** | 与平台角色是同一批 `clusterrole` 对象，统一在「访问控制 › 平台角色」维护。登记于 `ELSEWHERE`；PRD/design 见 `access-control/platform-roles.md` 的 DEC-06。**已知限制（受阻，非页面问题）**：该页读核心组 `/apis/rbac.authorization.k8s.io/v1/clusterroles`，BFF 代理到单一上游；实测集群感知路径 `/kapis/.../clusters/host/clusterroles` 返回 404，切换集群需 BFF 侧按集群路由（证据见[台账复核](capability-ledger-reconciliation-20261115.md)） |
| R-13 | 容器 exec / kubectl / 节点 shell / 容器日志 tail | **已补（节点终端受环境限制）** | 日志：`82e76d57f`、`cd3254439`；容器终端：`432fc81d6`（BFF 首个 WebSocket upgrade + `v5.channel.k8s.io`）；kubectl：`e40bd6498`（xterm 全屏共享控制台）；节点 shell：`bf85b1923`。**B200 上节点 shell 后端不起 node access pod**（握手 101 但无数据帧），用例按环境跳过并记证 |
| R-14 | 节点列表 6 列 + 节点总览面板 + 列筛选 | **部分已补** | `67be3c456` 补齐 XPU/版本/终端等列；GPU 使用率、GPU 显存、Pod 用量、时间同步仍缺（本轮复核） |
| R-15 | 节点详情 5 页签 + 4 个操作 | **部分已补** | `bf85b1923`：运行状态/容器组/监控三页签、编辑标签/污点、节点终端；事件页签与 vGPU 模式仍缺（且节点 shell 在 B200 缺 node access pod，按环境跳过） |
| R-16 | 存储类型详情的关联 PVC 列表 | **已补** | `4c00e048e`：关联存储卷表（一次集群级 PVC 读 + 页面侧过滤，kapis 忽略 fieldSelector）；openebs-hostpath 13 行与 API 一致 |
| R-17 | 平台角色详情的「已授权用户」页签 | **已补** | `20632575f` |
| R-18 | 平台角色的规则编辑器 | **已补** | `b868a8967`：规则可增删、动词逐项勾选；编辑既有角色时先读回现有规则（写路径是整对象替换，否则保存别名会静默清空权限）；用例验证 2 条规则创建/回读/回显 |
| R-19 | 项目概览的资源用量图表 / 引导提示卡 | **图表已补 + 引导卡不迁移** | `d325d5464`（CPU/内存/存储/容器组，已用/上限，三态区分；存储回落配额 `status.used`）；引导卡不迁移，理由见 `project-settings/overview.md` 的 DEC-03 |
| R-20 | 项目角色详情的「已授权用户」页签 | **已补** | `d435c6f3b`：按 RoleBinding subjects 展开（default/viewer 53 个 SA；老 console 的 users?role= 会显示 0 人） |
| R-21 | 网络隔离的规则聚合视图 / 白名单新建向导 | **规则视图与白名单向导均已补** | `815ed84ea`：ingress/egress 展开为规则行（matchLabels/matchExpressions、podSelector/namespaceSelector/ipBlock 含 except、endPort）；**不做有损白名单抽象**（`network-isolation.md` DEC-05）；白名单向导见[向导记录](network-whitelist-wizard-20261115.md)（多规则/三类对端/端口） |
| R-22 | 存储卷详情的快照页签 | **已补（空态路径）** | `4c00e048e`：PVC 详情「属性/快照」页签，按 `source.persistentVolumeClaimName` 过滤；B200 CRD 已装对象 0，空态即交付路径 |
| R-23 | 项目基本信息的角色/成员/服务统计 | **已补** | `d325d5464`：三卡取各列表 `totalItems`，失败显示 `-` 而非 0 |
| R-24 | 用户登录历史分页 / 管理员重置密码 / 批量启停 / 预置账号保护 | **已交付** | 批量启停 `48cad6d66`；改密（列表行操作 + 详情）、登录历史分页、`presetUsers` 保护均已实现（`PlatformListPage`/`UserDetailPage`/`LoginHistoryPanel` + `isProtectedPlatformUser`），用例 `ACCESS_CONTROL-USERS-*` 8 passed；复核记录见[台账复核](capability-ledger-reconciliation-20261115.md) |
| R-25 | 集群列表 host/成员分组 / 卡片视图 | **已补（筛选）+ 卡片不迁移** | `1a444af7a`：「集群类型」筛选（主集群/成员集群），清除后 host 仍置顶；卡片视图不迁移，见 `cluster-list.md` DEC-06 |
| R-26 | 列表刷新按钮 | **部分已补** | 8 个页面已接 `schema.refresh` + `onRefresh`（集群负载 8 页 / 容器组 / 工作负载列表等）；其余列表页仍无刷新出口 |
| R-27 | 列表实时刷新（watch） | **已补** | `f8bf8a441`：容器组列表「实时」开关，走 `?watch=true` 分块 HTTP（不是 WebSocket），变更即失效重取；顺带修了 dev 代理连接池与中止泄漏（`52bc55b1d`） |
| R-28 | 空态的「刷新 / 清除筛选」出口 | **已补** | `3d7029996`：ai-kit 空态渲染「清空搜索与筛选」「刷新」两个出口，仅在有对应回调时出现 |
| R-30 | 监控卡片自动刷新（老 console 的播放/暂停，5 秒轮询） | **已交付**（`CLUSTER_MANAGEMENT-MONITOR-04`） | 集群监控页新增「自动刷新」开关：每次 tick 把时间窗向前滚动后重取；关闭/切窗/卸载时清理定时器 |
| R-29 | 图表能力整体 | **已补集群物理资源** | 集群监控从 4 张卡片扩到 13 张（CPU/内存/容器组运行-异常-完成/节点/负载 1-5-15/磁盘/inode/网络收发），比值换算与单位格式化有单测级断言（`CLUSTER_MANAGEMENT-MONITOR-03`）；日志/审计页计数条与分布图见 `cd3254439` |
| R-30 | Service / Ingress 无法创建 | **已补** | `0f0f0ffdd`：专用创建弹窗（NodePort 条件字段、选择器预填、Ingress 同 host 合并）+ SSAR 权限前置检查 + 可切 YAML |
| R-31 | 密码强度指示器 | **已补** | `c1e824e8f`、`8e3922c7e`；改密页（并行线）把强度条从浮层改为常驻面板 |

---

## 2. 历史四列矩阵（停止更新）

原列定义为列表/写/详情/通用，但其中部分状态已经落后于 §1，且没有视觉与验证范围。
以下保留用于追查文档漂移；不得据此认为节点缺GPU、组件无详情或容器无终端。
新选页的完整清单用模板，当前状态只在 §0 与该页证据中更新。

| 页面 | 列表 | 写 | 详情 | 通用 |
| --- | --- | --- | --- | --- |
| 集群概览 | —（仪表盘） | 无集群写入；kubectl、用户 kubeconfig 查看/下载已补 | OVR-01 至08 已补：六类资源、三种 scheduler 结果、组件入口、Top5 和可见性 | 协调刷新、未知值、九类排行与下钻；本地八条回归通过，部署/member 待验收 |
| 节点列表 | ✅ 5 列（缺 GPU/XPU/时间同步 6 列，R-14） | 停止/启动调度；**无编辑标签/污点** | — | 无刷新；无实时 |
| 节点详情 | — | 编辑标签/污点、终端 | 三页签：运行状态/容器组/监控（`bf85b1923`） | 终端；无刷新 |
| 系统组件 | ✅ | — | **无详情页**（R-08） | 无刷新 |
| 项目（命名空间） | ✅ | **无创建/编辑/删除**（登记为不做） | **无详情页**（R-09） | 无刷新 |
| 集群级应用负载 ×8 | ✅ 带项目列 | 编辑信息 / 编辑 YAML / 重新部署 / 删除 | 复用负载详情 | 刷新已交付；实时刷新（watch）已交付（R-27，`f8bf8a441`） |
| 集群级网络策略 / IP 池 | ✅ | 创建 / 删除 | 无详情 | 无刷新 |
| 集群域配置字典 / 保密字典 / 服务账户 | ✅ 带项目列（只读） | 只读 + 跳转所属项目页 | — | 无刷新 |
| 集群域告警消息 / 告警策略 | ✅（消息合并两来源） | 自定义启停/删除；内置启停 + reset；消息下钻 | 与项目级共用 | 无刷新 |
| 存储类型 | ✅ | **只读**（登记为不做） | 单页，**缺关联 PVC 列表**（R-16） | 无刷新 |
| 持久卷 | ✅ | **写入已重纳（N-11，2026-11-17）**：编辑信息 / 编辑 YAML / 单条删除 / 批量删除（Bound、Released 跳过并汇总） | 单页 + 详情；写能力见[记录](persistent-volumes-write-20261117.md) | 刷新已有；member/生产/全站未验收 |
| 集群日志收集 | ✅ | **只读**（登记为不做） | **无分类页签、无收集器详情**（R-11） | — |
| 集群成员 | ✅ | **只读**（登记为不做） | — | 无刷新 |
| 集群列表 | ✅ | 添加 / 编辑 / 移除 / 更新 kubeconfig | — | **无分组、无卡片视图**（R-25）；无刷新 |
| 项目负载列表 ×8 | ✅ | 创建 / 编辑信息 / 编辑 YAML / 删除 / 扩缩容 / 重新部署 | **单页，无页签**（监控/环境变量/事件/元数据，R-13 同源） | 固定 10 条（无档位）；无刷新；无实时；空态无出口 |
| 容器组详情 | — | 编辑信息 / 编辑 YAML / 删除 | 单页 + 事件区块；**无调度信息/监控/环境变量页签**（R-15 同源） | — |
| 容器详情 | — | — | 属性 + 资源/环境变量/挂载/端口/探针 + 日志；**无终端、无单容器监控**（R-13） | — |
| 配置字典 / 保密字典 / 服务账户 | ✅ | 创建 / 编辑信息 / 编辑设置 / 编辑 YAML / 删除 | ✅ 详情页 | 固定 10 条；无刷新；无实时 |
| 存储卷 / 快照（项目） | ✅ | 编辑 YAML / 删除 / 扩容 | **存储卷缺快照页签**（R-22） | 无刷新 |
| 网络隔离 | ✅ | 创建 / 删除策略；**无 YAML 编辑**；**无白名单新建向导**（R-21） | 无详情 | 无刷新 |
| 项目角色 | ✅ | 创建 / 编辑信息 / 编辑权限 / 删除 | **弹窗替代详情，缺「已授权用户」页签**（R-20） | 无刷新 |
| 项目成员 | ✅ | 邀请 / 改角色 / 移除；**无批量移除** | — | 无刷新 |
| 平台角色 | ✅ | 创建 / 编辑信息 / 删除；**无规则编辑器**（R-18） | ✅ 含已授权用户（R-17 已补） | 无刷新 |
| 用户 | ✅ | 创建 / 编辑 / 改角色 / 启停 / 批量启停 / 删除；**无改密**（R-24） | ✅ 含登录历史（**无分页**，R-24） | 无刷新 |
| 项目概览 | ✅ | — | 单页；**缺资源用量图表**（R-19） | — |
| 项目基本信息 | ✅ | 编辑配额；**无编辑信息/删除**（登记为不做） | 单页；**缺角色/成员/服务统计**（R-23） | — |
| 告警消息 / 告警策略 | ✅ | 启停 / 删除；**无创建、无编辑 YAML**（登记为不做） | 弹窗替代详情 | 无刷新 |
| 顶栏与壳 | — | — | — | 刷新按钮（R-26）与空态出口（R-28）已交付；列表实时刷新（R-27）已交付（`f8bf8a441`） |

---

## 3. 历史枚举漏洞与当时建议（已退出执行入口）

`gap_check.py` 按 `src/pages/*/routes/*.js` 枚举段。**有两类老页面不在这条路径上**，因此至今没有归宿——和 115 个缺口当初隐身是同一个原因。

### 3.1 `src/pages/console` 整个作用域（6 页）

`SCOPE_DIRS` 里没有 `console`，所以 `/dashboard`、`/logquery`、`/eventsearch`、`/auditingsearch`、`/bill`、`/404` 一条都没被枚举过（`/support` 已于 2026-11-17 从源码删除，不再有归宿问题）。

**建议归宿**（可直接落到 `gap_check.py` 的四类表）：

| 段 | 归宿 | 说明 |
| --- | --- | --- |
| `console/dashboard` | ⇄ 别处承接 | 由 `/kube-frontend`（工作台）承接 |
| `console/logquery` | ⇄ 别处承接 | 由集群「日志查询」承接（`82e76d57f`） |
| `console/eventsearch` | ⇄ 别处承接 | 由集群「资源事件」承接（`ef0725ddb`） |
| `console/auditingsearch` | ⇄ 别处承接 | 由集群「审计日志」承接（`82e76d57f`） |
| `console/bill` | ⊘ 明确不做 | `metering` 模块未开启 |
| `console/404` | … 已登记缺口 | 新 UI 无兜底路由，任何写错的 URL 没有落点（缺口分析 §4.7 F-37） |

### 3.2 `src/pages/terminal`（独立新窗口，3 种模式）

该目录只有 `index.jsx`、没有 `routes/`，同样不被枚举。三种模式：容器终端、`kubectl`、节点 shell。

**建议归宿**：`terminal/terminal` → … 已登记缺口，阻塞点「BFF 无 WebSocket upgrade」。与 R-13 同源。

> **一个已经发生的自我纠正**：本文件初稿曾把「集群级网络策略 / Pod IP 池」登记为「不迁移」（理由：`network` 模块未开启）。
> 落位时发现并行线已经交付了这两页，且 `prd/kube-frontend/cluster-management/{network-policies,ip-pools}.md` 与用例规格都在——
> 按 §57.4 M4「已登记『不做』但代码里其实做了，同样算文档缺陷」，那条登记已从 PRD 删除。
> **这正是登记要防的错误类型：一条过期的「不做」会把已经做完的事永久盖住。**

### 3.3 一条已经过期的「不做」理由

`gap_check.py` 里 `projects/applications` 仍写着「应用商店：openpitrix 模块关闭（§5.1）」。
但计划 §5.1 已于同日更正为**已迁移**（`configz.openpitrix=true`，`/kapis/openpitrix.io/v1/{apps,categories,reviews}` 均 200），
且商店浏览与商店管理页已交付。**这条理由现在指向一个已不成立的事实。**

`projects/applications` 这一页本身仍属未迁移，但**真实理由是「项目内的『应用』页是 CRD composing 应用，与商店不是同一功能」**，
不是模块关闭。下次改 `gap_check.py` 时把理由改成这条。

> **三条都不建议现在改 `gap_check.py`**：该文件正被并行线持续修改（`apps` 作用域刚由它们加入）。
> 本节先把判定写下来，等下一次改该文件时一并落进去——**判定先于实现，是这次登记的主要目的**。

</details>

---

## 4. 怎么维护当前台账

1. 选定 §0 一个范围，在同一页记录建立原子能力表；不从旧R表/四列矩阵直接复制状态。
2. 同步该页 PRD/design/spec 与实现；既有能力、数据、权限、视觉与测试一起核对，未测不填通过。
3. 交付后只更新 §0 的对应行：范围、状态、提交、证据、未验收边界及下一步；必要时拆分 CHECK 项。
4. 不做/承接先有批准或任务等价证据，文档判定与实现同步；取消或覆盖旧决定时加后继说明。
5. 页面级输出与原子能力结果分开报告；阻塞/待补不从分母删除。历史段落停止追加“当前/下一轮”。


---

<details>
<summary>查看2026-11-15新开启区域的有限范围交付快照</summary>

## 附：2026-11-15 有限范围交付快照（不是当前待办）

应用商店（30 应用/8 分类）、DevOps、集群网关（1 Nginx）、联邦项目（1 个 federatednamespace）、服务网格（strategies 200）均已开启，原先「模块未开启」的 8 个 URL 段从「明确不做」改为登记缺口，并按区域交付：

| 区域 | 交付 | 提交 |
| --- | --- | --- |
| DevOps 工程 | 列表 + 详情骨架（成员/角色/凭证页签） | `0f4612302` |
| 联邦项目 | 列表 + 详情骨架（13 类联邦资源只读） | `daf3f6ace` |
| 集群网关详情 | 属性 + 关联应用路由（R-10 关闭） | `449be408c` |
| 灰度发布 | 项目级只读列表（状态派生自 conditions） | `2fce6985f` |
| 应用商店应用详情 | 版本表 + 解码 Readme（安装入口待开放） | `f19dcd169` |

以上对象数与接口结果仅限当时探测；404不能单独证明模块未装或永久不做。
新开启区域深度能力与产品范围的后续核对已整合到 §0 CHECK-06/09，不再引用已失效的计划 §3.0 待办。

</details>
