# FTS benchmarks

The benchmark measures the FTS runtime itself, not TypeScript's `tsc`. It separates parsing,
semantic validation, utility execution, TypeScript source generation and executable business
examples.

Run it locally:

```bash
npm run benchmark
npm run benchmark:quick
```

## Baseline: Apple M1 Max, Node.js 24.6.0

Mean latency in milliseconds from [`baseline-darwin-arm64-node24.json`](baseline-darwin-arm64-node24.json):

| Operation | Scale 10 | Scale 100 | Scale 1000 | What scale means |
|---|---:|---:|---:|---|
| Compile | 0.0511 | 0.3937 | 4.3608 | fields and rules |
| Validate | 0.0102 | 0.0883 | 1.0154 | fields and rules |
| Execute | 0.0010 | 0.0021 | 0.0157 | matching rules |
| Generate TypeScript | 0.0065 | 0.0392 | 0.3704 | rules |
| Transpile generated TypeScript | 1.8410 | 3.6606 | 22.9837 | generated implementation and tests |
| Test examples | 0.0021 | 0.0152 | 0.1611 | examples, with 10 rules each |

At scale 1000, compile plus validate takes about **5.38 ms** on this machine. Increasing the model
from 10 to 1000 elements increases compile latency about 85x and validation about 100x while model
scale grows 100x. Utility execution stays below 0.016 ms even for 1000 matching rules. Isolated
TypeScript transpilation of the generated implementation and tests takes about 23 ms. These are
microbenchmarks, so compare baselines on the same machine and watch trends rather than treating one
run as a universal guarantee.

The TypeScript measurement uses `transpileModule` and does not include a host project's full type
graph, bundler or incremental cache. Those costs depend much more on the application and its
dependencies; add an application-level benchmark when integrating generated files into a build.
