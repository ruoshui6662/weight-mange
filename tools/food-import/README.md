# Food import

Offline, deterministic importer for the local food catalog. It accepts either a metadata object containing `foods`, or a top-level array whose first food record repeats `datasetKey`, `version`, `sourceName`, and `checksum`.

```json
{
  "datasetKey": "cfcd6-local",
  "version": "v1",
  "sourceName": "Local fixture",
  "checksum": "sha256-or-fixture-id",
  "foods": [{ "foodCode": "F001", "foodName": "Example", "energyKCal": "100" }]
}
```

Only the explicit CFCD field mapping from `FOOD_DATA_SPEC.md` is imported. Numeric strings are retained verbatim; `Tr` becomes `trace`, and `—` or an empty value becomes `unknown`. The importer never fetches a remote source.
