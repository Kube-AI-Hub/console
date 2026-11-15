# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02 镜像构建器 · 行操作（编辑信息/删除，回读与清理）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

列表行操作有「编辑信息」与「删除」；编辑信息只改别名/描述注解，其余注解保留；删除需输入对象名确认，成功后行消失且 API 回读 404。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02** — 行操作：行菜单顺序为「编辑信息、删除」；编辑信息只更新 `kubesphere.io/alias-name` 与 `kubesphere.io/description`，其余注解保留；删除必须输入完整对象名，确认后 DELETE 成功、行消失且回读 404；支持勾选多行批量删除（同样输入名称确认），删除后总数与页码刷新，最后一页被删空时回到上一页。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看到项目里有哪些镜像构建器，并维护别名/删除 (Priority: P1)

作为 **项目运维**，我希望 **在项目里看到已有的镜像构建器、它们最近一次构建的状态与所属服务，并能改别名或删除不再需要的构建器**，以便 **快速判断某个服务的镜像最近是否构建成功，并清理过期的构建配置**。

**Independent Test**：打开项目的镜像构建器页：列表按创建时间倒序、服务端分页并支持名称搜索与刷新；行内显示名称（别名/显示名）、类型、所属服务、构建器镜像、状态、最近构建时间与创建时间；行菜单可编辑信息与删除，删除需输入对象名并回读 404；没有构建器时显示空态并给出创建入口。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- 存在一个唯一前缀的测试构建器

## 测试步骤

1. API 创建带自定义注解的构建器，打开列表并定位该行
2. 打开行操作菜单，核对菜单项为 编辑信息/删除
3. 点击编辑信息，填写别名与描述，提交；API 回读 annotations
4. 再次打开行操作，点击删除，输入对象名确认；等待行消失
5. API 回读该构建器为 404

## 期望结果

- 行操作顺序为 编辑信息、删除
- 编辑信息后 kubesphere.io/alias-name 与 kubesphere.io/description 更新，其它注解（languageType 等）保留
- 删除必须输入完整对象名才能确认；删除成功后列表刷新，API 404

## 失败排查

- 编辑未生效：PATCH 是否 merge-patch
- 其它注解丢失：是否整体替换 annotations
- 删除按钮不可点：输入值是否等于对象名

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
