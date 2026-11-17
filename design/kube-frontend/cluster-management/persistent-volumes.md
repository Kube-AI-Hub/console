# 持久卷（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/persistent-volumes.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-05

## 概述

集群级持久卷列表与详情：读取卷的归属与回收策略，编辑信息/YAML，并在状态约束下删除（Bound/Released 不可删）。

## 设计目标与非目标

目标：一眼看出「谁在用、释放后怎样」；写能力按状态分级（编辑随时可用，删除受 `Bound` / `Released` 约束）。非目标：创建持久卷、查看卷内文件。

## 关键约束

- 集群级集合，读核心 API。
- 全量取回后本地排序与搜索。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-PERSISTENT-VOLUMES-01 — 读核心 API，不走 kapis 代理

**为什么**：同一个列表实测差异巨大——核心 `/api/v1/persistentvolumes` **24 秒**，kapis 代理 **63 秒**。页面只需要标准字段，多出来的 KubeSphere 注解不值一分钟等待。

**被否方案**：走 kapis 以复用统一的分页/排序参数。代价是两倍以上的等待，而排序在前端做即可。

**何时重新考虑**：kapis 的持久卷接口变快，或需要 KubeSphere 专有字段时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-PERSISTENT-VOLUMES-02 — 绑定声明写成 `<命名空间>/<名称>`

**为什么**：卷是集群级的，声明是命名空间级的；只写声明名会让读者无法定位。已绑定的卷给出完整路径，未绑定的显示 `-`——「没有声明」与「声明名为空」是两件事。

**被否方案**：分成「命名空间」「声明」两列。多一列，而两者总是一起出现。

**何时重新考虑**：需要按声明排序时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-PERSISTENT-VOLUMES-03 — 详情页写能力（2026-11-17 反转）

**新决定**：详情与列表提供编辑信息、编辑 YAML、删除、批量删除。删除受状态约束：`Bound` / `Released` 不可删，单条置灰并说明原因，批量跳过并汇总；删除确认需输入名称。**2026-11-17 产品复核决定重纳**（N-11，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)）。

**原判断（保留，不删除）**：详情页只读——「老 console 的持久卷详情可以编辑与删除。但卷通常是数据的唯一副本，而『回收策略 Delete』意味着集群会销毁后端存储——这类操作值得单独设计确认流程，不适合顺手迁入。本页只读，并在页面里说明回收策略的含义。」

**原被否方案（保留，不删除）**：照搬删除按钮。删除卷是不可逆的数据操作，应有独立的确认与影响说明。

**为什么当时判断错了**：把「需要确认流程」和「不提供入口」混为一谈。缺入口并不阻止误删——管理员会转而用 kubectl，而 kubectl 连 `Bound` 校验都没有。正确做法是**把确认流程做出来**（输入名称 + 状态约束 + 影响说明），而不是不给。原被否方案里的「独立的确认与影响说明」其实是本决策要交付的内容，不是拒绝交付的理由。

**落地约定**：
1. 删除前必须回读状态：`Bound` / `Released` 一律不提交，行操作 `disabled` 且给出原因；不靠「点了再报错」。
2. 批量删除逐个提交并汇总成功/跳过/失败三类结果，不因一个失败静默中断整批。
3. 编辑 YAML 走整对象 PUT 带 `resourceVersion`；409 保留输入并显示错误，不覆盖其他管理员的修改。
4. 回收策略的含义仍在页面上说明——重纳写能力不取消这段解释。

**何时重新考虑**：若提供「仅未绑定卷」的强制筛选 + 回收站式软删除，可放宽 `Released` 的限制。

**交付（2026-11-17）**：`persistentVolumesApi.updateInfo`（merge-patch，删除的注解发 null）、`remove`（逐条 DELETE）；列表提供多选、批量删除与行操作（Bound/Released 置灰），详情提供编辑信息/编辑 YAML/删除（受保护时置灰 + 可见原因）；批量结果汇总成功/跳过/失败。E2E 见 `TC-…-03`。

## 系统现状

老 console 的集群存储页包含持久卷列表与存储类型。存储类型已迁移（见 `storage-classes.md`），
本模块补上持久卷列表，列与老页面一致（名称、状态、容量、访问模式、绑定声明、回收策略、创建时间）。

## 仓库落点

- `apps/console-next/src/pages/cluster/PersistentVolumesPage.tsx`
- `packages/api-client/src/storage.ts` 的 `persistentVolumesApi` / `toPersistentVolumeSummary`
- `src/routes/kube-frontend.clusters.$cluster/persistentvolumes/`

## 对外契约

| 用途 | 路径/方法 |
| --- | --- |
| 列表/详情 | GET /api/v1/persistentvolumes、GET /api/v1/persistentvolumes/&lt;name&gt; |
| 编辑信息 | PATCH /api/v1/persistentvolumes/&lt;name&gt;（application/merge-patch+json，只发 metadata.annotations，清空的键为 null） |
| 编辑 YAML | GET 取当前对象后 PUT /api/v1/persistentvolumes/&lt;name&gt;（保留 resourceVersion） |
| 删除 | DELETE /api/v1/persistentvolumes/&lt;name&gt;（逐条） |

## 不变量

1. 一次取全量，本地排序与搜索。
2. 绑定声明写成 `<命名空间>/<名称>`。
3. Bound / Released 不进删除请求：单条入口 disabled，批量提交前过滤；无论响应如何，这批卷不会被 DELETE。

## 已知坑

- **性能**：实测核心 API 24 秒、kapis 代理 63 秒；页面的加载骨架因此必须覆盖重查阶段，
  否则读者会以为页面没反应。
- 回收策略缺失时 Kubernetes 的默认值是 `Retain`，显示空串会被读成「未知」。

## 测试与可观测

E2E 见 `tests/ui/tests/kube-frontend/cluster-management/`；TC-01/02 核对行数与每卷的绑定声明，TC-03 覆盖编辑信息、编辑 YAML、单条删除确认、Bound 保护与批量跳过汇总。可观测点：`persistentvolumes:surface`、`:select:<name>`、`:bulk-delete`、`:delete-policy`、`:batch-result`（含 deleted/skipped/failed 属性）、`pv-detail:edit-info|edit-yaml|delete|delete-protected`、`pv-detail:delete-input|delete-confirm`。单测：`packages/api-client/test/persistent-volumes-write.test.ts`。

## 后续改进

持久卷详情（挂载历史、底层磁盘）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03`
