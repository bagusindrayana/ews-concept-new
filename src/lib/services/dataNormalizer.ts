import { DateTime } from "luxon";
import { XMLParser } from "fast-xml-parser";

export interface DataMappingConfig {
  id: string;
  category: "all" | "feel" | "small";
  source_url: string;
  type: "json" | "xml";
  single_data: boolean;
  attribute: string;
  data_mapping: Record<string, FieldMapping>;
}

export interface FieldMapping {
  attribute: string;
  index?: number;
  func?: Array<Record<string, any> | string>;
}

export class DataNormalizer {
  private parser = new XMLParser();

  /**
   * Resolve a nested attribute path like "info.point.coordinates"
   */
  private resolvePath(obj: any, path: string): any {
    if (!path) return obj;
    return path.split(".").reduce((prev, curr) => (prev ? prev[curr] : undefined), obj);
  }

  /**
   * Apply transformation functions to a value
   */
  private applyTransform(value: any, funcs: Array<Record<string, any> | string>, context?: any): any {
    let result = value;

    for (const func of funcs) {
      if (typeof func === "string") {
        result = this.executeFunc(func, result, {}, context);
      } else {
        const [funcName, params] = Object.entries(func)[0];
        result = this.executeFunc(funcName, result, params, context);
      }
    }

    return result;
  }

  private executeFunc(name: string, value: any, params: any, context?: any): any {
    switch (name) {
      case "split":
        if (typeof value !== "string") return value;
        const parts = value.split(params.separator);
        return parts[params.index] !== undefined ? parts[params.index] : value;
      case "replace":
        if (typeof value !== "string") return value;
        return value.replace(params.from, params.to);
      case "toFloat":
        return parseFloat(String(value));
      case "toInt":
        return parseInt(String(value));
      case "fromISO":
        return DateTime.fromISO(value, { zone: params.zone || "UTC" });
      case "fromFormat":
        return DateTime.fromFormat(value, params.format, { zone: params.zone || "UTC" });
      case "utcSqlToJakarta":
        if (!value) return value;
        // Handle SQL format like "2026-03-15 22:45:47.386256"
        let dt = DateTime.fromSQL(value, { zone: "UTC" });
        if (!dt.isValid) {
          // Try fromISO as fallback
          dt = DateTime.fromISO(value.replace(" ", "T"), { zone: "UTC" });
        }
        if (!dt.isValid) {
            // Last resort: just try to parse the first 19 chars (YYYY-MM-DD HH:mm:ss)
            dt = DateTime.fromFormat(value.substring(0, 19), "yyyy-MM-dd HH:mm:ss", { zone: "UTC" });
        }
        return dt.setZone("Asia/Jakarta");
      case "template":
        // Replace ${key} or ${index} with values from context
        const template = params.format || "";
        return template.replace(/\$\{(\w+)\}/g, (_: string, path: string) => {
          return this.resolvePath(context, path);
        });
      case "formatReadable":
        if (value instanceof DateTime) {
          return value.toFormat("yyyy-MM-dd HH:mm:ss");
        }
        return value;
      case "toMmi":
          // Special logic for MMI calculation if needed
          const str = String(value).replaceAll("-", "").replaceAll(" ", "").replaceAll(":", "");
          return parseInt(str || "0");
      default:
        console.warn(`Unknown function: ${name}`);
        return value;
    }
  }

  /**
   * Normalize raw data item based on field mappings
   */
  public normalizeItem<T>(item: any, mapping: Record<string, FieldMapping>): T {
    const result: any = {};

    for (const [targetField, fieldCfg] of Object.entries(mapping)) {
      let value = this.resolvePath(item, fieldCfg.attribute);

      if (fieldCfg.index !== undefined && Array.isArray(value)) {
        value = value[fieldCfg.index];
      }

      if (fieldCfg.func && fieldCfg.func.length > 0) {
        value = this.applyTransform(value, fieldCfg.func, item);
      }

      result[targetField] = value;
    }

    // Calculated fields (MMI)
    if (result.time && !result.mmi) {
        result.mmi = this.executeFunc("toMmi", result.time, {});
    }

    return result as T;
  }

  /**
   * Parse raw response and normalize list/single item
   */
  public async parseAndNormalize<T>(rawData: string | any, config: DataMappingConfig): Promise<T[]> {
    let data = rawData;
    
    // Parse if it's a string (e.g. from fetch response)
    if (typeof rawData === "string") {
      if (config.type === "xml") {
        data = this.parser.parse(rawData);
      } else {
        data = JSON.parse(rawData);
      }
    }

    // Navigate to the root data attribute
    let items = this.resolvePath(data, config.attribute);

    if (config.single_data) {
      return [this.normalizeItem<T>(items, config.data_mapping)];
    }

    if (!Array.isArray(items)) {
      items = items ? [items] : [];
    }

    return items.map((item: any) => this.normalizeItem<T>(item, config.data_mapping));
  }
}
