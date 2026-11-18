# 列表每页档位收口（2026-11-19）

> 本页记录：「每页条数（10/20/50/100）」在**一次读全、客户端分页**的 7 个列表上的收口，
> 以及把它固化成机械守卫。方法见[迁移指南](../legacy-ui-migration-guide.md)，模板见[单页交付模板](page-migration-template.md)。
> 这是能力级单元（CHECK-08 的最后一项），不是某一页的迁移：7 个页面各自的列表、详情与写入此前已交付。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群作用域为主（系统组件、集群成员、自定义资源、自定义资源实例、多集群、持久卷）＋项目作用域的灰度发布列表：在长列表里控制每屏行数，并知道总数 |
| 旧入口、源码版本 | 老 console 的 `Table` 统一带 `PAGESIZE_OPTION = [10, 20, 50, 100]`；7 个页面对应老页分别是灰度发布、集群成员、服务组件、扩展资源（列表/详情）、多集群、持久卷 |
| 新入口、构建 | `apps/console-next/src/pages/{app-workloads/CanaryReleasesPage,cluster/{ClusterMembersPage,ComponentsPage,CustomResourceDetailPage,CustomResourcesPage,MultiClusterListPage,PersistentVolumesPage}}.tsx`；`config/page-size-contract.test.ts` |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai` + 本地 preview 5178；admin |
| 明确排除及批准 | 不给这些聚合接口加服务端 `limit/page`（要改后端契约；集合规模几十到几百，客户端切片足够）——DEC-LIST-12 记被否方案 |
| 并行文件与安全边界 | 只改上述 7 个页面、契约测试、该能力 PRD/design/spec/tests 与受影响的既有用例；无写入操作 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-PAGESIZE-001 | 老 `Table` 的 `PAGESIZE_OPTION` | 列表有多于一页数据 | 灰度发布列表：10/20/50/100 | `CanaryReleasesPage` 客户端切片 + `canary:page-size` | AC-LIST-12 / TC-LIST-12 | 通过 |
| LEG-PAGESIZE-002 | 同上 | 同上 | 集群成员列表 | `ClusterMembersPage`（本地 page/pageSize 状态） | 同上 | 通过 |
| LEG-PAGESIZE-003 | 同上 | 同上 | 系统组件列表 | `ComponentsPage` + `components:page-size` | 同上（TC-LIST-12 主判定页） | 通过 |
| LEG-PAGESIZE-004 | 同上 | 同上 | 自定义资源实例列表 | `CustomResourceDetailPage` | 同上 | 通过 |
| LEG-PAGESIZE-005 | 同上 | 同上 | 自定义资源（CRD）列表 | `CustomResourcesPage` | 同上 | 通过 |
| LEG-PAGESIZE-006 | 同上 | 同上 | 多集群列表 | `MultiClusterListPage` | 同上 | 通过 |
| LEG-PAGESIZE-007 | 同上 | 同上 | 持久卷列表 | `PersistentVolumesPage` + `persistentvolumes:page-size` | 同上 | 通过 |
| LEG-PAGESIZE-008 | 无（新增守卫） | 每个构建 | 有 `pagination` 就必须有 `pageSizeOptions` | `config/page-size-contract.test.ts` 第 4 条 | 契约测试（1613 条通过） | 通过 |

## 3. 数据契约与全链路

| 能力 ID | 请求 | 返回类型 | 字段/口径 | 显示 | 缺值/边界规则 | 同次对账 |
| --- | --- | --- | --- | --- | --- | --- |
| 001–007 | 各页原有的整表读（kapis 聚合或 `/apis` 列表，一次读全） | JSON | `rows` | `rows.slice((currentPage-1)*size, currentPage*size)` | `total` 始终是 `rows.length`（不是当前页条数）；`currentPage = min(page, ceil(total/size))` 夹住页码，数据变少时不停在空页；切换档位由 `useResourceListState.setPageSize`（或成员页的手写回调）回到第 1 页 | 分页器文案「第 1-20 条，共 N 条」与接口条数一致 |

## 4. 交互、视觉与复用基线

- 选择器只在列表有多于一页数据时出现（`ResourceList` 既有规则），与旧 console 一致；不足一页时不分页。
- 翻页只换窗口，不发请求（这 7 个页面没有服务端分页）；因此「翻页时的加载态」不适用，列表不闪。
- 选择器句柄统一为 `<页面前缀>:page-size`，翻页按钮用共享的「上一页 / 下一页」文案。

## 5. 编码与回归

- [x] AC 承接功能、数据语义、边界与视觉；design 写 DEC（含被否方案与重考虑条件）。
- [x] 机械守卫：`config/page-size-contract.test.ts` 新增「有分页必须有档位」。
- [x] 既有用例按新默认值更新（3 条列表行数断言、2 条交互断言、1 条选择器选择器改为按句柄定位）。
- [x] 单元测试：`apps/console-next/test/list-page-size.test.tsx`（25 行数据，首屏 20、翻页到第 21 行、切 50 显示全部）。
- [x] 受影响的 10 条既有 E2E 串行复跑。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 8 条原子 ID：7 个页面 + 1 条守卫 | — |
| 数据语义 | 通过 | total 取全部行；页码夹住；档位切换回第 1 页（单测 + E2E） | — |
| 交互与权限 | 通过 | 选择器句柄与选项齐全；翻页不请求 | — |
| 视觉与主题 | 部分通过 | 1280 深色截图（TC-LIST-12） | 1024/1600、浅色、英文未单独截图 |
| 静态/类型/构建/测试 | 通过 | typecheck 0 error；架构契约 **1613 passed / 20 files**；应用单测 **302 passed / 50 files**（含新增 1 条）；build 成功；strict 门禁 errors=0 | — |
| 本地全栈/mlu370 | 通过 | 见 §7 | — |
| 新版部署/member/全站 | 未验收 | — | 生产部署、member、全站串行 E2E |

## 7. E2E（mlu370，`-n 0`）

| 用例 | 结果 |
| --- | --- |
| TC-LIST-12（新增，系统组件列表：首屏 20、总数 47、翻页、切 50） | 通过 |
| 受影响的既有用例：COMPONENTS-01、COMPONENT_DETAIL-01、CUSTOM_RESOURCES-01/02/REFRESH、CLUSTER_MEMBERS-01/02、PERSISTENT_VOLUMES-01/02/03 | 通过 |

命令：`KA_BASE_URL=https://ka.watering.ai KA_PASSWORD=<mlu370> pytest tests/kube-frontend/cluster-management tests/kube-frontend/configmaps/test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_12.py -q -n 0 -k "PERSISTENT_VOLUMES or COMPONENTS or COMPONENT_DETAIL or CUSTOM_RESOURCES or CLUSTER_MEMBERS or CONFIGMAPS_LIST_12"`
→ **11 passed, 130 deselected in 57.82s**。

首轮有 5 条失败，全部是**既有用例按旧默认值（一页显示全部行）写的断言**，按新契约更新后通过；其中 PV-03 的修法本身用上了新档位（切到 50/页 让受保护的 Bound 卷与新建卷同屏可选）。
