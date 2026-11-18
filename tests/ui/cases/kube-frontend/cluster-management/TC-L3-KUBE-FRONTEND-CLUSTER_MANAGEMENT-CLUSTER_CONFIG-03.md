# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03 集群级配置字典 · 行操作（编辑信息 / 删除，联邦对象无操作）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-config`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{CLUSTER}/configmaps`
- **需求**: `prd/kube-frontend/cluster-management/cluster-config.md`

## 产品功能

集群级配置字典列表的普通行提供「编辑信息 / 编辑 YAML / 编辑设置 / 删除」，写按该行自己的项目寻址；联邦托管对象不渲染操作。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-config.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03** — 已知集群侧「配置字典」页里有一个普通配置字典和一个联邦托管（`kubefed.io/managed=true`）的配置字典，当打开某行的更多操作，则普通行提供「编辑信息 / 编辑 YAML / 编辑设置 / 删除」四项，联邦托管行不渲染任何操作；编辑信息保存后该对象的描述注解被更新，删除确认后该对象从列表消失，两者都按**该行自己的项目**寻址。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-config.md`](../../../../design/kube-frontend/cluster-management/cluster-config.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目定位一份配置 (Priority: P1)

作为 **集群管理员**，我希望 **不进入具体项目就按名称检索集群里的保密字典 / 配置字典 / 服务账号**，以便 **先确认对象属于哪个项目，再跳到该项目里处理**。

**Independent Test**：打开集群级保密字典页，核对行数等于 `min(20, total)`、项目列等于对象命名空间、名称链接含 `/projects/<namespace>/secrets/<name>`；对配置字典与服务账号各重复一次。

## 前置与配置

- 已登录，host 集群，admin
- 用例在 default 项目创建一个唯一命名的配置字典，结束后删除

## 测试步骤

1. 用 API 创建配置字典 tc-e2e-cm-<stamp>（带 kubesphore 描述注解）
2. 打开 /kube-frontend/clusters/host/configmaps，用搜索框收窄到该名称
3. 打开该行的更多操作，核对四项动作
4. 点「编辑信息」，修改描述并保存，等弹窗关闭
5. 用 API 回读该对象的 kubesphore 描述注解，核对已更新
6. 再次打开更多操作，点「删除」，在确认弹窗输入名称并确认
7. 等该行消失；用 API 确认对象已不存在

## 期望结果

- 行操作四项齐全，顺序为 编辑信息 / 编辑 YAML / 编辑设置 / 删除
- 编辑信息保存后注解被更新（按行所属项目寻址，不是页面的空命名空间）
- 删除确认后对象从列表与 API 中消失
- 联邦托管行（若有）不渲染更多操作按钮

## 失败排查

- 保存没反应：写入打到了没有 namespaces 段的路径（404）；看 Network 的 URL
- 删除后对象还在：DELETE 少了命名空间段，或确认文本没输入正确

## 产品改版后如何更新自动化

- 行 data-ai-row=<namespace>/<name>；更多操作按钮 aria-label「更多操作」
