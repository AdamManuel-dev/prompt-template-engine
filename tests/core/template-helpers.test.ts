/**
 * @fileoverview Tests for template helper functions
 * @lastmodified 2025-08-22T16:35:00Z
 */

import { TemplateEngine } from '../../src/core/template-engine';
import { TemplateHelpers } from '../../src/core/template-helpers';

describe('TemplateHelpers', () => {
  let helpers: TemplateHelpers;
  let engine: TemplateEngine;

  beforeEach(() => {
    helpers = new TemplateHelpers();
    engine = new TemplateEngine();
  });

  describe('Comparison helpers', () => {
    it('should handle equality comparisons', async () => {
      const template = '{{#if (eq value 5)}}equal{{else}}not equal{{/if}}';
      expect(await engine.render('{{eq value 5}}', { value: 5 })).toBe('true');
      expect(await engine.render('{{eq value 5}}', { value: 3 })).toBe('false');
      expect(await engine.render('{{neq value 5}}', { value: 3 })).toBe('true');
    });

    it('should handle comparison operators', async () => {
      expect(await engine.render('{{lt value 10}}', { value: 5 })).toBe('true');
      expect(await engine.render('{{gt value 10}}', { value: 15 })).toBe('true');
      expect(await engine.render('{{lte value 10}}', { value: 10 })).toBe('true');
      expect(await engine.render('{{gte value 10}}', { value: 10 })).toBe('true');
    });

    it('should handle logical operators', async () => {
      expect(await engine.render('{{and true true}}', {})).toBe('true');
      expect(await engine.render('{{and true false}}', {})).toBe('false');
      expect(await engine.render('{{or false true}}', {})).toBe('true');
      expect(await engine.render('{{not false}}', {})).toBe('true');
    });
  });

  describe('Math helpers', () => {
    it('should perform basic arithmetic', async () => {
      expect(await engine.render('{{add 5 3}}', {})).toBe('8');
      expect(await engine.render('{{subtract 10 4}}', {})).toBe('6');
      expect(await engine.render('{{multiply 3 4}}', {})).toBe('12');
      expect(await engine.render('{{divide 15 3}}', {})).toBe('5');
      expect(await engine.render('{{mod 10 3}}', {})).toBe('1');
    });

    it('should handle division by zero', async () => {
      expect(await engine.render('{{divide 10 0}}', {})).toBe('0');
    });

    it('should perform rounding operations', async () => {
      expect(await engine.render('{{round 3.7}}', {})).toBe('4');
      expect(await engine.render('{{floor 3.7}}', {})).toBe('3');
      expect(await engine.render('{{ceil 3.2}}', {})).toBe('4');
      expect(await engine.render('{{abs -5}}', {})).toBe('5');
    });

    it('should find min and max values', async () => {
      expect(await engine.render('{{min 5 3 8 1}}', {})).toBe('1');
      expect(await engine.render('{{max 5 3 8 1}}', {})).toBe('8');
    });

    it('should work with variables', async () => {
      const context = { x: 10, y: 5 };
      expect(await engine.render('{{add x y}}', context)).toBe('15');
      expect(await engine.render('{{multiply x 2}}', context)).toBe('20');
    });
  });

  describe('String helpers', () => {
    it('should transform case', async () => {
      expect(await engine.render('{{uppercase "hello"}}', {})).toBe('HELLO');
      expect(await engine.render('{{lowercase "WORLD"}}', {})).toBe('world');
      expect(await engine.render('{{capitalize "test"}}', {})).toBe('Test');
    });

    it('should manipulate strings', async () => {
      expect(await engine.render('{{trim "  hello  "}}', {})).toBe('hello');
      expect(await engine.render('{{replace "hello world" "world" "universe"}}', {})).toBe('hello universe');
      expect(await engine.render('{{substring "hello" 1 4}}', {})).toBe('ell');
      expect(await engine.render('{{substring "hello" 2}}', {})).toBe('llo');
    });

    it('should check string properties', async () => {
      expect(await engine.render('{{length "hello"}}', {})).toBe('5');
      expect(await engine.render('{{contains "hello world" "world"}}', {})).toBe('true');
      expect(await engine.render('{{startsWith "hello" "he"}}', {})).toBe('true');
      expect(await engine.render('{{endsWith "hello" "lo"}}', {})).toBe('true');
    });

    it('should split and join strings', async () => {
      const context = { text: 'a,b,c', items: ['x', 'y', 'z'] };
      expect(await engine.render('{{split text ","}}', context)).toBe('a,b,c');
      expect(await engine.render('{{join items "-"}}', context)).toBe('x-y-z');
    });
  });

  describe('Array helpers', () => {
    it('should access array elements', async () => {
      const context = { items: [1, 2, 3, 4, 5] };
      expect(await engine.render('{{first items}}', context)).toBe('1');
      expect(await engine.render('{{last items}}', context)).toBe('5');
    });

    it('should transform arrays', async () => {
      const context = { items: [3, 1, 2] };
      expect(await engine.render('{{length items}}', context)).toBe('3');
      // Arrays get stringified for display
      expect(await engine.render('{{reverse items}}', context)).toBe('2,1,3');
      expect(await engine.render('{{sort items}}', context)).toBe('1,2,3');
    });

    it('should handle unique values', async () => {
      const context = { items: [1, 2, 2, 3, 1] };
      expect(await engine.render('{{unique items}}', context)).toBe('1,2,3');
    });
  });

  describe('Type checking helpers', () => {
    it('should check data types', async () => {
      const context = {
        arr: [1, 2],
        obj: { key: 'value' },
        str: 'hello',
        num: 42,
        bool: true,
        nothing: null,
        missing: undefined
      };
      
      expect(await engine.render('{{isArray arr}}', context)).toBe('true');
      expect(await engine.render('{{isObject obj}}', context)).toBe('true');
      expect(await engine.render('{{isString str}}', context)).toBe('true');
      expect(await engine.render('{{isNumber num}}', context)).toBe('true');
      expect(await engine.render('{{isBoolean bool}}', context)).toBe('true');
      expect(await engine.render('{{isNull nothing}}', context)).toBe('true');
      expect(await engine.render('{{isUndefined missing}}', context)).toBe('true');
      expect(await engine.render('{{isDefined str}}', context)).toBe('true');
    });

    it('should check for empty values', async () => {
      expect(await engine.render('{{isEmpty ""}}', {})).toBe('true');
      expect(await engine.render('{{isEmpty "hello"}}', {})).toBe('false');
      const context = { 
        emptyArr: [],
        fullArr: [1],
        emptyObj: {},
        fullObj: { a: 1 }
      };
      expect(await engine.render('{{isEmpty emptyArr}}', context)).toBe('true');
      expect(await engine.render('{{isEmpty fullArr}}', context)).toBe('false');
      expect(await engine.render('{{isEmpty emptyObj}}', context)).toBe('true');
      expect(await engine.render('{{isEmpty fullObj}}', context)).toBe('false');
    });
  });

  describe('Utility helpers', () => {
    it('should provide default values', async () => {
      const context = { value: null, existing: 'hello' };
      expect(await engine.render('{{default value "fallback"}}', context)).toBe('fallback');
      expect(await engine.render('{{default existing "fallback"}}', context)).toBe('hello');
    });

    it('should handle JSON operations', async () => {
      const context = { obj: { key: 'value' } };
      const jsonResult = await engine.render('{{json obj}}', context);
      expect(jsonResult).toContain('"key"');
      expect(jsonResult).toContain('"value"');
    });

    it('should provide date/time helpers', async () => {
      const result = await engine.render('{{now}}', {});
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      const dateResult = await engine.render('{{date "iso"}}', {});
      expect(dateResult).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Integration with conditionals', () => {
    it('should work within if blocks', async () => {
      const template = '{{#if (gt score 50)}}Pass{{else}}Fail{{/if}}';
      expect(await engine.render(template, { score: 75 })).toBe('Pass');
      expect(await engine.render(template, { score: 25 })).toBe('Fail');
    });

    it('should work with complex expressions', async () => {
      const template = '{{#if (and (gt age 18) (lt age 65))}}Working age{{else}}Not working age{{/if}}';
      expect(await engine.render(template, { age: 30 })).toBe('Working age');
      expect(await engine.render(template, { age: 70 })).toBe('Not working age');
      expect(await engine.render(template, { age: 15 })).toBe('Not working age');
    });

    it('should work in each blocks', async () => {
      const template = `{{#each items}}
{{uppercase this}} (length: {{length this}})
{{/each}}`;
      const context = { items: ['hello', 'world'] };
      const result = await engine.render(template, context);
      expect(result).toContain('HELLO (length: 5)');
      expect(result).toContain('WORLD (length: 5)');
    });
  });

  describe('Helper error handling', () => {
    it('should handle invalid helper names gracefully', async () => {
      const result = await engine.render('{{invalidHelper arg}}', { arg: 'test' });
      expect(result).toBe('{{invalidHelper arg}}');
    });

    it('should handle missing arguments', async () => {
      const result = await engine.render('{{add}}', {});
      expect(result).toBe('NaN'); // add with no args returns NaN
    });

    it('should handle type coercion', async () => {
      expect(await engine.render('{{add "5" "3"}}', {})).toBe('8');
      expect(await engine.render('{{uppercase 123}}', {})).toBe('123');
    });
  });

  describe('Complex template scenarios', () => {
    it('should handle nested helper calls in conditionals', async () => {
      const template = `
{{#if (and (isArray items) (gt (length items) 0))}}
  Items: {{#each items}}{{uppercase this}} {{/each}}
{{else}}
  No items
{{/if}}`;
      
      const withItems = await engine.render(template, { items: ['apple', 'banana'] });
      expect(withItems).toContain('APPLE');
      expect(withItems).toContain('BANANA');
      
      const noItems = await engine.render(template, { items: [] });
      expect(noItems).toContain('No items');
    });

    it('should process mathematical formulas', async () => {
      const template = 'Result: {{add (multiply x 2) (divide y 2)}}';
      const result = await engine.render(template, { x: 10, y: 6 });
      expect(result).toBe('Result: 23'); // (10 * 2) + (6 / 2) = 20 + 3 = 23
    });

    it('should format user data', async () => {
      const template = `
Name: {{capitalize user.firstName}} {{uppercase user.lastName}}
Email: {{lowercase user.email}}
Account Age: {{subtract currentYear user.joinYear}} years`;
      
      const context = {
        user: {
          firstName: 'john',
          lastName: 'doe',
          email: 'JOHN.DOE@EXAMPLE.COM',
          joinYear: 2020
        },
        currentYear: 2025
      };
      
      const result = await engine.render(template, context);
      expect(result).toContain('Name: John DOE');
      expect(result).toContain('Email: john.doe@example.com');
      expect(result).toContain('Account Age: 5 years');
    });
  });
});