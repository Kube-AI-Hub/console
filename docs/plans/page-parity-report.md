# 迁移页面对照报告

每个已迁移页面一行：**验收场景**列出该页字段与交互的逐条断言（AC），**有意未迁移**是从「明确不做」小节汇出、并在 design 文档里给出理由的部分。

判定标准：页面存在且 AC 全部有用例覆盖（check_docs.py --strict）；老 console 对应页面要么在映射里（parity_check.py 缺口 0），要么登记在明确不做清单里并写明原因。

## 有意保留的差异（跨页面）

| 差异 | 范围 | 原因 |
| --- | --- | --- |
| 列表保持为页面、切换/编辑为弹窗 | 集群、企业空间、用户 | 老 console 两者都有；页面负责浏览与检索，弹窗负责单一动作，混用会让「当前在哪」失去锚点 |
| 破坏性操作与可逆操作的确认方式不同 | 全部 | 移除集群需输入名称确认；停止调度、重新部署只需一次点击——按后果分级，不统一弹窗 |
| 同一对象只有一处编辑入口 | 集群信息、项目角色 | 两个编辑入口在冲突时无法判断以谁为准 |
| 接口不可用时显示「不可用」而不是空表 | 企业空间成员、节点 Pod 页签 | 空表会被读成「没有」，这是比缺功能更糟的误导 |
| 部分功能登记为明确不做而非放死按钮 | 全局 | 死按钮承诺了做不到的事 |
| 配置类对象在集群域与项目域都提供列表 | 配置字典 / 保密字典 / 服务账户 | 2026-11-14 决策反转：跨项目定位配置是集群管理员的日常第一步；集群级列表**只读 + 项目列 + 跳转所属项目页**，写操作回项目作用域，避免同一对象两个编辑入口（DEC-L2-…-CLUSTER_MANAGEMENT-04） |
| 告警在集群域与项目域都提供列表 | 告警消息 / 告警策略 | 2026-11-14 决策反转：规则的 `namespace` 是归属不是可见范围；原「只能逐项目拉」是未探测的假设，list 不传 `namespace` 即全命名空间（DEC-L2-…-MONITORING-03） |
| 建立 WebSocket 通道，实时能力是一等需求 | 全部 | 2026-11-14 决策反转：容器终端与日志 tail 是排障主路径，「暂时没有通道」不等于「不做实时」；分三步落地——BFF `upgrade` → watch 客户端 → xterm 终端。**唯一保留的旧结论**：不做轮询假实时（DEC-CORE-KUBE-FRONTEND-08） |

## 逐页对照

### workbench（平台/项目入口作用域，2 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 项目上下文栏 | WORKBENCH-CONTEXT-01 | 在本栏内切换企业空间。；跨集群聚合视图。 |
| 工作台入口 | WORKBENCH-ENTRY-01, WORKBENCH-ENTRY-02 | 在工作台创建项目（在项目控制台或平台管理里做）。；工作台仪表盘统计。 |

### cluster-management（集群作用域，18 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 添加集群 | CLUSTER_MANAGEMENT-ADD_CLUSTER-01, CLUSTER_MANAGEMENT-ADD_CLUSTER-02 | 用 KubeKey 新建集群（需要主机清单与 kubekey API）。；移除集群、更新 kubeconfig（老 console 有，另立功能点）。 |
| 编辑集群信息 | CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01, CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-02 | 修改集群名称、连接方式、kubeconfig（后者属「更新 kubeconfig」独立功能）。；移除集群。 |
| 资源事件查询 | CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01 | 事件全文检索后端（ES）：本页只过滤已加载窗口，不承诺历史检索。；日志检索、审计检索：另两个工具箱页面，属独立功能。 |
| 集群列表 | CLUSTER_MANAGEMENT-CLUSTER_LIST-01, CLUSTER_MANAGEMENT-CLUSTER_LIST-02, CLUSTER_MANAGEMENT-CLUSTER_LIST-03, CLUSTER_MANAGEMENT-CLUSTER_LIST-04 | 集群注册 / 注销 / 上下线（需要平台侧注册接口与 kubeconfig 校验）。；跨集群的聚合指标（需要按集群分别取指标，属集群监控）。；卡片视图：10 条/页的表格已能一屏看完，卡片把状态与版本挤进图标（DEC-L3-…-CLUSTER_LIST-06）。 |
| 集群成员 | CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01 | 邀请/移除集群成员（写集群角色绑定）。；集群角色本身的规则（见平台角色详情）。 |
| 集群切换与作用域侧栏 | CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01, CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02 | 在切换器里添加/编辑集群（那是列表页的职责）。；跨集群聚合视图。 |
| 系统组件 | CLUSTER_MANAGEMENT-COMPONENTS-01 | 组件重启、日志查看（属运维操作）。；按模块（KubeSphere / 应用治理 / 监控 / 日志）分组显示。 |
| 自定义资源 | CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01, CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-02 | CRD 实例的 YAML 编辑（只读展示；编辑需要按动态资源路径做 schema 校验，另立功能点）。；CRD 创建/编辑/删除（属安装器职责）。；按组分组展示（当前规模不需要）。 |
| 集群日志收集 | CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01 | 修改收集器/输入/输出：需要专门的编辑与校验流程。；日志全文检索：属工具箱，单独规划。 |
| 集群监控 | CLUSTER_MANAGEMENT-MONITOR-01, CLUSTER_MANAGEMENT-MONITOR-02 | 节点/容器组级别的下钻与排行：老 console 的「物理资源」「节点用量排行」是独立页面，另做。；etcd / apiserver / scheduler 专用监控页：需要各自的组件指标面板。；告警阈值线叠加：需要知道每条规则的阈值，规则体里没有统一字段。 |
| 节点用量 | CLUSTER_MANAGEMENT-NODE_USAGE-01 | 节点详情与排空/污点操作（属节点页与运维操作）。；按项目聚合的用量排行（项目用量已在集群「项目」页）。；历史趋势（见「集群监控」）。 |
| 节点列表 | CLUSTER_MANAGEMENT-NODES-01, CLUSTER_MANAGEMENT-NODES-02, CLUSTER_MANAGEMENT-NODES-03, CLUSTER_MANAGEMENT-NODES-04 | 节点排空、污点编辑、Pod 列表。 |
| 集群概览 | CLUSTER_MANAGEMENT-OVERVIEW-01, CLUSTER_MANAGEMENT-OVERVIEW-02 | 集群设置（编辑描述、可见性、可插拔组件开关）：需平台侧写接口，当前迁移范围外。；用量趋势曲线与历史：需要指标历史接口，本页只取当前值。；kubectl / kubeconfig 快捷工具：老 console 用新窗口打开独立页面，新 UI 无对应页面。；节点 Top5 与节点卡片：已由「节点」页承担，本页不再重复。 |
| 持久卷 | CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01, CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02 | 创建、删除持久卷。；查看卷内文件。 |
| 项目列表 | CLUSTER_MANAGEMENT-PROJECTS-01, CLUSTER_MANAGEMENT-PROJECTS-02 | 项目创建、编辑、删除。 |
| 集群设置 | CLUSTER_MANAGEMENT-SETTINGS-01, CLUSTER_MANAGEMENT-SETTINGS-02 | 集群可见性与分组标签编辑：安装器字段，改动会与安装配置产生分歧。；region / zone 编辑：需要平台 regionZones 配置，当前环境没有。；删除集群、上下线集群：属平台侧编排，不在集群设置范围。 |
| 存储类型 | CLUSTER_MANAGEMENT-STORAGE_CLASSES-01, CLUSTER_MANAGEMENT-STORAGE_CLASSES-02 | 创建与编辑存储类型（属基础设施操作）。；设为默认类型的操作。 |
| 集群可见性 | CLUSTER_MANAGEMENT-VISIBILITY-01 | 企业空间授权列表与授权变更（需要联邦工作空间资源）。；集群角色与项目可见性的联动。 |

### configmaps（项目作用域，8 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 智能体可操作性 | CONFIGMAPS-AI_SURFACE-01, CONFIGMAPS-AI_SURFACE-02 | 不做 MCP server：句柄是给任意自动化用的，绑定一种协议会限制复用。；不做坐标级操作接口。 |
| 创建配置字典 | CONFIGMAPS-CREATE-01, CONFIGMAPS-CREATE-02, CONFIGMAPS-CREATE-03, CONFIGMAPS-CREATE-04 | 不做标签（labels）输入——旧 console 的创建表单没有，需要时走 YAML。；不做多文档 YAML（`---` 分隔）。；不做从文件批量导入多个键值。 |
| 删除配置字典 | CONFIGMAPS-DELETE-01, CONFIGMAPS-DELETE-02 | 不做软删除与回收站。；不做删除单个键。 |
| 配置字典详情 | CONFIGMAPS-DETAIL-01, CONFIGMAPS-DETAIL-02 | 不做键值的内联编辑（编辑走「编辑设置」弹窗）。；不做「查看 YAML」只读弹窗（编辑 YAML 已可查看）。；不做关联工作负载的反向引用。 |
| 编辑配置字典 | CONFIGMAPS-EDIT-01, CONFIGMAPS-EDIT-02, CONFIGMAPS-EDIT-03 | 不做名称重命名。；不做 labels 的图形化编辑（走 YAML）。；不做变更历史与回滚。 |
| 配置字典列表 | CONFIGMAPS-LIST-01, CONFIGMAPS-LIST-02, CONFIGMAPS-LIST-03, CONFIGMAPS-LIST-04, CONFIGMAPS-LIST-05, CONFIGMAPS-LIST-06 | 不做列宽拖拽与列显隐设置。；不做虚拟滚动：首期分页 10 条，长列表不在本期。 |
| 移动端适配 | CONFIGMAPS-MOBILE-01, CONFIGMAPS-MOBILE-02 | 不做原生手势（左滑删除）。；不做平板专用双栏布局。 |
| 按名称搜索 | CONFIGMAPS-SEARCH-01, CONFIGMAPS-SEARCH-02 | 不做按标签 / 键值搜索。；不做搜索历史与建议。 |

### secrets（项目作用域，8 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 保密字典 · 智能体可操作性 | SECRETS-AI_SURFACE-01 | 不做自然语言指令解析（由上层智能体完成）。；不为每个表单字段都提供句柄（只覆盖可被自动化驱动的控件）。 |
| 创建保密字典 | SECRETS-CREATE-01, SECRETS-CREATE-02, SECRETS-CREATE-03 | 不做 labels 输入（走 YAML）。；不做从文件导入证书或 `.dockerconfigjson`（可粘贴内容）。；不做多条目镜像仓库的图形编辑（编辑器只维护一个 registry，其余走 YAML）。；不做服务账户令牌类型的手动创建。 |
| 删除保密字典 | SECRETS-DELETE-01 | 不做软删除或回收站。；不做「删除前检查是否被引用」的告警。 |
| 保密字典详情 | SECRETS-DETAIL-01, SECRETS-DETAIL-02 | 不做「复制值」按钮：复制会把明文放进系统剪贴板，绕过页面的遮挡意图。；不做值的就地编辑（走编辑设置）。；不做 labels/annotations 展示（走编辑 YAML）。 |
| 编辑保密字典 | SECRETS-EDIT-01, SECRETS-EDIT-02, SECRETS-EDIT-03 | 不做类型的修改（走 YAML）。；不做版本历史与回滚。；不做「编辑信息」中的标签（labels）编辑。 |
| 保密字典列表 | SECRETS-LIST-01, SECRETS-LIST-02 | 不做列显隐设置与列宽拖拽。；不在列表显示键名或任何值。 |
| 保密字典 · 移动端适配 | SECRETS-MOBILE-01 | 不做专用的移动端卡片布局（列表复用同一套表格，只是折叠列）。；不做手势（左滑删除等）。 |
| 保密字典 · 按名称搜索 | SECRETS-SEARCH-01 | 不做多字段搜索、模糊匹配或正则。；不做搜索历史。 |

### serviceaccounts（项目作用域，9 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 服务账户 · 智能体可操作性 | SERVICEACCOUNTS-AI_SURFACE-01 | 不暴露「在集群中执行命令」的能力。 |
| 创建服务账户 | SERVICEACCOUNTS-CREATE-01, SERVICEACCOUNTS-CREATE-02 | 不做令牌自动创建（集群决定）。；不做 `imagePullSecrets` 选择（走 YAML）。；不做批量创建。 |
| 删除服务账户 | SERVICEACCOUNTS-DELETE-01 | 不做回收站。 |
| 服务账户详情与 kubeconfig | SERVICEACCOUNTS-DETAIL-01, SERVICEACCOUNTS-DETAIL-02 | 不生成新的令牌 Secret（由集群控制器负责）。；不做 kubeconfig 的就地编辑。；不做 kubeconfig 的「合并到本地 ~/.kube/config」引导。 |
| 编辑服务账户 | SERVICEACCOUNTS-EDIT-01 | 不在「编辑」里改角色（见 `role`）。；不做标签编辑。 |
| 服务账户列表 | SERVICEACCOUNTS-LIST-01, SERVICEACCOUNTS-LIST-02 | 不在列表展示 kubeconfig 或令牌内容。；不做列显隐设置。 |
| 服务账户 · 移动端适配 | SERVICEACCOUNTS-MOBILE-01 | 不做专用的移动端详情布局。 |
| 修改角色 | SERVICEACCOUNTS-ROLE-01 | 不做 RoleBinding 的增删（只改注解）。；不做集群角色（`cluster-role.kubesphere.io`）。 |
| 服务账户 · 按名称搜索 | SERVICEACCOUNTS-SEARCH-01 | 不做按角色或令牌搜索。 |

### app-workloads（项目作用域，10 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 容器详情 | APP_WORKLOADS-CONTAINER_DETAIL-01 | 容器日志、容器终端、单容器监控：分别需要流式日志/exec 端点与监控区间查询，均未代理。；容器编辑：容器由所属工作负载的模板定义，改模板才是唯一入口。 |
| 删除负载 | APP_WORKLOADS-DELETE-01 | 不做回收站与恢复。 |
| 负载详情 | APP_WORKLOADS-DETAIL-01, APP_WORKLOADS-DETAIL-02, APP_WORKLOADS-DETAIL-03, APP_WORKLOADS-DETAIL-04, APP_WORKLOADS-DETAIL-05, APP_WORKLOADS-JOB_RUNS-01, APP_WORKLOADS-PODS_BLOCK-01, APP_WORKLOADS-SERVICE_PODS-01, APP_WORKLOADS-STATEFUL_SERVICE-01 | 不在详情做扩缩容（表单能力未迁移，记在待办）。 |
| 编辑设置 | APP_WORKLOADS-EDIT_SETTINGS-01, APP_WORKLOADS-EDIT_SETTINGS-02 | 不给容器组做与创建相同的编辑表单。；不在任务编辑里提供节点选择、容器或存储。；不把名称、别名、描述或副本数扩缩容搬进「编辑设置」。；不改服务和应用路由已有的编辑入口。 |
| 编辑 YAML | APP_WORKLOADS-EDIT_YAML-01 | 不做多文档 YAML。 |
| 工作负载列表 | APP_WORKLOADS-LIST-01, APP_WORKLOADS-LIST-02, APP_WORKLOADS-LIST-03 | 不做列显隐与列宽拖拽。；不在列表创建负载。 |
| 容器组事件 | APP_WORKLOADS-POD_EVENTS-01 | 事件全文检索（工具箱的独立功能）。；事件删除/归档。 |
| 重新部署 | APP_WORKLOADS-REDEPLOY-01 | 不做暂停/恢复滚动。 |
| 版本历史与回滚 | APP_WORKLOADS-REVISIONS-01 | 版本之间的差异对比（diff）。；指定副本数与镜像的"再次部署"。 |
| 状态派生 | APP_WORKLOADS-STATUS-01, APP_WORKLOADS-STATUS-02 | 不为状态引入新的中间态或自定义颜色。 |

### storage（项目作用域，4 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 删除存储对象 | STORAGE-DELETE-01 | — |
| 存储详情 | STORAGE-DETAIL-01, STORAGE-DETAIL-02 | — |
| 编辑 YAML | STORAGE-EDIT_YAML-01 | — |
| 存储列表 | STORAGE-LIST-01, STORAGE-LIST-02, STORAGE-LIST-03, STORAGE-LIST-04 | 不做列显隐与列宽拖拽。；不在列表创建存储卷。；不做快照创建。；扩容已迁移，但仅对存储类声明了 `allowVolumeExpansion` 的卷开放。 |

### monitoring（项目作用域，2 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 告警消息列表 | MONITORING-ALERTS-01 | 静默、通知、批量删除。 |
| 告警策略列表 | MONITORING-RULES-01, MONITORING-RULES-02, MONITORING-RULES-03, MONITORING-RULES-04 | 内置与集群级规则组的编辑：由安装器维护，改了下一次协调会覆盖。；规则的排序与分组：规则列表按录入顺序写入，Prometheus 不区分规则顺序。；告警消息删除以外的批量操作。 |

### project-settings（项目作用域，8 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 项目基本信息 | PROJECT_SETTINGS-BASE_INFO-01, PROJECT_SETTINGS-BASE_INFO-02, PROJECT_SETTINGS-BASE_INFO-03 | 编辑项目信息（需要平台侧表单）。；默认容器配额（LimitRange）区块。；删除项目。 |
| 网关设置 | PROJECT_SETTINGS-GATEWAY-01 | 修改网关类型、端口与副本数（属基础设施配置）。；网关的日志与监控。 |
| 日志收集 | PROJECT_SETTINGS-LOGGING-01, PROJECT_SETTINGS-LOGGING-02 | 日志查询与检索（属集群日志查询页面）。；日志后端（Elasticsearch/Kafka 等）配置（属集群级日志配置）。；按工作负载选择收集范围（老 console 也未提供）。 |
| 项目成员列表 | PROJECT_SETTINGS-MEMBERS-01, PROJECT_SETTINGS-MEMBERS-02 | 邀请成员、修改角色、移出项目。 |
| 网络隔离 | PROJECT_SETTINGS-NETWORK_ISOLATION-01, PROJECT_SETTINGS-NETWORK_ISOLATION-02, PROJECT_SETTINGS-NETWORK_ISOLATION-03 | 策略的**编辑**（创建与删除已迁移；修改仍用 YAML）。；多规则策略与 IP 段（`ipBlock`）规则。；策略的启用/停用（NetworkPolicy 没有这个字段）。；老的「内部/外部白名单」聚合视图：有损映射，直接展示 NetworkPolicy 对象（DEC-L3-…-NETWORK_ISOLATION-05）。 |
| 项目概览 | PROJECT_SETTINGS-OVERVIEW-01 | 用量排行（需要监控区间查询）。；应用列表（依赖 openpitrix 模块，本集群关闭）。；配额编辑：已有项目设置的配额编辑入口。；引导提示卡片（一次性内容占据常驻位置，DEC-L3-…-OVERVIEW-03）。 |
| 角色权限规则 | PROJECT_SETTINGS-ROLE_RULES-01, PROJECT_SETTINGS-ROLE_RULES-02 | 规则的编辑。 |
| 项目角色列表 | PROJECT_SETTINGS-ROLES-01, PROJECT_SETTINGS-ROLES-02, PROJECT_SETTINGS-ROLES-03, PROJECT_SETTINGS-ROLES-04 | 角色的**创建**（需要规则编辑器）。；对模板角色的任何写操作：平台会拒绝，界面只给「详情」。 |

### access-control（平台作用域，5 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 平台角色列表 | ACCESS_CONTROL-PLATFORM_ROLES-01, ACCESS_CONTROL-PLATFORM_ROLES-02, ACCESS_CONTROL-PLATFORM_ROLES-03, ACCESS_CONTROL-PLATFORM_ROLES-04, ACCESS_CONTROL-PLATFORM_ROLES-05 | 规则的多条编辑（当前一次一条）。；集群作用域单独的集群角色页：同一批 clusterrole 对象，统一在平台角色维护（DEC-L3-…-PLATFORM_ROLES-06）。 |
| 用户详情 | ACCESS_CONTROL-USER_DETAIL-01 | 停用/启用与删除：在用户列表的行操作里完成，详情页只读。；该用户在项目/企业空间里的角色：需要跨聚合查询，与成员管理重叠。 |
| 用户列表 | ACCESS_CONTROL-USERS-01, ACCESS_CONTROL-USERS-02, ACCESS_CONTROL-USERS-03, ACCESS_CONTROL-USERS-04, ACCESS_CONTROL-USERS-05, ACCESS_CONTROL-USERS-06, ACCESS_CONTROL-USERS-07 | — |
| 企业空间详情 | ACCESS_CONTROL-WORKSPACE_DETAIL-01, ACCESS_CONTROL-WORKSPACE_DETAIL-02 | 企业空间成员与角色：其 API 属于另一个聚合（且 `/workspaces/<name>/members` 在本集群返回 404），未迁移前不显示空表——空表会被读成「没有任何人有权限」。；企业空间编辑/删除：需要写接口与配额联动，另立功能点。 |
| 企业空间列表 | ACCESS_CONTROL-WORKSPACES-01, ACCESS_CONTROL-WORKSPACES-02 | 企业空间的配额与成员分配（属于企业空间内部页面）。 |

### platform-settings（平台作用域，4 个页面）

| 页面 | 验收场景 | 有意未迁移 |
| --- | --- | --- |
| 外观：深浅色与色调 | PLATFORM_SETTINGS-APPEARANCE-01 | 平台级强制主题（影响所有用户）。；自定义主色（任意取色）。 |
| 钉钉 / 企业微信 / Slack / Webhook 渠道 | PLATFORM_SETTINGS-CHANNELS-01, PLATFORM_SETTINGS-CHANNELS-02, PLATFORM_SETTINGS-CHANNELS-03 | 通知条件（alertSelector）与告警规则绑定。；用户级订阅。 |
| 平台信息 | PLATFORM_SETTINGS-INFO-01 | 编辑平台信息。 |
| 邮件通知渠道 | PLATFORM_SETTINGS-MAIL-01, PLATFORM_SETTINGS-MAIL-02, PLATFORM_SETTINGS-MAIL-03 | 其余四个渠道（钉钉/企业微信/Slack/Webhook）——下一轮，同一表单引擎。；用户级订阅（个人收件箱）。 |

## 重新生成

```
python3 prd/tools/build_prd.py           # catalog 与树保持一致
python3 prd/tools/check_docs.py --strict  # AC → 用例的覆盖门禁
python3 prd/tools/parity_check.py         # 老页面 → 新路由的映射缺口
```
