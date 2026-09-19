FROM node:22-alpine

# dumb-init: konteyner durdurulunca sinyal düzgün iletilsin, bot temiz kapansın
RUN apk add --no-cache dumb-init

WORKDIR /app

# Önce sadece bağımlılıklar: kod değişince katman tekrar kurulmasın
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Root ile çalıştırma
RUN mkdir -p logs && chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV NO_COLOR=1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
