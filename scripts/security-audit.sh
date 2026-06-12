#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
cd "$ROOT_DIR"

EXCLUDES=(
  --glob '!.git'
  --glob '!frontend/node_modules/**'
  --glob '!frontend/.next/**'
  --glob '!**/__pycache__/**'
  --glob '!**/*.pyc'
)

echo "== WriterLoop security audit =="

echo
echo "-- Checking for suspicious inline secrets --"
SECRET_PATTERNS='(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA|EC|DSA) PRIVATE KEY)'
INLINE_SECRET_MATCHES="$(rg -n -S "${EXCLUDES[@]}" "$SECRET_PATTERNS" . || true)"
if [[ -n "$INLINE_SECRET_MATCHES" ]]; then
  echo "$INLINE_SECRET_MATCHES"
  echo "FAIL: Potential hardcoded secrets found."
  exit 1
fi
echo "PASS: No obvious inline secrets found."

echo
echo "-- Checking inline DB credentials in source code --"
DB_CREDS_PATTERN='postgresql\+psycopg://[^[:space:]]+:[^[:space:]]+@'
INLINE_DB_CREDS_MATCHES="$(
  rg -n -S "${EXCLUDES[@]}" \
    --glob '*.py' --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.yml' --glob '*.yaml' \
    "$DB_CREDS_PATTERN" backend frontend docker scripts .github docs README.md || true
)"
if [[ -n "$INLINE_DB_CREDS_MATCHES" ]]; then
  echo "$INLINE_DB_CREDS_MATCHES"
  echo "FAIL: Inline database credentials found in source/config files."
  exit 1
fi
echo "PASS: No inline DB credentials in source/config files."

echo
echo "-- Checking insecure defaults --"
DEFAULT_ISSUES=0
for ENV_FILE in .env; do
  if [[ -f "$ENV_FILE" ]] && rg -n '^JWT_SECRET=change-me-in-production$' "$ENV_FILE" >/dev/null 2>&1; then
    echo "WARN: $ENV_FILE uses default JWT_SECRET placeholder."
    DEFAULT_ISSUES=$((DEFAULT_ISSUES + 1))
  fi
done

for ENV_FILE in .env.example backend/.env.example; do
  if [[ -f "$ENV_FILE" ]] && rg -n '^JWT_SECRET=change-me-in-production$' "$ENV_FILE" >/dev/null 2>&1; then
    echo "INFO: $ENV_FILE intentionally ships placeholder JWT_SECRET."
  fi

  if [[ -f "$ENV_FILE" ]] && rg -n 'postgresql\+psycopg://[^[:space:]]+:[^[:space:]]+@' "$ENV_FILE" >/dev/null 2>&1; then
    echo "INFO: $ENV_FILE intentionally ships development DB credential placeholders."
  fi
done

if rg -n 'allow_origins=\["\*"\]|allow_credentials=True' backend/app/main.py >/dev/null 2>&1; then
  echo "WARN: Wildcard CORS and credentialed CORS should not be enabled together."
  DEFAULT_ISSUES=$((DEFAULT_ISSUES + 1))
fi

if [[ "$DEFAULT_ISSUES" -eq 0 ]]; then
  echo "PASS: No insecure defaults detected in checked files."
else
  echo "INFO: $DEFAULT_ISSUES security warning(s) found. Review before production."
fi

echo
echo "-- Checking for accidentally tracked env files --"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  TRACKED_ENV="$(
    git ls-files \
      | rg -n '(^|/)\.env($|\.|/)' \
      | rg -v '\.env\.example$' \
      || true
  )"
  if [[ -n "$TRACKED_ENV" ]]; then
    echo "$TRACKED_ENV"
    echo "FAIL: .env-like files are tracked in git."
    exit 1
  fi
  echo "PASS: No .env-like files tracked in git."
else
  echo "INFO: Not a git repository in this directory; skipped tracked-file check."
fi

echo
echo "Security audit completed."
