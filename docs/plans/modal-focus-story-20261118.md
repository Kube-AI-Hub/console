# 弹层焦点归还：在 Storybook 上验（2026-11-18）

## 背景

`Modal` 的焦点归还（关闭后回到触发按钮）此前只在应用的配置字典创建弹层上验过一次。
Storybook 里有 `Components/Modal › basic modal`，触发按钮就是「打开弹窗」——**比应用里更适合验这件事**：
没有路由、没有数据请求、没有权限。

## 实测

```
dialog open: 1
focus inside: True            ← 打开后焦点在弹层内
dialog after esc: 0           ← Esc 关闭
focus after close: 打开弹窗    ← 焦点回到触发按钮
```

四条都符合 story 的文档承诺：「打开时焦点移入弹窗，关闭后归还给触发元素」。

## 为什么值得单独记

焦点归还是**我改出来的行为**（原先落到 `<body>`）。在应用里验需要起栈、登录、找到某个弹层；
在 Storybook 里只需要点一次。**同一件事，验证成本差一个数量级。**
