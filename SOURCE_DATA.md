# Earthquake Data Source Documentation (SOURCE_DATA)

This document explains how to manage and modify earthquake data sources in the EWS Concept application. It covers manual data fetching functions and the dynamic configuration system using JSON.

## 1. Manual Fetching Functions

The `EarthquakeDataService` provides several methods to fetch and normalize data manually. These specialized functions handle specific endpoints with hardcoded transformation logic.

### Available Functions

- **`fetchTitikGempa(existingIds?)`**: Fetches historical/all earthquake points from `gempaQL.json`.
- **`fetchGempaDirasakan()`**: Fetches the latest "felt" earthquake from `datagempa.json`.
- **`fetchGempaKecil()`**: Fetches the latest "small" earthquake from `lastQL.json`.
- **`fetchGempaLive(existingIds?)`**: Fetches the last 30 earthquake events via XML from `live30event.xml`.
- **`fetchTsunamiEvents()`**: Fetches tsunami alert data from `last30tsunamievent.xml`.

### Example Usage

```typescript
import { EarthquakeDataService } from '$lib/services/earthquakeDataService';

const service = new EarthquakeDataService();

// Manual fetch example
const dirasakan = await service.fetchGempaDirasakan();
console.log(dirasakan.info.place); // Normalized location name
```

---

## 2. Dynamic Configuration via JSON (`source-data.json`)

The application also supports a dynamic data mapping system controlled by `src/lib/config/source-data.json`. This allows adding new sources without changing the service code.

### Configuration Structure (`DataMappingConfig`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier for the source. |
| `category` | `string` | Data category: `"all"`, `"feel"`, or `"small"`. |
| `source_url` | `string` | The API endpoint URL (JSON or XML). |
| `type` | `string` | Data type: `"json"` or `"xml"`. |
| `single_data` | `boolean` | `true` if it's a single object, `false` if it's a list. |
| `attribute` | `string` | Path to the data root (e.g., `"features"` for GeoJSON). |
| `data_mapping` | `object` | Mapping from raw API fields to `InfoGempa` properties. |

### Data Transformation Functions

Within `data_mapping`, you can use the `func` array to apply transformations:

- `split`: Splits a string. Parameters: `{ "separator": ",", "index": 0 }`.
- `replace`: Replaces a substring. Parameters: `{ "from": "WIB", "to": "" }`.
- `toFloat` / `toInt`: Numeric conversion.
- `fromISO` / `fromFormat`: Parses strings into DateTime objects.
- `utcSqlToJakarta`: Specifically converts UTC SQL timestamps to Jakarta time.
- `formatReadable`: Formats DateTime to `yyyy-MM-dd HH:mm:ss`.
- `template`: Constructs strings using variables. Parameters: `{ "format": "${6} - ${0}" }`.
- `toMmi`: Calculates MMI value based on time.

---

## 3. Unified Initialization

The `initializeAllEarthquakes` method combines both systems. It fetches data from all sources defined in the config (or custom configs provided) and merges/deduplicates them.

```typescript
const result = await service.initializeAllEarthquakes();
// result.infoList contains merged and sorted data from multiple sources
```

### Why use `initializeAllEarthquakes`?

1. **Deduplication**: Automatically handles overlapping data from different sources using `id`.
2. **Standardization**: Applies the same normalization rules across JSON and XML sources.
3. **Efficiency**: Fetches all sources concurrently.
