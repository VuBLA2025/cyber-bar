# Cyber Bar & Dance Club — Node server nhẹ, deploy lên Dokploy
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY public/ ./public/

ENV NODE_ENV=production
ENV PORT=4193

EXPOSE 4193
CMD ["node", "server.js"]
