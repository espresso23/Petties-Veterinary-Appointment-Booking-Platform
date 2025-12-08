# ============================================
# PETTIES BACKEND - Unified Dockerfile
# Supports both Dev and Prod via BUILD_ENV arg
# 
# Usage:
#   Dev:  docker build --build-arg BUILD_ENV=dev -t petties-backend:dev .
#   Prod: docker build --build-arg BUILD_ENV=prod -t petties-backend:prod .
# 
# Or via docker-compose:
#   docker-compose -f docker-compose.dev.yml build
#   docker-compose -f docker-compose.prod.yml build
# ============================================

# Build arguments
ARG BUILD_ENV=prod
ARG JAVA_VERSION=21

# ============================================
# Stage 1: Builder - Build JAR
# ============================================
FROM eclipse-temurin:${JAVA_VERSION}-jdk-alpine AS builder

LABEL maintainer="Petties Team"
LABEL stage="builder"

WORKDIR /app

# Copy Maven wrapper và pom.xml trước (leverage cache)
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Fix line endings cho mvnw (Windows -> Linux)
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

# Download dependencies (cached layer)
RUN ./mvnw dependency:go-offline -B

# Copy source code
COPY src ./src

# Build application (skip tests cho faster build)
RUN ./mvnw clean package -DskipTests -B \
    && mv target/*.jar target/app.jar

# ============================================
# Stage 2: Base - Common runtime setup
# ============================================
FROM eclipse-temurin:${JAVA_VERSION}-jre-alpine AS base

LABEL maintainer="Petties Team"
LABEL build_env=${BUILD_ENV}

# Install necessary tools
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S petties && \
    adduser -u 1001 -S petties -G petties

WORKDIR /app

# Copy JAR from builder
COPY --from=builder /app/target/app.jar app.jar

# Create logs directory
RUN mkdir -p logs && chown -R petties:petties /app

# Switch to non-root user
USER petties

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:8080/api/actuator/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# ============================================
# Stage 3: Development (with Spring DevTools)
# ============================================
FROM eclipse-temurin:${JAVA_VERSION}-jdk-alpine AS dev

LABEL maintainer="Petties Team"
LABEL environment="development"

# Install tools
RUN apk add --no-cache curl bash

WORKDIR /app

# Copy Maven wrapper
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Fix line endings (Windows -> Linux)
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

# Download dependencies
RUN ./mvnw dependency:go-offline -B

# Copy source code (sẽ được mount volume trong docker-compose)
COPY src ./src

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/actuator/health || exit 1

# Run with Spring DevTools (hot-reload) 
CMD ["./mvnw", "spring-boot:run", \
     "-Dspring-boot.run.profiles=dev"]

# ============================================
# Stage 4: Production (optimized)
# ============================================
FROM base AS prod

LABEL environment="production"

# Run application với JVM settings tối ưu cho 512MB RAM
# MaxRAMPercentage=70 để chừa RAM cho OS (Render free tier)
CMD ["java", \
     "-XX:+UseContainerSupport", \
     "-XX:MaxRAMPercentage=70.0", \
     "-XX:+UseG1GC", \
     "-XX:+UseStringDeduplication", \
     "-XX:+OptimizeStringConcat", \
     "-Xss256k", \
     "-Djava.security.egd=file:/dev/./urandom", \
     "-Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod}", \
     "-jar", "app.jar"]

# ============================================
# Final stage selection based on BUILD_ENV
# ============================================
FROM ${BUILD_ENV} AS final
