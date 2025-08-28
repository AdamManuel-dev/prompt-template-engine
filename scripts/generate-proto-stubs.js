#!/usr/bin/env node

/**
 * @fileoverview Proto stub generator for PromptWizard gRPC service
 * @lastmodified 2025-08-26T15:00:00Z
 *
 * Features: Generates TypeScript stubs from proto files
 * Main APIs: generateProtoStubs()
 * Constraints: Requires @grpc/proto-loader
 * Patterns: Code generation, proto file processing
 */

const fs = require('fs');
const path = require('path');
const protoLoader = require('@grpc/proto-loader');

const PROTO_DIR = path.join(__dirname, '..', 'proto');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'generated');

/**
 * Generate TypeScript stubs from proto files
 */
async function generateProtoStubs() {
  console.log('🔧 Generating gRPC TypeScript stubs...');

  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Load proto file
    const protoPath = path.join(PROTO_DIR, 'promptwizard', 'optimization.proto');
    
    if (!fs.existsSync(protoPath)) {
      console.warn(`⚠️  Proto file not found: ${protoPath}`);
      console.log('Creating basic types file...');
      await generateBasicTypes();
      return;
    }

    console.log(`📄 Loading proto file: ${protoPath}`);
    
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [PROTO_DIR],
    });

    // Generate TypeScript interfaces
    const tsContent = generateTypeScriptInterfaces(packageDefinition);
    const outputPath = path.join(OUTPUT_DIR, 'promptwizard.ts');
    
    fs.writeFileSync(outputPath, tsContent);
    console.log(`✅ Generated TypeScript stubs: ${outputPath}`);

    // Generate index file
    const indexContent = `export * from './promptwizard';\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent);

    console.log('🎉 Proto stub generation completed!');

  } catch (error) {
    console.error('❌ Failed to generate proto stubs:', error.message);
    console.log('Creating fallback types...');
    await generateBasicTypes();
  }
}

/**
 * Generate basic TypeScript interfaces when proto files are not available
 */
async function generateBasicTypes() {
  const basicTypes = `/**
 * @fileoverview Generated PromptWizard gRPC types (fallback)
 * @lastmodified ${new Date().toISOString()}
 */

// Request interfaces
export interface OptimizationRequest {
  task: string;
  prompt: string;
  targetModel: string;
  mutateRefineIterations: number;
  fewShotCount: number;
  generateReasoning: boolean;
  examples?: string[];
  constraints?: Record<string, string>;
}

export interface ScoringRequest {
  prompt: string;
  task: string;
  targetModel: string;
}

export interface ComparisonRequest {
  originalPrompt: string;
  optimizedPrompt: string;
  task: string;
  targetModel: string;
}

export interface JobStatusRequest {
  jobId: string;
}

export interface CancelJobRequest {
  jobId: string;
}

export interface HealthCheckRequest {}

// Response interfaces
export interface OptimizationMetrics {
  accuracyImprovement: number;
  tokenReduction: number;
  costReduction: number;
  processingTime: number;
  apiCallsUsed: number;
}

export interface OptimizationResponse {
  jobId: string;
  status: string;
  originalPrompt: string;
  optimizedPrompt: string;
  metrics: OptimizationMetrics;
  errorMessage?: string;
}

export interface ScoringResponse {
  overallScore: number;
  componentScores: Record<string, number>;
  suggestions: string[];
  metrics: OptimizationMetrics;
}

export interface ComparisonMetrics {
  accuracyDelta: number;
  tokenDelta: number;
  costDelta: number;
  readabilityDelta: number;
}

export interface ComparisonResponse {
  improvementScore: number;
  improvements: string[];
  potentialIssues: string[];
  metrics: ComparisonMetrics;
}

export interface JobStatusResponse {
  jobId: string;
  status: string;
  progressPercentage: number;
  currentStep: string;
  result?: OptimizationResponse;
  errorMessage?: string;
}

export interface CancelJobResponse {
  cancelled: boolean;
  message: string;
}

export interface HealthCheckResponse {
  healthy: boolean;
  version: string;
  services: Record<string, boolean>;
  errorMessage?: string;
}

export interface OptimizationUpdate {
  jobId: string;
  progressPercentage: number;
  currentStep: string;
  status: string;
  partialResult?: OptimizationResponse;
}

// Service interface
export interface PromptOptimizationServiceClient {
  optimizePrompt(request: OptimizationRequest): Promise<OptimizationResponse>;
  scorePrompt(request: ScoringRequest): Promise<ScoringResponse>;
  comparePrompts(request: ComparisonRequest): Promise<ComparisonResponse>;
  getJobStatus(request: JobStatusRequest): Promise<JobStatusResponse>;
  cancelJob(request: CancelJobRequest): Promise<CancelJobResponse>;
  healthCheck(request: HealthCheckRequest): Promise<HealthCheckResponse>;
}
`;

  const outputPath = path.join(OUTPUT_DIR, 'promptwizard.ts');
  fs.writeFileSync(outputPath, basicTypes);
  
  const indexContent = `export * from './promptwizard';\n`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent);

  console.log('✅ Generated basic TypeScript types');
}

/**
 * Generate TypeScript interfaces from proto package definition
 */
function generateTypeScriptInterfaces(packageDefinition) {
  const timestamp = new Date().toISOString();
  
  let tsContent = `/**
 * @fileoverview Generated PromptWizard gRPC types
 * @lastmodified ${timestamp}
 * 
 * This file is auto-generated from proto files. Do not edit manually.
 */

`;

  // Extract and convert proto messages to TypeScript interfaces
  const promptwizardPackage = packageDefinition.promptwizard;
  
  if (promptwizardPackage) {
    // Generate interfaces for each message type
    Object.keys(promptwizardPackage).forEach(key => {
      if (key.endsWith('Request') || key.endsWith('Response') || key.endsWith('Metrics') || key.endsWith('Update')) {
        tsContent += generateInterface(key, promptwizardPackage[key]);
        tsContent += '\n';
      }
    });

    // Generate service interface
    tsContent += generateServiceInterface();
  }

  return tsContent;
}

/**
 * Generate TypeScript interface from proto message
 */
function generateInterface(name, messageDefinition) {
  const interfaceName = toPascalCase(name);
  
  let content = `export interface ${interfaceName} {\n`;
  
  // Add basic properties based on common gRPC patterns
  if (name.includes('Request')) {
    content += generateRequestProperties(name);
  } else if (name.includes('Response')) {
    content += generateResponseProperties(name);
  } else if (name.includes('Metrics')) {
    content += generateMetricsProperties(name);
  }
  
  content += '}\n';
  
  return content;
}

/**
 * Generate request properties
 */
function generateRequestProperties(requestName) {
  switch (requestName.toLowerCase()) {
    case 'optimizationrequest':
      return `  task: string;
  prompt: string;
  targetModel: string;
  mutateRefineIterations: number;
  fewShotCount: number;
  generateReasoning: boolean;
  examples?: string[];
  constraints?: Record<string, string>;
`;
    case 'scoringrequest':
      return `  prompt: string;
  task: string;
  targetModel: string;
`;
    case 'comparisonrequest':
      return `  originalPrompt: string;
  optimizedPrompt: string;
  task: string;
  targetModel: string;
`;
    case 'jobstatusrequest':
      return `  jobId: string;
`;
    case 'canceljobrequest':
      return `  jobId: string;
`;
    case 'healthcheckrequest':
      return '';
    default:
      return '  [key: string]: any;\n';
  }
}

/**
 * Generate response properties
 */
function generateResponseProperties(responseName) {
  switch (responseName.toLowerCase()) {
    case 'optimizationresponse':
      return `  jobId: string;
  status: string;
  originalPrompt: string;
  optimizedPrompt: string;
  metrics: OptimizationMetrics;
  errorMessage?: string;
`;
    case 'scoringresponse':
      return `  overallScore: number;
  componentScores: Record<string, number>;
  suggestions: string[];
  metrics: OptimizationMetrics;
`;
    case 'comparisonresponse':
      return `  improvementScore: number;
  improvements: string[];
  potentialIssues: string[];
  metrics: ComparisonMetrics;
`;
    case 'jobstatusresponse':
      return `  jobId: string;
  status: string;
  progressPercentage: number;
  currentStep: string;
  result?: OptimizationResponse;
  errorMessage?: string;
`;
    case 'cancelJobresponse':
      return `  cancelled: boolean;
  message: string;
`;
    case 'healthcheckresponse':
      return `  healthy: boolean;
  version: string;
  services: Record<string, boolean>;
  errorMessage?: string;
`;
    default:
      return '  [key: string]: any;\n';
  }
}

/**
 * Generate metrics properties
 */
function generateMetricsProperties(metricsName) {
  switch (metricsName.toLowerCase()) {
    case 'optimizationmetrics':
      return `  accuracyImprovement: number;
  tokenReduction: number;
  costReduction: number;
  processingTime: number;
  apiCallsUsed: number;
`;
    case 'comparisonmetrics':
      return `  accuracyDelta: number;
  tokenDelta: number;
  costDelta: number;
  readabilityDelta: number;
`;
    default:
      return '  [key: string]: number;\n';
  }
}

/**
 * Generate service interface
 */
function generateServiceInterface() {
  return `
export interface PromptOptimizationServiceClient {
  optimizePrompt(request: OptimizationRequest): Promise<OptimizationResponse>;
  scorePrompt(request: ScoringRequest): Promise<ScoringResponse>;
  comparePrompts(request: ComparisonRequest): Promise<ComparisonResponse>;
  getJobStatus(request: JobStatusRequest): Promise<JobStatusResponse>;
  cancelJob(request: CancelJobRequest): Promise<CancelJobResponse>;
  healthCheck(request: HealthCheckRequest): Promise<HealthCheckResponse>;
}

export interface OptimizationUpdate {
  jobId: string;
  progressPercentage: number;
  currentStep: string;
  status: string;
  partialResult?: OptimizationResponse;
}
`;
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str) {
  return str
    .replace(/(_\w)/g, (matches) => matches[1].toUpperCase())
    .replace(/^./, (match) => match.toUpperCase());
}

// Run the generator
if (require.main === module) {
  generateProtoStubs().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generateProtoStubs };