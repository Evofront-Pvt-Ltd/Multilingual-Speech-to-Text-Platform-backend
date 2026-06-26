# VoiceBridge AI — speech-to-text + translation backend for PODS voice widget.
FROM node:21-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libvips42 \
  && rm -rf /var/lib/apt/lists/*

ENV SHARP_FORCE_GLOBAL_LIBVIPS=1

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 300000

COPY nest-cli.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN yarn build
RUN node scripts/warmup-model.mjs
RUN yarn install --frozen-lockfile --production --network-timeout 300000 \
  && yarn cache clean

FROM node:21-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV WHISPER_MODEL=Xenova/whisper-base
ENV SHARP_FORCE_GLOBAL_LIBVIPS=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libvips42 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p data uploads \
  && chown -R node:node /app

USER node

EXPOSE 3001

CMD ["node", "dist/main"]
