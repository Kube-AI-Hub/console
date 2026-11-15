# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09 镜像构建器 · 镜像制品页签（仅成功运行、复制拉取命令）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

镜像制品页签只列 status.runState=Successful 的运行：镜像名称/大小/拉取命令（可复制）/发布时间；没有成功构建时显示空态。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09** — 镜像制品页签：只列 `runState=Successful` 的运行，列含镜像名称、镜像大小（`imageSize` 字节按 1024 换算）、拉取命令（可复制并提示已复制）、发布时间（imageCreated）；没有成功运行显示空态；非成功运行不出现在制品表。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 查看构建记录、重新构建并核对产出镜像 (Priority: P1)

作为 **项目运维**，我希望 **在详情页重新构建并查看最后构建环境、运行记录与日志、资源状态、镜像制品、环境变量与事件**，以便 **确认构建是否成功、拿到镜像地址，并在失败时定位原因**。

**Independent Test**：运行表单预填当前配置，保存后配置更新且出现新的 S2iRun；「更新工作负载」开关在有关联服务时出现，开/关分别移除/写入 donotautoscale 注解；构建记录页签显示最后构建环境与运行记录（未知状态如实显示），无日志地址时说明原因；镜像制品只列成功运行的镜像名/大小/拉取命令/发布时间；资源状态、环境变量、事件页签在没有 Job 时给出控制器未创建 Job 的如实提示。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- 存在一个测试构建器与一条运行

## 测试步骤

1. 创建构建器与运行，用 /status 子资源写入成功状态与 s2iBuildResult（模拟控制器）
2. 打开详情，点击镜像制品页签
3. 核对镜像名称/大小/拉取命令/发布时间与写入值一致
4. 点击复制按钮并断言出现「已复制」通知

## 期望结果

- 仅成功状态进入制品表；失败/构建中/未知不进入
- 镜像名称、大小（formatSize）、拉取命令、发布时间与 status.s2iBuildResult 一致
- 复制按钮可复制拉取命令并给出反馈
- 无成功运行时显示「还没有构建成功的镜像制品」

## 失败排查

- 表为空：status.runState 是否成功、s2iBuildResult 是否写入
- 大小单位错误：imageSize 字节是否按 1024 换算

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
