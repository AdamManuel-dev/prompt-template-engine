/**
 * @fileoverview Template registry for managing installed templates
 * @lastmodified 2025-08-22T23:30:00Z
 */

import { TemplateModel } from '../models/template.model';

export class TemplateRegistry {
  private templates: Map<string, TemplateModel> = new Map();

  async register(template: TemplateModel): Promise<void> {
    this.templates.set(template.id, template);
  }

  async unregister(templateId: string): Promise<void> {
    this.templates.delete(templateId);
  }

  async get(templateId: string): Promise<TemplateModel | undefined> {
    return this.templates.get(templateId);
  }

  async list(): Promise<TemplateModel[]> {
    return Array.from(this.templates.values());
  }

  async isInstalled(templateId: string): Promise<boolean> {
    return this.templates.has(templateId);
  }

  async clear(): Promise<void> {
    this.templates.clear();
  }
}
