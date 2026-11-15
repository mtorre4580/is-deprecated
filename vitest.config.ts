import ts from 'typescript';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Compile decorator tests with the TypeScript compiler itself, so they exercise the exact
 * standard (TC39) decorator output that TypeScript users get.
 */
function typescriptDecorators(): Plugin {
  return {
    name: 'typescript-decorators',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.decorators.ts') && !id.endsWith('decorator.test.ts')) return null;
      const output = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          sourceMap: true,
          inlineSources: true,
        },
      });
      return { code: output.outputText, map: output.sourceMapText };
    },
  };
}

export default defineConfig({
  plugins: [typescriptDecorators()],
  test: {
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts'],
      thresholds: { lines: 95, branches: 90, functions: 95, statements: 95 },
    },
  },
});
