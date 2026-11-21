# syntax=docker/dockerfile:1
#
# PixOffice Cloud 24/7 Container (Render.com / Fly.io / Railway / Docker)

FROM node:24-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts

COPY . .
RUN npm run build || echo "Using prebuilt dist/ bundle"

ENV NODE_ENV=production \
    HABBLAUD_HOST=0.0.0.0 \
    HABBLAUD_ALLOWED_HOSTS=* \
    HABBLAUD_IN_DOCKER=1 \
    HABBLAUD_DATA_DIR=/data \
    HABBLAUD_USAGE_DIR=/usage

RUN mkdir -p /data /usage && chown -R node:node /app /data /usage

USER node

EXPOSE 4747
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "const p=process.env.HABBLAUD_PORT||process.env.PORT||4747;fetch('http://127.0.0.1:'+p+'/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "dist/server/index.js"]
