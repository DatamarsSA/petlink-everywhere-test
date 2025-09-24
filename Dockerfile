FROM node:20-alpine3.19 AS builder

WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile
COPY . .

FROM node:20-alpine3.19

# Solo ca-certificates e tini (rimosso curl)
RUN apk add --no-cache ca-certificates tini

# Crea user e directory con permessi corretti
RUN addgroup --system testrunner && \
    adduser --system -G testrunner testrunner && \
    mkdir -p /app && \
    chown -R testrunner:testrunner /app

WORKDIR /app

# Copia come root, poi cambia ownership
COPY --from=builder /app .
RUN chown -R testrunner:testrunner /app

# IMPORTANTE: Switch a user DOPO aver settato i permessi
USER testrunner

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "test:develop"]