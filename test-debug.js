// Debug script to test marketplace sorting
const { MarketplaceService } = require('./dist/marketplace/core/marketplace.service');
const { FileMarketplaceDatabase } = require('./dist/marketplace/database/file-database');
const path = require('path');
const fs = require('fs').promises;

async function test() {
  const testDir = '/tmp/test-marketplace-' + Date.now();
  await fs.mkdir(testDir, { recursive: true });
  
  const db = new FileMarketplaceDatabase({ dataDir: testDir });
  await db.connect();
  
  const service = new MarketplaceService();
  service['database'] = db;
  
  // Create test templates
  const templates = [
    { id: 'auth-template', name: 'Auth', stats: { downloads: 1500 } },
    { id: 'react-component', name: 'React', stats: { downloads: 3200 } },
    { id: 'api-crud', name: 'API', stats: { downloads: 2100 } },
  ];
  
  for (const t of templates) {
    await db.templates.create({
      ...t,
      author: { id: 'test', name: 'Test' },
      currentVersion: '1.0.0',
      versions: [],
      tags: [],
      rating: { average: 0, total: 0 },
      metadata: {},
      category: 'test'
    });
  }
  
  // Test sorting
  const result = await service.getPopularTemplates(3);
  console.log('Results:', result.templates.map(t => ({
    id: t.id,
    name: t.name,
    downloads: t.stats?.downloads
  })));
  
  await fs.rm(testDir, { recursive: true, force: true });
}

test().catch(console.error);