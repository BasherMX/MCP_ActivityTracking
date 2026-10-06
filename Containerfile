# ==========================================
# Etapa 1: Builder (Compilación TypeScript)
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias completas para compilar TypeScript
COPY package*.json tsconfig.json ./
RUN npm ci

# Copiar código fuente
COPY src/ ./src/

# Compilar a JavaScript en dist/
RUN npm run build

# Purgar dependencias de desarrollo para reducir tamaño
RUN npm prune --production

# ==========================================
# Etapa 2: Runner de Producción Ultra-Ligero
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3333 \
    HOST=:: \
    MCP_TRANSPORT=sse \
    API_BASE_URL=http://10.200.1.13:5100 \
    DRY_RUN_MODE=true

# Copiar manifiesto y dependencias de producción
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Ejecutar como usuario no privilegiado 'node'
USER node

EXPOSE 3333

# Verificación de salud periódica
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3333/health || exit 1

CMD ["node", "dist/index.js"]
