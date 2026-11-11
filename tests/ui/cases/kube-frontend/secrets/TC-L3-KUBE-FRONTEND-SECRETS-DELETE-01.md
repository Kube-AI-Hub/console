# TC-L3-KUBE-FRONTEND-SECRETS-DELETE-01 保密字典 · 输入名称确认后删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-DELETE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `delete`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/delete.md`

## 产品功能

单条与批量删除都要求输入精确的名称串。

### 关联需求

- `prd/kube-frontend/secrets/delete.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/delete.md`](../../../../prd/kube-frontend/secrets/delete.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-DELETE-01** — Given 选中一条 Secret 并打开删除弹窗，When 输入错误或部分名称，Then 确认按钮保持禁用；When 输入完全一致并确认，Then 弹窗关闭、列表刷新且该行消失；批量删除时提示文案与输入要求为「以逗号加空格分隔的全部名称」，任一名称不符都不能确认。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/delete.md`](../../../../design/kube-frontend/secrets/delete.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/delete.md`](../../../../prd/kube-frontend/secrets/delete.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，删掉一条废弃的凭据


**Independent Test**：在行操作菜单点「删除」，输入框为空时确认按钮禁用；输入正确名称后确认，行消失，`kubectl get secret` 返回 NotFound。

### US2 - 作为项目成员，一次清理多条


**Independent Test**：勾选三条，点「批量删除」，按提示输入三个名称（逗号加空格）后确认；三条都消失，`selected` 徽标清零。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 存在两条测试对象

## 测试步骤

1. 行操作「删除」
2. 未输入时观察确认按钮
3. 输入正确名称并确认
4. 勾选另一条后点「批量删除」并输入错误串

## 期望结果

- 确认按钮禁用
- 删除后该行消失，kubectl 返回 NotFound
- 批量时输入不完整不能确认

## 失败排查

- 删除后列表未刷新时检查 invalidateQueries

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
