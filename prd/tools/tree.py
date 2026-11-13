"""智算平台功能树的源。

新增模块 / 子模块 / 功能点只改这里，然后跑 `python3 prd/tools/build_prd.py`：
它会同步 `prd/catalog.yaml`，并只为缺失的条目补需求稿、技术方案稿与 L1/L2 用例桩。
已有 Markdown 一律不动。

字段约定
--------
- `id`：路径段，用小写与连字符；会进用例 ID，所以不要用下划线（下划线留给功能名）。
- `tests.L1/L2`：该层的用例 ID，`build_prd.py` 会为缺失的生成桩。
- 功能点不需要写 `tests`：L3 用例 ID 由 `tc_id()` 按 `TC-L3-<模块>-<子>-<功能>-01` 推导。
"""

from __future__ import annotations

MODULES = [
    {
        "id": "console-core",
        "title": "控制台基础",
        "goal": "让控制台在资源不存在、无权限、加载失败时给出可读的中文反馈，并把用户送回能继续操作的上一级页面，而不是停在空转的详情页上。",
        "tests": {"L1": ["TC-CORE-CONSOLE-CORE-01"]},
        "submodules": [
            {
                "id": "resource-detail",
                "title": "资源详情页",
                "goal": "详情页的公共骨架：加载、不存在、无权限三种结果都收敛到确定的页面状态，提示走 i18n，回退目标取该页自己的列表入口。",
                "tests": {"L2": [
                    "TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01",
                    "TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-02",
                ]},
                "features": [
                    {
                        "id": "not-found",
                        "title": "资源不存在",
                        "tests": {"L3": [
                            "TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01",
                            "TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02",
                        ]},
                    },
                ],
            }
        ],
    },
    {
        "id": "cluster-gpu",
        "title": "集群算力",
        "goal": "让运维看清每张 GPU 卡的真实健康状态，故障卡一眼可辨，不被健康卡掩盖。",
        "tests": {"L1": ["TC-CORE-CLUSTER-GPU-01"]},
        "submodules": [
            {
                "id": "gpu-card",
                "title": "显卡列表",
                "goal": "节点页与集群页的显卡列表显示每张卡的健康状态；被 device plugin 摘除的故障卡仍显示且标为亚健康。",
                "tests": {"L2": ["TC-FULL-CLUSTER-GPU-GPU_CARD-01"]},
                "features": [
                    {
                        "id": "health",
                        "title": "健康状态",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01",
                            "TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02",
                        ]},
                    },
                ],
            },
            {
                "id": "vgpu-mode",
                "title": "vGPU 模式",
                "goal": "节点维度的 GPU 虚拟化方式可切换、可观察：选哪种模式、切完什么时候生效、切完资源名与容量对不对。",
                "tests": {"L2": ["TC-FULL-CLUSTER-GPU-VGPU_MODE-01"]},
                "features": [
                    {
                        "id": "switch",
                        "title": "设置 vGPU 模式",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01",
                            "TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02",
                        ]},
                    },
                    {
                        "id": "capacity",
                        "title": "vGPU 资源就绪",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01",
                            "TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02",
                        ]},
                    },
                ],
            },
            {
                "id": "gpu-monitor",
                "title": "GPU 监控",
                "goal": "节点、卡、容器/POD 三个维度的 GPU 指标口径一致；不同厂商、不同虚拟化方式用同一套指标名展示。",
                "tests": {"L2": ["TC-FULL-CLUSTER-GPU-GPU_MONITOR-01"]},
                "features": [
                    {
                        "id": "node-metrics",
                        "title": "节点维度指标",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_MONITOR-NODE_METRICS-01",
                        ]},
                    },
                    {
                        "id": "card-metrics",
                        "title": "卡维度指标",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01",
                        ]},
                    },
                    {
                        "id": "pod-metrics",
                        "title": "容器/POD 维度指标",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01",
                        ]},
                    },
                    {
                        "id": "vendor-dispatch",
                        "title": "厂商与虚拟化方式分派",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01",
                        ]},
                    },
                ],
            },
        ],
    },
    {
        "id": "cluster-storage",
        "title": "集群存储",
        "goal": "让运维看清集群共享存储的容量、配额与性能，并能安全地调整配额。",
        "tests": {"L1": ["TC-CORE-CLUSTER-STORAGE-01"]},
        "submodules": [
            {
                "id": "shared-storage",
                "title": "共享存储（JuiceFS）",
                "goal": "一页看清共享卷的配额、用量与性能；配额改动即时生效且不会被下一次挂载改回。",
                "tests": {"L2": ["TC-FULL-CLUSTER-STORAGE-SHARED_STORAGE-01"]},
                "features": [
                    {
                        "id": "overview",
                        "title": "概览",
                        # 一个功能点可以有多条 L3 用例（数值、可读性、提示各一条）。
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01",
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02",
                        ]},
                    },
                    {
                        "id": "quota",
                        "title": "卷与配额",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01",
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02",
                        ]},
                    },
                    {
                        "id": "performance",
                        "title": "性能",
                        "tests": {"L3": [
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01",
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02",
                            "TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03",
                        ]},
                    },
                ],
            }
        ],
    },
    {
        "id": "kube-frontend",
        "title": "新前端",
        "goal": "用 Apache 2.0 的 kube-frontend 替代 AGPL 的 console 页面：同一批资源用 schema 驱动重建，界面可被智能体操作，移动端可用。",
        "tests": {"L1": ["TC-CORE-KUBE-FRONTEND-01"]},
        "submodules": [
            {
                "id": "configmaps",
                "title": "配置字典",
                "goal": "项目内的 ConfigMap 列表能列出真实数据、按名称搜索、按名称与创建时间排序、分页，并能删除单条或所选多条。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-CONFIGMAPS-01"]},
                "features": [
                    {
                        "id": "list",
                        "title": "配置字典列表",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04",
                        ]},
                    },
                    {
                        "id": "search",
                        "title": "按名称搜索",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02",
                        ]},
                    },
                    {
                        "id": "delete",
                        "title": "删除配置字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02",
                        ]},
                    },
                    {
                        "id": "detail",
                        "title": "配置字典详情",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02",
                        ]},
                    },
                    {
                        "id": "create",
                        "title": "创建配置字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03",
                        ]},
                    },
                    {
                        "id": "edit",
                        "title": "编辑配置字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03",
                        ]},
                    },
                    {
                        "id": "ai-surface",
                        "title": "智能体可操作性",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02",
                        ]},
                    },
                    {
                        "id": "mobile",
                        "title": "移动端适配",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01",
                            "TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02",
                        ]},
                    },
                ],
            },
            {
                "id": "secrets",
                "title": "保密字典",
                "goal": "项目内的 Secret 能按类型正确展示与编辑：Opaque / TLS / 镜像仓库 / 用户名密码各自有对应的录入与展示方式，明文默认遮挡，镜像仓库密钥可设为默认。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-SECRETS-01"]},
                "features": [
                    {
                        "id": "list",
                        "title": "保密字典列表",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SECRETS-LIST-01",
                            "TC-L3-KUBE-FRONTEND-SECRETS-LIST-02",
                        ]},
                    },
                    {
                        "id": "search",
                        "title": "按名称搜索",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01",
                        ]},
                    },
                    {
                        "id": "detail",
                        "title": "保密字典详情",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01",
                            "TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02",
                        ]},
                    },
                    {
                        "id": "create",
                        "title": "创建保密字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SECRETS-CREATE-01",
                            "TC-L3-KUBE-FRONTEND-SECRETS-CREATE-02",
                            "TC-L3-KUBE-FRONTEND-SECRETS-CREATE-03",
                        ]},
                    },
                    {
                        "id": "edit",
                        "title": "编辑保密字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SECRETS-EDIT-01",
                            "TC-L3-KUBE-FRONTEND-SECRETS-EDIT-02",
                            "TC-L3-KUBE-FRONTEND-SECRETS-EDIT-03",
                        ]},
                    },
                    {
                        "id": "delete",
                        "title": "删除保密字典",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SECRETS-DELETE-01",
                        ]},
                    },
                    {
                        "id": "ai-surface",
                        "title": "智能体可操作性",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01",
                        ]},
                    },
                    {
                        "id": "mobile",
                        "title": "移动端适配",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01",
                        ]},
                    },
                ],
            },
            {
                "id": "serviceaccounts",
                "title": "服务账户",
                "goal": "项目内的 ServiceAccount 可浏览、创建、改角色；详情能从关联的 token Secret 生成 kubeconfig 并复制下载，让命令行访问不必再去拼证书。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-SERVICEACCOUNTS-01"]},
                "features": [
                    {
                        "id": "list",
                        "title": "服务账户列表",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01",
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-02",
                        ]},
                    },
                    {
                        "id": "search",
                        "title": "按名称搜索",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01",
                        ]},
                    },
                    {
                        "id": "detail",
                        "title": "服务账户详情与 kubeconfig",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01",
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02",
                        ]},
                    },
                    {
                        "id": "create",
                        "title": "创建服务账户",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01",
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02",
                        ]},
                    },
                    {
                        "id": "edit",
                        "title": "编辑服务账户",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01",
                        ]},
                    },
                    {
                        "id": "role",
                        "title": "修改角色",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01",
                        ]},
                    },
                    {
                        "id": "delete",
                        "title": "删除服务账户",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01",
                        ]},
                    },
                    {
                        "id": "ai-surface",
                        "title": "智能体可操作性",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01",
                        ]},
                    },
                    {
                        "id": "mobile",
                        "title": "移动端适配",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01",
                        ]},
                    },
                ],
            },
            {
                "id": "platform-settings",
                "title": "平台设置",
                "goal": "平台自身的配置：平台名称/描述/控制台地址，以及五种通知渠道是否已配置。两者都只读——渠道凭据是可读性受限的 Secret，编辑属于平台侧表单。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01"]},
                "features": [
                    {
                        "id": "info",
                        "title": "平台信息",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01"]},
                    },
                    {
                        "id": "notifications",
                        "title": "通知渠道",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01"]},
                    },
                ],
            },
            {
                "id": "access-control",
                "title": "访问控制",
                "goal": "平台级的三张表：用户（状态、平台角色、最近登录）、平台角色（规则数、是否模板）、企业空间（状态、集群关联）。这些记录不属于任何项目，页面不出现项目工作区栏。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01"]},
                "features": [
                    {
                        "id": "users",
                        "title": "用户列表",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01", "TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02", "TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05", "TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06"]},
                    },
                    {
                        "id": "platform-roles",
                        "title": "平台角色列表",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01", "TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-02", "TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-04"]},
                    },
                    {
                        "id": "workspaces",
                        "title": "企业空间列表",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01"]},
                    },
                    {
                        "id": "workspace-detail",
                        "title": "企业空间详情",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01", "TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02"]},
                    },
                    {
                        "id": "user-detail",
                        "title": "用户详情",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01"]},
                    },
                ],
            },
            {
                "id": "workbench",
                "title": "工作台",
                "goal": "工作台是进入项目控制台的入口：按企业空间列出项目，点项目进入该项目；顶部「工作台」入口必须可达。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-WORKBENCH-01"]},
                "features": [
                    {
                        "id": "entry",
                        "title": "工作台入口",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-01"]},
                    },
                    {
                        "id": "context",
                        "title": "项目上下文栏",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-WORKBENCH-CONTEXT-01"]},
                    },
                ],
            },
            {
                "id": "cluster-management",
                "title": "集群管理",
                "goal": "集群级视角：节点按就绪状态、角色与可分配资源展示；项目列出集群内全部项目空间及其所属企业空间。这些页面不属于任何项目，因此没有项目工作区栏。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01"]},
                "features": [
                    {
                        "id": "overview",
                        "title": "集群概览",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01"]},
                    },
                    {
                        "id": "nodes",
                        "title": "节点列表",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01", "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03", "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04"]},
                    },
                    {
                        "id": "components",
                        "title": "系统组件",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01"]},
                    },
                    {
                        "id": "cluster-edit-info",
                        "title": "编辑集群信息",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01"]},
                    },
                    {
                        "id": "cluster-switch",
                        "title": "集群切换与作用域侧栏",
                        "tests": {
                            "L3": [
                                "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01",
                                "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02",
                            ]
                        },
                    },
                    {
                        "id": "add-cluster",
                        "title": "添加集群",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01"]},
                    },
                    {
                        "id": "persistent-volumes",
                        "title": "持久卷",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01", "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02"]},
                    },
                    {
                        "id": "storage-classes",
                        "title": "存储类型",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01", "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02"]},
                    },
                    {
                        "id": "projects",
                        "title": "项目列表",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01"]},
                    },
                    {
                        "id": "settings",
                        "title": "集群设置",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01"]},
                    },
                    {
                        "id": "visibility",
                        "title": "集群可见性",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01"]},
                    },
                    {
                        "id": "cluster-members",
                        "title": "集群成员",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01"]},
                    },
                    {
                        "id": "log-collections",
                        "title": "集群日志收集",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01"]},
                    },
                    {
                        "id": "monitor",
                        "title": "集群监控",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01"]},
                    },
                    {
                        "id": "node-usage",
                        "title": "节点用量",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01"]},
                    },
                    {
                        "id": "cluster-list",
                        "title": "集群列表",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01",
                            "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-03",
                            "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-04",
                        ]},
                    },
                    {
                        "id": "custom-resources",
                        "title": "自定义资源",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01",
                            "TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-02",
                        ]},
                    },
                ],
            },
            {
                "id": "project-settings",
                "title": "项目设置",
                "goal": "项目可访问性与权限：项目角色按规则数与是否模板展示，详情列出权限规则；项目成员按状态、角色与最近活动展示。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01"]},
                "features": [
                    {
                        "id": "base-info",
                        "title": "项目基本信息",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01"]},
                    },
                    {
                        "id": "roles",
                        "title": "项目角色列表",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01", "TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-04"]},
                    },
                    {
                        "id": "role-rules",
                        "title": "角色权限规则",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01"]},
                    },
                    {
                        "id": "network-isolation",
                        "title": "网络隔离",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01"]},
                    },
                    {
                        "id": "members",
                        "title": "项目成员列表",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01", "TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02"]},
                    },
                    {
                        "id": "gateway",
                        "title": "网关设置",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01"]},
                    },
                    {
                        "id": "logging",
                        "title": "日志收集",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01"]},
                    },
                ],
            },
            {
                "id": "monitoring",
                "title": "监控告警",
                "goal": "项目内的告警消息与告警策略各自一张列表：消息按触发状态与级别展示，策略按启用状态与规则数展示；模块未安装时页面显示空态而不是报错。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-MONITORING-01"]},
                "features": [
                    {
                        "id": "alerts",
                        "title": "告警消息列表",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01"]},
                    },
                    {
                        "id": "rules",
                        "title": "告警策略列表",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-MONITORING-RULES-01",
                            "TC-L3-KUBE-FRONTEND-MONITORING-RULES-02",
                            "TC-L3-KUBE-FRONTEND-MONITORING-RULES-03",
                            "TC-L3-KUBE-FRONTEND-MONITORING-RULES-04",
                        ]},
                    },
                ],
            },
            {
                "id": "storage",
                "title": "存储",
                "goal": "项目内的存储卷与存储卷快照能按老 console 的列展示：状态来自 PVC 的 phase 与扩容条件，容量与访问模式按原样呈现；详情给出持久卷/来源卷的对应关系。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-STORAGE-01"]},
                "features": [
                    {
                        "id": "list",
                        "title": "存储列表",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-STORAGE-LIST-01",
                            "TC-L3-KUBE-FRONTEND-STORAGE-LIST-02",
                        ]},
                    },
                    {
                        "id": "detail",
                        "title": "存储详情",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01"]},
                    },
                    {
                        "id": "edit-yaml",
                        "title": "编辑 YAML",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01"]},
                    },
                    {
                        "id": "delete",
                        "title": "删除存储对象",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-STORAGE-DELETE-01"]},
                    },
                ],
            },
            {
                "id": "app-workloads",
                "title": "应用负载",
                "goal": "项目内的八种应用负载（部署、有状态副本集、守护进程集、任务、定时任务、容器组、服务、应用路由）用一套列表与详情呈现：状态按老 console 的规则派生，重新部署只打 Pod 模板注解，写操作走正确的 API 组。",
                "tests": {"L2": ["TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01"]},
                "features": [
                    {
                        "id": "list",
                        "title": "工作负载列表",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01",
                            "TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02",
                        ]},
                    },
                    {
                        "id": "status",
                        "title": "状态派生",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01",
                        ]},
                    },
                    {
                        "id": "revisions",
                        "title": "版本历史与回滚",
                        "tests": {"L3": ["TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01"]},
                    },
                    {
                        "id": "detail",
                        "title": "负载详情",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01",
                        ]},
                    },
                    {
                        "id": "redeploy",
                        "title": "重新部署",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01",
                        ]},
                    },
                    {
                        "id": "edit-yaml",
                        "title": "编辑 YAML",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01",
                        ]},
                    },
                    {
                        "id": "edit-settings",
                        "title": "编辑设置",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01",
                        ]},
                    },
                    {
                        "id": "delete",
                        "title": "删除负载",
                        "tests": {"L3": [
                            "TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01",
                        ]},
                    },
                ],
            },
            
        ],
    },
]


def tc_id(module: str, sub: str, feature: str, index: int = 1) -> str:
    """L3 用例 ID：`TC-L3-<模块>-<子模块>-<功能>-<NN>`。

    模块段保留连字符（`CLUSTER-STORAGE`），子模块与功能段内的连字符换成下划线
    （`SHARED_STORAGE`、`API_KEYS`），与 csghub-server 的命名习惯一致。
    """
    seg = lambda value: value.upper().replace("-", "_")
    return f"TC-L3-{module.upper()}-{seg(sub)}-{seg(feature)}-{index:02d}"


def iter_nodes():
    """(level, module, sub, feature, title) 的扁平序列，供生成器使用。"""
    for mod in MODULES:
        yield 1, mod["id"], "", "", mod["title"]
        for sub in mod.get("submodules") or []:
            yield 2, mod["id"], sub["id"], "", sub["title"]
            for feat in sub.get("features") or []:
                yield 3, mod["id"], sub["id"], feat["id"], feat["title"]
