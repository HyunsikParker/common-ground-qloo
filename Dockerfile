FROM node:22.23.3-bookworm-slim AS build
WORKDIR /app
RUN npm install --global --ignore-scripts pnpm@12.8.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY index.html vite.config.js ./
COPY src ./src
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:22.23.3-bookworm-slim
WORKDIR /app
RUN mkdir -p /run/qloo && chown node:node /run/qloo && chmod 700 /run/qloo
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
USER node
ENV HOST=0.0.0.0 PORT=7860
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/main.js"]
