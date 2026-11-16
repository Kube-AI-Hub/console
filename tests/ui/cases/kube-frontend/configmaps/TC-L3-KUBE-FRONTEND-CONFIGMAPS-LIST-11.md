# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-11 列表显示列（列显隐）覆盖配置/保密/服务账号/存储列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-11`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

四个多列列表都提供「显示列」：只列可隐藏列（名称不可隐藏），取消勾选后表头立即消失、选择被记住、重置恢复。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-11** — 已知配置字典、保密字典、服务账号、项目存储、告警策略、联邦项目、集群告警消息、集群列表、企业空间成员、集群成员与 JuiceFS 存储列表均为多列列表，当点工具栏的「显示列」，则只列出**可隐藏列**（标识列「名称」不可隐藏）；取消勾选某列后该列表头立即消失、结果行不变，选择被记住（刷新后仍隐藏），「重置」恢复全部列；同一套行为由 `useColumnVisibility` + `ResourceList.columnVisibility` 提供，每个页面的选择独立保存（`kube-frontend.columns.<页面键>`）。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

## 前置与配置

- 已登录；项目 default 有配置字典/保密字典/服务账号/PVC

## 测试步骤

1. 打开配置字典列表，点「显示列」，核对菜单项只包含可隐藏列且有重置项
2. 取消勾选「项目」列，核对表头减少一列；刷新后该列仍隐藏
3. 点「重置」，核对表头恢复
4. 对保密字典、服务账号、存储列表重复确认「显示列」句柄存在

## 期望结果

- 每页都有 <前缀>:columns 触发器；菜单项为 <前缀>:columns:<列键> 与 :columns:reset
- 取消勾选后 th 数量减少 1，行数不变；localStorage 的 kube-frontend.columns.<页面键> 记录新集合
- 刷新后仍隐藏；重置后恢复全部列
- 名称列不出现在可隐藏菜单里

## 失败排查

- {'菜单只有「重置」：列没有标 hideable': True}
- 隐藏后刷新又出现：没有接 useColumnVisibility（选择未持久化）

## 产品改版后如何更新自动化

- 句柄：configmaps:columns / secrets:columns / serviceaccounts:columns / persistentvolumeclaims:columns；项 :columns:<key> 与 :columns:reset
