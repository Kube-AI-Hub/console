# 共享组件在 Storybook 上的验证（2026-11-18）

> 原先分成六份小记录，合并成一份：它们是同一件事——**用 Storybook 验共享组件的行为**。
> 每一项都不需要集群、不需要凭据、不需要起应用。

## 为什么是 Storybook

| 环境 | 验同一件事的成本 |
| --- | --- |
| 应用里 | 起栈 → 登录 → 找到页面 → 打开对象 → 操作 → 读状态 |
| **Storybook** | 打开一个 story → 操作 → 读状态 |

差一个数量级。共享组件验一次，几十个页面受益。

## 六项验证

| # | 组件 | 验证内容 | 结果 |
| --- | --- | --- | --- |
| 1 | `ResourceList` | 收窄时显示「没有匹配的结果」+ 空态主操作 | ✓ |
| 2 | `ResourceList` | 列显隐三条规则 | ✓ |
| 3 | `ResourceList` | 分页 + 每页档位 + 切换回第一页 | ✓ |
| 4 | `ResourceList` | 多选筛选（并集） | ✓ |
| 5 | `Modal` | 焦点移入 / Esc 关闭 / 焦点归还 | ✓ |
| 6 | `Dropdown` | Enter 打开 / 方向键 / Esc / 焦点归还 | ✓ |

## 1. 无匹配空态（`Schema/ResourceList › no-match`）

本轮新加的 story。页面给的 `empty.title` 是「还没有工作负载」，用作对照。

```
body: 工作负载 | … | 创建 | 没有匹配的结果 | 创建 | 清空搜索与筛选
has create: 1              ← 页头主操作
has empty primary: 1       ← 空态里的同一个主操作
```

收窄时**没有**显示页面的「还没有工作负载」，证明分支优先级正确。

## 2. 列显隐（`filters and columns`）

```
before:            ['名称', '厂商', '型号']
after hiding 厂商:  ['名称', '型号']            ← 取消勾选即时隐藏
after reset:       ['名称', '厂商', '型号']     ← 恢复默认列
名称 in menu:      False                        ← 不可隐藏的列不进菜单
```

## 3. 分页与每页档位（`refresh and paging`）

```
page 1:              1/20/73
点「下一页」:         21/40/73
每页选项:            ['10', '20', '50', '100']
在第 2 页选 50 条:    1/50/73        ← 回到第 1 页
```

## 4. 多选筛选（`filters and columns`）

```
before:            ['node-a', 'node-b']
勾选「英伟达」:      ['node-a']            ← 单选生效
再勾选「CPU」:       ['node-a', 'node-b']   ← 多选取并集（不是交集）
```

「清除厂商」按钮未点通（可访问名与文本不一致），清除路径在应用里验过。

## 5. 弹层焦点（`Components/Modal › basic modal`）

```
dialog open: 1
focus inside: True            ← 打开后焦点在弹层内
dialog after esc: 0           ← Esc 关闭
focus after close: 打开弹窗    ← 焦点回到触发按钮
```

## 6. 下拉键盘（`Components/Dropdown › basic dropdown`）

```
opened by Enter:          1        ← Enter 打开
focus after open:         查看 YAML ← 焦点落在第一项
after ArrowDown:          编辑配置  ← 方向键移动
menu after Esc:           0        ← Esc 关闭
focus back on trigger:    更多操作  ← 焦点回到触发按钮
```

第 5、6 两项的最后一条是同一原则：**弹层关闭不能把读者丢回 `<body>`**。

## 写选择器前先 dump 结构

本轮三次因为猜 role 而 30 秒超时：

| 控件 | 猜的 role | 实际 |
| --- | --- | --- |
| 列显隐菜单项 | `menuitemcheckbox` | **`menuitem`** |
| 每页触发器 | `button` + name=`20` | 按文本才找得到 |
| 筛选选项 | `menuitemcheckbox` | **`checkbox`**（容器是 `dialog`） |

**规矩**：role+name 找不到就按文本找，再不行 dump 一次结构——比逐个猜快得多。
