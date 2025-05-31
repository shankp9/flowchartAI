#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists, if not create from example
if [ ! -f .env ]; then
    print_warning "No .env file found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_status ".env file created from .env.example"
        print_warning "Please edit .env file and add your OpenAI API key before starting the application."
        exit 1
    else
        print_error ".env.example file not found. Please create .env file manually."
        exit 1
    fi
fi

# Check if OPENAI_API_KEY is set
if ! grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null; then
    print_error "OPENAI_API_KEY not properly set in .env file."
    print_warning "Please add your OpenAI API key to the .env file."
    exit 1
fi

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop any existing containers
print_status "Stopping any existing containers..."
docker-compose down 2>/dev/null || docker compose down 2>/dev/null || true

# Build and start the application
print_status "Building and starting FlowchartAI application..."

# Use docker-compose or docker compose based on availability
if command -v docker-compose &> /dev/null; then
    docker-compose up --build -d
else
    docker compose up --build -d
fi

# Check if the build was successful
if [ $? -eq 0 ]; then
    print_status "Application started successfully!"
    print_status "Access it at http://localhost:3000"
    print_status ""
    print_status "To view logs, run: docker-compose logs -f flowchart-ai"
    print_status "To stop the application, run: docker-compose down"
else
    print_error "Failed to start the application. Check the logs for more details."
    exit 1
fi
