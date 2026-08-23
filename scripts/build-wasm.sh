#!/usr/bin/env bash
# Builds the engine for WebAssembly and generates the JS bindings.
#
# Two targets, on purpose:
#   nodejs  — used by the test suite and benchmarks (CommonJS)
#   web     — used by the browser app from M1 onwards (ESM + explicit init)
#
# The wasm-bindgen CLI version must match the `wasm-bindgen` crate version
# exactly; a mismatch produces bindings that fail at runtime rather than at build
# time, which is a bad way to find out.
set -euo pipefail

cd "$(dirname "$0")/.."

CRATE=onemark-wasm
ARTIFACT=target/wasm32-unknown-unknown/release-wasm/onemark_wasm.wasm
OUT=packages/engine/wasm

crate_version=$(grep -A2 '^name = "wasm-bindgen"' Cargo.lock | grep '^version' | head -1 | cut -d'"' -f2)
cli_version=$(wasm-bindgen --version | awk '{print $2}')
if [ "$crate_version" != "$cli_version" ]; then
  echo "wasm-bindgen version mismatch: crate $crate_version, CLI $cli_version" >&2
  echo "install the matching CLI: cargo install wasm-bindgen-cli --version $crate_version --locked" >&2
  exit 1
fi

cargo build -p "$CRATE" --target wasm32-unknown-unknown --profile release-wasm

for target in nodejs web; do
  wasm-bindgen "$ARTIFACT" --out-dir "$OUT/$target" --target "$target"
done

# wasm-bindgen's nodejs output is CommonJS, but @onemark/engine is an ESM
# package. Scoping the module type to this directory is how Node is told that,
# without renaming generated files or making the whole package CommonJS.
echo '{ "type": "commonjs" }' > "$OUT/nodejs/package.json"

echo
echo "built:"
ls -lh "$OUT"/*/*.wasm
