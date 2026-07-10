import { defineConfig } from 'vite';

export default defineConfig({
	root: '.',
	publicDir: 'public',
	resolve: {
		// Route bare `three` imports to the WebGPU build so every module picks up
		// node-backed materials + WebGPURenderer. Exact-match regex so that
		// `three/tsl`, `three/addons/*` and `three/examples/*` are left untouched.
		alias: [{ find: /^three$/, replacement: 'three/webgpu' }]
	},
	server: {
		// Port is env-overridable (defaults to 8080) so tooling can run a second
		// instance without colliding with a dev server already on 8080.
		port: Number(process.env.PORT) || 8080
	},
	// three/webgpu addons use top-level await, which needs a modern target.
	esbuild: {
		target: 'esnext'
	},
	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext'
		}
	},
	build: {
		outDir: 'dist',
		target: 'esnext'
	}
});
