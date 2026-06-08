FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock .npmrc ./
RUN yarn install --frozen-lockfile

COPY src ./src
COPY static ./static
COPY public ./public
COPY tsconfig.json vite.config.ts svelte.config.js ./

ARG PUBLIC_POSTHOG_PROJECT_TOKEN
ARG PUBLIC_POSTHOG_HOST
ENV PUBLIC_POSTHOG_PROJECT_TOKEN=$PUBLIC_POSTHOG_PROJECT_TOKEN
ENV PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST

RUN yarn build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]