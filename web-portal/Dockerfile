# Multi-stage Docker build for production deployment
FROM node:22-alpine AS base

# Install system dependencies
RUN apk add --no-cache libc6-compat git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci --only=production && \
    cd frontend && npm ci --only=production && \
    cd ../backend && npm ci --only=production && \
    cd ../shared && npm ci --only=production

# Build stage
FROM base AS builder

WORKDIR /app

# Install all dependencies (including dev)
RUN npm ci && \
    cd frontend && npm ci && \
    cd ../backend && npm ci && \
    cd ../shared && npm ci

# Copy source code
COPY . .

# Build shared package first
RUN cd shared && npm run build

# Build frontend
RUN cd frontend && npm run build

# Build backend
RUN cd backend && npm run build

# Production stage
FROM node:22-alpine AS production

# Install system dependencies for production
RUN apk add --no-cache dumb-init postgresql-client curl

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built applications
COPY --from=builder --chown=nextjs:nodejs /app/shared/dist ./shared/dist
COPY --from=builder --chown=nextjs:nodejs /app/shared/package.json ./shared/
COPY --from=builder --chown=nextjs:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=nextjs:nodejs /app/backend/package.json ./backend/
COPY --from=builder --chown=nextjs:nodejs /app/backend/prisma ./backend/prisma
COPY --from=builder --chown=nextjs:nodejs /app/frontend/dist ./frontend/dist
COPY --from=builder --chown=nextjs:nodejs /app/frontend/package.json ./frontend/

# Copy production dependencies
COPY --from=base --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nextjs:nodejs /app/frontend/node_modules ./frontend/node_modules
COPY --from=base --chown=nextjs:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=base --chown=nextjs:nodejs /app/shared/node_modules ./shared/node_modules

# Copy package.json files
COPY --chown=nextjs:nodejs package*.json ./

# Copy startup scripts
COPY --chown=nextjs:nodejs docker/start.sh ./
RUN chmod +x start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3001

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]

# Development stage
FROM builder AS development

WORKDIR /app

# Install development tools
RUN apk add --no-cache chromium

# Set Playwright environment
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install Playwright
RUN npx playwright install-deps && \
    npx playwright install chromium firefox webkit

# Switch to non-root user for development
USER nextjs

# Start development server
CMD ["npm", "run", "dev"]