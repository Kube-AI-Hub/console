# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-02 服务创建 · YAML 多端口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `network-create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/services`
- **需求**: `prd/kube-frontend/app-workloads/network-create.md`

## 产品功能

YAML 创建保留多端口和注解，并使用原生资源集合。

### 关联需求

- `prd/kube-frontend/app-workloads/network-create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/network-create.md`](../../../../prd/kube-frontend/app-workloads/network-create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-02** — 从创建表单切换 YAML 时带入已填内容；YAML 创建保留额外端口与原生字段，并写入文档指定的项目。错误 kind、apiVersion、缺失名称或项目不得提交成功。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/network-create.md`](../../../../design/kube-frontend/app-workloads/network-create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/network-create.md`](../../../../prd/kube-frontend/app-workloads/network-create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 为工作负载创建访问入口 (Priority: P1)

作为 **项目运维**，我希望 **创建服务和应用路由**，以便 **为已有负载配置稳定的访问入口**。

**Independent Test**：分别在服务和应用路由列表创建一次性对象，回读端口、选择器、域名、路径与后端。

## 前置与配置

- 已登录且有项目创建权限
- 唯一命名，finally 删除用例对象

## 测试步骤

1. 从服务创建表单切换 YAML
2. 填写包含两个端口和注解的文档，提交后回读

## 期望结果

- API 对象的端口数组与注解未丢失

## 失败排查

- 字段丢失时检查是否错误地由表单重新构造了 YAML

## 产品改版后如何更新自动化

- 选择器见 pages/app_workloads.py
