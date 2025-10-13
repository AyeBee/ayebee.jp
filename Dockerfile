# /srv/app/ayebee/Dockerfile

# ---------- deps（依存の取得のみ）----------
FROM node:20-alpine AS deps
WORKDIR /app

# どれか1つだけコピー（pnpm / npm / yarn）
# COPY pnpm-lock.yaml ./
# RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm fetch

COPY package-lock.json ./
RUN npm ci --ignore-scripts

# COPY yarn.lock ./
# RUN corepack enable && corepack prepare yarn@stable --activate && yarn --frozen-lockfile

# ---------- builder（ビルド）----------
FROM node:20-alpine AS builder
WORKDIR /app

# 依存物をコピー
COPY --from=deps /app/node_modules ./node_modules
# アプリの全ファイル
COPY . .

# 本番ビルド
ENV NODE_ENV=production
# Next.js: スタンドアロン出力で軽量化
RUN npm run build \
 && ls -la .next

# ---------- runner（実行）----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# 非root実行（最低権限）
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs

# Next.js の standalone 出力を採用（next.configで output: 'standalone' を推奨）
# スタンドアロンでない場合は .next と node_modules を丸ごと持ち込む
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Secrets を /run/secrets から読む実装を想定（コード側で対応）
# EXPOSE はメモ用（compose の expose/ports で制御する）
EXPOSE 3000

# ヘルスチェック（wget がない場合は busybox の wget 使用）
HEALTHCHECK --interval=60s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/ || exit 1

# Next.js standalone の起動エントリ
CMD ["node", "server.js"]