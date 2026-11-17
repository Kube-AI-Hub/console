# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03 持久卷写能力：编辑信息、编辑 YAML、单条与批量删除（Bound 保护）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `persistent-volumes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{KA_CLUSTER}/persistentvolumes`
- **需求**: `prd/kube-frontend/cluster-management/persistent-volumes.md`

## 产品功能

持久卷详情可编辑别名/描述（merge-patch）与 YAML（整对象 PUT）；可删卷可单条删除（输入卷名确认）；Bound/Released 的卷删除入口置灰并说明原因；批量删除跳过不可删卷并汇总成功/跳过/失败。

### 关联需求

- `prd/kube-frontend/cluster-management/persistent-volumes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/persistent-volumes.md`](../../../../prd/kube-frontend/cluster-management/persistent-volumes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03** — 已知持久卷详情页，当点「编辑信息」并修改别名/描述后确认，则发出只包含 metadata.annotations 的 merge-patch（未改动的注解保留，清空的注解以 null 移除），详情元数据区回显新值；当点「编辑 YAML」修改对象后确认，则整对象 PUT（带当前 resourceVersion）成功并刷新详情；服务端冲突或校验失败时对话框保持打开并显示错误。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-04** — 已知卷状态为 Bound/Released，当打开其详情或行操作菜单，则删除入口置灰（不可点击）并显示「先释放声明并确认后端数据处置」的说明；当卷状态为 Available 等可删状态并点删除，则弹出输入名称确认框，输入完全一致才可提交，确认后回到列表且该卷从接口与列表中消失。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-05** — 已知同时选中 Bound 与可删卷并点批量删除，当输入确认文本并提交，则只对可删卷发 DELETE，结果区显示「成功 N / 跳过 M（Bound / Released）/ 失败 K」的汇总；Bound 卷保持不变；全部被选卷都不可删时不发任何 DELETE，并说明「均不可删除」。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/persistent-volumes.md`](../../../../design/kube-frontend/cluster-management/persistent-volumes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/persistent-volumes.md`](../../../../prd/kube-frontend/cluster-management/persistent-volumes.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 安全地清理不再需要的持久卷 (Priority: P2)

作为 **集群管理员**，我希望 **在控制台编辑卷的别名/描述、编辑 YAML，并在确认后删除不再需要的卷（批量删除时跳过仍被绑定的卷）**，以便 **不必转去 kubectl 做这些操作，同时不会被一个按钮误删正在使用的数据**。

**Independent Test**：打开 Available 卷详情，改别名/描述并保存后接口注解更新；编辑 YAML 改别名后接口同步；删除需输入卷名，确认后列表不再有该卷；Bound 卷的删除按钮置灰并显示原因；同时选中 Bound 与 Available 卷批量删除，结果汇总为成功 1、跳过 1，Bound 卷仍在。

## 前置与配置

- 已登录，且在 host 集群；集群内至少有一个 Bound 持久卷（mlu370 有 22 个）
- 用例自建唯一的 Available 持久卷（hostPath，1Gi）；结束后删除，不依赖环境已有工程

## 测试步骤

1. 用 API 创建临时卷 A、B、C（Available）并读取一个 Bound 卷名
2. 打开 A 详情，确认删除按钮可用
3. 点「编辑信息」，改别名与描述后保存；轮询接口确认两个注解更新
4. 点「编辑 YAML」，在别名注解行末追加 "-yaml" 并提交；轮询接口确认别名以 -yaml 结尾
5. 打开 Bound 卷详情，确认删除按钮置灰且出现「先释放声明并确认后端数据处置」说明
6. 回到列表，选中 A、B 与 Bound 卷，点「批量删除」，输入数量确认；核对结果汇总成功 2 / 跳过 1，A、B 从接口消失，Bound 仍在
7. 打开 C 详情，点删除并输入 C 的名称确认；回到列表后 C 从接口消失

## 期望结果

- 编辑信息只发 metadata.annotations 的 merge-patch，未改注解保留、清空键以 null 移除；保存后详情/接口同步
- 编辑 YAML 走整对象 PUT 并刷新详情；提交后对话框关闭
- Bound/Released 的删除入口 disabled，并显示可见原因；不出现「点了再报错」
- 单条删除需输入名称，确认后回到列表且卷从接口/列表消失
- 批量只删除可删卷，结果区汇总成功/跳过/失败计数；Bound 卷保持 Bound
- 全部被选卷都不可删时不发 DELETE，并显示「均不可删除」

## 失败排查

- 编辑信息后注解未更新：确认 updateInfo 发送的 patch 对清空键是 null（不是省略）
- YAML 保存 409：页面应保留输入并显示错误；重试前刷新对象
- 批量后 Bound 卷消失：说明前端未过滤 UNDELETABLE，先查 bulk 提交前的 deletable 过滤
- 列表 checkbox 不存在：确认页面 schema.selection/multiple 与 selectAiId 已设置

## 产品改版后如何更新自动化

- 句柄：persistentvolumes:select:<name>、:bulk-delete、:batch-result（data-ai-deleted/skipped/failed）、pv-detail:edit-info|edit-yaml|delete|delete-protected、pv-detail:delete-input|delete-confirm、yaml:submit
