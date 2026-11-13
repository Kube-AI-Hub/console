# 网关设置（L3）

[子模块需求](./_index.md)

## 概述

项目网关的增删与状态：没有网关时给出创建入口，有网关时显示名称、访问方式、访问地址与控制器消息。

## 用户故事

### US1 - 让项目的路由有对外入口 (Priority: P1)

作为 **项目管理员**，我希望 **在没有网关时一键创建，并看到它是否部署成功**，以便 **知道应用路由能不能被访问**。

**Independent Test**：打开网关设置页，创建网关后页面切到信息态并能看到状态徽标。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01** — 已知项目没有网关，当打开网关设置页则显示空态与创建入口；点创建后页面切换到信息态并显示网关名称与状态；删除后回到空态。

## 设计目标

1. 无网关时给出可执行的下一步，而不是空表格。
2. 状态以控制器上报的 `Deployed` 条件为准。

## 约束与边界

- 读 `gateway.kubesphere.io/v1alpha1` 的 Gateways（项目命名空间）。
- 创建使用 NodePort 类型：不依赖云负载均衡，任何集群都可用。

## UI 交互设计

两态：空态（说明 + 创建按钮）与信息态（四个字段 + 状态徽标 + 删除）。

## 文案与校验

- 状态：已就绪 / 部署中。
- 字段：网关名称、访问方式、访问地址、控制器消息。

## 边界情况

- 未就绪时每 5 秒自动刷新，避免用户手动刷新。
- 访问方式与地址由控制器填充，创建后短时间可能为空。

## 明确不做

- 修改网关类型、端口与副本数（属基础设施配置）。
- 网关的日志与监控。

## 假设

- 网关由平台的 Gateway 控制器部署（Helm release）。若控制器未安装，网关会长期停在「部署中」。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01** — 两态切换与创建/删除。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02** — 状态取自 `Deployed` 条件。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01** — 创建后 Gateway 对象存在，删除后不存在。
