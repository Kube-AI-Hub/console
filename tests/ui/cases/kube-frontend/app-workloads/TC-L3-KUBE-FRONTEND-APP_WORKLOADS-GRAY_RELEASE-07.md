# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07 灰度发布 · 删除（名称确认、回读 404、列表刷新、失败不关闭）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

详情页删除需要输入策略名确认（不匹配时确认按钮不可用），取消不写；确认后 Strategy 被删除、API 回读 404、页面回到列表且该行消失；删除请求失败时确认框不关闭并显示原因。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07** — 已知一个灰度发布详情，当点「删除」，则出现要求输入策略名的确认框，输入不匹配时确认按钮不可用；输入策略名确认后 API 回读 404、列表不再包含该行、页面回到灰度发布列表；取消后对象仍存在；删除失败（权限/服务端错误）时确认框不关闭并显示服务端原因。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 删除不再需要的灰度发布 (Priority: P1)

作为 **项目运维**，我希望 **在详情里删除一个灰度发布，并且删除前必须输入策略名确认**，以便 **不会因为一次误点丢掉正在分流中的策略**。

**Independent Test**：在详情点「删除」，输入策略名后确认；API 回读 404，页面回到列表且该行消失；取消时对象不变；删除失败时确认框内显示原因且不关闭。

## 前置与配置

- 已登录，host 集群 default 项目，servicemesh 可读写
- 用例创建两条 Canary 策略：一条用于取消分支与失败分支，一条用于成功删除
- 用例对象使用 tc-e2e-gray- 前缀，finally 兜底删除

## 测试步骤

1. 打开第一条策略详情，点「删除」，输入错误名称，断言确认按钮不可用
2. 取消，回读对象仍存在
3. 用页面拦截让 DELETE 返回 500，点「删除」并输入正确名称确认，断言确认框仍显示且给出服务端原因
4. 放开拦截，打开第二条策略详情，输入名称确认删除，轮询回读 404 并等待页面回到列表

## 期望结果

- 输入不匹配时 grayrelease:delete-confirm 不可用
- 取消后对象仍存在
- 请求失败时确认框不关闭且显示错误文本
- 成功后回读 404、页面 URL 回到 …/grayrelease、列表不再包含该行

## 失败排查

- 确认按钮一直不可用：输入是否与策略名完全一致
- 删除成功但列表仍有行：是否 invalidate 了 ['strategies', cluster, namespace]
- 拦截未生效：page.route 的 URL 匹配需覆盖对象端点

## 产品改版后如何更新自动化

- 删除对话框复用 components/resource/DeleteDialog.tsx（句柄 grayrelease:delete-input/confirm）
