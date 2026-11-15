# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02 网关设置 · 编辑访问方式/副本数/追踪/注解/NodePort 与本地校验

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `gateway`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/gateways`
- **需求**: `prd/kube-frontend/project-settings/gateway.md`

## 产品功能

已有项目网关可编辑访问方式、副本数、链路追踪、服务注解与 NodePort；保存后接口回读一致；非法副本数/NodePort 与重复端口在本地被阻止。

### 关联需求

- `prd/kube-frontend/project-settings/gateway.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/gateway.md`](../../../../prd/kube-frontend/project-settings/gateway.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02** — 已知项目已有网关，当在网关设置页点「编辑设置」，则弹窗显示接口当前 spec 的访问方式、副本数、链路追踪、服务注解（仅 LoadBalancer）与配置选项；修改访问方式、副本数、追踪开关与注解并保存后，Gateway 接口回读的 `spec.service.type`、`spec.deployment.replicas`、`spec.deployment.annotations['servicemesh.kubesphere.io/enabled']`、`spec.service.annotations` 与所填值一致，页面信息区显示新值；当访问方式为空、副本数为负数或非整数、NodePort 不是 30000–32767 的整数或两个端口重复时，保存被本地阻止并显示对应错误，且不发起写请求。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/gateway.md`](../../../../design/kube-frontend/project-settings/gateway.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/gateway.md`](../../../../prd/kube-frontend/project-settings/gateway.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 改网关的访问方式与容量 (Priority: P1)

作为 **项目管理员**，我希望 **修改网关的访问方式（NodePort/LoadBalancer）、副本数、链路追踪与注解**，以便 **按项目的访问与容量需求调整入口，而不是删掉网关重建**。

**Independent Test**：在网关设置页点「编辑设置」，修改访问方式、副本数与追踪并保存；页面与接口回读显示新值；输入负数副本数或非法 NodePort 时保存被阻止并显示错误。

## 前置与配置

- 已登录，host 集群，admin；用唯一前缀的临时命名空间创建项目网关（用例结束删除网关与命名空间）
- 网关 Service 已由控制器创建并分配 NodePort（用例等待）

## 测试步骤

1. 用 API 在临时命名空间创建 NodePort 项目网关，等待 kube-router-&lt;ns&gt; Service 分配端口
2. 打开项目网关设置页，等 gateway:surface 离开 loading，核对信息区访问方式/副本数/追踪/NodePort
3. 点「编辑设置」，核对弹窗默认值等于当前 spec
4. 依次输入负数副本数、小数副本数、越界 NodePort、重复 NodePort，核对保存禁用并显示对应错误
5. 修正为副本数 2、NodePort 31000/31001，打开追踪，保存
6. 用 Gateway 接口与 Service 回读，再刷新页面核对信息区
7. 再次编辑切换访问方式为 LoadBalancer，添加服务注解，保存并回读

## 期望结果

- 弹窗默认值与接口当前 spec 一致（访问方式/副本数/追踪/NodePort）
- 非法输入时保存禁用并显示中文错误；期间没有发出网关写请求
- 保存后 spec.deployment.replicas=2、追踪注解=true、Service 的 NodePort=31000/31001，页面刷新显示一致
- 切换 LoadBalancer 后 spec.service.type=LoadBalancer 且 spec.service.annotations 回读为所填键值，页面访问方式显示 LoadBalancer

## 失败排查

- 保存后弹窗不关闭：看 gateway:edit:error 文案；Service 未创建时 NodePort 写入返回 not ready
- 副本数没变：确认写的是 spec.deployment.replicas（不是 controller.replicas）
- NodePort 写入 405：kapis resources 端点只支持 GET，写需走 /api/v1

## 产品改版后如何更新自动化

- 句柄：gateway:*、gateway:edit:*（type/replicas/tracing/node-port:<name>/annotation:*/save/cancel/error）
