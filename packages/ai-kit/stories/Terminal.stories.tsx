import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TerminalView, type TerminalHandle } from '../src/terminal';
import { Modal } from '../src/primitives/Feedback';
import { Button } from '../src/primitives/Button';

export default { title: 'Components/Terminal', component: TerminalView, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof TerminalView>;

function ConsoleDemo() {
  const [open, setOpen] = React.useState(false);
  const terminal = React.useRef<TerminalHandle | null>(null);
  const [size, setSize] = React.useState('');
  return <>
    <Button onClick={() => setOpen(true)}>打开近全屏控制台</Button>
    {open ? <Modal open size="console" title="交互控制台" description="本地演示 ANSI、尺寸同步和备用屏幕，无远端连接。"
      dismissOnEscape={false} dismissOnOutside={false} onOpenChange={setOpen}>
      <div className="mb-2 flex items-center gap-3">
        <Button size="sm" onClick={() => terminal.current?.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[32m备用屏幕\x1b[0m\r\n光标寻址与格式由终端模拟器渲染。')}>进入备用屏幕</Button>
        <Button size="sm" onClick={() => terminal.current?.write('\x1b[?1049l')}>返回主屏幕</Button>
        <span>{size}</span>
      </div>
      <TerminalView ariaLabel="本地交互终端" onReady={(handle) => {
        terminal.current = handle;
        handle.write('\x1b[32mSuccess\x1b[0m  \x1b[33mWarning\x1b[0m  \x1b[31mError\x1b[0m\r\n$ ');
        handle.focus();
      }} onData={(data) => terminal.current?.write(data === '\r' ? '\r\n$ ' : data)}
        onResize={(columns, rows) => setSize(`${columns} x ${rows}`)} />
    </Modal> : null}
  </>;
}

export const NearFullscreen: StoryObj = { render: () => <ConsoleDemo /> };
