FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g yarn@1.22.19

COPY package.json yarn.lock .npmrc ./
RUN yarn install --frozen-lockfile

COPY src ./src
COPY static ./static
COPY public ./public
COPY tsconfig.json vite.config.ts svelte.config.js ./

RUN yarn run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]