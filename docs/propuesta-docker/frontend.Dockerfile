# syntax=docker/dockerfile:1
# ============================================================
# Museo_Smart - Frontend (React 19 + Vite 8) servido por Nginx
# ------------------------------------------------------------
# ARCHIVO NUEVO (propuesta). El proyecto no tenía Dockerfile.
# Ubicación sugerida: frontend/Dockerfile
# Build desde la raíz del repo:
#   docker build -f frontend/Dockerfile -t museosmart-frontend frontend
# ============================================================

# ---------- Etapa 1: build de Vite ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# El frontend usa rutas relativas /api/v1; nginx las enviará al backend.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# ---------- Etapa 2: servidor estático ----------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
