#!/bin/bash

# Check if .env file exists, if not create from example
if [ ! -f .env ]; then
  echo "No .env file found. Creating from .env.example..."
  cp .env.example .env
  echo "Please edit .env file and add your OpenAI API key before starting the application."
  exit 1
fi

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
  echo "Docker and/or Docker Compose are not installed. Please install them first."
  exit 1
fi

# Start the application
echo "Starting FlowchartAI application..."
docker-compose up -d

echo "Application started! Access it at http://localhost:3000"
