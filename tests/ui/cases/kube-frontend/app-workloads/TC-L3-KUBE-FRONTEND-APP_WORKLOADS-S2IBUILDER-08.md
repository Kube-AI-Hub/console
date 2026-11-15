# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08 镜像构建器 · 资源状态页签（Job 容器端口与 Pod，缺失时如实空态）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

资源状态页签读取最近一次运行的 Job：展示容器端口与 Job 的 Pod；控制器未创建 Job 时显示「未创建构建任务」提示，不渲染空表冒充成功。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08** — 资源状态页签：读取最近一次运行的 Job；有 Job 时展示容器端口（名称/协议/端口）与 Job 的 Pod（名称/状态/就绪/重启次数/节点/IP）；控制器未创建 Job 时显示「最近一次运行还没有创建构建任务（Job）」并说明 Job 由 s2ioperator 创建（控制器无权限或未就绪时停留于此），不渲染空表冒充成功。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 查看构建记录、重新构建并核对产出镜像 (Priority: P1)

作为 **项目运维**，我希望 **在详情页重新构建并查看最后构建环境、运行记录与日志、资源状态、镜像制品、环境变量与事件**，以便 **确认构建是否成功、拿到镜像地址，并在失败时定位原因**。

**Independent Test**：运行表单预填当前配置，保存后配置更新且出现新的 S2iRun；「更新工作负载」开关在有关联服务时出现，开/关分别移除/写入 donotautoscale 注解；构建记录页签显示最后构建环境与运行记录（未知状态如实显示），无日志地址时说明原因；镜像制品只列成功运行的镜像名/大小/拉取命令/发布时间；资源状态、环境变量、事件页签在没有 Job 时给出控制器未创建 Job 的如实提示。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- 存在一个测试构建器与一条无 Job 的运行

## 测试步骤

1. 创建构建器与运行（当前控制器不产生 Job）；打开详情
2. 点击资源状态页签
3. 断言显示 noJob 提示，且容器端口/容器组表格不存在

## 期望结果

- 最近一次运行没有 kubernetesJobName 时不请求 Job（或 404 视为未创建），显示如实提示
- 不渲染端口/容器组空表，避免读者误以为构建没有资源

## 失败排查

- 接口 500：Job 路径与命名空间
- 误报空态：控制器已创建 Job 时是否读取 status.kubernetesJobName

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
