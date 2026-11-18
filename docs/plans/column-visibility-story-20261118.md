# 列显隐：在 Storybook 上验三条规则（2026-11-18）

列显隐是这批迁移的头号交互（42 个多列列表全部接入），但验证一直依赖页面。
Storybook 的 `Schema/ResourceList › filters and columns` 能直接验三条规则。

## 实测

```
before:            ['名称', '厂商', '型号']
after hiding 厂商:  ['名称', '型号']            ← 取消勾选即时隐藏
after reset:       ['名称', '厂商', '型号']     ← 恢复默认列
名称 in menu:      False                        ← 不可隐藏的列不进菜单
```

## 三条规则与实测对应

| 规则 | 实测 |
| --- | --- |
| 只列可隐藏列（`hideable: true`） | 「名称」不在菜单里 ✓ |
| 取消勾选即时隐藏 | 厂商列立刻消失 ✓ |
| 重置恢复默认 | 三列都回来 ✓ |

## 一处踩坑

菜单项的角色是 `menuitem` 而不是 `menuitemcheckbox`（后者是按 role 查时的直觉选择）。
按 `menuitemcheckbox` 找会 30 秒超时——**先 dump 一次菜单结构再写选择器**，比猜快。
