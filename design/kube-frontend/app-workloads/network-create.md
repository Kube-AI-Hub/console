# 服务与应用路由创建（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/network-create.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-02

## 概述

Service/Ingress 通过独立的 NetworkResourceCreateDialog 创建，复用 Modal、ResourceForm 和 YamlEditor。
纯函数 networkManifest 把表单映射到原生文档，workloadsApi.createManifest 校验资源种类后调用集合 POST。

## 系统现状

老版支持服务类型、选择器、端口数组以及路由规则。新 UI 已有端口与规则编辑，但创建描述符关闭。
本轮启用两类创建；常用表单字段迁移，复杂数组和高级字段由 YAML 承接。

## 仓库落点

- `apps/console-next/src/pages/app-workloads/{NetworkResourceCreateDialog,networkManifest,WorkloadListPage,queries}`
- `apps/console-next/src/components/resource/ManifestCreateDialog.tsx`（第二个使用者 Job/CronJob 出现后上收表单与 YAML 交互）
- `packages/api-client/src/workloads.ts`
- `packages/locales/src/index.ts`

## 对外契约

- Service POST `/api/v1/namespaces/<ns>/services`；Ingress POST `/apis/networking.k8s.io/v1/namespaces/<ns>/ingresses`。
- 成员集群沿用资源 API 的 clusters 段约定。body.kind/apiVersion 必须对应创建页面，metadata.namespace 与目标项目一致。
- 动作句柄：`services:create`、`ingresses:create`，YAML 切换与提交使用 `<kind>:create-yaml` 和 `<kind>:create-yaml-submit`。

## 设计目标与非目标

目标：补齐访问入口资源的创建，错误与输入在弹窗中可见。非目标：安装控制器、生成公网 DNS 或改写既有编辑表单。

## 关键约束

- 读走 kapis，写走原生资源集合；创建不能调用对象 PUT。
- Ingress 使用 networking.k8s.io/v1 的 backend.service 与 pathType。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01 — 共享组件加独立资源映射

**为什么**：创建 Service/Ingress 不包含镜像或副本数，不能套用控制器创建接口；共享表单组件负责字段包装、
校验和失败反馈，独立纯函数处理目标端口 IntOrString、Headless 与 v1 Ingress 文档。

**被否方案**：复制旧表单源码或为两种资源手写表单结构；前者有许可证问题，后者造成控件和校验行为漂移。

**何时重新考虑**：多端口、多规则成为常用表单场景时，上收可重复行组件，保留 YAML 作为完整能力出口。

## 不变量

1. YAML 的额外字段原样提交，不经表单裁剪。
2. ExternalName 不包含选择器；数字 targetPort 和 backend.port.number 使用数字。
3. 表单及 YAML 写入失败都保留内容；成功使对应列表查询失效。

## 已知坑

- kapis resources 仅支持 GET，写入会 405。
- `workloadsApi.create` 只为控制器产生 apps/v1 文档，服务和路由必须使用 createManifest。
- 返回表单明确取消 YAML 修改，不能把高级 YAML 隐式投影成简易表单。

## 测试与可观测

E2E 见 `tests/kube-frontend/app-workloads/`，测试回读对象并在 finally 删除唯一命名的资源。
单测覆盖纯映射、原生集合 POST、种类拒绝、错误留在弹窗；现有 ResourceForm 和编辑器 Storybook 继续复用。

## 后续改进

表单重复行和服务选择器可视化，按第二个实际使用者出现后提取通用组件。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-02`
