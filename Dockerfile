FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json .npmrc ./
RUN npm install

COPY src ./src
COPY static ./static
COPY public ./public
COPY tsconfig.json vite.config.ts svelte.config.js ./

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]