/**
 * @fileoverview Template type conversion utilities
 * @lastmodified 2025-08-26T16:30:00Z
 *
 * Features: Convert between different Template type formats
 * Main APIs: convertServiceToIndexTemplate, convertIndexToServiceTemplate
 * Constraints: Handle optional properties and type differences
 * Patterns: Type conversion utilities with fallback values
 */

import { Template as IndexTemplate } from '../types/index';
import { Template as ServiceTemplate } from '../services/template.service';

/**
 * Convert from service Template to index Template format
 */
export function convertServiceToIndexTemplate(
  serviceTemplate: ServiceTemplate
): IndexTemplate {
  return {
    id: serviceTemplate.name, // Use name as fallback ID
    name: serviceTemplate.name,
    version: serviceTemplate.version,
    description: serviceTemplate.description,
    author: serviceTemplate.metadata?.author,
    tags: serviceTemplate.metadata?.tags,
    content: serviceTemplate.files?.[0]?.content || undefined,
    variables: serviceTemplate.variables
      ? Object.fromEntries(
          Object.entries(serviceTemplate.variables).map(([key, config]) => [
            key,
            config.default,
          ])
        )
      : undefined,
    commands: serviceTemplate.commands
      ? Object.fromEntries(
          serviceTemplate.commands.map((cmd, index) => [
            `cmd${index}`,
            cmd.command,
          ])
        )
      : undefined,
    category: serviceTemplate.metadata?.category,
    files: serviceTemplate.files?.map(file => ({
      path: file.path,
      source: file.path || file.source || '',
      destination: file.destination || file.path || file.source || '',
      transform: file.transform,
      condition: file.condition,
      content: file.content,
      name: file.name || file.path,
      encoding: file.encoding,
      mode: file.mode,
      permissions: file.mode,
    })),
  };
}

/**
 * Convert from index Template to service Template format
 */
export function convertIndexToServiceTemplate(
  indexTemplate: IndexTemplate
): ServiceTemplate {
  const commands = indexTemplate.commands
    ? Array.isArray(indexTemplate.commands)
      ? indexTemplate.commands
      : Object.entries(indexTemplate.commands).map(
          ([name, command], _index) => ({
            command,
            description: `Command ${name}`,
          })
        )
    : [];

  const variables = indexTemplate.variables
    ? Object.fromEntries(
        Object.entries(indexTemplate.variables).map(([key, value]) => [
          key,
          {
            type: typeof value as 'string' | 'number' | 'boolean',
            description: `Variable ${key}`,
            defaultValue: value,
            required: false,
          },
        ])
      )
    : {};

  const files =
    indexTemplate.files?.map(file => ({
      path: ('path' in file ? file.path : undefined) || file.source,
      name:
        ('name' in file ? file.name : undefined) ||
        ('path' in file ? file.path : undefined) ||
        file.source,
      content:
        ('content' in file ? file.content : undefined) ||
        indexTemplate.content ||
        '',
      encoding: 'encoding' in file ? file.encoding : undefined,
      mode: 'mode' in file ? file.mode : undefined,
      source: file.source || ('path' in file ? file.path : '') || '',
      destination:
        file.destination ||
        file.source ||
        ('path' in file ? file.path : '') ||
        '',
    })) || [];

  return {
    name: indexTemplate.name,
    version: indexTemplate.version || '1.0.0',
    description: indexTemplate.description,
    basePath: undefined,
    files,
    variables,
    commands,
    metadata: {
      author: indexTemplate.author || 'unknown',
      tags: indexTemplate.tags || [],
      category: indexTemplate.category || 'general',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },
  };
}
