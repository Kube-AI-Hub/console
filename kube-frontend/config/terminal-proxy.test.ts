import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

describe('development terminal proxy', () => {
  /*
   * The container terminal is a WebSocket, so every prefix the dev server forwards
   * needs `ws: true` — without it the exec handshake is answered by the SPA
   * fallback and the terminal never connects.
   *
   * The keys carry the app's mount prefix because the deployed console routes
   * `/kube-frontend/{kapis,apis,api/v1}` itself; the dev proxy forwards the path
   * unchanged so a local check exercises that routing.
   */
  it('enables WebSocket forwarding for every API prefix', () => {
    const source = ts.createSourceFile('vite.config.ts',
      readFileSync(new URL('../apps/console-next/vite.config.ts', import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest, true);
    const expected = ['/kube-frontend/api', '/kube-frontend/apis', '/kube-frontend/kapis'];
    const found = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) &&
        expected.includes(node.name.text) && ts.isObjectLiteralExpression(node.initializer)) {
        const websocket = node.initializer.properties.find((property) =>
          ts.isPropertyAssignment(property) && property.name.getText(source) === 'ws');
        expect(websocket && ts.isPropertyAssignment(websocket) && websocket.initializer.kind === ts.SyntaxKind.TrueKeyword,
          node.name.text).toBe(true);
        found.add(node.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect([...found].sort()).toEqual([...expected].sort());
  });
});
