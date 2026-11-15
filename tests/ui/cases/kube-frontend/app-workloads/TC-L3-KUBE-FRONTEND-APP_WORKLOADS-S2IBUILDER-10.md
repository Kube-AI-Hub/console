# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10 镜像构建器 · 环境变量页签（Job 容器 env 解析）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

环境变量页签读取最近一次运行 Job 的容器 env（含 valueFrom secret/configmap 的值），按容器分组，首个展开；名称含 password/secret 的值以 ****** 显示；无 Job 时如实空态。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10** — 环境变量页签：读取最近一次运行 Job 的容器 `env`，按容器分组、首个展开、其余可展开/收起；`valueFrom.secretKeyRef`/`configMapKeyRef` 解析为实际值；变量名含 password/secret 的值以 `******` 显示；无 Job 时不读取并显示如实提示；读取失败可重试。

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

1. 创建构建器与运行；打开详情，点击环境变量页签
2. 断言显示「未创建构建任务」提示且不渲染容器表

## 期望结果

- 无 Job 时不读取容器 env，页面显示如实提示
- 有 Job 时按容器分组、valueFrom 解析后展示；敏感名称值打码

## 失败排查

- 读取失败：Job 是否取最近运行
- 值泄露：password/secret 名称是否打码

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
