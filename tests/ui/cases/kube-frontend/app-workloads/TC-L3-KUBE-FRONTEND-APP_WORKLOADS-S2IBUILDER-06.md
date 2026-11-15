# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06 镜像构建器 · 运行/重新构建（预填、PATCH、更新工作负载注解、触发 run）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

详情页「运行」打开预填当前配置的表单；保存会 PATCH 构建器配置并创建新的 S2iRun；有 serviceName 注解时显示「构建成功后更新工作负载」开关，默认开（移除 donotautoscale 注解），关闭则写入该注解。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06** — 运行/重新构建：详情「运行」打开预填当前 `spec.config` 的表单；保存会 merge-patch 配置（未修改字段保留）并创建一条新的 S2iRun；构建器带 `serviceName` 注解时显示「构建成功后更新工作负载」开关并默认开启（不写 `devops.kubesphere.io/donotautoscale`），关闭时写入该注解；无 `serviceName` 时不显示开关并说明原因；提交失败保留输入并显示错误。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 查看构建记录、重新构建并核对产出镜像 (Priority: P1)

作为 **项目运维**，我希望 **在详情页重新构建并查看最后构建环境、运行记录与日志、资源状态、镜像制品、环境变量与事件**，以便 **确认构建是否成功、拿到镜像地址，并在失败时定位原因**。

**Independent Test**：运行表单预填当前配置，保存后配置更新且出现新的 S2iRun；「更新工作负载」开关在有关联服务时出现，开/关分别移除/写入 donotautoscale 注解；构建记录页签显示最后构建环境与运行记录（未知状态如实显示），无日志地址时说明原因；镜像制品只列成功运行的镜像名/大小/拉取命令/发布时间；资源状态、环境变量、事件页签在没有 Job 时给出控制器未创建 Job 的如实提示。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- 存在带 serviceName 注解的测试构建器

## 测试步骤

1. 打开详情，点击运行；核对仓库 URL/镜像名称/标签已预填
2. 修改镜像标签，确认「更新工作负载」开关默认为开，提交
3. 轮询 API：构建器 tag 已更新、donotautoscale 注解不存在、新增一条 S2iRun
4. 再次打开运行，关闭「更新工作负载」开关并提交
5. 轮询 API：donotautoscale 注解为 true，且再新增一条运行

## 期望结果

- 运行表单预填既有 config；提交按钮在提交中禁用并显示进行中
- PATCH 后配置更新（未修改字段保留），并创建 spec.builderName 等于该构建器的新 S2iRun
- 更新工作负载开：不写 devops.kubesphere.io/donotautoscale；关：写入 true
- 没有 serviceName 注解时不显示该校验框，并说明原因

## 失败排查

- PATCH 后字段丢失：是否 merge-patch 而非整对象
- 没有新 run：是否只 PATCH 未 createRun
- 注解未更新：merge patch 删除键用 null

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
