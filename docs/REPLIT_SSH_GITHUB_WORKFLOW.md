# Replit + GitHub Workflow (Source Of Truth In Replit, Push From SSH)

This doc describes a repeatable setup for any Replit project where:

- Replit is where we **edit + run** the app (source of truth while building)
- GitHub is where we **save/share** the work (commit + push intentionally)
- `git push` works from inside **Replit SSH sessions** (no Replit web UI auth)

It is written to be copy/pasted to new projects. Replace all placeholders like `<OWNER>` and `<REPO>`.

---

## Mental Model (Plain English)

- **Replit workspace**: the live folder where code runs.
- **Git commit**: a saved checkpoint of changes.
- **GitHub remote (`origin`)**: where commits get uploaded.
- **Push**: upload commits to GitHub.
- **Pull**: download commits from GitHub.

Rule of thumb:
- If `git push` asks for a username/password, your remote is probably **HTTPS**, not **SSH**.

---

## Phase 0: Inputs You Need

You need these values (do not guess):

- GitHub repo: `<OWNER>/<REPO>`
- Replit SSH command (from Replit UI), shaped like:
  - `ssh -i ~/.ssh/<REPLIT_KEY> -p 22 <REPLIT_USER>@<REPLIT_HOST>`
- The repo directory inside Replit (commonly):
  - `/home/runner/workspace`

---

## Phase 1: Make GitHub Push Work From Replit SSH

The goal is: **origin uses SSH** and Replit has a **repo-scoped deploy key** with write access.

### 1) SSH in and confirm you are in the git repo

Inside the Replit SSH session:

```bash
cd /home/runner/workspace

git status -sb
git remote -v
```

If `origin` is already `git@github.com:<OWNER>/<REPO>.git`, you can skip to the push test.

### 2) Create a repo-scoped deploy key on the Replit box

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add GitHub host key so SSH doesn't prompt interactively.
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts

# Create a new keypair (no passphrase)
ssh-keygen -t ed25519 \
  -f ~/.ssh/github_replit_ed25519 \
  -C "replit-deploy-key-<OWNER>-<REPO>" \
  -N ""

chmod 600 ~/.ssh/github_replit_ed25519
chmod 644 ~/.ssh/github_replit_ed25519.pub

cat ~/.ssh/github_replit_ed25519.pub
```

Copy the public key line that starts with `ssh-ed25519`.

### 3) Add the public key to GitHub as a Deploy Key (write access ON)

In GitHub:

- Repo → Settings → Deploy keys → Add deploy key
- Title: `replit-ssh-write`
- Key: paste the public key
- Enable: **Allow write access**

Notes:
- Deploy keys are **repo-scoped** (this is good).
- Do not commit the private key anywhere.

### 4) Configure SSH on the Replit box to use that key for GitHub

```bash
cat > ~/.ssh/config <<'CFG'
Host github.com
  HostName github.com
  IdentityFile ~/.ssh/github_replit_ed25519
  IdentitiesOnly yes
CFG

chmod 600 ~/.ssh/config
```

### 5) Switch `origin` to SSH form

If your remote is HTTPS, switch it:

```bash
git remote set-url origin git@github.com:<OWNER>/<REPO>.git
git remote -v
```

### 6) Test SSH auth and prove push works (throwaway branch)

```bash
# This should NOT ask for a password.
ssh -T git@github.com

git checkout -b ssh-push-test
# Some environments require setting identity before committing.
git config user.name "Replit SSH Push"
git config user.email "replit-ssh-push@localhost"

git commit --allow-empty -m "sync test"
git push -u origin ssh-push-test

git push origin --delete ssh-push-test

git checkout main
git branch -D ssh-push-test
```

Success criteria:
- no credential prompts
- push succeeds

---

## Phase 2: Standardize Verification Commands

Goal: every agent can run the same commands before pushing important changes.

### 1) Add `verify` scripts to `package.json`

Recommended convention:

- `verify:quick`: fast checks for iteration
- `verify`: stricter checks before pushing to `main`

Example (adjust to your repo):

If your repo has tests, consider including them in `verify` (for example: `npm run check && npm test && npm run build`).

```json
"scripts": {
  "check": "tsc",
  "build": "...",
  "verify:quick": "npm run check",
  "verify": "npm run check && npm run build"
}
```

### 2) Confirm they run in Replit

```bash
npm install
npm run verify:quick
npm run verify
```

---

## Phase 3: Add a Handoff Checklist (Documentation)

Create or update `replit.md` with a section titled:

`## Handoff Checklist`

It should include:

1. **Confirm pushing will work from SSH**
   - `git remote -v`
   - `origin` must be `git@github.com:...`

2. **Confirm branch + cleanliness**
   - `git status -sb`

3. **Run checks**
   - Iterating: `npm run verify:quick`
   - Before pushing to `main`: `npm run verify`

4. **Restart + smoke test**
   - Restart the Replit app and click through the key flows for 60 seconds.

5. **Commit + push a meaningful chunk**

```bash
git add -A
git commit -m "..."
git push origin <branch>
```

Troubleshooting line to include:
- If `git push` prompts for username/password, stop: `origin` is probably HTTPS or the SSH key is not configured.

---

## Daily Operating Workflow

While building:
- Edit and run in Replit.

After each meaningful chunk:
1. `npm run verify:quick` (optional while iterating)
2. `npm run verify` (before pushing to `main`)
3. Restart app + smoke test
4. `git add -A && git commit -m "..." && git push origin main`

---

## Hard Rules (To Avoid Breaking Things)

- Never commit secrets. Use Replit Secrets.
- Keep `origin` as SSH so SSH pushes never prompt for credentials.
- Prefer fewer, meaningful commits over hundreds of tiny commits.

---

## Troubleshooting (Fast)

### `git push` prompts for username/password
- Cause: `origin` is HTTPS.
- Fix:

```bash
git remote set-url origin git@github.com:<OWNER>/<REPO>.git
```

### “Author identity unknown” when committing
- Fix (repo-local):

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

### `Permission denied (publickey)`
- Cause: deploy key not installed, not write-enabled in GitHub, or SSH config not pointing to it.
- Fix:
  - Re-check GitHub Deploy Key exists for `<OWNER>/<REPO>` and has write access enabled.
  - Re-check `~/.ssh/config` in Replit points `github.com` to the deploy key.
  - Re-test: `ssh -T git@github.com`

### `Host key verification failed`
- Fix:

```bash
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts
```

---

## Copy/Paste Brief (New Project Setup)

- SSH into the Replit project and `cd /home/runner/workspace`.
- Ensure `origin` is SSH: `git@github.com:<OWNER>/<REPO>.git`.
- Install a GitHub deploy key (write access) so pushes work from SSH.
- Add `verify` / `verify:quick` scripts and run them once in Replit.
- Document a `## Handoff Checklist` in `replit.md`.
- Only push meaningful chunks (don't auto-commit every edit).
