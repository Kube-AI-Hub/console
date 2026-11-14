import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

describe('development terminal proxy', () => {
  it('enables WebSocket forwarding for every BFF prefix', () => {
    const source = ts.createSourceFile('vite.config.ts',
      readFileSync(new URL('../apps/console-next/vite.config.ts', import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest, true);
    const found = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) &&
        ['/api', '/apis', '/kapis'].includes(node.name.text) && ts.isObjectLiteralExpression(node.initializer)) {
        const websocket = node.initializer.properties.find((property) =>
          ts.isPropertyAssignment(property) && property.name.getText(source) === 'ws');
        expect(websocket && ts.isPropertyAssignment(websocket) && websocket.initializer.kind === ts.SyntaxKind.TrueKeyword,
          node.name.text).toBe(true);
        found.add(node.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect([...found].sort()).toEqual(['/api', '/apis', '/kapis']);
  });
});
