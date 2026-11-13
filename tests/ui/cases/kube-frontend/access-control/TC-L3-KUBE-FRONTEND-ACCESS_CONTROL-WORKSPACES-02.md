# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-02 企业空间 · 创建、编辑与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspaces`
- **入口**: `{BASE_URL}/kube-frontend/access/workspaces`
- **需求**: `prd/kube-frontend/access-control/workspaces.md`

## 产品功能

企业空间可由「创建」建立，可改别名与描述，可删除；别名写在注解上。

### 关联需求

- `prd/kube-frontend/access-control/workspaces.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspaces.md`](../../../../prd/kube-frontend/access-control/workspaces.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-02** — 已知在平台管理 → 企业空间页，当「创建」填写名称与别名，则对象存在且 `kubesphere.io/alias-name` 为填写值；当「编辑企业空间」改别名，则注解更新且名称不可改；当「删除」，则该企业空间不再出现在列表中。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspaces.md`](../../../../design/kube-frontend/access-control/workspaces.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspaces.md`](../../../../prd/kube-frontend/access-control/workspaces.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清平台上有哪些企业空间 (Priority: P1)

作为 **平台管理员**，我希望 **看到企业空间状态与集群关联**，以便 **确认归属**。

**Independent Test**：打开企业空间页，核对名称集合与 `kubectl get workspaces` 一致。

## 前置与配置

- 已登录，且有平台权限
- 用例自行创建的企业空间在结束时无条件删除

## 测试步骤

1. 打开企业空间页并点「创建」，填写名称与别名
2. 用 tenant 接口读取该对象
3. 行操作「编辑企业空间」改别名并确认
4. 再次读取
5. 行操作「删除」并确认
6. 用列表接口确认已不存在

## 期望结果

- 创建后名称存在且 kubesphere.io/alias-name 为填写的别名
- 编辑后别名更新
- 删除后不在列表中

## 失败排查

- 创建 404 说明路径写成了 /apis/tenant...（该组只经 kapis 暴露）
- 编辑 500 说明用了 merge patch（该接口只接受 PUT）

## 产品改版后如何更新自动化

- 字段变化时改 api-client 的 workspacesWriteApi
