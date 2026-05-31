# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.15.3 create --template minimal --types ts --no-install .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deploy

The project is configured for a static production deploy with Docker, Docker Compose, Portainer, and Drone CI.

### Local image build

```sh
docker build -t pokengu:local .
```

### Compose / Portainer stack

The root `docker-compose.yml` exposes the app through Nginx on port `3030` by default.

Environment variables supported by the stack:

- `WEB_PORT`: host port published by the web container. Default: `3030`
- `EXTERNAL_NETWORK_NAME`: external Docker network used by Portainer/reverse proxy. Default: `gitea_dev-network`

Example:

```sh
WEB_PORT=3030 EXTERNAL_NETWORK_NAME=gitea_dev-network docker compose up -d --build
```

### Drone secrets

The `.drone.yml` pipeline validates the project on every push/PR and publishes the Docker image on pushes to `main` when these secrets are configured:

- `docker_registry`
- `docker_repo`
- `docker_username`
- `docker_password`
