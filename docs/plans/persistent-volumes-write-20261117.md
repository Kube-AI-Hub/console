# 持久卷写能力（2026-11-17）

> 本批交付证据。范围是**集群持久卷页**的一个用户任务：编辑卷信息/YAML，并安全地删除不再需要的卷。
> 重纳决策 N-11；创建持久卷仍不做（老 console 集群存储页也没有创建入口）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群管理员在 /kube-frontend/clusters/<cluster>/persistentvolumes 清理未绑定卷、修正别名/描述/YAML，批量删除时不被 Bound/Released 卷拖住 |
| 旧入口、部署 URL | /clusters/host/volumes（Vue 页签跳转到 /clusters/host/volumes/Volumes），mlu370 http://10.1.37.18:30880，2026-11-17 实拍；详情 /clusters/host/pv/<name> |
| 新入口 | 列表 /kube-frontend/clusters/<cluster>/persistentvolumes，详情 …/persistentvolumes/<name> |
| 环境、集群、角色 | mlu370 host；admin（sysadmin）；集群有 22+ Bound 卷 |
| 视口、主题、语言 | 1600×1000 / 1280×1000 / 1024×1000；深+紫、浅+紫（列表/详情/批量结果），旧站 1600/1024 |
| 子页面与状态范围 | 列表（多选、行操作、批量删除、策略提示、结果汇总）、详情（编辑信息、编辑 YAML、删除、保护态）、编辑信息对话框、YAML 对话框、删除确认框 |
| 明确排除及批准 | 创建持久卷不做（老 console 也没有；PV 通常由供应器创建）；卷内文件查看不做（既有登记） |
| 并行文件与安全边界 | 不修改并行线登记；E2E 只创建唯一临时 Available 卷（hostPath 1Gi）并在断言后删除；未触碰环境已有卷，Bound 卷只读验证 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-PV-01 | 旧 /clusters/:cluster/volumes 列表（实拍列：名称/状态/持久卷(PVC)/访问模式/挂载状态/创建时间） | 集群成员 | 每页 10、共 22，名称链接详情 | 读取列按既有 AC-01 的七列（容量/绑定声明/回收策略替代旧「挂载状态」的信息），名称列第二行显示存储类型；写能力本批补 | AC-01；TC-01 | 通过（读列沿用既有交付） |
| LEG-PV-02 | 旧 /clusters/:cluster/pv/:name 详情 | 集群成员 | 状态/容量/访问模式/回收策略/存储类型/卷模式/挂载选项/创建时间/绑定声明 | 保留（既有交付） | AC-02；TC-02 | 通过（既有） |
| LEG-PV-03 | 旧详情「编辑信息」 | 集群管理员 | 别名/描述注解 | 保留：详情与列表行操作；merge-patch 只发 metadata.annotations，清空键发 null | AC-03；TC-03 | 通过 |
| LEG-PV-04 | 旧详情「编辑 YAML」 | 集群管理员 | 整对象编辑，保存 PUT | 保留：详情与列表行操作；PUT 带 resourceVersion，失败保留输入 | AC-03；TC-03 | 通过 |
| LEG-PV-05 | 旧删除（输入名称确认） | 集群管理员 | Bound/Released 不可删；确认输入名称 | 保留：列表行操作 + 详情按钮；保护态置灰并显示原因 | AC-04；TC-03 | 通过 |
| LEG-PV-06 | 旧批量删除 | 集群管理员 | 跳过不可删并汇总 | 保留：多选/全选、批量删除、结果行汇总成功/跳过/失败；全部不可删时不发请求 | AC-05；TC-03 | 通过 |
| LEG-PV-07 | 旧无创建入口 | — | — | 不做（登记「创建持久卷」） | — | 批准不做 |
| LEG-PV-08 | 旧列表刷新 | 集群成员 | 手动刷新 | 保留（列表刷新按钮） | — | 通过 |

**计数**：8 项原子能力；通过 6（03–06 本批，01/02/08 既有/回归）、批准不做 1（创建）、未映射 0、未验收 0。

## 3. 数据契约与全链路

| 能力 ID | 请求路径/方法 | 字段/标签 | 规则 | API 映射→页面位置 | 缺值/异常规则 | 同次响应对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-PV-03 | PATCH /api/v1/persistentvolumes/&lt;name&gt;，application/merge-patch+json | metadata.annotations（kubesphere.io/alias-name、description） | 先读当前对象；只发改动键；删除的键发 null；无改动不发请求 | persistentVolumesApi.updateInfo → EditInfoDialog | 保存失败：对话框保留输入，列表上方 MutationAlert 显示错误 | TC-03 轮询 GET 核对别名/描述 |
| LEG-PV-04 | GET 后 PUT /api/v1/persistentvolumes/&lt;name&gt; | 对象全量 + 当前 resourceVersion | 保留未在编辑器中出现的当前字段；409/校验错误留在对话框 | persistentVolumesApi.update → YamlDialog | 冲突保留输入 | TC-03 编辑 YAML 后回读别名 |
| LEG-PV-05/06 | DELETE /api/v1/persistentvolumes/&lt;name&gt;（逐条） | — | 提交前过滤 Bound/Released；批量逐条执行并收集结果 | persistentVolumesApi.remove → 列表/详情 | 部分失败计入失败数；不因一个失败中断整批 | TC-03 批量后 GET 核对可删卷 404、Bound 仍 200；汇总 data-ai-deleted=2/skipped=1/failed=0 |

**实测（2026-11-17，mlu370）**：E2E 自建 3 个 hostPath Available 卷；编辑信息后别名/描述回读一致；YAML 在别名行末追加 -yaml 后回读一致；Bound 卷详情删除按钮置灰并显示原因；选中「2 个临时卷 + 1 个 Bound」批量删除，汇总成功 2/跳过 1/失败 0，Bound GET 仍 200；单条删除第三个卷后 URL 回列表且 GET 404。清理后无临时 PV 残留。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 列表 | 多选/全选、行操作菜单（编辑信息/编辑 YAML/删除）、批量删除按钮；存在不可删卷时表格上方策略说明 | 三档深浅截图；批量结果行截图 |
| 保护态 | 行操作删除置灰；详情删除按钮置灰 + 可见原因文字；不依赖「点了再报错」 | 详情保护态 1600 深浅截图；E2E to_be_disabled + 原因可见 |
| 破坏性确认 | 单条输入名称；多条输入可删数量（不可删项不计入）；按钮未输入匹配时保持禁用 | E2E 输入后提交成功；批量输入 2 匹配可删 2 个 |
| 结果反馈 | 批量结果行显示成功/跳过/失败计数与 data-ai-* 属性，便于自动化与读屏 | 截图与 TC-03 属性断言 |
| 复用 | 不新增公共组件：EditInfoDialog / YamlDialog / DeleteDialog / ResourceList / selection 全部复用；仅扩展 persistentVolumesApi 两个写方法与 locales | 契约 1499 通过 |
| 主题/旧站对照 | 复用语义 token；旧站 1024 横向溢出，新页三档无溢出 | 截图与 scrollWidth 记录 |

## 5. 编码与回归

- [x] AC/US/design DEC-03 覆盖编辑信息、YAML、单删/批删、状态保护、确认与汇总。
- [x] 一 spec 一测试；E2E 自建唯一临时 PV 并在 finally 清理（创建/删除均走 API），已核对无残留。
- [x] 旧能力表独立比对；创建仍不做并保留原登记。
- [x] 类型检查、构建、契约、api-client 单测、dev 与固定构建 E2E 分别记录。
- [x] 严格门禁覆盖本页 PRD/design/spec；三档 + 深浅 + 旧站对照截图。
- [x] 未改并行范围，未提交/未推送。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 8 项：通过 6（4 项本批）、批准不做 1、未映射 0 | 创建按登记不做 |
| 数据语义 | 通过（host） | 编辑信息/ YAML 后回读；批量删除后 GET 对账；Bound 保护 | 409 冲突、批量 failed>0 分支未用模拟覆盖 |
| 交互与权限 | 通过（admin） | 保护态、单项/批量确认、结果汇总、单条后回列表 | 非 admin / 无权限未验 |
| 视觉与主题 | 通过（已测组合） | 三档深浅列表 + 详情保护态 + 批量结果 + 旧站 1600/1024 | 浅+绿/浅+英未逐张截图；未做设计评审签收 |
| 静态/类型/构建/测试 | 通过（含既有基线） | tsc 0；contracts 18 文件/1499；api-client 42 文件/419；E2E dev 11.72s、固定 dist 11.63s 各 1 passed；build 通过 | api-client 测试文件既有 TS2379；console-next 两个既有基线失败未修（非本批文件） |
| 本地全栈/部署/全站 | 部分 | 本地 Vite/BFF → mlu370 | 部署镜像、member、全站串行 E2E 未执行 |

## 7. 测试命令与结果

    cd console/kube-frontend
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    npx vitest run --config config/vitest.config.ts → 18 files / 1499 passed
    pnpm --filter @kube-ai-hub/api-client test → 42 files / 419 passed
    pnpm --filter @kube-ai-hub/console-next build → 通过

    KA_APP_URL=http://localhost:5175 …（dev）
      pytest ...PERSISTENT_VOLUMES_03.py -n 0 → 1 passed (11.72s)
      pytest ... -k PERSISTENT_VOLUMES -n 0 → 3 passed (17.62s，含 01/02 回归)
    KA_APP_URL=http://localhost:5176 …（固定 dist）
      ...PERSISTENT_VOLUMES_03.py → 1 passed (11.63s)
      ... -k PERSISTENT_VOLUMES → 3 passed (15.06s)

    cd console && python3 prd/tools/check_docs.py --strict \
      prd/kube-frontend/cluster-management/persistent-volumes.md \
      design/kube-frontend/cluster-management/persistent-volumes.md \
      tests/ui/specs/kube-frontend/cluster-management
    → errors=0 warnings=0（首轮 3 个 AC 未被 design 承接，补「关联需求」后通过）

## 8. 截图与记录

assets/persistent-volumes-write-20261117：
- 新 UI：list-{dark,light}-{1600,1280,1024}.png、detail-protected-{dark,light}-1600.png、list-batch-result-{dark,light}-1600.png
- 旧 console：old/list-{1600,1024}.png

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| YAML 409 冲突分支 | 未模拟 | 两个客户端并发编辑同一 PV，核对对话框保留输入并显示冲突 |
| 批量部分失败（failed>0） | 未模拟 | 删除期间另一客户端先删一卷或注入 403，核对汇总 failed 计数 |
| 非 admin / 无删除权限 | 未验收 | 普通集群成员账号，核对入口置灰/错误提示 |
| 浅+绿、浅+英组合 | 未验收 | 设计走查时补截图 |
| 部署/member/全站 | 未执行 | 构建推送镜像后按集成记录滚动；全站串行 E2E 按链路健康协议执行 |

## 10. 流程反思（已并入方法文档）

| 本批踩到的事 | 已写入 |
| --- | --- |
| 编辑信息「保存没反应」：别名含空格被老别名正则拦下，不是接口失败 | 指南 §8 #27：造数用连字符别名，先区分校验失败与接口失败 |
| 批量删除输入「2」但按钮一直置灰：只选到 1 个可删项时确认文本是该卷名 | 指南 §8 #28：确认文本按可删集合推导，不可删项不计入 |
| 保护态只在详情验证会把列表行操作的置灰漏掉 | 本批两处都实现并用同一 UNDELETABLE 集合；E2E 覆盖详情按钮，批量路径覆盖跳过 |

## 11. 关联文档

- PRD：prd/kube-frontend/cluster-management/persistent-volumes.md（US3/AC-03/04/05）
- design：design/kube-frontend/cluster-management/persistent-volumes.md（DEC-03）
- 用例：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03
- 既有只读交付：TC-…-01/02
