#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

print_status "Building FlowchartAI Docker image..."

# Build the Docker image
docker build -t flowchart-ai:latest .

if [ $? -eq 0 ]; then
    print_status "Docker image built successfully!"
    print_status "Image name: flowchart-ai:latest"
    print_status ""
    print_status "To run the container:"
    print_status "docker run -p 3000:3000 --env-file .env flowchart-ai:latest"
else
    print_error "Failed to build Docker image."
    exit 1
fi
