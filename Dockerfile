
# Stage 1: Build dependencies (cached layer)
FROM node:20-alpine3.19 AS builder

WORKDIR /app

# Copy dependency files first (for caching)
COPY package.json yarn.lock* package-lock.json* ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Stage 2: Runtime
FROM node:20-alpine3.19

# Install minimal system dependencies
RUN apk add --no-cache ca-certificates curl tini

# Create non-root user
RUN addgroup --system testrunner && adduser --system -G testrunner testrunner

WORKDIR /app

# Copy everything from builder
COPY --from=builder /app .

# Switch to non-root user
USER testrunner

# Use tini for signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default command
CMD ["npm", "run", "test:develop:run"]