# Stable Test Identity and Traceability

## Existing data flow and compatibility

Adapters normalize imported framework results and compute `id` from framework, layer, suite, title, file, and line. Report core uses that technical fingerprint to combine retries; requirement extraction scans titles, suites, files, and labels, while the CLI applies the legacy requirement mapping and writes test chunks plus the manifest. The UI uses `id` for detail links. This remains unchanged: `id` is still the technical identity and older schema 1.0 reports remain readable.

Every imported test now also has `identity`. Stable IDs are optional: automated results continue to be imported without registration, and an unchanged project receives a deterministic generated canonical identity.

## Precedence

1. Explicit framework metadata or annotation
2. A configured token in the title
3. The most-specific external mapping
4. The generated technical fingerprint

Add explicit IDs only to critical, long-lived, or audit-relevant tests. An explicit ID remains the same when the test is renamed or moved. Framework exporters vary: Playwright preserves annotations; JUnit-compatible exporters often preserve properties, but title tokens are the most portable fallback.

```ts
test(
  "buyer can complete checkout",
  { annotation: { type: "testCase", description: "SHOP-TC-0042" } },
  async ({ page }) => {
    /* ... */
  }
);
```

Aliases are configurable. A portable title is `[SHOP-TC-0043] receipt is printable`; projects choose their own prefix and regular expression.

## External mapping

Configure `artifacts.tests.mapping: tests/test-mapping.json`. Entries match any subset of `framework`, `file`, `suite`, `fullName`, and `title`, then assign `canonicalId`, `requirements`, `defects`, `tags`, and optional `links`.

```json
[
  {
    "match": { "framework": "junit", "fullName": "CheckoutTest > pays" },
    "canonicalId": "SHOP-TC-9",
    "requirements": ["REQ-2"],
    "defects": ["BUG-3"],
    "tags": ["critical"]
  }
]
```

The entry with the most match fields wins. Equally specific matches are ambiguous: neither is applied and a diagnostic warning is emitted. Explicit and title identities always outrank mappings. Traceability fields are merged and deduplicated. Duplicate canonical IDs are reported and never used to merge independent results.

For migration, add no configuration first and inspect Identity Health. Introduce title tokens or mappings where metadata cannot travel through the exporter, and explicit annotations only where identity stability matters.
