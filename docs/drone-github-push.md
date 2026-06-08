# Drone → GitHub push

A pipeline step (`push-to-github`) mirror commits from `main` to GitHub after deploy.

## How it works

| Mechanism | Detail |
|---|---|
| Step name | `push-to-github` |
| Image | `alpine/git` |
| Trigger | `main` branch, `push` event |
| Failure mode | `failure: ignore` — step is silently skipped if secret is missing |
| Auth | GitHub PAT passed via Drone secret `github_token` |

## 1. Create a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Give it a name like `drone-ci-push`
4. Select scope: **`repo`** (full control of private repositories)
5. Click **Generate token**
6. **Copy the token** — you won't see it again

> The token is used in the URL `https://lucasgr7:${GITHUB_TOKEN}@github.com/lucasgr7/pokenug-game.git`

## 2. Add the token as a Drone secret

### Via Drone CLI

```bash
# install CLI (one time)
# Windows (winget)
winget install drone-cli
# macOS
brew install drone-cli
# Linux
curl -L https://github.com/drone/drone-cli/releases/latest/download/drone_linux_amd64.tar.gz | tar zx

# authenticate (use your Drone server URL)
export DRONE_SERVER=https://drone.noonsoft.com.br
export DRONE_TOKEN=your-drone-admin-token

# add the secret
drone secret add \
  --repository lucas/pokenug \
  --name github_token \
  --data 'ghp_xxxxxxxxxxxxxxxxxxxx'
```

### Via Drone UI

1. Open your repo in Drone → **Settings** → **Secrets**
2. Click **Add Secret**
3. **Name**: `github_token`
4. **Value**: paste the GitHub PAT
5. **Allow pull request** — leave unchecked (only `main` pushes trigger this step)
6. Click **Save**

## 3. Verify

After the secret is added, push a commit to `main`. The pipeline will:

1. `validate` — runs check + build
2. `deploy` — docker compose up
3. `push-to-github` — mirrors the commit to GitHub

Check the pipeline log: the step output should show the push progress.

## If the secret is missing

The step fails silently (thanks to `failure: ignore`) — the overall pipeline stays green. The log shows:

```
:: GITHUB_TOKEN secret not found — skipping GitHub push ::
```

This means the token was created but the step ran before the Drone secret was set. Once you add the secret, subsequent runs will push.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `failure: ignore` kicked in but token exists | Check Drone secret name is exactly `github_token` |
| `remote: Invalid username or password` | PAT is expired or missing `repo` scope |
| `Push failed` with no details | Try `git push -v` locally with the same token |
| Pipeline still fails | `failure: ignore` may not be present — check `.drone.yml` |
