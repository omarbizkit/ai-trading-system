#!/bin/bash

# Container Testing Script for AI Trading System
# Tests the production build in a containerized environment

set -e

echo "🐳 AI Trading System - Container Testing"
echo "======================================="

# Check if Docker or Podman is available
if command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
else
    echo "❌ Error: Neither Docker nor Podman is available"
    exit 1
fi

echo "📦 Using container runtime: $CONTAINER_CMD"

# Build the container image
echo "🔨 Building container image..."
$CONTAINER_CMD build -t ai-trading-system:test .

if [ $? -eq 0 ]; then
    echo "✅ Container build successful"
else
    echo "❌ Container build failed"
    exit 1
fi

# Run the container in detached mode
echo "🚀 Starting container..."
CONTAINER_ID=$($CONTAINER_CMD run -d -p 4321:4321 \
    -e NODE_ENV=production \
    -e HOST=0.0.0.0 \
    -e PORT=4321 \
    -e SUPABASE_URL=http://localhost:54321 \
    -e SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoQ2ZJuoUVnK_iBbShbmOcNbq5czJFfEn0 \
    ai-trading-system:test)

if [ $? -eq 0 ]; then
    echo "✅ Container started with ID: $CONTAINER_ID"
else
    echo "❌ Container failed to start"
    exit 1
fi

# Wait for the application to start
echo "⏳ Waiting for application to start..."
sleep 10

# Test if the application is responding
echo "🔍 Testing application health..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/api/health || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Application is healthy and responding"
    HEALTH_RESPONSE=$(curl -s http://localhost:4321/api/health)
    echo "📊 Health response: $HEALTH_RESPONSE"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "⚠️  Application is not responding (connection failed)"
    echo "📝 Container logs:"
    $CONTAINER_CMD logs $CONTAINER_ID
else
    echo "⚠️  Application responded with HTTP $HTTP_STATUS"
    echo "📝 Container logs:"
    $CONTAINER_CMD logs $CONTAINER_ID
fi

# Test root page
echo "🔍 Testing root page..."
ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/ || echo "000")

if [ "$ROOT_STATUS" = "200" ]; then
    echo "✅ Root page is accessible"
else
    echo "⚠️  Root page responded with HTTP $ROOT_STATUS"
fi

# Show container info
echo "📋 Container Information:"
echo "   Container ID: $CONTAINER_ID"
echo "   Port mapping: 4321:4321"
echo "   Access URL: http://localhost:4321"

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up container..."
    $CONTAINER_CMD stop $CONTAINER_ID > /dev/null 2>&1
    $CONTAINER_CMD rm $CONTAINER_ID > /dev/null 2>&1
    echo "✅ Cleanup complete"
}

# Ask user if they want to keep the container running
echo ""
echo "Container is running at http://localhost:4321"
echo "Press Enter to stop and cleanup, or Ctrl+C to keep running..."
read -r

cleanup