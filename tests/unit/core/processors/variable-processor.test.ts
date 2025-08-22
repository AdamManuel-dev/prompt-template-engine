/**
 * @fileoverview Tests for variable processor
 * @lastmodified 2025-08-22T22:00:00Z
 */

import { VariableProcessor } from '../../../../src/core/processors/variable-processor';
import { TemplateContext } from '../../../../src/types';

describe('VariableProcessor', () => {
  let processor: VariableProcessor;

  beforeEach(() => {
    processor = new VariableProcessor();
  });

  describe('processVariables', () => {
    it('should replace simple variables', () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      const context: TemplateContext = {
        name: 'John',
        place: 'TypeScript',
      };

      const result = processor.processVariables(template, context);

      expect(result).toBe('Hello John, welcome to TypeScript!');
    });

    it('should handle nested object paths', () => {
      const template = 'User: {{user.name}}, Email: {{user.email}}';
      const context: TemplateContext = {
        user: {
          name: 'Jane',
          email: 'jane@example.com',
        },
      };

      const result = processor.processVariables(template, context);

      expect(result).toBe('User: Jane, Email: jane@example.com');
    });

    it('should handle array index notation', () => {
      const template = 'First: {{items[0]}}, Second: {{items[1]}}';
      const context: TemplateContext = {
        items: ['apple', 'banana', 'cherry'],
      };

      const result = processor.processVariables(template, context);

      expect(result).toBe('First: apple, Second: banana');
    });

    it('should leave unmatched variables as-is', () => {
      const template = 'Hello {{name}}, {{unknown}} variable';
      const context: TemplateContext = {
        name: 'World',
      };

      const result = processor.processVariables(template, context);

      expect(result).toBe('Hello World, {{unknown}} variable');
    });

    it('should handle special @ variables', () => {
      const template = 'Index: {{@index}}, First: {{@first}}, Last: {{@last}}';
      const context: TemplateContext = {
        _index: 2,
        _total: 5,
      };

      const result = processor.processVariables(template, context);

      expect(result).toBe('Index: 2, First: false, Last: false');
    });
  });

  describe('resolveVariable', () => {
    it('should resolve simple variables', () => {
      const context: TemplateContext = {
        name: 'Test',
        value: 42,
      };

      expect(processor.resolveVariable('name', context)).toBe('Test');
      expect(processor.resolveVariable('value', context)).toBe(42);
    });

    it('should resolve nested paths', () => {
      const context: TemplateContext = {
        user: {
          profile: {
            name: 'Deep',
            age: 30,
          },
        },
      };

      expect(processor.resolveVariable('user.profile.name', context)).toBe(
        'Deep'
      );
      expect(processor.resolveVariable('user.profile.age', context)).toBe(30);
    });

    it('should handle undefined paths gracefully', () => {
      const context: TemplateContext = {
        user: null,
      };

      expect(processor.resolveVariable('user.name', context)).toBeUndefined();
      expect(
        processor.resolveVariable('missing.path', context)
      ).toBeUndefined();
    });

    it('should resolve special variables', () => {
      const context: TemplateContext = {
        _index: 0,
        _total: 3,
      };

      expect(processor.resolveVariable('@index', context)).toBe(0);
      expect(processor.resolveVariable('@first', context)).toBe(true);
      expect(processor.resolveVariable('@last', context)).toBe(false);
      expect(processor.resolveVariable('@even', context)).toBe(true);
      expect(processor.resolveVariable('@odd', context)).toBe(false);
    });

    it('should handle array access with bracket notation', () => {
      const context: TemplateContext = {
        users: [{ name: 'Alice' }, { name: 'Bob' }],
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      };

      expect(processor.resolveVariable('users[0]', context)).toEqual({
        name: 'Alice',
      });
      expect(processor.resolveVariable('users[1]', context)).toEqual({
        name: 'Bob',
      });
      expect(processor.resolveVariable('matrix[0]', context)).toEqual([
        1, 2, 3,
      ]);
      expect(processor.resolveVariable('matrix[1]', context)).toEqual([
        4, 5, 6,
      ]);
    });
  });

  describe('extractSimpleVariables', () => {
    it('should extract all variable names', () => {
      const template =
        'Hello {{name}}, your score is {{score}} and rank is {{rank}}';

      const variables = processor.extractSimpleVariables(template);

      expect(variables).toEqual(['name', 'score', 'rank']);
    });

    it('should extract unique variables only', () => {
      const template = '{{name}} - {{age}} - {{name}} - {{age}}';

      const variables = processor.extractSimpleVariables(template);

      expect(variables).toEqual(['name', 'age']);
    });

    it('should ignore special @ variables', () => {
      const template = '{{@index}} - {{name}} - {{@first}} - {{value}}';

      const variables = processor.extractSimpleVariables(template);

      expect(variables).toEqual(['name', 'value']);
    });

    it('should extract nested path variables', () => {
      const template =
        '{{user.name}} - {{user.email}} - {{config.theme.color}}';

      const variables = processor.extractSimpleVariables(template);

      expect(variables).toEqual([
        'user.name',
        'user.email',
        'config.theme.color',
      ]);
    });

    it('should return empty array for no variables', () => {
      const template = 'No variables here!';

      const variables = processor.extractSimpleVariables(template);

      expect(variables).toEqual([]);
    });
  });
});
