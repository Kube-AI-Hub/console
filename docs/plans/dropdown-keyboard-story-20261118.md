# 下拉菜单的键盘操作：在 Storybook 上验（2026-11-18）

`Dropdown` 是行操作菜单与列显隐菜单的底座，几乎每个列表都用它。键盘可达此前没有单独验过。

## 实测（`Components/Dropdown › basic dropdown`）

```
opened by Enter:          1        ← Enter 打开
focus after open:         查看 YAML ← 焦点落在第一项
after ArrowDown:          编辑配置  ← 方向键移动
menu after Esc:           0        ← Esc 关闭
focus back on trigger:    更多操作  ← 焦点回到触发按钮
```

## 五条与可访问性要求对应

| 要求 | 实测 |
| --- | --- |
| 键盘可打开（不只鼠标） | Enter ✓ |
| 打开后焦点进入菜单 | 落在「查看 YAML」✓ |
| 方向键在项间移动 | ArrowDown → 「编辑配置」✓ |
| Esc 关闭 | 菜单消失 ✓ |
| 关闭后焦点归还 | 回到「更多操作」✓ |

最后一条与 `Modal` 的焦点归还是同一个原则：**弹层关闭不能把读者丢回 `<body>`**。
