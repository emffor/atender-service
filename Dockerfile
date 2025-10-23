# Dockerfile para Attendance Service

FROM node:18-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache dumb-init

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Estágio de desenvolvimento
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --only=development
COPY . .
EXPOSE 3003
CMD ["dumb-init", "npm", "run", "dev"]

# Estágio de build
FROM base AS build
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Estágio de produção
FROM node:18-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Instalar dumb-init
RUN apk add --no-cache dumb-init

# Copiar dependências e build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S attendance -u 1001
USER attendance

# Expor porta
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Comando para iniciar
CMD ["dumb-init", "node", "dist/app.js"]