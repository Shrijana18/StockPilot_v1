FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat python3 make g++ git

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . ./

ENV PORT=8080
EXPOSE 8080

RUN adduser -D -H appuser && chown -R appuser /app
USER appuser

CMD ["node", "index.js"]