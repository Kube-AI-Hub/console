# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05 镜像构建器 · 详情（属性/操作/五页签/404）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

详情页展示名称/项目/类型/构建器镜像/镜像名称/拉取策略/代码仓库/远程触发器/创建时间/创建者；操作有条目顺序 运行/编辑信息/编辑 YAML/删除；五个页签可切换；不存在的对象显示「资源不存在」并可返回列表。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05** — 详情：属性区按旧版字段展示名称、项目、类型、构建器镜像（builderImage）、镜像名称（imageName）、拉取策略（builderPullPolicy）、代码仓库/制品（S2I 显示 sourceUrl + revisionId；B2I 显示制品与下载入口）、远程触发器（`http://s2ioperator-trigger-service.kubesphere-devops-system.svc/s2itrigger/v1alpha1/general/namespaces/<ns>/s2ibuilders/<name>/` + secretCode 查询参数，可复制）、创建时间、创建者；操作顺序为「运行、编辑信息、编辑 YAML、删除」；页签为 构建记录（默认）、资源状态、镜像制品、环境变量、事件；编辑 YAML 打开对话框且取消不写；对象不存在时显示「资源不存在」与返回列表链接；详情读取失败可重试。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 查看构建器详情与全部属性 (Priority: P2)

作为 **项目运维**，我希望 **打开一个构建器，看到它的构建器镜像、输出镜像名、拉取策略、代码仓库、远程触发器与创建信息，并能运行/编辑/删除**，以便 **确认配置并复制 Webhook 触发器**。

**Independent Test**：打开详情页，属性区按旧版字段与顺序展示；远程触发器包含 s2itrigger 地址并可复制；操作顺序为 运行 / 编辑信息 / 编辑 YAML / 删除；五个页签可切换；不存在的对象显示「资源不存在」并可返回列表。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- 存在一个唯一前缀的测试构建器

## 测试步骤

1. API 创建构建器并 patch 别名/描述；打开其详情页
2. 核对标题、状态徽章、类型徽章与属性区字段值
3. 逐个点击构建记录/资源状态/镜像制品/环境变量/事件页签，核对面板出现与各自空态
4. 点击编辑 YAML，断言对话框打开且取消可关闭
5. 打开一个不存在的对象名，断言 404 面板与返回列表链接

## 期望结果

- 属性含 构建器镜像、镜像名称、拉取策略、代码仓库、远程触发器、创建时间等；远程触发器包含 s2itrigger 与对象名
- 操作顺序为 运行、编辑信息、编辑 YAML、删除
- 五个页签均存在且可切换；无 Job 时资源状态/环境变量/事件显示如实的「未创建构建任务」提示，镜像制品显示空态
- 编辑 YAML 对话框可打开；取消不改对象
- 不存在对象显示「资源不存在」与返回列表链接，不显示空白页

## 失败排查

- 详情 404：CRD 名称/命名空间是否正确
- 页签空白：面板是否渲染了空态
- 触发器不对：s2ioperator 服务地址与 secretCode 查询参数

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
