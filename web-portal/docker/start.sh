#!/bin/sh
set -e

echo "🚀 Starting Cursor Prompt Web Portal..."

# Wait for database if DATABASE_URL is provided
if [ -n "$DATABASE_URL" ]; then
    echo "⏳ Waiting for database connection..."
    npx wait-on tcp:${DB_HOST:-localhost}:${DB_PORT:-5432} --timeout 30000
    
    echo "🔧 Running database migrations..."
    cd backend
    npx prisma generate
    npx prisma db push --force-reset
    cd ..
fi

# Set default environment
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3001}

echo "🌐 Starting backend server on port $PORT..."
cd backend && node dist/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
npx wait-on http://localhost:$PORT/api/health --timeout 60000

echo "✅ Backend server started successfully"
echo "📊 Health check: http://localhost:$PORT/api/health"
echo "📖 API docs: http://localhost:$PORT/api"

# Keep the container running and handle signals
trap 'echo "🛑 Shutting down..."; kill $BACKEND_PID; wait $BACKEND_PID; exit 0' TERM INT

wait $BACKEND_PID