# Build stage - install dependencies
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile && yarn cache clean

# Runtime stage - minimal image
FROM node:20-alpine

WORKDIR /app

# Copy only node_modules and source
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY . .