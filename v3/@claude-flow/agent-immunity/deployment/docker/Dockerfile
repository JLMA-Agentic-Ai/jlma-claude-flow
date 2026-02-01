# Multi-stage Docker build for AIS Plugin with security hardening
# Stage 1: Build environment
FROM node:20-alpine AS builder

LABEL maintainer="Claude Flow Team <team@claude-flow.com>" \
      description="Agent Immunity System (AIS) Plugin - Production Build" \
      version="3.0.0-alpha.1"

# Security: Create non-root user for build
RUN addgroup -g 1001 -S aisbuilder && \
    adduser -S aisbuilder -u 1001 -G aisbuilder

# Install security updates and build tools
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        dumb-init \
        curl \
        ca-certificates && \
    rm -rf /var/cache/apk/*

# Set secure work directory
WORKDIR /build

# Copy package files with proper ownership
COPY --chown=aisbuilder:aisbuilder package*.json ./
COPY --chown=aisbuilder:aisbuilder tsconfig.json ./

# Switch to non-root user for build
USER aisbuilder

# Install dependencies (production only for smaller image)
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY --chown=aisbuilder:aisbuilder src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Production runtime (distroless for security)
FROM gcr.io/distroless/nodejs20-debian12:nonroot

# Security labels
LABEL security.scan="enabled" \
      security.distroless="true" \
      security.nonroot="true"

# Copy built application from builder stage
COPY --from=builder --chown=nonroot:nonroot /build/dist/ /app/
COPY --from=builder --chown=nonroot:nonroot /build/node_modules/ /app/node_modules/
COPY --from=builder --chown=nonroot:nonroot /build/package*.json /app/

# Copy health check script
COPY --chown=nonroot:nonroot deployment/health/health-check.js /app/health-check.js

# Set working directory
WORKDIR /app

# Security: Use non-root user (distroless default)
USER nonroot

# Expose health check port (non-privileged)
EXPOSE 8080

# Health check for immunity services
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/nodejs/bin/node", "health-check.js"]

# Entry point
ENTRYPOINT ["/nodejs/bin/node", "index.js"]