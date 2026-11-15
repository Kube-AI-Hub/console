# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07 镜像构建器 · 构建记录（最后构建环境/运行记录/日志如实呈现）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

构建记录页签展示最后构建环境与运行记录（序号/状态/镜像/开始时间/最后消息/日志）；运行状态来自 status.runState；无 logURL 时说明控制器未创建构建任务，有 logURL 时读取日志并在构建中每 4 秒刷新。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07** — 构建记录：默认页签；「最后构建环境」取自最新一次运行的 `status.s2iBuildSource`（builderImage / sourceUrl / revisionId；B2I 显示 binaryName/binarySize），无运行或控制器未汇报时显示 "-" 与如实说明，不把构建器配置冒充成上次构建结果；运行记录按创建时间倒序分页（每页 10），列含序号、状态（runState 映射）、镜像名称、开始时间、最后消息（镜像：{name}/构建中|成功|失败；未汇报显示“控制器尚未写入运行状态”）、日志；无 `status.logURL` 时不发日志请求并说明控制器未创建构建任务；有 logURL 时读取日志正文，构建中每 4 秒刷新，可暂停/继续/手动刷新；运行列表读取失败可重试。

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

1. API 创建构建器与一条 S2iRun；打开详情，构建记录为默认页签
2. 核对运行记录行：序号
3. 点击查看日志，断言显示「运行尚未产生日志地址」提示（无 logURL）
4. 用 /status 子资源写入成功状态与构建结果（模拟控制器汇报），刷新后核对状态徽章、最后消息、最后构建环境与镜像信息

## 期望结果

- 运行记录行数与 spec.builderName 匹配的运行数一致，序号由新到旧
- 未汇报状态显示「状态未知」，不把空状态展示成成功/失败
- 无 logURL 时不发日志请求，显示如实提示
- 模拟 status 后：状态=构建成功、最后消息=镜像：<name>/成功、最后构建环境显示 builderImage/sourceUrl/revisionId

## 失败排查

- 行不出现：spec.builderName 过滤是否生效
- 状态一直是未知：status 子资源是否被读取
- 日志请求 404：logURL 是否为空仍发请求

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
