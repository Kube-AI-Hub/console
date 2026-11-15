# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03 镜像构建器 · 创建源码构建（两步表单 + 触发 S2iRun）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

创建向导分两步：构建模式/语言，构建设置；源码构建填仓库 URL/分支/密钥/镜像名/标签/目标镜像服务与高级项；提交创建 S2iBuilder（带 pull policy、s2i-type、languageType、repoUrl 前缀）并创建一个 S2iRun。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03** — 创建（S2I）：向导两步，第一步必须选择构建模式（源码/制品）与语言（模板支持的 java/nodejs/python 等），第二步填写构建设置；字段：构建环境（模板 builder image）、代码仓库 URL（必填、http(s):// 或 git@）、分支（必填，默认 master）、代码仓库密钥（basic-auth 保密字典，可选）、镜像名称（必填，小写字母/数字/- . / : 且首尾为字母或数字）、镜像标签（必填，默认 latest）、目标镜像服务（dockerconfigjson 保密字典，必填）、高级项（触发令牌仅字母数字、代码相对路径默认 /、模板环境变量名/值）；提交后 POST 创建 S2iBuilder（标签 `s2i-type.kubesphere.io=s2i`、`controller-tools.k8s.io=1.0`，注解 `languageType`、`kubesphere.io/repoUrl`，`spec.config.builderPullPolicy=if-not-present` 等），并把所选镜像服务的仓库地址前缀到镜像名称；随后创建一条 S2iRun（`spec.builderName`=新构建器）；提交中按钮禁用并显示进行中；字段校验失败显示错误且不发请求；服务端错误保留输入。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 从代码或制品创建镜像构建器并开始构建 (Priority: P1)

作为 **项目开发者**，我希望 **用两步向导创建一个源码构建（S2I）或制品构建（B2I）的构建器，选择构建模板、填写仓库/制品与目标镜像服务，并在创建后立即触发一次构建**，以便 **把代码或制品变成可部署的镜像**。

**Independent Test**：创建向导第一步选构建模式与语言，第二步填写构建设置并提交：生成的对象带正确标签/注解与 `spec.config`（含 pull policy、仓库、分支、镜像名、标签、目标镜像服务、环境变量），同时出现一条 `spec.builderName` 指向它的 S2iRun；制品构建先创建 S2iBinary 并上传文件，上传失败时如实报错且不留下半成品。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- 存在构建模板（5 个）
- 存在 dockerconfigjson 保密字典

## 测试步骤

1. API 创建一个唯一前缀的 dockerconfigjson 保密字典（registry.example.com）
2. 打开列表，点击创建构建器，选择「通过代码构建镜像 / Java」，进入下一步
3. 等待构建环境预选；填写仓库 URL、分支、镜像名称、标签，选择目标镜像服务
4. 展开高级设置，添加一个环境变量并填值；提交
5. 等待对话框关闭；用 API 读取该构建器与 s2irun，核对字段与列表行

## 期望结果

- 步骤 1 选择构建模式与语言后才能进入步骤 2；模板来自 s2ibuildertemplates
- 创建请求 POST /apis/devops.kubesphere.io/v1alpha1/namespaces/default/s2ibuilders 返回 201
- 对象标签 s2i-type.kubesphere.io=s2i、注解 languageType=java，config 含 builderPullPolicy/sourceUrl/revisionId/imageName（带 registry.example.com 前缀）/tag/environment
- 创建后存在一条 spec.builderName 等于新构建器名的 S2iRun；列表出现该行
- 必填/格式错误时显示字段错误且不提交

## 失败排查

- 提交按钮禁用：模板或目标镜像服务为空
- 创建 403：webhook 校验 builderPullPolicy/sourceUrl
- 没有运行记录：创建后是否 createRun

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
