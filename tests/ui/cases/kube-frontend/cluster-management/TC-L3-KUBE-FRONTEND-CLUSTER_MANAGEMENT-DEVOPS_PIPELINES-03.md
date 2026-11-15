# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03 流水线详情 · 基本信息、同步状态与 Jenkinsfile 保存

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-pipelines`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

流水线详情基本信息字段与缺值语义（health 无状态、sync/validate 为 -），配置页签单分支 Jenkinsfile 编辑/保存后回读、取消恢复，多分支只读脚本路径说明。测试对象用接口创建并在 finally 删除。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-05** — Given 从列表进入流水线详情，Then 基本信息显示名称 / 类型 / 同步状态 / 健康状态 / 脚本校验 / 创建者 / 创建时间 / 工程命名空间 / 描述，健康缺失显示「无状态」、同步状态与脚本校验缺失显示 `-`；配置页签单分支显示可编辑 Jenkinsfile，保存按钮在未修改时禁用、修改后可用，取消恢复服务端值，保存后重新读取 `spec.pipeline.jenkinsfile` 等于提交内容（走 `PUT …/pipelines/<p>/jenkinsfile?mode=raw`，见 design GOT）；多分支显示脚本来自代码仓库的只读说明；保存失败显示服务端消息。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US8 - 查看流水线详情与 Jenkinsfile 配置 (Priority: P2)

作为 **DevOps 使用者**，我希望 **打开流水线详情看到名称 / 类型 / 同步状态 / 健康 / 脚本校验 / 创建者 / 创建时间 / 工程命名空间 / 描述，并在配置页签查看与保存 Jenkinsfile（多分支只读脚本路径说明）**，以便 **判断流水线是否与 Jenkins 同步，并修正单分支脚本**。

**Independent Test**：从流水线列表点名称进入详情；基本信息各项与接口一致，无 Jenkins 元数据时健康显示「无状态」、同步状态与脚本校验显示 -；配置页签单分支显示 Jenkinsfile，修改后保存，重新加载页面回读内容等于提交内容；多分支显示脚本来自代码仓库的只读说明。

## 前置与配置

- 已登录且存在含命名空间的 DevOps 工程；不存在时 skip
- 用例通过接口创建一条单分支与一条多分支流水线（唯一前缀），finally 删除
- 不修改非本用例创建的流水线

## 测试步骤

1. 接口创建单分支流水线（带 description 注解与 Jenkinsfile JF1）
2. 打开其详情 URL，核对基本信息字段
3. 切到配置页签，核对 Jenkinsfile 文本域值等于 JF1、保存按钮初始禁用
4. 修改为 JF2，核对保存可用；点取消核对恢复 JF1
5. 再次改为 JF2 保存，重新打开页面与接口回读核对 spec.pipeline.jenkinsfile=JF2
6. 接口创建多分支流水线并打开配置页签，核对只读说明且无文本域

## 期望结果

- 基本信息显示名称/类型/同步状态/健康状态/脚本校验/创建者/创建时间/工程命名空间/描述；同步状态与脚本校验缺注解显示 -，健康缺值显示「无状态」
- 配置页签单分支显示 devops:pipeline-detail:config-editor，值为 spec.pipeline.jenkinsfile
- 保存按钮在未修改时 disabled=true，修改后可点；点取消后值恢复服务端值
- 保存后接口回读 jenkinsfile 等于提交内容（PUT …/jenkinsfile?mode=raw 语义）
- 多分支显示 devops:pipeline-detail:config-multibranch，无编辑器

## 失败排查

- 保存后回读仍旧值：确认走的是 …/jenkinsfile?mode=raw 而不是整对象 PUT
- 多分支出现编辑器：类型必须是 multi-branch-pipeline
- 同步状态/校验显示成功：缺注解时应为 -，不要伪造

## 产品改版后如何更新自动化

- 选择器：pipeline-detail:surface/basic/name/type/sync-status/health/validate/creator/created-at/namespace/description、tab:config/config/config-editor/config-save/config-reset/config-multibranch/config-error
- 保存接口变化时同步 pages/devops_page.py 与 api-client 单元测试
