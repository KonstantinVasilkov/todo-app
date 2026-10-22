FROM node:22.23.4-alpine AS build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM caddy:2.11.7-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /frontend/dist /srv
