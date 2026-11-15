# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04 DevOps 工程 · 创建、编辑信息、删除与 CD 白名单

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-projects`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

工程生命周期闭环：创建对话框的名称校验与 generateName 提交、跳转生成名详情、编辑信息回读、CD 白名单编辑回读、输入名称确认删除后回列表；测试自建工程并在 finally 清理。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04** — Given 已登录且存在可写企业空间，When 在 DevOps 列表点「创建 DevOps 工程」并填合法唯一名称、企业空间、别名与描述后提交，Then 发出 POST `/kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops`，body 的 `metadata.generateName` 等于输入名并带 `kubesphere.io/workspace` 标签与两个注解；成功后跳转到响应返回的生成名详情且列表出现该行；名称为空或含非法字符时提交被拦下并显示对应提示；取消不发请求；服务端失败时对话框保持打开、保留输入并显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05** — Given 打开一个存在的工程详情，When 点「编辑工程信息」修改别名与描述并确认，Then 名称只读不可改；保存发出整对象 PUT `/apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>` 且保留 `spec.argo` 与 workspace 标签；成功后标题、描述与基本信息回显新值；取消不改变对象；清空别名的保存会移除 `kubesphere.io/alias-name` 注解。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-06** — Given 打开一个存在的工程详情，When 点删除、按提示输入完整工程名并确认，Then 发出 DELETE `/apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>`；成功后回到 DevOps 列表且该行消失；输入不匹配时删除按钮禁用；失败时确认框保留并显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CD-02** — Given 工程详情基本信息，Then 持续部署白名单区显示代码仓库（`spec.argo.sourceRepos`）与部署位置（`spec.argo.destinations` 的名称 / 命名空间），未配置显示「未选择」；点编辑白名单，按行编辑仓库（每行一个，`*` 表示全部）与部署位置（每行 `集群/项目`）后保存，发出整对象 PUT 且保留对象其他 spec 与 annotations，成功后基本信息回显新值；取消不写；失败显示服务端消息。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 管理 DevOps 工程的生命周期 (Priority: P1)

作为 **集群管理员**，我希望 **在集群 DevOps 列表创建工程、修改工程别名与描述、删除不再使用的工程，并且每个动作都能回读**，以便 **不切换旧控制台就完成工程治理，并确认接口真的生效**。

**Independent Test**：在列表点「创建 DevOps 工程」，填唯一名称、企业空间、别名与描述并提交；页面跳到接口返回的生成名详情，列表出现该行；在详情用「编辑工程信息」改别名与描述并确认，标题、描述与基本信息回显新值；点删除、按提示输入工程名确认，回到列表且该行消失。

### US14 - 查看持续部署并维护 CD 白名单 (Priority: P2)

作为 **DevOps 使用者**，我希望 **在持续部署页签查看应用的同步 / 健康 / 目标命名空间，并在基本信息维护持续部署白名单（可部署的代码仓库与部署位置）**，以便 **控制从哪些仓库能部署到哪里**。

**Independent Test**：打开持续部署页签，无应用显示空态；基本信息区显示白名单的代码仓库与部署位置（未配置显示「未选择」）；点编辑白名单，按行填写仓库与「集群/项目」保存，基本信息回显新值。

## 前置与配置

- 已登录且存在可写企业空间（system-workspace / public）
- 工程名称每次运行唯一（pwspec-proj- 前缀），用例在 finally 删除自建工程
- 不操作并行用例或用户已有的工程

## 测试步骤

1. 用接口读 devopsprojects 确认列表可读
2. 打开 DevOps 列表，点 devops:create，对话框可见
3. 名称留空直接提交，核对名称必填提示
4. 填唯一名称、选择企业空间、填别名与描述后提交
5. 等待跳转到新工程详情 URL，用接口按前缀找到生成名并核对 workspace 标签与两个注解
6. 点 devops-detail:edit，修改别名与描述后确认，核对标题/描述与接口注解
7. 点 devops-detail:allowlist-edit，仓库填两行、部署位置填两行后保存，核对白名单回显与 spec.argo
8. 点 devops-detail:delete，在删除框输入生成名并确认，核对回到列表且行消失

## 期望结果

- 创建请求 URL 为 /kapis/devops.kubesphere.io/v1alpha3/workspaces/<ws>/devops，响应名以输入名前缀开头
- 名称为空提交时对话框不关闭并显示「请输入名称。」
- 创建成功后 URL 为新工程详情，列表出现该行，基本信息工程命名空间回退为工程名
- 编辑后 devops-detail:title 显示别名、devops-detail:description 显示描述，接口注解 kubesphere.io/alias-name/description 等于提交值
- 白名单保存后 devops-detail:allowlist-repos 含提交的仓库行、allowlist-destinations 含 集群/项目，接口 spec.argo.sourceRepos/destinations 回读一致
- 删除确认框未输入完整名称时 delete-confirm 禁用；确认后回到列表且该行消失，接口 GET 404

## 失败排查

- 创建 400 metadata.generateName Required value：body 必须带 generateName
- 创建后控制器未同步属正常：不要断言 status.adminNamespace 已写入
- 白名单保存丢失 annotations/spec.argo 其他字段：核对整对象 PUT 前的回读对象
- 删除卡住：核对是否仍有 finalizer（本环境新建工程可即时删除）

## 产品改版后如何更新自动化

- 选择器：devops:create/create-name/-workspace/-alias/-description/-submit；devops-detail:edit/edit-alias/edit-description/edit-info-submit、delete/delete-input/delete-confirm、allowlist-edit/allowlist-repos/allowlist-destinations；devops:cd-allowlist-repos/-destinations/-submit
- 接口：工程写路径变化时同步 pages/devops_page.py 的 create_project/delete_project 与断言
