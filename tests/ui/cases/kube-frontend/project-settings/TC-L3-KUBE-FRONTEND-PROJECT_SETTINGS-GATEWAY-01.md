# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01 网关设置 · 无网关时创建并显示状态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `gateway`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/gateways`
- **需求**: `prd/kube-frontend/project-settings/gateway.md`

## 产品功能

项目没有网关时显示空态与创建入口；创建后显示名称、访问方式、地址与控制器消息；可删除。

### 关联需求

- `prd/kube-frontend/project-settings/gateway.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/gateway.md`](../../../../prd/kube-frontend/project-settings/gateway.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01** — 已知项目没有网关，当打开网关设置页则显示空态与创建入口；点创建后页面切换到信息态并显示网关名称与状态；删除后回到空态。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/gateway.md`](../../../../design/kube-frontend/project-settings/gateway.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/gateway.md`](../../../../prd/kube-frontend/project-settings/gateway.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 让项目的路由有对外入口 (Priority: P1)

作为 **项目管理员**，我希望 **在没有网关时一键创建，并看到它是否部署成功**，以便 **知道应用路由能不能被访问**。

**Independent Test**：打开网关设置页，创建网关后页面切到信息态并能看到状态徽标。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 该项目当前没有网关；用例结束时删除自己创建的网关

## 测试步骤

1. 打开网关设置页，确认空态
2. 点「创建网关」
3. 等待页面切到信息态，读取字段
4. 用 API 确认 Gateway 对象存在
5. 删除该网关并确认页面回到空态

## 期望结果

- 初始显示空态与创建入口
- 创建后显示网关名称与状态徽标
- API 中存在该 Gateway 对象
- 删除后对象不存在

## 失败排查

- 状态长期为「部署中」说明控制器未装 Helm chart，属环境限制
- 访问方式与地址为空时，看 status.conditions 与 loadBalancer

## 产品改版后如何更新自动化

- 网关字段变化时改 api-client 的 toProjectGateway
