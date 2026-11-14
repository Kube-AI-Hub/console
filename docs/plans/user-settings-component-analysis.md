# 用户设置页面迁移与 ai-kit 组件复用分析

> 范围：老 console 的**用户设置**（个人账号设置）页面与子页面 → 新 UI（console-next）的迁移结果。
> 回答三个问题：迁移后哪些通用组件可以统一 UI 与交互、ai-kit 还缺什么、本轮补了什么。
> 关联：[迁移指导](../legacy-ui-migration-guide.md)、[全量迁移方案](./area-migration-plan.md)、
> 组件库 [ai-kit README](../../packages/ai-kit/README.md)、
> 需求 [prd/kube-frontend/user-settings](../../prd/kube-frontend/user-settings/_index.md)、
> 设计 [design/kube-frontend/user-settings](../../design/kube-frontend/user-settings/_index.md)。

## 0. 结论先行

| # | 结论 | 证据 |
| --- | --- | --- |
| 1 | 用户设置的两个页签**已经迁移完成**（账号菜单 → 弹窗），字段、校验、写入、退出会话均按老 console 逐项核对过；差异都已归入「照搬 / 改进 / 不迁移」 | `UserSettingsDialog.tsx`、`prd|design/kube-frontend/user-settings/`、6 条 E2E |
| 2 | 迁移后页面上真正值得抽的是 **4 类结构性重复**：页签条、表单字段包装、只读信息行、密码强度面板。前三类在设计系统里已有对应物（Tabs / FormField / 无），第四类原先只存在于应用内 | 见 §2.3 的量化清单 |
| 3 | ai-kit 本轮补 **2 个组件 + 2 个能力扩展**：`DescriptionList/DescriptionItem`、`PasswordStrengthMeter`；`Tabs` 支持 `aiId/badge/badgeLabel/children`、`FormField` 支持 `errorAiId`。全部进 Storybook 并有单测；应用侧通过组合替换手写结构，**行为与 E2E 句柄不变** | 见 §4、§5 |

一句话：**用户设置页不需要「再造一套页面组件」，需要的是把页面已经在用的那几种结构上收到设计系统**，
让下一个页面（渠道配置、用户编辑、工作负载详情）直接组合，而不是各自复制一份。

## 1. 老 console 的用户设置：页面与交互清单

### 1.1 入口与容器

| 项 | 老 console 实现 | 文件 |
| --- | --- | --- |
| 入口 | 头像下拉：**用户设置 / 退出登录 / 关于** 三项 | `console/src/components/Layout/LoginInfo/index.jsx` |
| 容器 | 模态框，宽 1162，标题「用户设置」，图标 wrench，隐藏默认 footer，底部只有一个「关闭」 | `console/src/components/Modals/UserSetting/index.jsx` |
| 页签 | 左侧竖直图标页签（paper / ssh），两页签**同时挂载**、切换只切显隐；有改动时页签上出现提示点并带 tooltip「内容已经修改但并未保存」 | 同上 `renderTabs` |
| 保存结构 | 每个页签底部一个 `Confirm`：**两个图标按钮**（✕ 取消 = 丢弃本页改动、✓ 保存 = 提交本页） | `console/src/components/Forms/Base/Confirm/index.jsx` |
| 关闭 | 关闭即丢弃，**没有二次确认** | `renderFooter` |

### 1.2 基本信息页签

| 字段 | 控件 | 校验 / 行为 |
| --- | --- | --- |
| 用户名 | `Input disabled`（占位 `username`） | 只读 |
| 邮箱 | `Input`，绑定 `spec.email`，说明文案 `USER_SETTING_EMAIL_DESC` | **没有格式校验**，非法值由服务端 admission webhook 拒绝 |
| 语言 | `Select`，选项来自 `globals.config.supportLangs`（非 `showAllLangs` 时只留 recommend） | 写 `spec.lang`；语言与 cookie 不同时 `location.reload()` |

保存路径：`actions/user.js` 的 `'user.setting'` → `UserStore.update` → **PUT `users/<name>` 整对象**
（请求体是弹窗挂载时克隆的 `_originData` + `metadata.resourceVersion`）。

### 1.3 密码设置页签

| 字段 | 控件 | 校验 / 行为 |
| --- | --- | --- |
| 当前密码 | `InputPassword` | 必填 |
| 新密码 | `InputPassword` + `withStrength` | 必填 + `PATTERN_PASSWORD` = `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[^]{8,64}$/` |
| 确认密码 | `InputPassword` | 必填 + 与 `state.password` 比较（validator 挂在字段上；只在该字段 change 时重跑） |
| 规则说明 | `Alert type="warning"` 显示 `PASSWORD_DESC` | 文案承诺「必须包含…特殊字符」，但**正则不要求特殊字符** |

强度条：实现在 `components/Inputs/InputPassword/index.jsx`，**浮层下拉**（focus/点击时出现、失焦收起），
含三条 checklist（大小写 / 数字 / 长度 ≥8）与 0–10 分打分进度条（<6 红 33%、6–8 黄 66%、≥8 绿 100%）。

保存路径：`'user.setting'` 里按「data 里有没有 `currentPassword` 与 `password`」分流 →
`UserStore.modifyPassword` → **PUT `users/<name>/password`**；成功后 `setTimeout(1000)` → `location.href='/login'`，
**没有调用退出登录接口**。

### 1.4 与用户设置相邻但不同的三个面

| 面 | 老 console | 新 UI 现状 |
| --- | --- | --- |
| 管理员重置他人密码 | `components/Modals/ModifyPassword`（`user.modifypassword`，无当前密码） | **未迁**（缺口分析 F-33） |
| 关于（版本 / 许可） | `components/Modals/About`，账号菜单第三项 | **未迁**（F-36） |
| 语言切换 | 用户设置弹窗内写 `spec.lang` + 刷新 | 已移到**顶栏**（`localStorage['kube-frontend-locale']`，不刷新）；设计 DEC 记「明确不做」回弹窗 |

### 1.5 老实现的四个问题（说明「不能照搬什么」）

1. **语言有两个写入口**：弹窗写 `spec.lang` 并整页刷新；顶栏语言偏好是另一套。迁移后只保留顶栏一个入口。
2. **邮箱没有客户端校验**：非法邮箱每次都把服务端 webhook 的英文原文（含回显输入）摆到界面上。
3. **密码文案与规则不一致**：`PASSWORD_DESC` 要求特殊字符，`PATTERN_PASSWORD` 从不检查；用户按文案打了字符却不知道是否真的有用。
4. **改密后会话没有真的结束**：只跳 `/login`，服务端不吊销 token（实测改密后同一 token 仍返回 200），旧会话依然可用。

## 2. 迁移到新 UI 之后：现状对照

### 2.1 已落地的实现

| 层 | 新 UI 落点 | 说明 |
| --- | --- | --- |
| 入口 | `shell/AppShell.tsx` 的 `UserMenu`（`shell:user-settings`） | 与语言、主题同区；菜单项：当前邮箱（只读）/ 用户设置 / 退出登录 |
| 弹窗 | `shell/UserSettingsDialog.tsx` | 两个页签（基本信息 / 密码设置）、页脚「关闭」 |
| 基本信息 | 用户名、平台角色**只读文本** + 邮箱输入框 | 邮箱格式在客户端先拦（与服务端 webhook 同源规则） |
| 密码设置 | 当前 / 新 / 确认三个密码框 + 常驻规则说明 + 强度面板 + 实时比对提示 | 改密成功后 `signOut()` 再跳 `/login` |
| 规则判定 | `api-client` 的 `passwordProblem` / `passwordChecks`（两个弹窗共用） | 强度面板与提交判据同源 |
| 文案映射 | `apps/console-next/src/lib/password.ts` | 规则码 → 句子 |
| 强度面板 | `components/password/PasswordStrength.tsx` | 见 §2.3：目前是应用内组件，样式与结构应在 ai-kit |
| 写接口 | `userSettingsApi.updateProfile` / `changePassword` | 整对象 PUT / 子资源 PUT |
| 文档与用例 | `prd|design/kube-frontend/user-settings/`、6 条 spec（L2 + PROFILE×2 + PASSWORD×3） | 一一对应 |

### 2.2 差异归类

| 差异 | 归类 | 理由 |
| --- | --- | --- |
| 弹窗而非独立页面 | 照搬（老 console 也是弹窗） | 低频小改动，弹窗不打断当前工作；DEC-L2-01 |
| 页签去掉图标、左侧竖直改横向 | 改进 | 横向页签是当前设计系统唯一的 Tabs 形态；图标没有信息量 |
| 用户名只读文本而非 disabled 输入框 | 改进 | disabled 输入框诱导点击一个永远点不动的控件（GOT-04） |
| 邮箱客户端校验 | 改进 | 不再把 webhook 英文原文给用户（DEC-PROFILE-02） |
| 语言选择移到顶栏 | 不迁移（有意） | 两个写入口必然漂移；顶栏切换不刷新页面 |
| 密码强度：浮层 → 常驻内联；三条 checklist → 四条；分数算法 → 规则档位 | 改进 | 浮层遮挡输入框且失焦即收；分数算法与提交规则不同源（DEC-PASSWORD-06/07） |
| 确认密码实时比对（改新密码也重算） | 改进 | 老实现只在该字段自身 change 时重跑，可能滞留旧结论（DEC-PASSWORD-08） |
| 改密后主动退出会话 | 改进 | 服务端不吊销 token，只跳转等于没退出（DEC-PASSWORD-03） |
| 新增平台角色只读展示 | 改进/新增 | 回答「我现在是什么身份」；不可编辑避免自助提权 |
| 关闭即丢弃，无二次确认；无页签级「取消」 | 不迁移（有意） | 两页最多四个字段，重填成本低于一次确认弹窗；DEC-L2-04、design「明确不做」 |
| 关于弹窗、管理员重置他人密码 | 未迁移（已登记缺口） | 缺 F-36 / F-33，不属于本页 |

### 2.3 迁移后暴露的「手写结构」——复用机会的量化

| # | 结构 | 新 UI 现状 | 消费者 | 应复用 |
| --- | --- | --- | --- | --- |
| 1 | **页签条** | `UserSettingsDialog` 手写 `role="tablist"` + 自定义 `TabButton`（原生 `<button>`、手写 aria、无方向键导航）；`app-workloads/WorkloadDetailPage.tsx` 也是手写 tablist | 2 个页面（用户设置 / 工作负载详情） | ai-kit `Tabs`（Radix：roving tabindex、方向键、aria-controls） |
| 2 | **表单字段包装** | 17 个文件手写 `<label className="flex flex-col gap-1">` + 标题 + 输入 + 说明/错误行；共 24 处 `htmlFor` | ≥17 个文件（用户设置、用户编辑、集群增改、ConfigMap/Secret 创建、成员/角色弹窗…） | ai-kit `FormField`（已有 label/hint/error 结构，只缺稳定错误句柄） |
| 3 | **只读信息行** | `components/resource/DefinitionRow.tsx` 已被 **24 个文件**导入；但它不在设计系统里，样式是 app 私有约定 | 24 个文件（全部详情页 + 用户设置） | ai-kit `DescriptionList` / `DescriptionItem` |
| 4 | **密码强度面板** | `components/password/PasswordStrength.tsx` 纯展示组件，被用户设置弹窗与「创建用户」字段类型两处消费（`registerPasswordField`） | 2 个消费方 | ai-kit `PasswordStrengthMeter`（展示上收；规则与 i18n 留在 app） |
| 5 | 保存成功反馈 | 用户设置：按钮旁内联「已保存。」；渠道配置：按钮文字切换成「已保存」 | 2 种写法 | 暂不抽象：只有两处且交互语义不同（一次性提示 vs 按钮态），抽象会造一个没人用的组件 |
| 6 | 删除确认 | `components/resource/DeleteDialog.tsx`（typed-name）已单点共用 | 全部资源页 | 不在本页范围，不动 |

由此得到两条判断：

- **第 1、3 类是真的「重复造轮子」**：同样的结构在别的页面各写一遍，已经出现样式漂移（例如只读行的值有的用主色、有的用次色）。
- **第 2 类不是没有组件，而是组件没人用**：`FormField` 早就在 ai-kit 里，页面仍然手写，差距只在「错误行没有稳定句柄」这一个具体缺口。
- **第 4 类是「展示被留在应用里」**：规则判定在 api-client 是对的，但面板的 DOM 结构与无障碍语义属于设计系统。

## 3. 可复用的通用组件对照（老 console → ai-kit）

| 用途 | 老 console（kube-design / 自研） | 新 UI 应使用的 ai-kit 组件 | 本轮动作 |
| --- | --- | --- | --- |
| 弹窗 | `Modal` | `Modal`（`size`、footer、Esc/遮罩关闭） | 已用，不动 |
| 表单字段（label/hint/error） | `Form` / `Form.Item` | `FormField`（非 schema 场景）或 `Form.Item` | **补 `errorAiId`，应用改用 FormField** |
| 输入 / 密码输入 | `Input` / 自研 `InputPassword`（强度浮层） | `Input` / `InputPassword`（自带显示/隐藏切换） | 已用，不动 |
| 选择 | `Select` | `Select` | 本页不再需要（语言已移顶栏） |
| 提示 | `Alert` | `Alert` | 规则说明目前是轻量文本块，保留 |
| 图标 | `Icon` | `Icon`（366 个） | 页签图标按 §2.2 去掉 |
| 下拉菜单 | `Dropdown` / `Menu` | `Dropdown` | 已用，不动 |
| 页签 | 手写 `ul/li` + Tooltip 提示点 | `Tabs` + `TabsContent` | **扩展 `aiId/badge/badgeLabel/children` 后使用** |
| 只读信息行 | `Input disabled` 或裸 label | `DescriptionList` / `DescriptionItem` | **新增，24 处 DefinitionRow 统一 re-export** |
| 密码强度条 | 自研浮层（checklist + 分数） | `PasswordStrengthMeter` | **新增，展示上收** |
| 按钮 / 骨架 / 错误面板 | `Button` / 自研 | `Button` / `Skeleton` / `ResourceErrorPanel`（app） | 已用，不动 |

## 4. ai-kit 需要补什么

### 4.1 不需要补的（已有且够用）

`Modal`、`FormField`（只差一个句柄能力）、`Form`、`Input`、`InputPassword`、`Alert`、`Button`、
`Skeleton`、`Icon`、`Dropdown`、`Panel`、`Text`。**不为用户设置页新建「设置页组件」或「账户弹窗组件」**——
那会把页面布局固化进库，而布局是页面自己的事。

### 4.2 本轮新增 / 扩展

| 类型 | 变更 | 为什么必须（缺口证据） | 无障碍 / 契约收益 |
| --- | --- | --- | --- |
| **新增** | `DescriptionList` + `DescriptionItem` | app 里 24 个文件依赖一个非设计系统的 `DefinitionRow`；同样的只读信息在不同详情页已出现颜色/换行漂移 | 用 `<dl>/<dt>/<dd>` 语义；空值统一 `-`；`aiId` 让自动化读到值 |
| **新增** | `PasswordStrengthMeter` | 面板纯展示却被留在应用里；第二个消费方（创建用户）已在复用应用内实现 | 档位有文字标签（不只靠颜色）、进度条 `aria-hidden`、`data-*` 机器可读 |
| **扩展** | `Tabs`：`aiId` / `badge` / `badgeLabel` / `children` | 页签条在 2 个页面手写；`Tabs` 原来只渲染列表，无法把 `TabsContent` 放进 Radix root，触发器的 `aria-controls` 指向不存在的节点 | Radix 自带方向键 / roving tabindex / `aria-selected`；未保存提示点有 `sr-only` 文案 |
| **扩展** | `FormField`：`errorAiId` | 页面需要把稳定的 `data-ai-id` 放在错误行上（E2E/agent 句柄），而句柄属于设计系统契约（`Pagination` 已有同类能力） | 错误行可被自动化精确定位 |

### 4.3 API 契约（本轮落地）

```ts
// ai-kit: DescriptionList
export interface DescriptionItem {
  label: React.ReactNode;
  value: React.ReactNode;      // 空值（null/undefined/''）渲染 '-'
  hint?: React.ReactNode;      // 值下方的小字说明
  aiId?: string;               // data-ai-id 落在值节点上（值文本不含 hint，便于精确断言）
}
export function DescriptionItem(props: DescriptionItem): React.ReactElement; // <> <dt> <dd> </>
export function DescriptionList(props: { items: DescriptionItem[]; className?: string }): React.ReactElement;

// ai-kit: PasswordStrengthMeter（纯展示：规则与文案由调用方传入）
export interface PasswordStrengthMeterProps {
  level: 'weak' | 'medium' | 'strong';
  checks: Array<{ key: string; label: React.ReactNode; met: boolean }>;
  title: React.ReactNode;       // 「密码强度」
  levelLabel: React.ReactNode;  // 「弱 / 中 / 强」
  rule?: React.ReactNode;       // 「您的密码必须：」
  hint?: React.ReactNode;       // 「避免使用弱密码或其它账户的密码。」
  ariaLabel?: string;
  aiPrefix?: string;            // 省略则不渲染 data-ai-id
}

// ai-kit: Tabs 扩展
interface TabItem {
  value: string;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
  aiId?: string;                // data-ai-id 落在 trigger 上
  badge?: React.ReactNode;      // 装饰性徽标（如未保存提示点），aria-hidden
  badgeLabel?: string;          // 徽标的无障碍文案（sr-only）
}
interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;   // 放在 Root 内、List 之后，供 TabsContent 使用
  className?: string;
}

// ai-kit: FormField 扩展
interface FormFieldProps {
  // …原有 label / hint / error / required / htmlFor / className
  errorAiId?: string;           // data-ai-id 落在错误段落上
}
```

### 4.4 Storybook 入口

| Story 文件 | 内容 |
| --- | --- |
| `stories/DescriptionList.stories.tsx` | 详情式两列清单、带 hint 的项、空值显示 `-` |
| `stories/PasswordStrength.stories.tsx` | 弱 / 中 / 强三档、四条 checklist 的满足/未满足状态 |
| `stories/Tabs.stories.tsx`（扩展） | 带页签徽标（未保存提示点 + 无障碍文案）；`Tabs` + `TabsContent` 面板 |
| `stories/Form.stories.tsx`（扩展） | `FormField` 的 hint / error / `errorAiId` |

Storybook 的价值在这里不是「展示组件好看」，而是**在深/浅色与两套色调下同时看到这些结构**：
用户设置页只覆盖其中一种组合，组件级故事覆盖四种。

### 4.5 单测覆盖（ai-kit 包内）

| 组件 | 断言 |
| --- | --- |
| `Tabs` | trigger 带 `data-ai-id`；`badge` + `badgeLabel` 的无障碍名称；`children`/`TabsContent` 随选中切换；方向键改变选中项 |
| `DescriptionList` | `dl/dt/dd` 语义；hint；空值 `-`；`aiId` 落在 `dd`；`className` 合并 |
| `PasswordStrengthMeter` | 三档 `data-strength`；档位文字可见；`data-met` 逐项；`aiPrefix` 生成句柄 / 缺省不生成；`ariaLabel` |
| `FormField` | 错误段落带 `errorAiId`；无错误时显示 hint |

## 5. 落地方式与兼容约束

### 5.1 应用侧替换

| 文件 | 改法 | 保持不变 |
| --- | --- | --- |
| `shell/UserSettingsDialog.tsx` | 页签 → `Tabs` + `TabsContent`；4 个字段 → `FormField`；只读两行 → `DescriptionList`；删除手写 `TabButton` / `ReadOnlyField` | 全部 `user-settings:*` 句柄、校验顺序、文案、关闭即丢弃、改密退出 |
| `components/password/PasswordStrength.tsx` | 保留 `passwordChecks` 换算与 i18n，渲染交给 `PasswordStrengthMeter` | `data-strength` / `data-met` / `data-ai-id` 句柄 |
| `components/resource/DefinitionRow.tsx` | 改为 re-export ai-kit `DescriptionItem`（+ 类型别名） | 24 个调用点的 `label/value/aiId` props 与渲染结果 |
| `packages/ui/src/index.ts` | 补齐新组件 re-export（页面只从 `@kube-ai-hub/ui` 导入） | 包边界契约：ui 仍是纯展示层 |

### 5.2 必须遵守的兼容约束

1. **E2E 句柄不变**：`user-settings:tab-profile` / `-tab-password` / `-username` / `-platform-role` /
   `-email` / `-profile-save` / `-profile-error` / `-profile-saved` / `-current-password` / `-new-password` /
   `-confirm-password` / `-confirm-hint` / `-password-save` / `-password-error` / `-password-saved` /
   `-password-rule` / `-password-strength` / `-password-strength-bar` / `-password-check-*` / `-close` / `-retry`。
   这些是本页用例唯一的选择器来源（`tests/ui/pages/user_settings.py`）；句柄换位置等于把用例改成实现细节。
2. **不新增行为**：不加关闭确认框、不加页签级「取消」按钮（design 已按 DEC 明确不做）。本轮是**结构统一**，不是交互改版。
3. **职责不搬家**：规则判定留在 `api-client`，文案映射与请求留在应用；ai-kit 只接收 props（库不内置 i18n）。
4. **零调用点迁移**：`DefinitionRow` 的 24 处使用不改一行，靠 re-export 吃到统一实现。
5. **首屏与包体**：新组件都是纯展示、无新依赖；不把 `PasswordStrengthMeter` 做成需要 api-client 的复合组件。

## 6. 验证

验证快照：HEAD `d82d53fa9` + 并行会话未提交改动；本轮 20 个文件在快照前已冻结，之后零变化。

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| ai-kit 类型 | `npm run typecheck` | 0 错 |
| ai-kit 单测 | `npm test` | **174 passed**（154 基线 + 本轮 16 + 并行菜单测试 4） |
| ai-kit 构建 | `npm run build` | 通过，`dist/` 含新组件与 d.ts（app 消费 dist） |
| Storybook 编译 | `npm run storybook:build` | 通过，新 stories 无编译错误 |
| 应用类型 / 单测 / 构建 | `npm run typecheck && npm test && npx vite build` | 0 错 / **115 passed** / 构建通过，dist 重建 |
| 静态门禁 | `python3 prd/tools/verify.py --no-e2e` | 文档门禁 0/0、一致性 0、缺口清单未归类 0、契约 **907**、api-client **199**、ai-kit 174、console-next 115 |
| 用户设置 E2E | `pytest tests/kube-frontend/user-settings`（KA_APP_URL=http://localhost:5178） | **6 passed**（与基线 6 一致；PROFILE×2 + PASSWORD×3 + L2） |
| 访问控制 E2E | `pytest tests/kube-frontend/access-control` | **22 passed**（与基线 22 一致；创建用户弹窗共用强度面板） |
| 手工 | Storybook 6106：深/浅 × 紫/绿四组合；真实页面 | 结构、对比度、键盘可达 |

过程中发现并修复了一处**门禁可复现问题**：design 文档里的短引用（`DEC-05`、`GOT-03` 等）会被文档门禁当作跨文件编号，
与其它模块新增文档的短引用撞号。已把本模块 design 文档的短引用全部改成完整编号
（`DEC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-05`），门禁恢复 0 错；这也是后续新增 DEC 时应遵守的写法。

## 7. 仍然缺什么 / 下一轮

| 项 | 现状 | 建议 |
| --- | --- | --- |
| 16 个文件仍在手写字段包装 | 本轮只把用户设置页改为 `FormField` | 逐页替换（`EditInfoDialog`、ConfigMap/Secret 创建、集群增改、成员/角色弹窗…）；每页替换后用现有 E2E 兜底 |
| `WorkloadDetailPage` 手写页签 | 第二个 `role="tablist"` 消费者；该文件正被并行会话修改 | 等文件稳定后改用 `Tabs`（需要把面板包进 `TabsContent`，或给 Tabs 增加「外部面板」用法） |
| 保存成功反馈两种写法 | 内联文字 vs 按钮文字切换 | 先统一文案与出现位置，再考虑是否需要组件（目前只有两处，抽象收益低） |
| 管理员重置他人密码 | 未迁（F-33） | 属于「访问控制 → 用户」的编辑能力，需确认接口与权限口径 |
| 关于弹窗 | 未迁（F-36） | 低风险小页面，可在收尾轮补 |
| 密码强度档位判定 | 在 app 的 `PasswordStrength` 包装里（规则来自 api-client 的 `passwordChecks`） | 若出现第三个消费方，再把「档位推导」也上收到 app 的共享模块（不建议进 ai-kit：库不懂规则） |
