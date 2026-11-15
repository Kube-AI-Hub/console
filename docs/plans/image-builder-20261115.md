# 镜像构建器（S2I/B2I）页族迁移交付记录（2026-11-15）

> 单元：共享任务 task-4（镜像构建器页族完整迁移：列表 + 详情 + 构建记录 + 写入）。
> 旧实现：<code>console/src/pages/projects/containers/ImageBuilder/{index.jsx,Detail/*}</code>、<code>actions/imagebuilder.js</code>、<code>stores/s2i/{builder,run}.js</code>。
> 新实现：<code>apps/console-next/src/pages/app-workloads/ImageBuilderPage.tsx</code> + <code>imagebuilder/</code>；<code>packages/api-client/src/s2ibuilder.ts</code>。
> 规格：<code>prd/kube-frontend/app-workloads/s2ibuilder.md</code>、<code>design/kube-frontend/app-workloads/s2ibuilder.md</code>、<code>tests/ui/specs/kube-frontend/app-workloads/TC-…-S2IBUILDER-01..12.yaml</code>。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目级（namespace）：创建源码/制品构建器 → 触发构建运行 → 查看构建记录/制品/资源状态/环境变量/事件 → 重新构建/编辑信息/编辑 YAML/删除。 |
| 旧入口、源码、部署 URL | 列表 <code>/projects/:namespace/s2ibuilders</code>；详情 <code>/projects/:namespace/s2ibuilders/:name</code>（默认 <code>/records</code>，另有 <code>/resource-status</code>、<code>/image-artifacts</code>、<code>/env</code>、<code>/events</code>）。组件：<code>ImageBuilder/index.jsx</code>、<code>Detail/{index,ResourceStatus,ImageProduct,BuildRecords,Environment,Events}.jsx</code>；表单 <code>components/Forms/ImageBuilder/{LanguageSelect,S2IForm,B2IForm,RerunForm}</code>；卡片 <code>projects/components/Cards/{ImageArtifacts,ImageBuilderLastRun,ImageRunRecord}</code>；store <code>stores/s2i/{builder,run}.js</code>；action <code>actions/imagebuilder.js</code>。旧部署未重复截图，行为以源码为契约线索、以 B200 本地全栈实测为准。 |
| 新入口、提交及工作树 | 路由 <code>/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/s2ibuilder</code>（列表）、<code>…/s2ibuilder/:name</code>（详情；页签为页内状态）。工作树未提交（本批不 commit）；本地 <code>apps/console-next/dist</code> 由 vite build 实际重建并用于 E2E/截图。 |
| 环境、集群、角色 | 本地全栈：BFF 127.0.0.1:8092（上游 18088→B200 30880）+ 静态站 http://localhost:5178；集群 host；项目 default；角色 admin（tests/ui/.env，凭据不入库/截图）。 |
| 视口、主题、语言 | 截图 1024/1280/1600 宽，中文与英文（<code>localStorage kube-frontend-locale=en</code>）。应用当前只有一套深色主题 token，浅色/第二色调未验收（§6）。 |
| 子页面与状态范围 | 列表（空/加载/错误/无权限/搜索无匹配）、创建向导两步（S2I/B2I 上传失败分支）、详情五页签、运行/重新构建（含更新工作负载开关）、编辑信息、编辑 YAML、删除、详情 404。 |
| 明确排除及批准 | containerd 运行时警告（无运行时信息源，旧提示也不阻止操作）；旧列表的列过滤高级输入框（旧实现所有列无 search 标记，回车会报错）；批量编辑/批量运行（旧版也没有）。见 PRD「明确不做」，不占能力分母。 |
| 并行文件与安全边界 | 只改本单元路径（页面/路由/api-client s2ibuilder+barrel 对应行/locales devopsProject.s2ibuilder.*/prd|design s2ibuilder.md/specs|tests S2IBUILDER/tree.py 本功能 tests/pages/imagebuilder_page.py/本记录）。未改 queries.ts、capability-matrix.md、package.json、yarn.lock、out/。测试对象唯一前缀、回读、失败清理；未写入密码/token/kubeconfig。 |

## 2. 旧能力全集与归宿

原子 ID：LEG-IB-<区块>-<NN>。状态：通过 / 阻塞（环境，见 §6）/ 批准不做。

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-IB-L01 | index.jsx Banner | 总是 | 页头标题/说明 | 保留 | AC-01 / TC-01 表头与说明 | 通过 |
| LEG-IB-L02 | showCreate → imagebuilder.create | 有写权限 | 创建按钮打开两步向导 | 保留 | AC-03 / TC-03 向导与 POST 201 | 通过 |
| LEG-IB-L03 | getColumns NAME | 总是 | 名称列：displayName/name + 所属服务副行 + 详情链接 | 改进（类型/服务拆列、副行保留） | AC-01 / TC-01 名称与副行 | 通过 |
| LEG-IB-L04 | getColumns STATUS | 总是 | lastRunState：Running→Building，空→NOT_RUNNING_YET | 保留（Badge） | AC-01 / TC-01；TC-07 状态映射 | 通过 |
| LEG-IB-L05 | getColumns TYPE | isHideable | 标签 s2i-type→t(upper) | 保留（可隐藏） | AC-01 / TC-01 类型列 | 通过 |
| LEG-IB-L06 | getColumns SERVICE | isHideable | serviceName 链接服务详情，无则 - | 保留（可隐藏） | AC-01 / TC-01；TC-05 注解 | 通过 |
| LEG-IB-L07 | CREATION_TIME_TCAP | isHideable | 创建时间 YYYY-MM-DD HH:mm:ss | 保留（共享 formatTimestamp） | AC-01 / TC-01 | 通过 |
| LEG-IB-L08 | isHideable + localStorage hide-columns | 总是 | 状态/类型/服务/创建时间可隐藏，名称不可隐藏 | 保留（columnVisibility） | AC-01 / 列表契约覆盖 | 通过 |
| LEG-IB-L09 | reaction + 4s 轮询 | 有 Running | 列表 4 秒刷新 | 保留（refetchInterval 4000） | AC-01 / DEC-05；TC-01 刷新 | 通过 |
| LEG-IB-L10 | itemActions edit | 有写权限 | 编辑信息（别名/描述） | 保留（EditInfoDialog） | AC-02 / TC-02 回读 | 通过 |
| LEG-IB-L11 | itemActions delete | 有写权限 | 删除（输入名称确认） | 保留（DeleteDialog） | AC-02 / TC-02 回读 404 | 通过 |
| LEG-IB-L12 | defaultTableActions.selectActions | 有写权限 | 勾选多行批量删除 | 保留（selection+bulk-delete） | AC-02 / 同组件；E2E 覆盖单条 | 通过 |
| LEG-IB-L13 | Table Base refresh | 总是 | 刷新按钮 | 保留（image-builder:refresh） | AC-01 / TC-01 | 通过 |
| LEG-IB-L14 | Table Base FilterInput | 总是 | 列过滤高级输入（所有列无 search 标记 → 实际不可用） | 改进为服务端名称搜索 | AC-01 / TC-01 搜索 | 改进（旧缺陷，DEC-02） |
| LEG-IB-L15 | withList/ListPage | 总是 | 分页（旧默认 10/页）+ totalItems | 保留（服务端 page/limit/totalItems） | AC-01 / TC-01 请求带 page/limit | 通过 |
| LEG-IB-L16 | withList 空态 | 0 条 | 空态文案 | 保留 + 创建入口 | AC-01/12 / TC-12 空态 | 通过 |
| LEG-IB-L17 | getS2iSupportLanguage + constants | 创建向导 | s2i java/nodejs/python；b2i jar/war/binary；按模板标签合并去重 | 保留（buildLanguages） | AC-03/04 / TC-03 java；TC-04 jar | 通过 |
| LEG-IB-C01 | LanguageSelect | 向导第 1 步 | 构建模式（源码/制品）+ 语言卡片；未选不能下一步 | 保留（两步向导） | AC-03 / TC-03 | 通过 |
| LEG-IB-C02 | LanguageSelect 写 label/annotation | 选择语言 | labels[s2i-type] + annotations.languageType | 保留 | AC-03 / TC-03 回读 | 通过 |
| LEG-IB-C03 | CONTAINERD_RUNTIME_NOT_SUPPORTED | runtime=containerd | 提示（不阻止） | 明确不做（无运行时信息源） | PRD 明确不做第 2 条 | 批准不做 |
| LEG-IB-C04 | TemplateSelect getTemplateList | 创建/编辑 | 构建环境按语言过滤模板 containerInfo | 保留 | AC-03/04 / TC-03 预选 | 通过 |
| LEG-IB-C05 | handleTemplateChange | 选择构建环境 | 复制 runtimeImage/buildVolumes/runtimeArtifacts 到 config；环境变量选项/文档链接随模板 | 保留 | AC-03 / DEC-06；TC-03 builderImage | 通过 |
| LEG-IB-C06 | S2IForm sourceUrl + git/verify | 源码构建 | 仓库 URL 必填；blur 校验（非阻塞）；私库选 basic-auth | 保留 | AC-03 / TC-03 回读 sourceUrl；GOT-07 | 通过（环境限制） |
| LEG-IB-C07 | S2IForm revisionId | 源码构建 | 分支必填，默认 master | 保留 | AC-03 / TC-03 回读 master | 通过 |
| LEG-IB-C08 | S2IForm imageName/tag | 总是 | PATTERN_IMAGE_NAME；标签默认 latest | 保留 | AC-03 / TC-03 回读 | 通过 |
| LEG-IB-C09 | 目标镜像服务 | 总是 | dockerconfigjson 必填；写 repoUrl 注解 + 前缀镜像名 | 保留 | AC-03 / TC-03 回读前缀 | 通过 |
| LEG-IB-C10 | renderAdvancedSetting | 高级设置 | 触发令牌、相对路径（/）、模板环境变量 key/value | 保留 | AC-03 / TC-03 回读 environment | 通过 |
| LEG-IB-C11 | updateCreateData 名称生成 | 提交 | imageName+tag+3 随机字符，截断 60 | 保留（generatedBuilderName） | AC-03 / TC-03 名称合法 | 通过 |
| LEG-IB-C12 | updateCreateData donotautoscale | 编辑/运行 | 开关写/删 donotautoscale | 保留（运行对话框） | AC-06 / TC-06 两分支回读 | 通过 |
| LEG-IB-C13 | store.create → createS2IRun | 提交 | 创建后立即触发一次构建 | 保留 | AC-03 / TC-03 S2iRun 存在 | 通过 |
| LEG-IB-C14 | B2I Uploader | 制品构建 | S2iBinary→PUT /file→downloadURL/isBinaryURL/file 注解 | 保留 | AC-04 / TC-04 请求链路与失败清理 | 阻塞（上传 500） |
| LEG-IB-C15 | B2I 扩展名校验 | 制品构建 | 扩展名不符拒绝 | 保留 | AC-04 / 代码路径（E2E 未单独构造） | 通过 |
| LEG-IB-D01 | getAttrs NAME/PROJECT | 详情 | 名称、项目 | 保留 | AC-05 / TC-05 | 通过 |
| LEG-IB-D02 | getAttrs TYPE | 详情 | s2i/b2i | 保留（徽章+属性） | AC-05 / TC-05 | 通过 |
| LEG-IB-D03 | getAttrs BUILDER_IMAGE | 详情 | 构建器镜像 | 保留 | AC-05 / TC-05 精确值 | 通过 |
| LEG-IB-D04 | getAttrs IMAGE_NAME | 详情 | 镜像名称 | 保留 | AC-05 / TC-05 精确值 | 通过 |
| LEG-IB-D05 | getAttrs PULL_POLICY | 详情 | 拉取策略原值 | 保留 | AC-05 / TC-05 精确值 | 通过 |
| LEG-IB-D06 | getAttrs 代码仓库/制品 | 详情 | S2I sourceUrl；B2I 制品下载 | 保留（B2I 下载见 T03） | AC-05 / TC-05 sourceUrl | 通过 |
| LEG-IB-D07 | getAttrs REMOTE_TRIGGER+copy | 详情 | s2itrigger URL + secretCode + 复制 | 保留（逐字 URL） | AC-05 / TC-05 断言 | 通过 |
| LEG-IB-D08 | getAttrs CREATION_TIME/CREATOR | 详情 | 创建时间、创建者 | 保留 | AC-05 / TC-05 | 通过 |
| LEG-IB-D09 | getOperations RUN | 详情 | 预填配置+更新工作负载+PATCH+createS2IRun | 保留 | AC-06 / TC-06 | 通过 |
| LEG-IB-D10 | getOperations EDIT_INFORMATION | 详情 | 编辑信息 | 保留 | AC-05/02 / TC-05 顺序；TC-02 回读 | 通过 |
| LEG-IB-D11 | getOperations EDIT_YAML | 详情 | 整对象 PUT | 保留 | AC-05 / TC-05 打开/取消 | 通过 |
| LEG-IB-D12 | getOperations DELETE | 详情 | 删除后回列表 | 保留 | AC-05 / DeleteDialog+导航；列表删除 E2E 覆盖 | 通过 |
| LEG-IB-D13 | fetchData 404 guard | 404 | 回退列表 | 改进为「资源不存在+返回列表」 | AC-05 / TC-05 404 | 通过 |
| LEG-IB-D14 | creator 注解 | 详情 | 创建者 | 保留 | AC-05 / TC-05 | 通过 |
| LEG-IB-T01 | BuildRecords 默认页签 | 详情 | 构建记录默认 | 保留 | AC-07 / TC-07 | 通过 |
| LEG-IB-T02 | ImageBuilderLastRun S2I | 有运行 | 最后构建环境 builderImage/sourceUrl/revisionId | 保留（取最新运行 s2iBuildSource，未汇报如实说明） | AC-07 / TC-07 模拟 status 断言 | 通过（真实汇报阻塞） |
| LEG-IB-T03 | ImageBuilderLastRun B2I | B2I 有运行 | builderImage/binaryName/binarySize + 成功才可下载 | 保留（下载改带 token Blob） | AC-07/04 / 正文阻塞 | 阻塞（下载 500） |
| LEG-IB-T04 | ImageRunRecord 列表 | 有运行 | #count/状态/镜像/开始时间/最后消息/分页 10/自动刷新 4s | 保留（客户端分页，spec.builderName） | AC-07 / TC-07 | 通过 |
| LEG-IB-T05 | Item 展开日志 | 有运行 | 展开日志；模块未安装提示；4s 刷新 | 改进（直接读 status.logURL；无 URL 如实说明） | AC-07 / TC-07 无 logURL 提示 | 通过（正文阻塞） |
| LEG-IB-T06 | BuildRecords isB2i | B2I | 制品文件/大小 | 保留 | AC-07 / 代码路径 | 阻塞（无成功 B2I） |
| LEG-IB-T07 | ImageProduct | 详情页签 | 成功运行 imageName/imageSize/commandPull+copy/imageCreated | 保留 | AC-09 / TC-09 模拟 status + 复制 | 通过（真实成功构建阻塞） |
| LEG-IB-T08 | ResourceStatus 容器端口 | 详情页签 | Job 容器端口 name/protocol/containerPort | 保留 | AC-08 / TC-08 无 Job 提示 | 阻塞（无 Job） |
| LEG-IB-T09 | ResourceStatus PodsCard | 详情页签 | Job Pod 列表 + 自动刷新 + 监控 | 部分保留（名称/状态/就绪/重启/节点/IP；Pod 监控属工作负载详情，另页承接） | AC-08 / TC-08 | 阻塞（无 Job） |
| LEG-IB-T10 | Environment 容器 env | 详情页签 | Job 容器 env、valueFrom 解析、首个展开、敏感值打码 | 保留 | AC-10 / TC-10 无 Job 提示；代码覆盖分组/打码 | 阻塞（无 Job） |
| LEG-IB-T11 | Events Job 事件 | 详情页签 | 类型/原因/age/来源/消息 | 保留（最近发生时间 + 次数列） | AC-11 / TC-11 无 Job 提示 | 阻塞（无 Job） |
| LEG-IB-T12 | 详情页签 URL /records 等 | 详情 | 5 个页签 URL | 改进为页内状态（与全站详情一致） | AC-05/12 / TC-05 五页签 | 改进 |
| LEG-IB-S01 | Loading/错误态 | 列表/详情 | 加载骨架、错误提示 | 保留（五态分离） | AC-12 / TC-12 空/500/403 | 通过 |
| LEG-IB-S02 | 时间/大小格式 | 多处 | 同一格式只写一次 | 保留（format.ts/formatTimestamp） | AC-01/07/09 | 通过 |
| LEG-IB-S03 | 复制 URL/拉取命令 | 详情/制品 | CopyToClipboard + 成功提示 | 保留（navigator.clipboard + Notify） | AC-05/09 / TC-09 复制提示 | 通过 |

计数（按原子 ID 去重）：本表 61 行 = 通过 51 + 环境阻塞 7（C14、T03、T06、T08、T09、T10、T11） + 批准不做 1（C03） + 改进 2（L14、T12）。**未映射旧能力 = 0；未经证明承接 = 0；未经批准删减 = 0。** 阻塞与未验证项不从分母删除。

> 说明：B2I 上传与依赖 Job 的页面能力在本地环境取不到控制器/存储产物 → 阻塞登记（§6）；其请求链路、失败处理与如实空态已实现并验收。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/参数 | 字段/标签 | 单位/精度 | 映射→页面位置 | 缺值/零/异常规则 | 同次响应对账 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-IB-L15 | GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/s2ibuilders?page&limit&sortBy=createTime&ascending=false&name | items/totalItems | 条 | 行数据与分页 total | 0→empty；越界页 500→回退页码；搜索无匹配→empty | TC-01 请求带 page/limit，行数与 items 对账 |
| LEG-IB-L04 | 同上的 status.lastRunState | Running/Successful/Failed/空 | 状态徽章 | 列表状态列 | 空/未知→尚未构建；未知不填 0 | TC-01/07 |
| LEG-IB-L07+L13 | status.lastRunStartTime / metadata.creationTimestamp | RFC3339 | YYYY-MM-DD HH:mm:ss | 最近构建/创建时间 | 缺→ - | TC-01 |
| LEG-IB-C06..C10 | POST /apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibuilders | spec.config.* + 注解/标签 | 字符串 | 详情/列表 | webhook 缺 pullPolicy/sourceUrl→403；重名→409 | TC-03 回读全字段 |
| LEG-IB-C09 | 同上 + annotation kubesphere.io/repoUrl | 镜像名前缀 | 无 | config.imageName | 无 registry 不拼 | TC-03 imageName=registry.example.com/… |
| LEG-IB-C13 | POST …/s2iruns {spec.builderName} | builderName | 条 | 运行记录 | 失败保留输入并报错 | TC-03/06 |
| LEG-IB-D07 | 触发器 URL 字符串 | namespace/name/secretCode | 无 | 属性区 | secretCode 空则无查询参数 | TC-05 |
| LEG-IB-C14 | POST …/s2ibinaries；PUT /kapis/devops.kubesphere.io/v1alpha2/namespaces/<ns>/s2ibinaries/<name>/file（multipart）→ spec.downloadURL | downloadURL/fileName/size/phase | size 字符串 | config.sourceUrl + file 注解 | 500→显示原因；半成品删除 | TC-04 请求链路；正文阻塞 |
| LEG-IB-T02..T05 | GET …/s2iruns；status.runState/s2iBuildSource/s2iBuildResult/logURL/kubernetesJobName | 见 design 字段映射 | imageSize 字节→1024 换算 | 记录/制品/最后环境 | 空状态→未知；无 logURL 不请求 | TC-07/09（/status 子资源模拟） |
| LEG-IB-T08..T11 | GET /apis/batch/v1/namespaces/<ns>/jobs/<name>；/api/v1/.../pods?labelSelector；/api/v1/.../events?fieldSelector | containers/selector/events | 无 | 资源状态/环境/事件 | 无 Job→如实提示；404 视为未创建 | TC-08/10/11 |

全局规则：查询键含 cluster/namespace/对象名/分页/搜索；列表服务端全局排序（createTime desc）与 totalItems；运行列表因 CRD 无分页改为 spec.builderName 过滤后的客户端分页（DEC-05）。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 列表：标题+创建（主操作）/搜索+刷新/表格；详情：返回→标题+状态→操作→属性→页签 | 三档首屏/详情截图 + TC-01/05 结构断言 |
| 字段栅格 | 列表列顺序 名称/类型/服务/构建器镜像/状态/最近构建/创建时间；窄屏依次隐藏类型+服务→最近构建→创建时间；属性两列，缺值 - | TC-01 表头；1024/1280/1600 截图 |
| 主题 | ai-kit 语义 token（ai-fg / ai-fg-muted / ai-line / ai-accent / ai-danger），无十六进制 | 截图 + 页面无裸色值（应用单一深色主题） |
| 图标与图表 | 语言图标 java/nodejs/python/jar/war/binary；状态用 Badge；不画空图表 | 创建向导/状态截图 |
| 通用控件 | ResourceList/Modal/Tabs/Select/Switch/DeleteDialog/EditInfoDialog/YamlDialog 复用 | 代码 + 契约套件；未新增公共组件 |
| 表单与弹窗 | 提交时校验；失败保留输入；提交中禁用并 loading；删除输入名称 | TC-03 校验、TC-02/06 回读 |
| 链接与状态 | 列表名→详情、服务→服务详情；删除后回列表/刷新；刷新保留搜索 | TC-01/02/05 |
| 控制台 | 不适用 | — |

复用决定：全部组合既有 ai-kit/ui 组件，**未新增或扩展公共组件** → 无需补 Storybook；未新建业务专用公共组件。

## 5. 编码与回归

- [x] PRD 的 AC 覆盖功能/数据/状态/权限/交互/视觉；design 写全 DEC/CON/INV/GOT 与被否方案。
- [x] 12 对 YAML/Python 一一镜像；docstring 首行字面 TC ID；选择器集中在 pages/imagebuilder_page.py。
- [x] 旧能力表独立比对新实现（§2 逐行）；新增能力（最近构建列、名称搜索、带 token 下载）单列。
- [x] 显式类型检查：api-client tsc（src 0 error，test 4 条既有 baseline）、console-next tsc 0 error。
- [x] 契约套件 1399 passed / 3 failed，失败全部在 appstore 并行在途页面；本单元页面全通过。
- [x] 构建：npx vite build（串行锁）成功，dist 用于 E2E/截图。
- [x] 相关 E2E 串行实跑 12 passed；api-client 单测 8 passed；写入用例唯一前缀、回读、失败清理（结果见 §6）。
- [ ] 全站串行 E2E 与共享组件影响回归：未运行 → 未验收（本页未改共享组件）。
- [ ] member 集群与新版部署：未验收。

## 6. 完成判定与证据

环境事实（2026-11-15，本地全栈 BFF→B200，admin，host/default）：

- **可验收链路（真实验收）**：列表（服务端分页/搜索/刷新/列）、创建 S2I（POST 201 + 回读 config/标签/注解 + S2iRun 201）、编辑信息（merge patch 回读）、删除（回读 404）、运行/重新构建（PATCH + 新 S2iRun + donotautoscale 两分支回读）、详情属性/五页签/404、编辑 YAML 对话框。
- **阻塞 1（控制器权限）**：s2ioperator-0 以 <code>system:serviceaccount:kubesphere-devops-system:default</code> 运行；cluster-scope list/watch s2ibuilders、s2iruns、jobs.batch、namespaces、configmaps 全部 forbidden。日志原文示例：<code>Failed to watch *v1alpha1.S2iBuilder: s2ibuilders.devops.kubesphere.io is forbidden: User "system:serviceaccount:kubesphere-devops-system:default" cannot list resource "s2ibuilders" in API group "devops.kubesphere.io" at the cluster scope</code>。影响：S2iRun 创建后不产生 Job/status/logURL → 构建成功状态、Job、日志正文、资源状态/环境变量/事件真实数据不可验收（页面如实降级；测试用 /status 子资源模拟并标注）。复查条件：为 operator SA 绑定 cluster-scope list/watch（或修正 helm RBAC）后重建一个真实运行。
- **阻塞 2（minio 缺失）**：B2I 上传 <code>PUT …/s2ibinaries/<name>/file</code> 返回 <code>500 RequestError: send request failed caused by: Put "http://minio.kubesphere-system.svc:9000/s2i-binaries/default-<name>" dial tcp: lookup minio.kubesphere-system.svc on 169.254.25.10:53: no such host</code>，S2iBinary → UploadFailed。影响：B2I 上传成功与制品下载正文不可验收；请求链路与失败清理可验收。复查条件：部署/恢复 minio 服务与 DNS。
- **环境限制 3（git/verify）**：<code>POST /kapis/resources.kubesphere.io/v1alpha2/git/verify</code> 恒 500 <code>authentication required</code>；表单按非阻塞提示（与旧版一致）。

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（含阻塞登记） | §2 共 61 行 = 通过 51 + 阻塞 7 + 批准不做 1 + 改进 2；未映射 0/未经证明承接 0/未经批准删减 0；阻塞 7 行保留在分母 | 阻塞项不关闭 |
| 数据语义 | 通过 | 列表 totalItems/行数、builder config 全字段、S2iRun builderName、donotautoscale、模拟 runState 映射（TC-03/06/07/09） | 真实 controller runState/logURL 未验证 |
| 交互与权限 | 通过（admin 写链路）/部分未验收 | 创建/编辑/删除/运行回读与清理；403 无重试（TC-12 拦截模拟） | 真实非 admin 身份未验收；member 未验收 |
| 视觉与主题 | 通过（本地）/部分未验收 | /tmp/image-builder-*.png 三档 + 中英文人工核对 | 浅色主题/第二色调未验收（应用当前单一主题） |
| 静态/类型/构建/测试 | 通过（含基线失败） | api-client tsc src 0（test 4 条既有）；console-next tsc 0；api-client 单测 8 passed（test/s2ibuilder.test.ts）；契约 1399/1402（3 条并行在途）；vite build 成功；E2E 12 passed（见下） | 全站 E2E 未跑 |
| 本地全栈/B200 读取 | 通过（读） | 上游 18088→B200 30880；模板 5 条、CRUD 回读、operator forbidden 证据 | 构建产物阻塞 |
| 新版部署/member/全站 | 未验收 | — | 明确列出 |

### E2E 实跑（本地全栈，串行 -n 0，KA_APP_URL=http://localhost:5178）

命令：

    cd console/tests/ui && KA_APP_URL=http://localhost:5178 \
      python3 -m pytest tests/kube-frontend/app-workloads/test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_*.py \
      -m ui -q -p no:cacheprovider -n 0

结果（逐条，以最终串行为准）：

- **最终判定运行：12 passed / 0 failed / 0 skipped，用时 67.93s**（对应 dist 为最后一次 vite build；命令同上）。
- 首轮全量：5 passed / 7 failed。根因：job 查询在无 kubernetesJobName 时被 disabled，TanStack Query 保持 isPending → 五个 Job 依赖页签显示骨架而非“无 Job”提示。修复：jobLoading 仅在存在 jobName 时取 isPending；重建 dist 后 TC-05/08/10/11 通过。
- 第二轮（TC-03/04/06）：TC-03 失败于“构建环境未预选”——同语言重选时清空 builderImage 而 seed effect 依赖未变；修复为选模式/语言时直接 seed 默认模板镜像。TC-04 失败于上传请求断言过早（上传异步：先 POST S2iBinary 再 PUT /file）；改为轮询等待。TC-06 失败于运行表单要求目标镜像服务，而 API 造的测试构建器没有 pushAuthentication；测试改为先建 dockerconfigjson 密钥并写入构建器。
- 第三轮与最终轮：TC-04 改为“名称集合差集”避免共享项目计数抖动；TC-12 英文断言此前依赖残留数据（空项目没有表头），改为用例自建一行并显式 1600 视口；随后全量 12 passed。
- 缺陷归属：上述失败均为测试/实现在本批内修复的机械问题，非环境阻塞；环境阻塞项（构建产物）单列在 §6 上表，不从分母删除。

截图（人工核对，已逐张查看）：/tmp/image-builder-1024-zh.png、/tmp/image-builder-1280-zh.png、/tmp/image-builder-1600-zh.png、/tmp/image-builder-1600-en.png（英文表头 Name/Status/Type/Service/Builder image/Last build/Created）；详情 /tmp/image-builder-detail-1600-zh.png（属性、五页签、运行记录 #1 成功）；/tmp/image-builder-detail-artifacts-1600-zh.png（镜像名/11.77 MB/拉取命令/发布时间）。E2E 用例截图在 console/tests/ui/artifacts/test_TC_…S2IBUILDER_*/。

人工核对结论：1600 全列可读；1280 隐藏类型/所属服务/创建时间后仍保留名称/状态/构建器镜像/最近构建；1024 仅名称/状态/构建器镜像，状态徽章与时间不再竖排换行（本批修复了 Badge/时间列的 nowrap 与窄屏列序）；深色主题 token 对比度正常，无裸色值；英文界面无原始 key。

### 清理

- E2E 对象（builder/run/secret/binary）在 finally 删除并回读。收尾扫描默认项目 tc-e2e-s2i-*：清理了被中断轮次留下的 1 个构建器（tc-e2e-s2i-272897-detail）与首轮失败留下的 3 个 S2iBinary/1 个构建器+运行，最终读回 **builders=0、runs=0、s2ibinaries=0、secrets=0 残留**。
- 未修改集群 RBAC、未部署 minio、未删除非本次前缀对象。

### 能力矩阵

按任务约定由 Lead 统一更新 docs/plans/capability-matrix.md（本单元不直接改）。
