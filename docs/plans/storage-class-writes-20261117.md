# 存储类型写能力（2026-11-17）

> 本批交付证据。范围是**集群存储类型页**的一个用户任务：创建存储类型、编辑信息/YAML、切换默认与卷能力，并在确认没有 PVC 使用时删除。
> 重纳决策 N-12；创建/编辑/删除/默认/卷功能全部在本批交付。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群管理员在 /kube-frontend/clusters/<cluster>/storageclasses 维护存储类型；删除前必须确认没有 PVC 使用 |
| 旧入口、部署 URL | 旧 console 集群存储类型列表（/clusters/host/storageclasses）与详情；旧列表在选中项关联 PVC 非零时提示并中止删除 |
| 新入口 | 列表与详情同旧；新增创建对话框、行操作、批量删除、设置默认、卷功能对话框 |
| 环境、集群、角色 | B200 本地全栈（静态站 5176 → BFF 8092 → B200）；集群 host；账号 admin。TC-04 **1 passed（23.79s）**；截图已生成 |
| 视口、主题 | 复用既有列表/详情与对话框；截图待环境 |
| 子页面与状态范围 | 创建、编辑信息、编辑 YAML、设为默认、卷功能、单条删除、批量删除、PVC 守卫、PVC 读取失败 |
| 明确排除及批准 | 关联存储卷列表内编辑/删除（回项目存储页）；旧 console 的 accessor/auto-resizer 对象不在本批（卷扩展开关按 allowVolumeExpansion，DEC-04 #3） |
| 并行文件与安全边界 | 只改存储类型页/API/文案；E2E 自建唯一临时类与 Pending PVC 并清理，默认类型在 finally 恢复 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-SC-01 | 旧列表六列 | 集群成员 | 名称/供应者/存储卷数/能力/回收策略/创建时间 | 保留（既有） | AC-01；TC-01 | 通过（既有） |
| LEG-SC-02 | 旧详情 + 关联存储卷页签 | 集群成员 | 属性/驱动参数/关联 PVC | 保留（既有） | AC-02/03；TC-02/03 | 通过（既有） |
| LEG-SC-03 | 旧创建（基础设施操作，曾登记不做） | 集群管理员 | 供应者/回收策略/绑定模式/能力 | 新增创建对话框 | AC-04；TC-04 | 实现完成；E2E 待环境 |
| LEG-SC-04 | 旧编辑信息/编辑 YAML | 集群管理员 | 别名/描述、整对象 YAML | 列表行操作 + 详情按钮；info 用 merge-patch（清空键 null），YAML 用 PUT | AC-05；TC-04 | 实现完成；E2E 待环境 |
| LEG-SC-05 | 旧设为默认（曾登记不做） | 集群管理员 | 写默认注解，替换现有默认 | 行操作 + 详情按钮；先清旧默认三种拼写，操作前提示替换 | AC-05；TC-04 | 实现完成；E2E 待环境 |
| LEG-SC-06 | 旧卷功能（克隆/快照/扩容） | 集群管理员 | 三个开关 | 详情卷功能对话框；写注解/spec.allowVolumeExpansion，关闭移除字段 | AC-05；TC-04 | 实现完成；E2E 待环境 |
| LEG-SC-07 | 旧单条/批量删除 + PVC 拦截 | 集群管理员 | 输入确认；关联 PVC 非零中止 | 列表多选/批量 + 行操作；实时 PVC 统计守卫，读取失败停用 | AC-06；TC-04 | 实现完成；E2E 待环境 |

**计数**：7 项；既有只读 2、写 5 全部实现；E2E 与截图受环境阻塞。

## 3. 数据契约与全链路

| 能力 ID | 请求/方法 | 字段 | 规则 | 映射→页面 | 缺值/异常 | 断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-SC-03 | POST /apis/storage.k8s.io/v1/storageclasses | provisioner/reclaimPolicy/volumeBindingMode/allowVolumeExpansion/能力注解 | 只写勾选能力；成员集群走 /apis/clusters/<c> 段 | storageClassesApi.create | 名称/供应者校验在对话框；服务端错误显示在页面 | api 单测：body/成员路径 |
| LEG-SC-04 | PATCH metadata.annotations；GET+PUT | alias/description；整对象 resourceVersion | patch 只发改动键，删除键 null；PUT 保留未编辑字段 | updateInfo / update | 失败保留对话框与输入 | api 单测：null diff；E2E 回读 |
| LEG-SC-05 | GET 列表 + PATCH 旧默认/新默认 | storageclass.kubernetes.io/is-default-class（三种拼写） | 先清旧默认再设新；已有默认时提示替换 | setDefault | 列表/详情刷新；不出现双默认 | api 单测：清除+设置两个 PATCH |
| LEG-SC-06 | PATCH annotations + spec.allowVolumeExpansion | allow-clone/allow-snapshot/allowVolumeExpansion | 关闭 → null 移除字段（不写 false） | setFeatures | 徽标与字段同源 | api 单测：body 为 null |
| LEG-SC-07 | DELETE 逐条 | — | 提交前用实时 PVC 集合统计；读取失败停用；批量跳过并汇总 | remove + 页面守卫 | 单条 disabled，批量结果成功/跳过/失败 | 组件测试：守卫两因；api 单测：逐条 DELETE |

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证 |
| --- | --- | --- |
| 列表 | 创建按钮、多选/全选、行操作（编辑信息/YAML/设为默认/删除）、批量删除、不可删原因条、结果汇总 | 代码/契约；E2E 待环境 |
| 详情 | 右上 编辑信息 / 编辑 YAML / 设为默认 / 卷功能 / 删除；默认替换提示；删除守卫原因 | 代码/组件测试 |
| 对话框 | 创建表单校验；卷功能三个复选框；删除输名称确认（批量输入可删数量） | 组件测试 + 复用 DeleteDialog |
| 复用 | 不新增公共组件；复用 ResourceList/Dropdown/DeleteDialog/EditInfoDialog/YamlDialog | 契约 1506 通过 |

## 5. 编码与回归

- [x] AC-04/05/06、US3、DEC-04 交付段覆盖创建/编辑/默认/能力/删除守卫。
- [x] API 单测 6 条、组件测试 6 条；E2E spec/test 已写好（环境恢复执行）。
- [x] 删除守卫用实时 PVC 集合；读取失败时单条停用、批量不渲染（不把失败当 0）。
- [x] 类型检查、构建、契约、api-client 单测通过。
- [x] E2E + 截图：B200 通过 TC-04（创建、编辑信息/YAML、扩容开关、默认切换+恢复、PVC 守卫、批量跳过与汇总）。B200 在读回时会丢弃 clone/snapshot 两个 KubeSphere 能力注解（实测：POST 响应有、随后 GET 无），该两项由 API 单测覆盖并在用例内注明环境差异。E2E 还捕获了写路径重复段缺陷（已修复，见指南 §8 #32）。
- [x] 未提交/未推送；并行文件未回退。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（实现层） | 7 项：2 既有 + 5 新实现 | E2E |
| 数据语义 | 通过（单测） | 创建 body、merge-patch null、默认清除、能力移除、逐条删除 | 真实成员集群写路径 |
| 交互与权限 | 部分 | 创建校验、守卫两因组件测试 | 非 admin、E2E 交互 |
| 视觉 | 未验收 | — | 三档深浅/旧站截图 |
| 静态/类型/构建/测试 | 通过 | 严格门禁 errors=0；tsc 0；contracts 18/1506；api-client 44 文件/427 passed（含 SC 写 6 条）；组件 6 条；build 通过 | 契约基线由并行修复后全绿 |
| E2E/部署/全站 | 通过（B200） | TC-04 passed（23.79s）；截图见 §8 | 部署镜像与全站串行 E2E 未执行；B200 丢弃 clone/snapshot 注解（环境差异，已记录） |

## 7. 测试命令与结果

    cd console && python3 prd/tools/check_docs.py --strict       prd/kube-frontend/cluster-management/storage-classes.md       design/kube-frontend/cluster-management/storage-classes.md       tests/ui/specs/kube-frontend/cluster-management
    → errors=0 warnings=0（首轮缺 US3 登记，补齐后通过）

    cd console/kube-frontend
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    npx vitest run --config config/vitest.config.ts → 18 files / 1506 passed
    pnpm --filter @kube-ai-hub/api-client test → 44 files / 427 passed（含 storage-class-writes 6）
    cd apps/console-next && npx vitest run test/storage-class-writes.test.tsx → 6 passed
    pnpm --filter @kube-ai-hub/console-next build → 通过

    # E2E（B200 本地全栈）
    KA_APP_URL=http://localhost:5176 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=*** \
      pytest tests/kube-frontend/cluster-management/test_TC_L3_..._STORAGE_CLASSES_04.py -n 0
    → 1 passed (23.79s)；首跑暴露写路径 /storageclasses/storageclasses 重复段，修复后通过

## 8. 截图与记录

assets/storage-class-writes-20261117/new：list-{dark,light}-{1600,1280,1024}.png、create-{dark,light}-1600.png、detail-delete-protected-dark-1600.png。旧站对照未生成。

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| clone/snapshot 注解在 B200 读回被丢弃 | 环境差异 | 在保留注解的集群（mlu370）执行同一创建/开关流程；本批由 API 单测覆盖请求体 |
| 成员集群创建/编辑/删除 | 未验收 | 在成员集群执行同一流程（/apis/clusters/<c> 路径） |
| 非 admin / 无权限 | 未验收 | 普通集群成员账号 |
| 默认替换的真实集群行为 | 单测覆盖 | 真实环境确认旧默认注解清除且只有一个徽标 |
| 部署/全站 | 未执行 | 镜像与全站串行 E2E |

## 10. 流程反思（已并入方法文档）

| 本批踩到的事 | 已写入 |
| --- | --- |
| 删除守卫若读注解 pvc-count，注解滞后会把在用类删掉；读取失败时若当 0 同样危险 | 指南 §8 #31：删除前置校验用实时集合，读取失败停用删除而不是当作「没有」 |
| 能力关闭写 'false' 会让「能力列不显示但对象写着 false」出现歧义 | design DEC-04：关闭即移除字段/注解，徽标与对象同源 |
| 单测用 `toContain('/apis/storage.k8s.io/v1/storageclasses')` 没发现路径被拼成 `…/storageclasses/storageclasses`；真实请求 405 | 指南 §8 #32：路径断言比较完整 pathname/精确段 |

## 11. 关联文档

- PRD：prd/kube-frontend/cluster-management/storage-classes.md（US3/AC-04..06）
- design：design/kube-frontend/cluster-management/storage-classes.md（DEC-04 交付）
- 用例：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04
- 既有只读交付：TC-…-01/02/03
