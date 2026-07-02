FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV MCP_TRANSPORT=sse

CMD ["node", "dist/index.js"]
