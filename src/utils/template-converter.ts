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
export function convertServiceToIndexTemplate(serviceTemplate: ServiceTemplate): IndexTemplate {
  return {
    id: serviceTemplate.name, // Use name as fallback ID
    name: serviceTemplate.name,
    version: serviceTemplate.version,
    description: serviceTemplate.description,
    author: serviceTemplate.metadata?.author,
    tags: serviceTemplate.metadata?.tags,
    content: serviceTemplate.files?.[0]?.content || undefined,
    variables: serviceTemplate.variables ? 
      Object.fromEntries(Object.entries(serviceTemplate.variables).map(([key, config]) => [key, config.defaultValue])) : 
      undefined,
    commands: serviceTemplate.commands ? 
      Object.fromEntries(serviceTemplate.commands.map((cmd, index) => [`cmd${index}`, cmd.command])) : 
      undefined,
    category: serviceTemplate.metadata?.category,
    files: serviceTemplate.files?.map(file => ({
      source: file.source,
      destination: file.destination || file.source,
      transform: file.transform,
      condition: file.condition
    }))
  };
}

/**
 * Convert from index Template to service Template format
 */
export function convertIndexToServiceTemplate(indexTemplate: IndexTemplate): ServiceTemplate {
  const commands = indexTemplate.commands ? 
    Object.entries(indexTemplate.commands).map(([name, command], index) => ({
      name,
      command,
      description: `Command ${index + 1}`,
      args: []
    })) : 
    [];

  const variables = indexTemplate.variables ?
    Object.fromEntries(Object.entries(indexTemplate.variables).map(([key, value]) => [
      key,
      {
        type: typeof value as 'string' | 'number' | 'boolean',
        description: `Variable ${key}`,
        defaultValue: value,
        required: false
      }
    ])) :
    {};

  const files = indexTemplate.files?.map(file => ({
    source: file.source,
    destination: file.destination,
    transform: file.transform,
    condition: file.condition,
    content: indexTemplate.content || undefined
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
      author: indexTemplate.author,
      tags: indexTemplate.tags,
      category: indexTemplate.category,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  };
}