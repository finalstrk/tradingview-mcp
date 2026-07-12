# Pine closed-editor read-only boundary

`discoverOpenPineEditorReadOnly(reader)` is the capability boundary for future
Pine discovery. It is intentionally separate from the Gate A1 artifact and
does not connect to CDP or open the editor.

The supplied reader exposes only three operations used by the boundary:

- `readEditorVisibility()` returns a strict boolean.
- `readEditorProjection()` reads state from an editor that is already open.
- `readChartProjection()` reads chart-only state without changing it.

When the editor is closed, the result code is `PINE_EDITOR_UNAVAILABLE` and
the editor projection is not read. The chart-only projection may still be
read. The boundary never calls editor activation, `showWidget`, DOM click or
focus, keyboard or CDP Input commands, or `fetch`.

Reader exceptions and malformed visibility values return the fixed,
secret-safe `PINE_DISCOVERY_READ_FAILED` result. Raw errors and page values
from a failed read are not included in that result.

Successful projections are copied into frozen plain objects through fixed
allowlists. Editor fields are limited to boolean availability/detection flags
and a bounded marker count. Chart fields are limited to bounded symbol and
interval strings, replay state, and bounded study/shape counts. Unknown keys,
functions, accessors, proxies, cycles, non-finite numbers, excessive nesting,
and oversized payloads fail closed. Returned results never share projection
object references with the reader.

This contract does not approve live discovery, retry Gate A1, provide a close
strategy, or authorize any UI or network action. A caller that supplies the
three read methods remains responsible for implementing those methods as
read-only projections.
