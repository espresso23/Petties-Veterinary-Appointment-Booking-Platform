# ============================================
# PETTIES AI AGENT SERVICE - Unified Dockerfile
# Supports both Dev and Prod via BUILD_ENV arg
# 
# Usage:
#   Dev:  docker build --build-arg BUILD_ENV=dev -t petties-ai:dev .
#   Prod: docker build --build-arg BUILD_ENV=prod -t petties-ai:prod .
# 
# Or via docker-compose:
#   docker-compose -f docker-compose.dev.yml build
#   docker-compose -f docker-compose.prod.yml build
# ============================================

# Build arguments
ARG BUILD_ENV=prod
ARG PYTHON_VERSION=3.12

# ============================================
# Stage 1: Builder - Install dependencies
# ============================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies to user directory
RUN pip install --user --no-cache-dir -r requirements.txt

# ============================================
# Stage 2: Base - Common runtime setup
# ============================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS base

LABEL maintainer="Petties Team"
LABEL build_env=${BUILD_ENV}

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PATH="/home/petties/.local/bin:$PATH"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash petties

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/petties/.local

# Copy application code
COPY --chown=petties:petties ./app ./app

# Copy Alembic migrations
COPY --chown=petties:petties ./alembic ./alembic
COPY --chown=petties:petties ./alembic.ini ./alembic.ini

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs \
    && chown -R petties:petties /app

# Switch to non-root user
USER petties

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ============================================
# Stage 3: Development (with hot-reload)
# ============================================
FROM base AS dev

LABEL environment="development"

# Dev: Run migrations then start with hot-reload
CMD ["sh", "-c", "alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"]

# ============================================
# Stage 4: Production (optimized)
# ============================================
FROM base AS prod

LABEL environment="production"

# Production: Run migrations then start optimized server
CMD ["sh", "-c", "alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info"]

# ============================================
# Final stage selection based on BUILD_ENV
# ============================================
FROM ${BUILD_ENV} AS final
