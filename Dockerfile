FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# These values are public client configuration, never server credentials.
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG EXPO_PUBLIC_NEARBY_FUNCTION=nearby
ENV CI=1
RUN node -e "const e=process.env; if(!/^https:\/\//.test(e.EXPO_PUBLIC_SUPABASE_URL||'') || !(e.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').startsWith('sb_publishable_')) throw Error('Provide a Supabase URL and public publishable key')"
RUN npm run typecheck && npm run lint && npm test
RUN npx expo export --platform web

FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
