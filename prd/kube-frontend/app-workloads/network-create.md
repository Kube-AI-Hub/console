# 服务与应用路由创建（L3）

[子模块需求](./_index.md)

## 概述

项目运维可以从 Service 与 Ingress 列表创建资源，补上部署之后无法在新 UI 建立访问入口的缺口。
表单覆盖常用字段，YAML 承接多端口、多规则及其他原生配置。

## 用户故事

### US1 - 为工作负载创建访问入口 (Priority: P1)

作为 **项目运维**，我希望 **创建服务和应用路由**，以便 **为已有负载配置稳定的访问入口**。

**Independent Test**：分别在服务和应用路由列表创建一次性对象，回读端口、选择器、域名、路径与后端。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01** — 服务和应用路由列表均提供创建入口；表单创建 Service 后回读服务类型、选择器及端口映射与输入一致；创建 Ingress 后回读域名、路径与后端一致。非法名称、路径、端口阻止提交；写入失败在弹窗内显示并保留输入。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-02** — 从创建表单切换 YAML 时带入已填内容；YAML 创建保留额外端口与原生字段，并写入文档指定的项目。错误 kind、apiVersion、缺失名称或项目不得提交成功。

## 设计目标

一个创建入口，同时满足常见操作和完整原生配置，不复制旧版 AGPL 表单代码。

## 约束与边界

- 写入使用 Service 核心 API 和 Ingress networking.k8s.io/v1 的集合 POST；不使用 kapis 写入。
- 表单支持 ClusterIP、NodePort、Headless、ExternalName；Ingress 支持 Prefix/Exact、可选 TLS 与 IngressClass。
- 表单每次创建一个端口或一条规则，多端口、多规则、选择器组合由 YAML 承接。
- 资源创建成功不表示外部路由已可达；控制器和网关就绪另行验证。

## UI 交互设计

列表主操作打开共享 Modal，字段通过 ResourceForm 渲染。切换 YAML 带入当前表单值；
“取消 YAML 修改并返回表单”明确放弃未提交的 YAML。提交期间禁用确认，成功关闭并刷新列表。

## 文案与校验

- `networkCreate.*` 提供中英文文案；已有名称、端口、路径标签复用工作负载词典。
- 表单名称为字母开头的 DNS label，最多 63 字符；数字端口范围 1-65535，命名端口最多 15 字符且含小写字母。
- 路径以 / 开头；后端填同项目的服务名称。

## 边界情况

- 无对象时创建入口仍可见；403、重名或 admission 拒绝显示在弹窗内。
- ExternalName 不提交选择器和普通端口；Headless 写 clusterIP=None。
- YAML 可以填写 API 支持的完整字段，保留服务原生端口列表与注解。

## 明确不做

- 不创建 Ingress 控制器或配置公网 DNS；不承诺创建后已能从集群外访问。
- 不把多端口或多规则限定为单条：完整配置通过 YAML 支持。

## 假设

- 操作者有目标项目创建权限，集群服务核心 API 和 networking.k8s.io/v1。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01** — 支持表单与 YAML 创建 Service 和 Ingress。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01** — 创建后 API 回读与提交字段一致，失败不清空表单。
