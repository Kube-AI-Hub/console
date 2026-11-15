# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05 联邦项目 · 编辑信息与调整部署集群

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `federated-projects`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/federatedprojects`
- **需求**: `prd/kube-frontend/access-control/federated-projects.md`

## 产品功能

详情头部的「编辑信息」改别名与描述（对象注解与每个放置集群的 override 同步），「调整部署集群」回显并替换 placement 集合；保存后回读一致，未修改的字段保持不变。

### 关联需求

- `prd/kube-frontend/access-control/federated-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05** — 已知存在一个联邦项目，当在行操作中打开「编辑信息」并修改别名与描述后保存，则对象 `metadata.annotations` 的 `kubesphere.io/alias-name` / `kubesphere.io/description` 被更新，且各放置集群的 `/metadata/annotations` override 同步更新，详情与列表回读为新值，其它注解与 `spec.placement` 不变；当打开「调整部署集群」并增删集群后保存，则 `spec.placement.clusters` 与 override 列表替换为新集合，详情回读一致；已知移除某个集群，则在确认前显示「移除会删除该集群上的命名空间」的警告；已知当前账号被明确拒绝修改，则对应入口提示无权限且不打开对话框。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/federated-projects.md`](../../../../design/kube-frontend/access-control/federated-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 创建、编辑与删除联邦项目 (Priority: P1)

作为 **企业空间管理员**，我希望 **在列表页直接创建联邦项目（名称/别名/描述/放置集群）、编辑别名与描述、调整部署集群、删除单个或批量删除**，以便 **不必切到联邦控制面命令行就能完成多集群项目的日常维护**。

**Independent Test**：用唯一名称创建联邦项目，确认列表出现该行且详情显示所选集群与传播状态；编辑别名后回读生效；调整部署集群后回读新集合；分别在列表行与批量选择中删除，确认确认框、行消失与命名空间清理。

## 前置与配置

- 已登录，联邦 API 可读写，至少一个就绪集群
- 预置一个唯一名称的联邦项目（宿主编 managed=true，放置 host）

## 测试步骤

1. 用 API 预置联邦项目（别名 old/描述 old）
2. 打开详情，点「编辑信息」，修改别名与描述后保存
3. 用联邦 API 回读对象：核对 metadata.annotations、spec.overrides、spec.template、spec.placement
4. 打开「调整部署集群」，核对对话框回显当前集群，未出现移除警告，直接保存
5. 回读 placement 与 overrides，核对未变化
6. 清理：删除宿主命名空间并轮询到 404

## 期望结果

- 编辑信息保存后对话框关闭，详情别名更新
- metadata.annotations 的 kubesphere.io/alias-name / kubesphere.io/description 为新值，其余注解保留
- 每个放置集群的 /metadata/annotations override 值同步为新注解集合
- spec.template.metadata 不含 annotations；spec.placement.clusters 保持 host
- 放置对话框回显 host；单集群环境下无移除警告；保存后 placement 仍为 host
- 未修改的字段（resourceVersion 变化除外）保持一致
- 清理后对象与命名空间都不存在

## 失败排查

- 保存后别名没变：PUT 丢了对象注解或 override；检查是否用读取到的完整对象做 PUT
- 保存报 409：PUT 未携带 resourceVersion
- 放置保存后多出集群：override 列表未去重或 placement 未整体替换
- 单集群环境无法验证增删集群：记录为环境限制，不在本用例伪造第二集群

## 产品改版后如何更新自动化

- 选择器：federated-project:edit-info / :edit-alias / :edit-description / :edit-info-submit / :edit-placement / federated-projects:placement-submit
- 注解键变化时同步 EditInfoDialog 与 federated.ts
