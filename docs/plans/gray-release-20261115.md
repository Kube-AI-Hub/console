# 灰度发布页族迁移交付记录（2026-11-15）

> 本记录按[单页迁移交付模板](../plans/page-migration-template.md) §1–§6 填写；
> 方法见[迁移指南](../legacy-ui-migration-guide.md)。旧能力表先于新 AC 独立建立，
> 不从新 PRD 反推。AC/TC 的完整 ID 与断言在
> [PRD](../../prd/kube-frontend/app-workloads/gray-release.md)、
> [design](../../design/kube-frontend/app-workloads/gray-release.md)、
> [specs](../../tests/ui/specs/kube-frontend/app-workloads/) 中，不在本文件重复定义。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 项目控制台：看到项目内灰度发布策略及其分流 → 创建（含初始流量）→ 详情（版本/权重/匹配规则/条件）→ 调整流量/暂停/恢复 → 删除。集群 host，项目 default，角色 admin |
| 旧入口、源码版本、部署 URL | 路由 `/:workspace/clusters/:cluster/projects/:namespace/grayrelease`（子页 `cates` / `jobs`），容器 `src/pages/projects/containers/GrayRelease/{index,Categories,Jobs}`，弹窗 `src/pages/projects/components/Modals/GrayReleaseDetail`，Store `src/stores/grayrelease.js`，表单 `src/components/Forms/GrayRelease/**`；部署 URL 同路由段。旧实现是 AGPL 源码，仅用于行为清点，新实现独立编写 |
| 新入口、提交及工作树 | 列表 `…/grayrelease`、详情 `…/grayrelease/:name`；代码见 design 的「仓库落点」。工作树含并行成员在途文件（imagebuilder 等），本单元文件见 §5 |
| 环境、集群、角色 | 本地全栈：BFF 127.0.0.1:8092（上游 ssh 隧道 18088→B200 30880）、静态站 http://localhost:5178（服务 `apps/console-next/dist`）；集群 host；账号 admin（B200）。未在成员集群/生产前端/member 角色验收 |
| 视口、主题、语言 | 1600×900 主视口；截图覆盖 1024/1280/1600 中文与 1600/1024 英文；深色主题（当前唯一主题）。未覆盖浅色/第二色调 |
| 子页面与状态范围 | 列表（空/加载/错误/就绪、搜索、排序、下钻）；创建向导（表单/确认两步、三种类型、初始流量、失败保留）；详情（四区块、三态、版本卡副本与工作负载链接）；调整流量弹窗（权重/内容接管/蓝绿/镜像只读）；暂停/恢复；删除确认（输入名称、失败不关闭） |
| 明确排除及批准 | 监控曲线（RPS/成功率/延迟/TCP）登记待补/阻塞（端点证据见 §3）；不代建新版本工作负载、不内嵌容器编辑器（等价承接工作负载页）；不级联删除工作负载；集群级列表/实时 watch/流量历史不做。均写入 PRD「明确不做」与 design DEC，未写成「不做」代替阻塞 |
| 并行文件与安全边界 | 独占：`pages/app-workloads/CanaryReleasesPage.tsx`、`CreateGrayReleaseDialog.tsx`、`canary/**`、`packages/api-client/src/servicemesh.ts`、`grayrelease` 路由、`tests/ui/pages/canary_page.py`、本页 PRD/design/specs/tests。共享文件只用 edit 局部追加：`packages/api-client/src/index.ts`、`packages/locales/src/index.ts`、`prd/tools/tree.py`、`tests/ui/cases/**`（生成物）。未改 cluster/**、user-settings/about、package.json、yarn.lock、out/、capability-matrix.md；未提交 git；日志/文档/截图中不含口令与 token |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-grayrelease-001 | `routes/grayrelease.js`、`GrayRelease/index.jsx` | 项目内、servicemesh 启用 | 项目控制台「灰度发布」入口 + Banner 标题/描述/使用前提 tips/文档链接 | 保留入口；tips 不做（迁移指南要求减少重复说明），文档链接不迁移 | AC-01；TC-01 列表可达 | 通过（tips 改进） |
| LEG-grayrelease-002 | 同上 `getChildRoutes` | — | 子页 `cates`（发布模式）与 `jobs`（发布任务） | 改进：合并为单页列表 + 创建向导（DEC-04） | AC-01/02；TC-01/02 | 通过 |
| LEG-grayrelease-003 | `Jobs/index.jsx` | — | 卡片列表；空态含创建按钮；页脚显示总数 | 表格列表；空态含主操作；无分页页脚（全量单页） | AC-01；TC-01 空态文案/行 | 通过 |
| LEG-grayrelease-004 | `Jobs/Item.jsx`、`object.mapper.js StrategyMapper` | — | 卡片标题：策略名；APP 标签 `labels["app.kubernetes.io/name"]` | 名称列（metadata.name / 别名）；不再单独显示 app 标签 | AC-01；TC-01 行名称 | 等价（app 标签不单列） |
| LEG-grayrelease-005 | 同上 + `GRAY_RELEASE_CATEGORIES` | — | 发布模式标签（蓝绿/金丝雀/镜像，含 `_LOW` 变体） | 类型列徽章 + 详情「分流方式」 | AC-01/03；TC-01 金丝雀发布、TC-03 分流方式 | 通过 |
| LEG-grayrelease-006 | 同上 | — | SERVICE：`hosts` | 目标服务列 + 详情目标服务 | AC-01/03；TC-01 断言 host、TC-03 | 通过 |
| LEG-grayrelease-007 | 同上 | — | VERSIONS：新/旧版本 + 副本 available/desire（`/kapis servicemesh workloads/<name>/health`） | 列表版本列（新版本在前 + 权重）；副本数移入详情版本卡（Deployment status，DEC-10） | AC-01/03；TC-01 版本与权重、TC-03 副本 0/1 | 通过（来源改为 Deployment） |
| LEG-grayrelease-008 | `Jobs/Item.jsx` 三/两图 | — | 请求量 RPS、成功率 %、延迟 ms；tcp 协议时 TCP 收发 B/s（5 分钟窗口） | 待补：登记阻塞（§3 端点证据）；不由本单元实现 | 无 AC（明确不做 + 待补） | 待补/阻塞 |
| LEG-grayrelease-009 | `Jobs/index.jsx` `renderFooter` | — | `TOTAL_ITEMS` 总数 | 表格行数即总数（CRD 无服务端分页） | AC-01；TC-01 计数在 TC-02 finally 核对 | 等价 |
| LEG-grayrelease-010 | `Jobs/index.jsx` 空态 | canCreate：applications edit + servicemesh 模块 | 空态 + 创建按钮 | 空态 + 主操作（权限由 SSAR，DEC-13） | AC-01/08；TC-01/08 | 通过 |
| LEG-grayrelease-011 | `Jobs/Item.jsx` onClick | — | 点卡片打开全屏详情弹窗 | 改进：名称链接进入详情路由（DEC-04） | AC-01；TC-01 下钻、TC-03 | 通过 |
| LEG-grayrelease-012 | `Categories/index.jsx` | `grayscale-release:create` | 三张类型卡（蓝绿/金丝雀/镜像）+ 每卡创建按钮 | 改进：创建向导内选择类型（DEC-04），权限用 SSAR | AC-02/08；TC-02/08 | 通过 |
| LEG-grayrelease-013 | `Forms/GrayRelease/BaseInfo` | — | 名称：必填、PATTERN_NAME、maxLength 253、同名异步校验（kapis 查询） | 名称必填 DNS label、maxLength 63、服务端 409 就地显示 | AC-02；TC-02 名称合法/唯一 | 改进（校验时机） |
| LEG-grayrelease-014 | `Forms/GrayRelease/Components` | 应用需 serviceMeshEnable；禁用项带提示 | 选择应用（仅 service mesh 应用）→ 选择组件（服务），写入 selector/hosts/principal/协议/注解 | 改进：选择项目内 Deployment，app 标签作 selector+host（DEC-05） | AC-02；TC-02 选择器/host 回读 | 通过 |
| LEG-grayrelease-015 | `Forms/GrayRelease/Version` | — | 新版本号（必填、PATTERN_COMPONENT_VERSION、命名冲突校验）、副本数、容器列表（增删改） | 不做：不代建新版本工作负载；容器/副本由工作负载页承接（PRD 明确不做、DEC-12 相关） | 无 AC（明确不做） | 明确不做（有承接） |
| LEG-grayrelease-016 | `PolicyConfig/Canary/ByTraffic` | Canary 按流量模式 | 流量滑块 0–100（默认 50）、信息提示含比例/组件/新版本 | 创建向导「初始流量」+ 详情「调整流量」滑块/数字/摘要 | AC-02/05；TC-02 75/25、TC-05 35→65/35 | 通过 |
| LEG-grayrelease-017 | `PolicyConfig/Canary/ByContent` + Cookie/Header/OSSelect | 协议 http | 编辑 cookie（精确/正则）、请求头（精确/正则 key/value）、URL（前缀/正则）、客户端 OS 多选 | 创建时不提供规则编辑（不在本单元范围）；详情只读展示全部 match + 接管/恢复 | AC-03/04/05；TC-04/05 | 部分（编辑待补） |
| LEG-grayrelease-018 | `PolicyConfig/Bluegreen` | — | 版本单选：旧/新，权重 100/0 或 0/100，默认 governor=旧版本 | 创建类型 Bluegreen 固定 100/0；详情「调整流量」两版本单选 | AC-02/05；TC-02/05 | 通过 |
| LEG-grayrelease-019 | `PolicyConfig/Mirror` | — | 无输入，自动生成 route 旧 100% + mirror 新版本 | 创建类型 Mirror 生成 mirror 目标；详情只读展示镜像副本 | AC-02/03；TC-02/05 | 通过 |
| LEG-grayrelease-020 | `GrayReleaseStore.create` | — | POST strategy +（可选）POST workload；成功 Notify 并跳转 jobs、清理表单持久化 | POST strategy；确认前无写、成功提示、列表 refetch；不代建 workload | AC-02；TC-02 | 通过（不代建 workload） |
| LEG-grayrelease-021 | `GrayReleaseDetail/index.jsx renderTitle` | 删除按钮：`grayscale-release:delete` | 名称 + 发布模式 + 删除 | 详情头部名称/类型/状态 + 删除（SSAR delete） | AC-03/07/08；TC-03/07/08 | 通过 |
| LEG-grayrelease-022 | 同上 Alert | governor 存在 | 接管提示（新旧版本不同文案）、删除前提示 | 操作结果提示（已暂停/已恢复/已更新）+ 条件区块说明 | AC-04/06；TC-04/06 | 改进 |
| LEG-grayrelease-023 | `GrayReleaseDetail/Component` | 有新版本菜单、非接管时可接管 | 新/旧两列卡片：工作负载链接、版本 tag、副本 available/desire、Pod 列表（CPU/内存/GPU）、更多菜单（编辑新版本/接管） | 版本卡（版本/角色/权重/接管徽章/副本/工作负载链接）；Pod 列表与 GPU 指标等价承接工作负载详情；编辑容器不做；接管→调整流量/暂停恢复 | AC-03/05/06；TC-03/05/06 | 部分（Pod 列表/容器编辑承接） |
| LEG-grayrelease-024 | `renderTraffic` + TrafficSlider + NotifyConfirm | Canary 按流量 | 滑块 + 二次确认（比例文案）、取消重置 | 调整流量弹窗：滑块 + 数字输入 + 摘要 + 确认/取消 | AC-05；TC-05 | 通过 |
| LEG-grayrelease-025 | `renderContentMatch` | Canary 按内容 | 请求参数展示（cookie/OS/请求头/URL）+ 箭头 + 新版本副本 + governor 横幅 + 恢复 | 匹配规则表（全部 match，含未建模）+ 条件区块 + 调整流量（保持/新/旧接管） | AC-04/05；TC-04/05 | 保留并改进（DEC-09） |
| LEG-grayrelease-026 | `renderBluegreen` | Bluegreen | 单版本 100% 条形 | 版本卡权重 + 接管徽章 + 两版本单选 | AC-03/05；TC-05 | 通过（形态改进） |
| LEG-grayrelease-027 | `renderMirror` | Mirror | 两条 100% 条形 + 镜像图标 + 非接管标记 | 版本卡镜像副本徽章（无权重）+ 不提供调整流量 | AC-03/05；TC-03/05 | 通过（形态改进） |
| LEG-grayrelease-028 | `GrayReleaseDetail/Monitor` | — | 三折线 + TCP 两线，10s 轮询 | 待补/阻塞（同 LEG-008） | 无 AC | 待补/阻塞 |
| LEG-grayrelease-029 | `initWebsocket` + reaction | — | Pod watch 触发副本数重取 | 不做实时 watch；刷新按钮/窗口聚焦重取 | 无 AC（明确不做） | 明确不做 |
| LEG-grayrelease-030 | `handleTakeover` | type≠Mirror | 新/旧版本接管（governor 写入；按内容与蓝绿各路径） | 调整流量：内容模式新/旧接管；按权重 0/100 自动写 governor | AC-05；TC-05 | 通过（DEC-08） |
| LEG-grayrelease-031 | `handleRecover` | governor 非空 | 恢复：governor='' | 「恢复发布」/内容模式「保持按规则分流」 | AC-05/06；TC-05/06 | 通过 |
| LEG-grayrelease-032 | 无直接等价 | — | 旧 console 无「暂停发布」命名 | 新增：暂停=参考版本接管、权重保留；恢复=清空 governor（DEC-08） | AC-06；TC-06 | 新增/等价 |
| LEG-grayrelease-033 | `handleOffline` / `onDelete` / store.delete | `grayscale-release:delete` | 删除确认；删除策略，接管/镜像场景可能删除非接管版本工作负载；关闭弹窗并刷新 | 输入名称确认 → DELETE strategy → refetch → 回列表；不级联删除工作负载（DEC-12） | AC-07；TC-07 | 通过（不级联） |
| LEG-grayrelease-034 | `CanDelete` | — | 删除权限 `grayscale-release:delete` | SSAR delete（明确 false 时隐藏） | AC-08；TC-08 | 通过 |
| LEG-grayrelease-035 | `canCreate` | applications edit + servicemesh 模块 | 创建权限 | SSAR create（明确 false 时禁用+原因，检查失败 fail-open） | AC-08；TC-08 | 通过 |
| LEG-grayrelease-036 | `EditForms/GrayReleaseComponent` | — | 编辑新版本容器（镜像/端口/环境变量等） | 不做：工作负载详情「编辑设置」承接（已交付单元） | 无 AC（明确不做） | 明确不做（有承接） |
| LEG-grayrelease-037 | `Edit/config.js` + `PolicyConfig` 复用 | — | 详情内编辑策略（流量/匹配规则） | 调整流量弹窗覆盖流量/接管；匹配规则编辑不做（待补） | 无 AC（部分） | 部分（规则编辑待补） |
| LEG-grayrelease-038 | `renderTitle`/`hosts` | — | 名称、服务 host | 基本信息区块（集群/项目/目标服务/创建时间/标签来源） | AC-03；TC-03 | 通过 |
| LEG-grayrelease-039 | `GRAY_RELEASE_CATEGORIES` | — | 发布模式文案 | 基本信息「分流方式」+ 类型徽章 | AC-03；TC-03 | 通过 |
| LEG-grayrelease-040 | StrategyMapper 两版本假设 | — | 仅按新旧两版本解析 | 从路由派生任意版本；takeover/governor 徽章通用 | AC-03；TC-03/05 | 改进 |
| LEG-grayrelease-041 | 旧弹窗无独立属性区 | — | 信息散落在标题与卡片 | 新增基本信息区块（八字段） | AC-03；TC-03 | 新增 |
| LEG-grayrelease-042 | 旧 mapper 读 `spec.assemblyPhase`（CRD 无此字段） | — | 无状态展示（值恒空） | 新增派生状态徽章 + 列表状态 + 条件表（DEC-01/11） | AC-01/04；TC-01/04 | 新增 |
| LEG-grayrelease-043 | Loading / EmptyList / Notify | — | 加载、空、失败提示 | 四态 surface + 错误重试 + 权限原因 + 失败保留输入 | AC-01/07/08；TC-01/07/08 | 保留/改进 |
| LEG-grayrelease-044 | 旧 i18n keys | — | 中英文案 | 中英字典成对键，en 截图核对 | AC 全部（视觉） | 通过 |
| LEG-grayrelease-045 | `index.scss` 深色变量 | — | 深色主题样式 | ai-kit 语义 token，无十六进制色值（C3） | AC-03（视觉） | 通过 |
| LEG-grayrelease-046 | 旧卡片流 | — | 无搜索、无排序 | 新增：名称/创建时间排序、按名称/目标服务/版本搜索 | AC-01；TC-01（列头） | 新增 |
| LEG-grayrelease-047 | 旧 total 显示 | — | 无服务端分页 | 全量单页（CRD 不分页） | AC-01；等价 | 等价 |
| LEG-grayrelease-048 | 模块关闭时隐藏创建 | servicemesh 模块开关 | 未启用则隐藏入口 | 接口不可用 → 错误态 + 重试（不伪装空态） | AC-01；TC-01 错误态分支 | 改进 |

计数：48 行；通过 27、改进 6、等价 3、新增 4（合计 40 行关闭）；部分 3（LEG-017/023/037，规则编辑与 Pod 列表/容器编辑承接待补）；明确不做（有承接/有理由）3（LEG-015/029/036）；待补/阻塞 2（LEG-008/028）。未映射 0、未经证明承接 0、未经批准删减 0。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/版本/作用域/参数 | 字段或指标/标签 | 原单位→显示单位/精度/分母 | API 映射→页面位置 | 缺值/零/异常/过期值规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-003/004 | `GET /apis/servicemesh.kubesphere.io/v1alpha2/namespaces/default/strategies` | `items[]` Strategy | — | `toStrategySummary` → 列表行 | 0 条=空态；404/5xx=错误态；无分页参数 | TC-01 列头/行值；TC-02 finally 计数 |
| LEG-005/006/007 | 同上 | `spec.type`、`template.spec.hosts[0]`、`principal`、`route[].destination.subset/weight` | 权重 %，整数；缺省不补 0 | 类型/目标服务/版本列；版本权重次级行 | 缺 type→原样；缺 hosts→selector app→模板名；缺 weight→不显示百分比 | TC-01 ""金丝雀发布""/host/"20%"/"80%" |
| LEG-042 | 同上 | `status.conditions[].type/status/reason/message/lastTransitionTime`、`completionTime` | — | `strategyStatusOf` → 状态徽章；详情条件表 | Failed=True→失败；Complete=True/ completionTime→已完成；其它 condition→进行中；空→未知 | TC-01 已完成；TC-04 条件四字段 |
| LEG-016/018/019/024 | `POST /…/strategies` | `spec.governor`、`template.spec.http[].route[].weight`、`mirror` | % 整数 0–100 | 向导初始流量 → manifest；详情版本卡 | 0/100 同步 governor；非 0/100 空；镜像无权重 | TC-02 回读 75/25、100/0、mirror |
| LEG-024/025/030/031/032 | `PUT /…/strategies/<name>`（整对象 + resourceVersion） | 同上 | % | 调整流量/暂停/恢复 → PUT → 详情与列表重取 | 对象无两版本路由时拒绝写入；非法输入不写；失败保留输入 | TC-05 65/35、0/100、100 接管；TC-06 governor 与权重 |
| LEG-033 | `DELETE /…/strategies/<name>` | — | — | 删除确认 → DELETE → refetch → 回列表 | 404 视为已删除；失败保留确认框 | TC-07 回读 404 + 行消失 |
| LEG-007/023 | `GET /apis/apps/v1/namespaces/default/deployments` | `metadata.name`、`spec.replicas`、`status.readyReplicas` | 副本数整数，分母为 spec.replicas | 版本卡「副本 ready/total」+ 工作负载链接 | 找不到 Deployment→「未找到对应工作负载」（不显示 0/0）；readyReplicas 缺省按 0 计（真实 0） | TC-03 ""副本 0/1"" 与 ""未找到"；v1 卡片不含 ""0/0"" |
| LEG-034/035 | `POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews` | `verb=create/delete`、`resource=strategies`、`group=servicemesh.kubesphere.io` | — | 列表创建按钮 disabled/hint；详情删除按钮渲染 | 明确 false→禁用/隐藏；错误/未返回→fail-open | TC-08 SSAR 请求体含 create/delete；拒绝时按钮状态 |
| LEG-008/028 | `GET /kapis/servicemesh.kubesphere.io/v1alpha2/.../workloads/<name>/metrics`（旧） | request_count/error/duration、tcp_sent/received | RPS、%、ms、B/s | 未实现 | 端点证据不足 → 待补/阻塞，不填 0 | 未验收（阻塞登记） |

写路径实测（2026-11-15，default 项目，全部对象已清理）：`POST` 201；`PUT` 权重 80/20→70/30 回读 `[70,30]`、第二条 http 规则的 match 保留、`template.metadata` 被 CRD 裁剪为 `{}`；`PUT` 注入 `status.conditions.Complete=True` 回读一致；`DELETE` 200 后 `GET` 404。`/apis/servicemesh.kubesphere.io` 的 versions 只有 `v1alpha2`；全集群 strategies 0 条；`/kapis/.../klusters/host/.../workloads/<name>/metrics` 404、`namespaces` 变体 200 但返回 `{"error":"unsupported query parameter 'namespaces'"}`；全集群 Deployment 无 servicemesh/strategy 控制器（仅 istiod）。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 信息层次 | 列表首屏回答「有哪些发布、分到哪些版本、是否完成」；详情首屏回答「两个版本怎么分」，其下匹配规则、条件 | 截图 `/tmp/gray-release-list-1600-zh.png`、`/tmp/gray-release-detail-{1024,1280,1600}-zh.png`、`/tmp/gray-release-detail-1024-en.png`；TC-03 区块纵向顺序 |
| 字段栅格 | 基本信息 dt/dd 两列（窄屏一列）；版本卡单列→≥lg 两列；匹配规则/条件为可横滚表格；列右对齐的数值用 tabular-nums | TC-03 三档 scrollWidth ≤ innerWidth+1；人工核对字段相对位置 |
| 主题 | ai-kit 语义 token（border-ai-line / bg-ai-surface-2 / text-ai-fg-secondary / accent-ai-accent）；禁止十六进制色值 | 代码无十六进制；计算样式人工核对；C3 门禁通过 |
| 图标与图表 | 状态/类型用 Badge 文字，不只用颜色；图表本轮不迁移（不画 0 条假数据） | TC-01/03/04 徽章文案；图表明确不做 |
| 通用控件 | ResourceList / AiSurface / DeleteDialog / DescriptionItem / Modal / Input / Button 全部复用；不新建业务专用公共组件 | 未改 ai-kit，无需 Storybook；删除复用共享确认框 |
| 表单与弹窗 | 两步确认；校验就地提示；取消不写；失败保留输入；关闭重置 | TC-02（下一步无写/失败保留）、TC-05（非法输入不写）、TC-07（失败不关闭） |
| 链接与状态 | 名称链到详情、工作负载名链到工作负载详情；加载/空/错误/无权限分开 | TC-01/03（链接）、TC-08（权限） |
| 控制台 | 不适用（本页无终端） | — |
| 复用决定 | 现有 ai-kit 组件足够（无滑块组件，流量用原生 range + ai-kit Input，随弹窗局部样式，不新增公共组件与 Storybook） | design DEC-14；本记录 §5 |

## 5. 编码与回归

- [x] PRD 的 8 条 AC 同时承接功能、数据语义、状态、权限、交互与视觉；design 为每条写出 DEC/CON/INV/GOT，含被否方案
- [x] YAML 与 Python 一一镜像（8 spec ↔ 8 测试文件，一文件一函数、docstring 首行字面 TC ID、选择器 data-ai-id）
- [x] 旧能力表独立比对实现；未映射 0 行；可自动检出的部分由 `check_docs` 与契约测试兜住，其余人工逐行核对
- [ ] API/mapper 单测、组件/应用测试、显式类型检查与构建、严格规格门禁分别记录（见下表）
- [ ] 固定本批构建并确认 BFF/代理版本；相关 E2E 串行判定（见下表）
- [x] 实际采样按同次响应核对；写入用唯一 `tc-e2e-gray-` 前缀，失败也清理，不删他人对象
- [ ] 新旧同角色同集群的首屏/全页、展开状态及三档截图人工复核（见 §6）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| api-client 单测 | `cd console/kube-frontend/packages/api-client && npx vitest run test/servicemesh.test.ts` | 18 passed |
| api-client 显式类型 | `npx tsc --noEmit -p tsconfig.json` | 我的文件 0 error；基线 3 error 在他人文件（`test/network-create.test.ts`、`test/workspace-groups.test.ts` 的 exactOptionalPropertyTypes） |
| console-next 显式类型 | `cd apps/console-next && npx tsc --noEmit -p tsconfig.json` | 我的文件 0 error；基线 error 全在并行成员在途的 `pages/app-workloads/imagebuilder/**`（46+24+15+9+4+1 条）与 `ImageBuilderPage.tsx` |
| 构建 | `while ! mkdir /tmp/kf-build.lock; do sleep 5; done; npx vite build; rmdir /tmp/kf-build.lock` | build_exit=0（`/tmp/canary-build2.log`，✓ built）；串行锁，未与并行构建重叠 |
| 严格规格门禁 | `python3 prd/tools/check_docs.py --strict prd/.../gray-release.md design/.../gray-release.md tests/ui/specs/kube-frontend/app-workloads` | errors=0 warnings=0 |
| 生成物 | `python3 prd/tools/build_prd.py` → `cd tests/ui && python3 generate_case_docs.py` | catalog 更新、374 份 case 文档与 `_traceability.md` 重生成 |
| E2E（本单元，串行 `-n 0`） | `KA_APP_URL=http://localhost:5178 python3 -m pytest tests/kube-frontend/app-workloads/test_TC_L3_..._GRAY_RELEASE_0{1..8}.py -m ui -q -p no:cacheprovider -n 0` | **8 passed in 66.95s**（一次串行运行，`/tmp/e2e-final.log`）；分条耗时 5.5/11.7/4.2/7.9/15.5/9.8/5.1/7.9s。首轮 05/08 失败是本用例自身的缺陷（mirror 的 manifest 类型写错、SSAR delete 断言顺序偏早），修的是用例；产品代码未因此改动。运行后 strategies 计数 0、无 `tc-e2e-gray-` 残留（别人单元的历史残留 Deployment 未动） |
| 契约套件 | `cd console/kube-frontend && npx vitest run --config config/vitest.config.ts` | 1399 passed / 3 failed；3 条失败全部在并行成员的 `pages/appstore/**`（AiSurface state 契约），本单元页面通过；locale 键成对与字面 `t()` 键检查通过 |
| 视觉截图 | `python3 /tmp/canary_shots.py`、`python3 /tmp/canary_shot_traffic.py` | `/tmp/gray-release-list-1600-{zh,en}.png`、`/tmp/gray-release-detail-{1024,1280,1600}-zh.png`、`/tmp/gray-release-detail-1024-en.png`、`/tmp/gray-release-traffic-1600-zh.png`（内容分流接管选项）、`/tmp/gray-release-traffic-weight-1600-zh.png`（权重滑块/数字/摘要）；截图对象自建并在 finally 删除 |

## 6. 完成判定与证据

| 维度 | 状态 | 日期/构建/证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 2026-11-15；§2 共 48 行：关闭 40（通过 27 + 改进 6 + 等价 3 + 新增 4）、部分 3、明确不做（有承接）3、待补/阻塞 2；未映射 0、未经证明承接 0、未经批准删减 0 | 规则编辑、监控曲线、新版本工作负载代建已逐项登记 |
| 数据语义 | 通过 | §3 请求→映射→展示；TC-01/02/03/04/05/06/07 回读断言；写路径实测 201/200/200/404 | 监控指标未实现（阻塞） |
| 交互与权限 | 通过 | TC-02 两步创建、TC-05 流量与非法输入、TC-06 暂停恢复、TC-07 删除与失败、TC-08 SSAR 允许/拒绝/fail-open | 受限账号真实 403 分支未验收（本环境无受限账号）；成员集群未验收 |
| 视觉与主题 | 通过（人工核对） | 三档 + 中英截图；区块顺序断言；无横向溢出；语义 token | 浅色/第二色调未测（当前产品唯一主题） |
| 静态/类型/构建/测试 | 通过（本单元） | 单测 18 passed；tsc 本单元 0 error；vite build exit 0；docs gate errors=0 warnings=0；E2E 8/8 passed（`-n 0` 串行）；契约套件 1399 passed | 基线：api-client 3 条 test 类型错误、console-next 全部 error 在 `pages/app-workloads/imagebuilder/**`、契约套件 3 条在 `pages/appstore/**`——均为并行范围，不修改、不冒称全仓通过 |
| 本地全栈/B200 读取 | 通过 | BFF 8092 → 隧道 18088 → B200；admin；真实 strategies API 读写与回读 | 新版生产前端未部署，未验收 |
| 新版部署/member/全站 | 未验收 | — | 生产目标、member 角色、全站串行 E2E 均未执行 |

清理结论（2026-11-15 收尾实测）：`GET /apis/servicemesh.kubesphere.io/v1alpha2/strategies` 返回 `items=0`（全集群），无 `tc-e2e-gray-` 前缀对象；E2E 8 条与截图脚本创建的对象都在 finally 删除并回读 404。default 项目里另有其他单元的历史 `tc-e2e-*` Deployment（如 `tc-e2e-355315-rev`、`tc-e2e-dep-b3e0902d`），不属于本单元、未触碰。

阻塞与待补（不得移出分母）：

- **BLOCK-1 无 servicemesh 策略控制器**：全集群无 servicemesh/strategy 控制器 Deployment（只有 istiod）；新建 Strategy 的 `status` 恒为空 → 真实对象状态恒为「未知」。派生与展示通过 PUT 注入 `status.conditions` 验收（TC-04），控制器产生的正分支（真实完成/失败、耗时、条件消息）不可验收。复查条件：集群出现 servicemesh 控制器且新对象写入条件。
- **BLOCK-2 监控曲线指标端点不可用**：`/kapis/servicemesh.../klusters/host/namespaces/default/workloads/<name>/metrics|health` 404；`namespaces` 变体 200 但返回 `{"error":"unsupported query parameter 'namespaces'"}`。LEG-008/028 待补。复查条件：kapis servicemesh 工作负载指标在本环境返回真实数据。
- **TODO-1 规则编辑**：创建/编辑匹配规则的 UI 未实现（LEG-017/037）；当前只能通过 YAML/API 设置并由详情只读展示。
- **TODO-2 受限账号 403 分支**：仅有 admin 账号，SSAR 拒绝分支用请求拦截验收；真实角色的 403 未验收。
- **TODO-3 成员集群**：原生端点需要 `clusters/<id>` 段，本环境只验证 host。

结论：**本地该页交付完成（范围内）**；BLOCK-1/2 与 TODO-1..3 为阻塞/待补，新版部署与 member 未验收。
