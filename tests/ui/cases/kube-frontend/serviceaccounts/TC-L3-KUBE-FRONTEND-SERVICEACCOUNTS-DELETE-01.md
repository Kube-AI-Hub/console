# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01 服务账户 · 输入名称确认后删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `delete`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/delete.md`

## 产品功能

删除需要输入精确名称；批量时要求全部名称。

### 关联需求

- `prd/kube-frontend/serviceaccounts/delete.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/delete.md`](../../../../prd/kube-frontend/serviceaccounts/delete.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-DELETE-01** — Given 打开删除弹窗，When 输入与名称不一致，Then 确认禁用；When 输入一致并确认，Then 对象被删除、列表刷新、选择清空；批量删除要求输入以逗号加空格分隔的全部名称。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/delete.md`](../../../../design/kube-frontend/serviceaccounts/delete.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/delete.md`](../../../../prd/kube-frontend/serviceaccounts/delete.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，删掉不再使用的服务账户


**Independent Test**：删除并输入名称确认，行消失，`kubectl get sa <name>` 返回 NotFound。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 存在一条测试账户

## 测试步骤

1. 行操作「删除」
2. 未输入时观察确认按钮
3. 输入正确名称并确认

## 期望结果

- 确认按钮禁用
- 行消失，kubectl 返回 NotFound

## 失败排查

- 行未消失时检查 invalidateQueries 的键

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
