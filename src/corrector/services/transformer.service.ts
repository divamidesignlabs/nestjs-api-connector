import { Injectable, Logger } from '@nestjs/common';
import * as jsonpath from 'jsonpath';
import {
  RequestMapping,
  ResponseMapping,
  TransformDefinition,
} from '../interfaces/mapping-config.interface';
import { MESSAGES } from '../constants';

@Injectable()
export class TransformerService {
  private readonly logger = new Logger(TransformerService.name);

  /**
   * Main entry point for data transformation.
   * Supports OBJECT, ARRAY, CUSTOM, and DIRECT mapping types.
   */
  transform(
    sourceData: any,
    mapping: RequestMapping | ResponseMapping,
    customTransforms?: Record<string, TransformDefinition>,
  ): any {
    if (!mapping || mapping.type === 'DIRECT') return sourceData;

    // Orchestrate based on mapping type
    switch (mapping.type) {
      case 'ARRAY':
        return this.transformArray(sourceData, mapping as ResponseMapping, customTransforms);
      case 'CUSTOM':
        return mapping.logic ? this.executeCustomLogic(sourceData, mapping.logic) : sourceData;
      case 'OBJECT':
      default:
        return this.transformObject(sourceData, mapping, customTransforms);
    }
  }

  private transformArray(
    source: any,
    mapping: ResponseMapping,
    customTransforms?: Record<string, TransformDefinition>,
  ): any {
    if (!mapping.root) return [];
    
    const rootArray = this.getValue(source, mapping.root);
    if (!Array.isArray(rootArray)) {
      this.logger.warn(MESSAGES.ERROR.ROOT_ARRAY_NOT_FOUND(mapping.root));
      return [];
    }

    // Optimization: Define the item mapping once outside the loop
    const itemMapping: ResponseMapping = { ...mapping, type: 'OBJECT', root: undefined };

    const transformedList = rootArray.map((item: any) => 
      this.transformObject(item, itemMapping, customTransforms)
    );

    if (mapping.outputWrapper) {
      const result = {};
      this.setValue(result, mapping.outputWrapper, transformedList);
      return result;
    }

    return transformedList;
  }

  private transformObject(
    source: any,
    mapping: RequestMapping | ResponseMapping,
    customTransforms?: Record<string, TransformDefinition>,
  ): any {
    const result = {};

    // 1. Process individual field mappings
    if (mapping.mappings) {
      for (const mapItem of mapping.mappings) {
        try {
          const value = this.resolveFieldValue(source, mapItem);

          // Handle required field validation
          if (mapItem.required && value === undefined) {
            throw new Error(MESSAGES.ERROR.REQUIRED_FIELD_MISSING(mapItem.source));
          }

          if (value === undefined) continue;

          // Apply transformations if defined
          const transformedValue = mapItem.transform 
            ? this.applyTransform(value, mapItem.transform, customTransforms)
            : value;

          if (transformedValue !== undefined) {
            this.setValue(result, mapItem.target, transformedValue);
          }
        } catch (error: any) {
          this.logger.warn(MESSAGES.ERROR.TRANSFORM_FAILED(mapItem.source, error.message));
        }
      }
    }

    // 2. Apply object-level defaults for missing keys
    if (mapping.defaults) {
      for (const [path, defaultValue] of Object.entries(mapping.defaults)) {
        if (this.getValue(result, path) === undefined) {
          this.setValue(result, path, defaultValue);
        }
      }
    }

    return result;
  }

  private resolveFieldValue(source: any, mapItem: any): any {
    // A. Handle Conditional Logic
    if (mapItem.condition) {
      const conditionPassed = this.evaluateCondition(source, mapItem.condition);
      if (conditionPassed) {
        return mapItem.valueIfTrue !== undefined 
          ? mapItem.valueIfTrue 
          : this.getValue(source, mapItem.source);
      }
      return mapItem.valueIfFalse;
    }

    // B. Standard JSONPath Lookup
    const value = this.getValue(source, mapItem.source);
    return value !== undefined ? value : mapItem.default;
  }

  private evaluateCondition(data: any, condition: string): boolean {
    if (condition.includes('==')) {
      const [path, val] = condition.split('==').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
      return String(this.getValue(data, path)) === val;
    }
    return !!this.getValue(data, condition);
  }

  private applyTransform(
    value: any,
    transformName: string,
    customTransforms?: Record<string, TransformDefinition>,
  ): any {
    // 1. Core Built-in Utilities
    const builtInTransforms: Record<string, (v: any) => any> = {
      roundTo2: (v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v,
      uppercase: (v) => typeof v === 'string' ? v.toUpperCase() : v,
      lowercase: (v) => typeof v === 'string' ? v.toLowerCase() : v,
      toNumber: (v) => Number(v),
      toString: (v) => String(v),
    };

    if (builtInTransforms[transformName]) {
      return builtInTransforms[transformName](value);
    }

    // 2. Configurable Custom Transforms
    if (customTransforms?.[transformName]) {
      return this.executeCustomLogic(value, customTransforms[transformName].logic);
    }

    return value;
  }

  private executeCustomLogic(value: any, logicBody: string): any {
    try {
      // Create a dynamic function context
      /* eslint-disable @typescript-eslint/no-implied-eval */
      const fn = new Function('value', logicBody);
      return fn(value);
    } catch (e: any) {
      this.logger.error(MESSAGES.ERROR.CUSTOM_TRANSFORM_ERROR(e.message));
      return { error: `Script Error: ${e.message}` };
    }
  }

  /**
   * Deep set a value on an object using a dot-notation path.
   */
  private setValue(obj: any, path: string, value: any): void {
    const cleanPath = path.startsWith('$.') ? path.slice(2) : path;
    const parts = cleanPath.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue;
      if (!current[part]) current[part] = {};
      current = current[part];
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) current[lastPart] = value;
  }

  private getValue(obj: any, path: string): any {
    try {
      return jsonpath.value(obj, path);
    } catch {
      return undefined;
    }
  }
}
