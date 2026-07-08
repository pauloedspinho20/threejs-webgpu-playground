import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // This is a game engine with genuinely dynamic seams — cannon-es private
    // methods, glb `userData`/option bags, animation-data blobs. Where a value
    // can't be honestly typed without contortion, `any` is allowed but kept
    // visible as a warning (tech debt) rather than a blocking error.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    // TSL shader modules build GPU node graphs whose handles are dynamically
    // typed — `any` is idiomatic for TSL `Fn` params and node locals, and the
    // alternative (`unknown`) breaks the node method chaining. Relax
    // no-explicit-any for shader files only. Add new TSL modules to this glob.
    files: ['src/ts/world/Ocean.ts', 'src/ts/**/shaders/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', '.vscode/**']
  }
);
