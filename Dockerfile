FROM livekit/gstreamer:1.24.5-prod AS base
RUN apt update && apt install -y curl libgirepository1.0-dev gir1.2-gstreamer-1.0 && \
    curl -L -o /usr/lib/x86_64-linux-gnu/gstreamer-1.0/libgstrswebrtc.so https://github.com/BeeInventor/gst-plugins-rs/releases/download/0.14.0-alpha.1-a8146f33/libgstrswebrtc.so && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt install -y nodejs && npm install -g corepack@latest && \
    corepack enable && corepack prepare pnpm --activate
WORKDIR /app

FROM base AS pnpm-fetch
COPY package.json pnpm-lock.yaml ./
RUN pnpm fetch

FROM pnpm-fetch AS prod-deps
RUN pnpm install --offline --ignore-scripts --ignore-scripts --prod

FROM pnpm-fetch AS build
RUN pnpm install --offline --ignore-scripts --ignore-scripts
COPY . ./
RUN pnpm exec nest build

FROM base AS app
COPY --from=prod-deps /app/node_modules ./node_modules/
COPY --from=build /app/dist ./dist/
COPY .env* ./
CMD ["node", "dist/main"]
