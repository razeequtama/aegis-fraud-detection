# Stage 1: Build static production assets
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# Stage 2: Serve static production assets via Nginx as non-root
FROM nginx:alpine

# Create non-root system user and group
RUN addgroup -g 10001 -S appuser && \
    adduser -u 10001 -S appuser -G appuser -h /app -s /sbin/nologin

# Configure permissions for non-root execution
RUN mkdir -p /var/cache/nginx /var/log/nginx && \
    touch /tmp/nginx.pid && \
    chown -R appuser:appuser /var/cache/nginx /var/log/nginx /tmp/nginx.pid /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder --chown=appuser:appuser /app/dist /usr/share/nginx/html

USER appuser

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
