/**
 * Backwards-compatibility shim.
 *
 * The canonical dataset moved to `./benchmarks.v2`. This module re-exports
 * everything so existing imports (e.g. BenchmarkPanel, older tests) keep
 * working. New code should import from `@/data/benchmarks.v2` directly.
 */
export * from './benchmarks.v2';
