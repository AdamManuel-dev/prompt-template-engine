/**
 * @fileoverview Tests for partial template functionality
 * @lastmodified 2025-08-22T16:50:00Z
 */

import { TemplateEngine } from '../../src/core/template-engine';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Template Partials', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
    jest.clearAllMocks();
  });

  describe('Basic partial rendering', () => {
    it('should render a simple partial', async () => {
      engine.registerPartial('header', '<h1>{{title}}</h1>');
      const template = '{{> header}}';
      const result = await engine.render(template, { title: 'Hello World' });
      expect(result).toBe('<h1>Hello World</h1>');
    });

    it('should render multiple partials', async () => {
      engine.registerPartial('header', '<header>{{title}}</header>');
      engine.registerPartial('footer', '<footer>{{copyright}}</footer>');
      
      const template = '{{> header}}\n<main>Content</main>\n{{> footer}}';
      const context = {
        title: 'My Site',
        copyright: '© 2025'
      };
      
      const result = await engine.render(template, context);
      expect(result).toBe('<header>My Site</header>\n<main>Content</main>\n<footer>© 2025</footer>');
    });

    it('should handle missing partials gracefully', async () => {
      const template = '{{> nonexistent}}';
      const result = await engine.render(template, {});
      expect(result).toBe('{{> nonexistent}}');
    });
  });

  describe('Partials with context', () => {
    it('should pass context to partial', async () => {
      engine.registerPartial('user', 'Name: {{name}}, Age: {{age}}');
      
      const template = '{{> user}}';
      const context = { name: 'John', age: 30 };
      
      const result = await engine.render(template, context);
      expect(result).toBe('Name: John, Age: 30');
    });

    it('should use specific context object for partial', async () => {
      engine.registerPartial('address', '{{street}}, {{city}}');
      
      const template = 'User Address: {{> address userAddress}}';
      const context = {
        userAddress: {
          street: '123 Main St',
          city: 'New York'
        }
      };
      
      const result = await engine.render(template, context);
      expect(result).toBe('User Address: 123 Main St, New York');
    });
  });

  describe('Nested partials', () => {
    it('should render partials within partials', async () => {
      engine.registerPartial('bold', '<b>{{text}}</b>');
      engine.registerPartial('wrapper', '<div>{{> bold}}</div>');
      
      const template = '{{> wrapper}}';
      const result = await engine.render(template, { text: 'Hello' });
      expect(result).toBe('<div><b>Hello</b></div>');
    });

    it('should handle multiple levels of nesting', async () => {
      engine.registerPartial('item', '<li>{{value}}</li>');
      engine.registerPartial('list', '<ul>{{#each items}}{{> item}}{{/each}}</ul>');
      engine.registerPartial('section', '<section><h2>{{title}}</h2>{{> list}}</section>');
      
      const template = '{{> section}}';
      const context = {
        title: 'My List',
        items: [
          { value: 'Item 1' },
          { value: 'Item 2' },
          { value: 'Item 3' }
        ]
      };
      
      const result = await engine.render(template, context);
      expect(result).toBe('<section><h2>My List</h2><ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></section>');
    });
  });

  describe('Partials with conditionals and loops', () => {
    it('should work with conditional blocks in partials', async () => {
      engine.registerPartial('greeting', '{{#if loggedIn}}Welcome {{username}}!{{else}}Please log in{{/if}}');
      
      const template = '{{> greeting}}';
      
      const loggedInResult = await engine.render(template, { loggedIn: true, username: 'Alice' });
      expect(loggedInResult).toBe('Welcome Alice!');
      
      const loggedOutResult = await engine.render(template, { loggedIn: false });
      expect(loggedOutResult).toBe('Please log in');
    });

    it('should work with each blocks in partials', async () => {
      engine.registerPartial('todoItem', '- {{task}} ({{status}})');
      engine.registerPartial('todoList', '{{#each todos}}{{> todoItem}}{{/each}}');
      
      const template = 'Tasks:\n{{> todoList}}';
      const context = {
        todos: [
          { task: 'Buy milk', status: 'pending' },
          { task: 'Write code', status: 'completed' },
          { task: 'Review PR', status: 'in-progress' }
        ]
      };
      
      const result = await engine.render(template, context);
      expect(result).toBe('Tasks:\n- Buy milk (pending)- Write code (completed)- Review PR (in-progress)');
    });
  });

  describe('Partials with helpers', () => {
    it('should work with helper functions in partials', async () => {
      engine.registerPartial('price', '${{multiply price quantity}}');
      
      const template = 'Total: {{> price}}';
      const context = { price: 10, quantity: 3 };
      
      const result = await engine.render(template, context);
      expect(result).toBe('Total: $30');
    });

    it('should work with complex helper expressions', async () => {
      engine.registerPartial('status', '{{#if (gt score 70)}}Pass{{else}}Fail{{/if}}');
      
      const template = 'Result: {{> status}}';
      
      const passResult = await engine.render(template, { score: 85 });
      expect(passResult).toBe('Result: Pass');
      
      const failResult = await engine.render(template, { score: 60 });
      expect(failResult).toBe('Result: Fail');
    });
  });

  describe('Loading partials from files', () => {
    it('should register partial from file', async () => {
      const partialContent = '<nav>{{#each links}}<a href="{{url}}">{{text}}</a>{{/each}}</nav>';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(partialContent);
      
      engine.registerPartialFromFile('navigation', '/templates/nav.partial');
      
      const template = '{{> navigation}}';
      const context = {
        links: [
          { url: '/', text: 'Home' },
          { url: '/about', text: 'About' }
        ]
      };
      
      const result = await engine.render(template, context);
      expect(result).toBe('<nav><a href="/">Home</a><a href="/about">About</a></nav>');
    });

    it('should load all partials from directory', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['header.partial', 'footer.partial', 'readme.txt'] as any);
      mockFs.readFileSync.mockImplementation((file) => {
        if (String(file).includes('header')) return '<header>Header</header>';
        if (String(file).includes('footer')) return '<footer>Footer</footer>';
        return '';
      });
      
      engine.setPartialsDirectory('/templates/partials');
      engine.loadPartials();
      
      const template = '{{> header}}\nContent\n{{> footer}}';
      const result = await engine.render(template, {});
      expect(result).toBe('<header>Header</header>\nContent\n<footer>Footer</footer>');
    });
  });

  describe('Complex template scenarios', () => {
    it('should render a complete page with partials', async () => {
      // Register partials
      engine.registerPartial('head', '<head><title>{{pageTitle}}</title></head>');
      engine.registerPartial('nav', '<nav>{{#each navItems}}<a href="{{url}}">{{label}}</a>{{/each}}</nav>');
      engine.registerPartial('card', '<div class="card"><h3>{{title}}</h3><p>{{description}}</p></div>');
      engine.registerPartial('footer', '<footer>© {{year}} {{company}}</footer>');
      
      const template = `<!DOCTYPE html>
<html>
{{> head}}
<body>
  {{> nav}}
  <main>
    <h1>{{mainTitle}}</h1>
    {{#each cards}}
      {{> card}}
    {{/each}}
  </main>
  {{> footer}}
</body>
</html>`;
      
      const context = {
        pageTitle: 'My Website',
        navItems: [
          { url: '/', label: 'Home' },
          { url: '/products', label: 'Products' },
          { url: '/contact', label: 'Contact' }
        ],
        mainTitle: 'Welcome',
        cards: [
          { title: 'Feature 1', description: 'Description of feature 1' },
          { title: 'Feature 2', description: 'Description of feature 2' }
        ],
        year: 2025,
        company: 'My Company'
      };
      
      const result = await engine.render(template, context);
      expect(result).toContain('<title>My Website</title>');
      expect(result).toContain('<a href="/">Home</a>');
      expect(result).toContain('<h3>Feature 1</h3>');
      expect(result).toContain('© 2025 My Company');
    });

    it('should handle recursive partial structures', async () => {
      engine.registerPartial('comment', `
<div class="comment">
  <p>{{text}}</p>
  {{#if replies}}
    <div class="replies">
      {{#each replies}}
        {{> comment}}
      {{/each}}
    </div>
  {{/if}}
</div>`);
      
      const template = '{{> comment}}';
      const context = {
        text: 'Top level comment',
        replies: [
          {
            text: 'First reply',
            replies: [
              { text: 'Nested reply 1' },
              { text: 'Nested reply 2' }
            ]
          },
          {
            text: 'Second reply'
          }
        ]
      };
      
      const result = await engine.render(template, context);
      expect(result).toContain('Top level comment');
      expect(result).toContain('First reply');
      expect(result).toContain('Nested reply 1');
      expect(result).toContain('Nested reply 2');
      expect(result).toContain('Second reply');
    });
  });
});