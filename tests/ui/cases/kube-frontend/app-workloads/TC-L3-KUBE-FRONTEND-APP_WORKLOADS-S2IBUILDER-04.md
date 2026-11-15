# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04 镜像构建器 · 创建制品构建（B2I 上传链路，上游不可用时如实报错）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

B2I 模式先上传制品：创建 S2iBinary 并 PUT /file，成功后写 downloadURL 到 sourceUrl 且 isBinaryURL=true；上传失败时对话框显示服务端原因、不创建构建器，且失败对象被清理。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04** — 创建（B2I）：制品模式先创建 S2iBinary 再 `PUT …/s2ibinaries/<name>/file` 上传；成功后把控制器写入的 `spec.downloadURL` 作为 builder 的 `spec.config.sourceUrl`、设置 `isBinaryURL=true` 并记录 `kubesphere.io/file` 注解（文件名/大小）；上传失败时对话框显示服务端原因、不创建 builder，且删除半成品 S2iBinary；文件扩展名与所选制品类型不符时拒绝上传并提示。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 从代码或制品创建镜像构建器并开始构建 (Priority: P1)

作为 **项目开发者**，我希望 **用两步向导创建一个源码构建（S2I）或制品构建（B2I）的构建器，选择构建模板、填写仓库/制品与目标镜像服务，并在创建后立即触发一次构建**，以便 **把代码或制品变成可部署的镜像**。

**Independent Test**：创建向导第一步选构建模式与语言，第二步填写构建设置并提交：生成的对象带正确标签/注解与 `spec.config`（含 pull policy、仓库、分支、镜像名、标签、目标镜像服务、环境变量），同时出现一条 `spec.builderName` 指向它的 S2iRun；制品构建先创建 S2iBinary 并上传文件，上传失败时如实报错且不留下半成品。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- 存在构建模板

## 测试步骤

1. 打开创建构建器，选择「通过制品构建镜像 / JAR」，进入下一步
2. 生成一个唯一前缀的 .jar 临时文件并通过制品上传控件选择
3. 观察请求：S2iBinary 创建与 /file 上传；记录响应与页面提示
4. 若上传失败：断言对话框中制品字段显示错误文本，构建器未被创建，s2ibinaries 无前缀残留
5. 若上传成功：继续创建并回读 builder 的 isBinaryURL 与 sourceUrl，再清理

## 期望结果

- 上传链路真实发起 POST s2ibinaries 与 PUT /kapis/devops.kubesphere.io/v1alpha2/namespaces/default/s2ibinaries/<name>/file
- 上传失败时页面如实显示服务端错误（当前上游 minio 不可用 → 500），不伪装成功
- 上传失败不创建 S2iBuilder，且半成品 S2iBinary 被删除
- 上传成功时 builder 的 spec.config.isBinaryURL=true、sourceUrl 指向 downloadURL

## 失败排查

- 上传 500：devops-apiserver 到 minio 的 DNS/服务是否可用
- 出现残留 S2iBinary：失败路径是否清理

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
