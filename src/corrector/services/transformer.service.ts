import { Injectable, Logger } from '@nestjs/common';
import * as jsonpath from 'jsonpath';
import {
  RequestMapping,
  ResponseMapping,
  TransformDefinition,
} from '../interfaces/mapping-config.interface';

@Injectable()
export class TransformerService {
  private readonly logger = new Logger(TransformerService.name);

  // Core transform entry
  transform(
    sourceData: any,
    mapping: RequestMapping | ResponseMapping,
    customTransforms?: Record<string, TransformDefinition>,
  ): any {
    if (!mapping) {
      return sourceData;
    }

    // Handle Array Mapping
    if (mapping.type === 'ARRAY' && mapping.root) {
      return this.transformArray(sourceData, mapping, customTransforms);
    }

    // Handle Custom Script Mapping (Root Level)
    if (mapping.type === 'CUSTOM' && mapping.logic) {
      return this.executeCustomLogic(sourceData, mapping.logic);
    }

    // Default Object Mapping
    return this.transformObject(sourceData, mapping, customTransforms);
  }

  private transformArray(
    source: any,
    mapping: ResponseMapping,
    customTransforms?: Record<string, TransformDefinition>,
  ): any {
    if (!mapping.root) return [];
    const rootArray = this.getValue(source, mapping.root) as any[];

    if (!Array.isArray(rootArray)) {
      this.logger.warn(`Root path ${mapping.root} did not resolve to an array`);
      return [];
    }

    const transformedList = rootArray.map((item: any) => {
      // Create a temporary mapping config for the item, treating it as an object mapping
      const itemMapping: ResponseMapping = {
        ...mapping,
        type: 'OBJECT',
        root: undefined,
      }; // Reset root for recursing
      return this.transformObject(
        item,
        itemMapping,
        customTransforms,
      ) as unknown;
    });

    if (mapping.outputWrapper) {
      const result = {};
      this.setValue(result, mapping.outputWrapper, transformedList);
      return result as unknown;
    }

    return transformedList as unknown;
  }

  private transformObject(
    source: any,
    mapping: RequestMapping | ResponseMapping,
    customTransforms?: Record<string, TransformDefinition>,
  ): any {
    const result = {};

    if (mapping.mappings) {
      for (const mapItem of mapping.mappings) {
        try {
          let value: unknown;
          const conditionPassed =
            !mapItem.condition ||
            this.evaluateCondition(source, mapItem.condition);

          if (mapItem.condition) {
            if (conditionPassed) {
              value =
                mapItem.valueIfTrue !== undefined
                  ? (mapItem.valueIfTrue as unknown)
                  : (jsonpath.value(source, mapItem.source) as unknown);
            } else {
              if (mapItem.valueIfFalse !== undefined) {
                value = mapItem.valueIfFalse as unknown;
              } else {
                continue; // Skip if no false value provided
              }
            }
          } else {
            value = jsonpath.value(source, mapItem.source) as unknown;
          }

          // Handle default if source path is missing
          if (value === undefined) {
            value = mapItem.default as unknown;
          }

          // STRICT VALIDATION: Check if field is required but missing
          if (mapItem.required && value === undefined) {
            throw new Error(`Missing required field: ${mapItem.source}`);
          }

          if (value !== undefined && mapItem.transform) {
            value = this.applyTransform(
              value,
              mapItem.transform,
              customTransforms,
            ) as unknown;
          }

          if (value !== undefined) {
            this.setValue(result, mapItem.target, value);
          }
        } catch (error: unknown) {
          const err = error as { message?: string };
          this.logger.warn(
            `Mapping failed for ${mapItem.source}: ${err.message || 'Unknown error'}`,
          );
        }
      }
    }

    // Apply object-level defaults (if target keys missing)
    if (mapping.defaults) {
      for (const [path, defaultValue] of Object.entries(mapping.defaults)) {
        if (this.getValue(result, path) === undefined) {
          this.setValue(result, path, defaultValue);
        }
      }
    }

    return result as unknown;
  }

  private evaluateCondition(data: any, condition: string): boolean {
    // Simple equality check support or boolean path check
    if (condition.includes('==')) {
      const [path, val] = condition
        .split('==')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
      if (path) {
        return String(this.getValue(data, path)) === val;
      }
    }
    return !!this.getValue(data, condition);
  }

  private applyTransform(
    value: any,
    transformName: string,
    customTransforms?: Record<string, TransformDefinition>,
  ): any {
    // 1. Built-in transforms
    switch (transformName) {
      case 'roundTo2':
        return typeof value === 'number'
          ? Math.round(value * 100) / 100
          : value;
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'toNumber':
        return Number(value);
      case 'toString':
        return String(value);
    }

    // 2. Custom Configured Transforms
    if (customTransforms && customTransforms[transformName]) {
      return this.executeCustomLogic(
        value,
        customTransforms[transformName].logic,
      );
    }

    return value;
  }

  private executeCustomLogic(value: any, logicBody: string): any {
    try {
      // Safe(ish) functionality: new Function('value', body)
      // Ensure logicBody is just the inner logic.
      // Example: "return value + 1;"
      /* eslint-disable @typescript-eslint/no-implied-eval */
      const fn = new Function('value', logicBody);
      /* eslint-disable @typescript-eslint/no-unsafe-call */
      return fn(value);
    } catch (e: any) {
      const error = e as { message?: string };
      this.logger.error(
        `Custom transform error: ${error.message || 'Unknown error'}`,
      );
      return { error: `Script Error: ${error.message || 'Unknown error'}` };
    }
  }

  private setValue(obj: any, path: string, value: any): void {
    const cleanPath = path.startsWith('$.') ? path.slice(2) : path;
    const parts = cleanPath.split('.');
    let current = obj as Record<string, any>;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part) {
        if (!current[part]) current[part] = {};
        current = current[part] as Record<string, any>;
      }
    }
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value as unknown;
    }
  }

  private getValue(obj: any, path: string): any {
    try {
      return jsonpath.value(obj, path);
    } catch {
      return undefined;
    }
  }
}
