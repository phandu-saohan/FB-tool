# ==============================================================================
# Multi-stage Dockerfile for Dokploy / Docker Deployment
# ==============================================================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python + Playwright Backend
FROM mcr.microsoft.com/playwright/python:v1.50.0-noble AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    HOST=0.0.0.0 \
    PORT=8080 \
    BROWSER_HEADLESS=true \
    DOCKER_CONTAINER=1

# Install system utilities (curl, ca-certificates)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium & dependencies
RUN playwright install chromium

# Copy Application Code
COPY app/ ./app
COPY run.py .
COPY .env.example .

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create storage directories
RUN mkdir -p /app/data /app/profiles/facebook /app/logs

# Expose Port for Dokploy / Traefik
EXPOSE 8080

# Healthcheck using built-in python urllib
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health')" || exit 1

# Start Server
CMD ["python", "run.py"]

