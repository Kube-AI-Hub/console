# 集群级配置 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-config.md)

## 概述

保密字典、配置字典、服务账号三页跨项目只读列表。三页各有一个页面组件，共用「项目 → 企业空间」索引与行键规则；数据分别走 `secretsApi`、`configMapsApi`、`serviceAccountsApi` 的 `namespace: ''` 读取。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01

## 设计目标与非目标

目标：三页一套列语义与链接规则；行内能进到对象所属项目；大集合有加载态与错误重试。
非目标：集群级写操作、按项目/类型的服务端筛选、自定义资源类型。

## 关键约束

- 读集群级 kapis 集合（无 namespace 段）；参数只有 `limit` / `page` / `sortBy` / `ascending` / `name`。
- 不做 `fieldSelector`：kapis 代理忽略它（迁移计划 §52 实测），筛选控件会变成死控件。
- 项目 → workspace 只读一次命名空间列表；链接解析不到时回落 `public`。
- 只读：页面不渲染创建/删除/编辑入口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01 — 三个页面文件，而不是一个带 kind 的组件

**为什么**：三页的专属列不同（类型 + 字段数 / 字段数 / 保密字典数），而且页面契约要求每个 `Page.tsx` 自己声明 `AiSurface` 状态；写成一个 kind 参数组件会让三个 Page 文件变成没有 `AiSurface` 的包装层，直接违反契约测试。共享部分收敛到 `useClusterProjectIndex` 与行键/链接函数，重复的只有列描述。
**被否方案**：一个 `ClusterConfigPage kind=…` 组件 + 三个薄包装。被否原因是契约与可读性，不是代码量。
**何时重新考虑**：出现第四、第五个同构配置资源，或三页的列开始分叉到需要各自的数据形状时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02 — 行键用「项目/名称」，不用名称

**为什么**：名称在跨项目列表里不唯一——`kube-root-ca.crt` 在每个命名空间都存在。名称单键会让 React 键重复，也让自动化的行定位器一次匹配多行，测试会随机失败。
**被否方案**：沿用工作负载页的 `data-ai-row=name`。工作负载的镜像/部署名通常唯一，配置对象不满足这个前提。
**何时重新考虑**：列表改为按项目分组渲染、每行不再跨项目时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03 — configmaps 用 `namespace: ''` 而不是 `scope: 'cluster'`

**为什么**：`configMapsApi` 的 `scope: 'cluster'` 生成的 URL 完全不带集群段；在成员集群页面上它会读成 **host** 集群的配置字典。`namespace: ''` + 默认项目作用域在 host 上同样是无 namespace 段的集合，在成员集群上保留 `clusters/<id>` 段，因此两种集群都读对。secrets / serviceaccounts 的 `resourceApi` 本身就是这个行为。
**被否方案**：三页统一显式传 `scope: 'cluster'`。只在 host 上验证过，成员集群会静默读错集群。
**何时重新考虑**：api-client 为 cluster scope 正确带上集群段之后。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02 — 页大小必须进查询键

六个集群列表（配置字典/保密字典/服务账号/网络策略/IP 池/持久卷声明）原本的 `queryKey` 只有
`page/sortBy/order/search`，没有页大小。把选择器接上以后，`pageSize` 变了但键没变，react-query
直接返回缓存——表现为「选择器显示 50、表格还是 20 行、也没有新请求」。页大小与页码一样是查询的一部分，
必须进键。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03 — 客户端分页的列表要自己切片

集群存储类列表一次取全量（`limit=200`）再本地排序，分页器也是客户端的。接上档位后如果只改分页器、
不按页切片，表格会把所有行都画出来而页码按钮点了没反应。该页现在按 `page/pageSize` 切片，
并在 `useMemo` 依赖里带上两者。

### GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02 — 用例要等新请求落地

切换档位后列表会经历一次 loading；过早读行数会拿到上一页的 20 行（本批第一轮探测就踩到）。
用例断言 `limit=50` 的请求出现且 surface 离开 loading 之后再数行。
## 系统现状

老 console 在集群管理的「配置」分组下有这三页，列含 PROJECT，行内可跳项目。项目作用域的三页（可编辑）已在 `pages/{secrets,configmaps,serviceaccounts}` 交付；本方案只补集群作用域只读视图，编辑仍在项目页。registry 条目与 `cluster.config.*` 标题键已存在，路由目录与页面需新建。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterSecretsPage.tsx`、`ClusterConfigMapsPage.tsx`、`ClusterServiceAccountsPage.tsx`
- 共用：`apps/console-next/src/pages/cluster/useClusterProjectIndex.ts`（项目索引、链接、行键）
- 路由：`routes/kube-frontend.clusters.$cluster/{secrets,configmaps,serviceaccounts}/{route,index}.tsx`
- 注册：`areas/registry.ts` 的 `groupKey: 'cluster.nav.groupConfig'`（已预置）
- 用例：`tests/ui/specs|tests/kube-frontend/cluster-management/`

## 对外契约

| 用途 | 路径 | 参数 |
| --- | --- | --- |
| 保密字典（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/secrets | limit, page, sortBy, ascending, name |
| 配置字典（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/configmaps | 同上 |
| 服务账号（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/serviceaccounts | 同上 |
| 命名空间（取 workspace） | /kapis/resources.kubesphere.io/v1alpha3/namespaces | limit=500 |

## 不变量

1. 行数 = `min(20, total)`。
2. 项目列 = 对象的 `metadata.namespace`。
3. 名称链接含 `/projects/<namespace>/<kind>/<name>`，并带 workspace 段。
4. 三页都不出现项目工作区栏，也没有写操作。

## 已知坑

- **代理忽略 fieldSelector**：筛选不做（迁移计划 §52）。别把「按项目筛选」做成前端过滤当前页，那只会筛 20 行。
- **名称跨项目不唯一**：行键必须是项目/名称（DEC-02）。
- **configmaps 的 scope 语义**：`scope: 'cluster'` 丢集群段（见本文件关于 scope 语义的历史决策）。
- **locale 键是项目级复用的**：`secrets.column.fieldCount`（en 为 Keys）、`configmaps.column.keys`、`serviceaccounts.column.secrets` 来自项目页词典；没有专门的 `cluster.config.column.*`。要改中文措辞（键数/密钥数）需要先加 locale 键。
- **集群级列表慢**：首屏可达数秒，测试与页面都要用大于默认 20 秒的等待。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01.yaml`
- 可观测点：`cluster-secrets:surface` / `cluster-configmaps:surface` / `cluster-serviceaccounts:surface`（`data-ai-state` 为 loading/ready/empty/error），搜索框 `<ai id>:search`，行句柄 `data-ai-row=<namespace>/<name>`。
- 失败可从 DOM 读到错误面板与重试按钮（`<ai id>:retry`）。

## 后续改进

- 补 `cluster.config.column.*` locale 键，让中文列标题直接叫「键数 / 密钥数」。
- 服务端支持跨项目筛选后，再加项目/类型下拉（当前做会是不生效的控件）。
- 成员集群上的三页集成验证（本环境只有 host 集群）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03 — 集群级配置字典补写入口，按行寻址、联邦对象不渲染操作

**为什么**：集群级配置字典此前是只读的，而它的用途恰恰是「刚在跨项目列表里找到那个键」——找到之后不能改，等于让人再跳一次项目页。旧 console 的集群配置页有编辑信息/编辑 YAML/编辑设置/删除，本次补回同样四项。

**按行寻址**：每一行的写都用**该行自己的 namespace**；用页面的（空）命名空间会拼出 `/api/v1/configmaps/<name>` 这种没有 `namespaces/<ns>` 段的路径，404 而对象还在（项目页的 `useDeleteConfigMaps` 注释记过同一个坑）。

**联邦托管对象不渲染操作**：`kubefed.io/managed=true` 的对象是控制面副本的投影，在这里改会被联邦控制器覆盖；隐藏入口比让写入失败更诚实。

**不逐行做 SSAR**：跨项目列表里每行属于不同命名空间，逐行权限检查是 N 次请求；写入失败时 `MutationAlert` 显示服务端原因（403 会带命名空间与资源）。这是本页与项目页的差异，已在此记录。

**不做批量删除**：跨项目的批量删除无法在一次确认里说明「哪些项目的哪些对象」，旧页也没有；单条删除足够。


### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-04 — 集群级保密字典沿用配置字典的写入口径

**为什么**：保密字典与配置字典是同一类跨项目对象，写入口的形状必须一致：按行所属项目寻址、联邦托管对象不渲染操作、失败由 `MutationAlert` 显示服务端原因。差异只有一处——镜像仓库类型且非默认的行多一个「设为默认镜像仓库」，它写的是同一命名空间里的默认标记，所以「旧默认」也在该行自己的项目里查（`useDefaultRegistrySecret` 按行命名空间取）。

**被否方案**：把「设为默认」做成批量或做成列表级开关。默认标记是单值语义，一次只能有一个默认；批量设置只会互相覆盖。

**何时重新考虑**：平台支持按命名空间多默认仓库时，与项目页一起改成「默认仓库」管理入口。


### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-05 — 集群级服务账号沿用同一写入口径，角色修改按行所属项目

**为什么**：三张跨项目配置页（配置字典 / 保密字典 / 服务账号）是同一类对象，写入口的形状必须一致：按行所属项目寻址、联邦托管对象不渲染操作、失败由 `MutationAlert` 显示服务端原因。服务账号的差异是「修改角色」——它写的是该**项目**里的 RoleBinding，而对话框列出的角色也是该项目能提供的，所以角色修改天然属于行而不是页面。

**被否方案**：在集群页只做「删除」，把编辑与角色留给项目页。这正是上一版的做法，结果是「在集群列表里找到账号后还要再跳一次」；旧 console 的集群页本来就有这四项。

**被否方案**：集群页提供跨项目的统一角色列表。角色是项目作用域对象，跨项目列表里根本没有「同一个角色」。

**何时重新考虑**：平台支持集群级角色模板并允许跨项目套用时，「修改角色」要改成选择模板。

