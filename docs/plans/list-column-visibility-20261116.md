# 列表「显示列」接入（配置/保密/服务账号/存储）

> 继续 R-31「列显隐」这条能力线。日期 2026-11-16。
> 规格：prd|design/kube-frontend/configmaps/list.md（AC-CONFIGMAPS-LIST-11、DEC/GOT-11）。

## 1. 本批范围（4 个列表）

| 页面 | 可隐藏列 | 说明 |
| --- | --- | --- |
| 配置字典 | 3（项目/字段/创建时间） | 名称不可隐藏 |
| 保密字典 | 4 | 同上 |
| 服务账号 | 4 | 同上 |
| 项目存储（PVC/快照等 kind） | 6 | 页面键按 kind 区分 |

## 2. 接入分两步（这轮踩到的坑）

1. schema 上声明 `columnVisibility`（标签/重置标签/aiId）；
2. 给需要可隐藏的列标 `hideable: true`。

只做第一步时，选择器里**只有「重置」一项**——`ResourceList` 只渲染 `hideable` 的列，而默认列都没标。
第一轮探测就撞上了这个（菜单项只有 `:columns:reset`），补上 `hideable` 后菜单立刻正常。

## 3. 实测（B200 host，admin，项目 default）

| 步骤 | 结果 |
| --- | --- |
| 打开「显示列」 | 菜单项：`configmaps:columns:project` / `:keys` / `:createTime` / `:reset` |
| 取消「项目」 | 表头 6 → 5 行，`localStorage['kube-frontend.columns.configmaps'] = ["name","keys","createTime"]` |
| 点「重置」 | 表头恢复 6 |
| 名称列 | 不在可隐藏菜单里 |

## 4. 验证与证据

| 维度 | 状态 | 证据 |
| --- | --- | --- |
| 旧能力覆盖 | 通过（4 页） | 旧 console 的「列设置」在这些列表都有 |
| 交互 | 通过 | 用例逐页验证：菜单项、表头数变化、持久化、刷新后保持、重置恢复 |
| 视觉 | 通过（人工） | `/tmp/columns-menu.png` |
| 静态/类型/构建/测试 | 通过 | scoped 门禁 0/0；console-next tsc 0；vite build ✓；新用例 passed（12.42s）；四模块串行回归见下 |
| 未验收 | — | 其余 43 个多列列表仍未接入；浅色主题、部署环境、member 与全站串行 E2E |

## 5. 剩余

还有 43 个多列列表没有「显示列」（集群网关、告警策略、商店管理、联邦、工作负载等）。接入方式已经固定为两步，
每页改动约 3 处（import、schema、ResourceList props）+ 列上的 `hideable`。

## 6. 第二批（同日）：告警策略 / 联邦项目 / 集群告警消息

| 页面 | 可隐藏列 | 页面键 | 表格 aiId |
| --- | --- | --- | --- |
| 告警策略 | 4（启用/规则数/类型/创建时间） | `rule-groups` | `alertingrules:surface` |
| 联邦项目 | 4（命名空间/集群/传播状态/创建时间） | `federated-projects` | `federated-projects:surface` |
| 集群告警消息 | 6（摘要/状态/级别/规则组/来源/触发时间） | `cluster-alerting-messages` | 同名 |

用例 `CONFIGMAPS-LIST-11` 已扩到 **7 个页面**（前四个 + 这三个），逐页验证菜单项、取消勾选后表头减一、
持久化、刷新后保持、重置恢复，并断言名称列不在可隐藏菜单里（25.73s）。

第二批踩到的两个坑：

1. **hook 必须放在 schema 之后**：`columnKeys` 依赖 `schema.columns`，放在 `const state =` 之前（schema 之前）会报
   「used before its declaration」。
2. **surface 的 aiId 未必等于前缀**：告警策略页的 surface 是 `alertingrules:surface`，而列菜单前缀是
   `rule-groups`；用例需要为每页单独给出 surface 前缀。

## 7. 仍待接入

约 40 个多列列表（集群网关 17 列、商店管理 3 张表、多集群列表、工作空间成员、JuiceFS、集群自定义监控等）。
商店管理这类**一页多表**的页面需要为每张表分别接线，不能套用单表脚本。

## 8. 回归中两条 access-control 失败（已确认非本批引入）

三模块串行回归出现 2 条失败：`ACCESS_CONTROL_USERS_05`、`ACCESS_CONTROL_WORKSPACE_CONSOLE_05`（用户组名称生成的
等待超时）。单独串行重跑这两条 **2 passed（26.15s）**，且本批没有改动访问控制相关页面——属于长跑/并发下的
等待敏感用例，与列显隐改动无关。这与「长跑退化」的记录一致：判定按「失败单条复跑」。

## 9. 第三批（同日）：集群列表 / 企业空间成员 / 集群成员 / JuiceFS 存储

| 页面 | 可隐藏列 | 页面键 | surface aiId |
| --- | --- | --- | --- |
| 集群列表 | 5（就绪/角色/K8s 版本/节点数/创建时间） | `clusters` | 同名 |
| 企业空间成员 | 4（用户名/角色/状态/最近登录） | `workspace-members` | 同名 |
| 集群成员 | 4（用户名/状态/角色/最近登录） | `cluster-members` | 同名 |
| JuiceFS 存储 | 5（状态/容量/已用/节点/创建时间） | `juicefs` | **`cluster-juicefs`** |

用例 `CONFIGMAPS-LIST-11` 已扩到 **11 个页面**（41.91s 通过）。

第三批的处理方式：`columnVisibility` 直接插在 `columns: [` 之前（不依赖 `sortAiPrefix`，这四个页面都没有），
`hideable` 只加在多行写法的列上。踩到的坑：**JuiceFS 页的 surface aiId 是 `cluster-juicefs:surface`**，
而列菜单前缀是 `juicefs`——用例必须分开给出。

## 10. 仍未接入（约 36 个）

集群网关（双 schema、双页签，需按页签分键）、商店管理（一页三表）、工作负载以外的多数详情内表格、
集群自定义监控、访问控制的若干列表等。商店管理与集群网关都属于「一页多表/多 schema」，需要逐表接线。

## 11. 第四批（同日）：应用商店管理（一页三表）

商店管理的应用/分类/审核三个视图各自独立接入列显隐：三份 schema、三个存储键
（`store-manage:{apps,categories,reviews}`）、三个列表实例。用例 `APP_STORE-MANAGE-02`
按视图分别验证菜单项、表头减一、持久化与重置（13.7s 通过）。

这批暴露了一个**共享组件的限制**：`ResourceList` 的列选择器渲染在工具栏里，而工具栏只在
`search`/`filters`/`refresh` 至少有一项时出现。三张表原本都没有工具栏，于是「接了列显隐却看不到选择器」。
第一次的修法是给三张表各加一个刷新按钮——结果与页面级的单一刷新重复，打断了既有用例
`APPSTORE_LISTS_REFRESH_01`（它断言管理页只有一个 `:refresh`）。

**最终修法**：把 `columnVisibility` 也纳入 `hasToolbar` 的判断（共享组件一行改动），三张表不加刷新按钮。
既让选择器出现，也保持「管理页只有一个页面级刷新」的既有约定。

## 12. 本轮发现的环境数据漂移（非代码问题）

`APP_STORE-INSTALL-01` 串行复跑仍失败：安装弹窗提交时报「请选择项目。」。排查结果：

| 企业空间 | 项目数 | 备注 |
| --- | --- | --- |
| `public` | **0** | 用例原先偏好的 `spaces` / `csghub` 已不存在 |
| `system-workspace` | 16 | 全是系统命名空间（istio-system、kubeedge…） |

用例的偏好列表 `('public','spaces')` / `('public','csghub')` 都落空，于是退到系统命名空间；安装弹窗对这些
项目的可选状态与用例预期不一致。**这是共享环境的项目数据被清理导致的**，不是本轮改动引入；需要在环境侧
恢复一个可安装的项目，或让该用例自己创建项目（已登记为待办）。

## 13. 第五批（同日）：集群网关（双 schema + 双页签）

集群网关页用同一个 `ResourceList` 渲染两个页签，schema 按 `component` 切换。接入方式与前几批不同：

- 两份 schema（`clusterSchema` / `projectSchema`）各声明一份 columnVisibility，aiId 分别为
  `cluster-gateways:cluster:columns` 与 `:project:columns`；
- 活动 schema 由 `component` 派生，存储键带页签名（`cluster-gateways:<tab>`），两个页签互不影响；
- 用例 `CLUSTER_GATEWAYS-02` 验证两页签各自的菜单、取消勾选后表头减一、存储键不同、重置恢复。

本批的两个坑：

1. **单行列定义**：该文件里既有**多行**列定义、也有**单行**（`{ key: 'ready', title: …, render: … }`）。
   只按行匹配 `key: 'x',` 的脚本会漏掉单行写法，第一次探测「集群网关」页签只剩「重置」一项。
2. **rowActions 里也有 `key:`**：批量加 `hideable` 会误加到 action 上，`tsc` 报「`hideable` 不存在于
   `ListAction`」。必须把插入范围限制在 `columns: [` 块内。

第三个坑属于用例：**项目网关页签在本集群没有对象**，`thead` 数量为 0，断言「表头减一」必然失败；
用例改为「有表头时断言减一，无表头时断言仍为 0 并依赖持久化值」。

## 14. 第六批（同日）：集群配置与存储六个列表

| 页面 | 页面键 | 可隐藏列（菜单项数） |
| --- | --- | --- |
| 集群配置字典 | `cluster-configmaps` | 4（命名空间/字段/创建时间…） |
| 集群保密字典 | `cluster-secrets` | 5 |
| 集群服务账号 | `cluster-serviceaccounts` | 4 |
| 集群网络策略 | `cluster-networkpolicies` | 5 |
| 集群持久卷 | `persistent-volumes` | 7 |
| IP 池 | `ip-pools` | 5 |

用例 `CONFIGMAPS-LIST-11` 已扩到 **17 个页面**（72.86s 通过）。这批全部是单表页面，套用固定四步即可，
唯一需要注意的是 surface 的 aiId：**持久卷页是 `persistentvolumes:surface`**（无连字符），而列菜单前缀是
`persistent-volumes`——又一次印证「surface 前缀 ≠ 列表前缀」是固定检查项。

## 15. 剩余

还有 **28 个**带表格的页面没有列选择器：应用商店的若干列表（已安装应用、企业空间应用/仓库、详情内表）、
集群告警策略、集群自定义监控、组件页、扩展资源与 CRD 详情、DevOps 工程、监控的自定义监控、
项目设置网络隔离、企业空间的成员详情/项目/配额/角色/用户组、节点排行面板等。

## 16. 第七批（同日）：集群存储与扩展资源六页

| 页面 | 页面键 | 菜单项数 |
| --- | --- | --- |
| 集群持久卷声明 | `cluster-pvc` | 7 |
| 集群卷快照 | `cluster-volume-snapshots` | 6 |
| 集群快照类 | `cluster-snapshot-classes` | 5 |
| 存储类 | `storageclasses` | 6 |
| 集群告警策略 | `cluster-alerting-policies` | 5 |
| 自定义资源 | `custom-resources` | 5 |

用例 `CONFIGMAPS-LIST-11` 扩到 **23 个页面**（123.27s 通过）。

本批新增一条用例侧的通用护栏：**空表页签/空列表没有 thead**。集群卷快照在本集群没有对象，
「取消勾选后表头减一」必然失败；用例改为「有表头时断言减一、无表头时断言仍为 0，并以持久化值为准」。
这条同样适用于上一批的集群网关项目页签——已经固化成同一种写法。

## 17. 剩余

还有 **22 个**带表格的页面没有列选择器：应用商店家族（已安装应用、企业空间应用/仓库、详情内表、
Canary 发布）、集群组件页/自定义监控/资源监控/节点排行/GPU 容器组面板、CMDB 类（DevOps 工程）、
监控的自定义监控、项目设置网络隔离、企业空间家族（成员详情/项目/配额/角色/用户组）。

## 18. 第八批（同日）：企业空间家族四页 + 项目网络隔离

| 页面 | 页面键 | 菜单项数 |
| --- | --- | --- |
| 企业空间项目 | `workspace-projects` | 5 |
| 企业空间角色 | `workspace-roles` | 3 |
| 企业空间配额 | `workspace-quota` | 5 |
| 项目网络隔离 | `network-isolation` | 4 |

用例 `CONFIGMAPS-LIST-11` 扩到 **27 个页面**（157.94s 通过）。

**企业空间用户组页本轮回滚**：它是一棵「用户组 + 展开后的成员表」的树，成员表 schema 叫 `memberSchema`、
另有 `addMemberSchema`（对话框内的表），页面里没有 `schema` 变量。脚本套用单表模板后 hook 引用了不存在的
`schema`，`tsc` 立刻报错——已回滚该文件，登记为「需要逐表接线（树 + 对话框内表）」的页面。

## 19. 剩余

还有 **18 个**带表格的页面：应用商店家族（已安装应用、企业空间应用/仓库、详情内表、Canary）、
集群组件页 / 自定义监控 / 资源监控 / 节点排行 / GPU 容器组面板、DevOps 工程、监控自定义监控、
企业空间成员详情/用户组。其中**面板类**（GPU 容器组、节点排行）是嵌在宿主页里的子表，需要独立页面键。

## 20. 第九批（同日）：应用商店、DevOps、组件与边缘节点六页

| 页面 | 页面键 | 菜单项数 | 备注 |
| --- | --- | --- | --- |
| 已安装应用 | `installed-apps` | 6 | 两个真实路由（企业空间 `/apps/instances` 与项目 `/applications`） |
| 企业空间应用 | `workspace-apps` | 6 | |
| 企业空间仓库 | `workspace-repos` | 6 | |
| DevOps 工程 | `devops-projects` | 4 | 本集群无工程时列表为空 |
| 系统组件 | `components` | 3 | |
| 边缘节点 | `edge-nodes` | 4 | |

用例 `CONFIGMAPS-LIST-11` 扩到 **33 个页面**（159.08s 通过）。

**又一个 surface 前缀不同的页面**：边缘节点的 surface 是 `edgenodes:surface`（无连字符），列菜单前缀是
`edge-nodes`；DevOps 页的 surface 是 `devops:surface`、前缀是 `devops-projects`。至此「surface 前缀 ≠ 列表前缀」
已在 5 个页面上出现，用例里每一页都显式给出 surface 前缀。

## 21. 回归中发现的三个与列显隐无关的问题（均已处理）

| 问题 | 处理 |
| --- | --- |
| 两个 app-store 用例 `from conftest import ApiClient` 报 ImportError | pytest 把 `conftest` 解析到了别的模块（多 conftest 同名）；改成文档规定的 `from helpers.api import ApiClient`，两条恢复通过 |
| 边缘节点用例 502 `ECONNREFUSED 127.0.0.1:18088` | SSH 隧道中断；重启后单跑通过 |
| 企业空间仓库用例弹窗未关闭 | 单跑通过（等待敏感） |

三条复跑合计 **4 passed（41.34s）**，确认与本批改动无关。
