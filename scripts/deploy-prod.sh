#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE=".env.prod"
COMPOSE_FILE="docker-compose.prod.yml"
BRANCH="main"
REF=""
SKIP_GIT="false"
SKIP_BUILD="false"
FOLLOW_LOGS="false"
SERVICE=""
ACTION="deploy"

DEPLOY_STATE_DIR="${REPO_DIR}/.deploy"
LAST_SUCCESS_FILE="${DEPLOY_STATE_DIR}/last_successful_commit.txt"

print_usage() {
  cat <<'EOF'
Usage:
  scripts/deploy-prod.sh [action] [options]

Actions:
  deploy                  Deploy latest code (default)
  validate                Validate docker compose config
  status                  Show container status
  health                  Check backend + AI health endpoints
  logs                    Show logs (all services or one service)
  restart                 Restart one service (backend|ai-service|nginx)
  rollback                Roll back to a git ref or last successful commit

Options:
  --env-file <file>       Env file path (default: .env.prod)
  --compose-file <file>   Compose file path (default: docker-compose.prod.yml)
  --branch <name>         Target branch for deploy (default: main)
  --ref <git-ref>         Specific git ref/tag/commit for deploy or rollback
  --service <name>        Service name for logs/restart
  --follow                Follow logs (for logs action)
  --skip-git              Skip git fetch/checkout/pull in deploy
  --skip-build            Deploy without --build
  -h, --help              Show this help

Examples:
  scripts/deploy-prod.sh deploy
  scripts/deploy-prod.sh deploy --ref v1.2.3
  scripts/deploy-prod.sh validate
  scripts/deploy-prod.sh status
  scripts/deploy-prod.sh health
  scripts/deploy-prod.sh logs --service backend --follow
  scripts/deploy-prod.sh restart --service ai-service
  scripts/deploy-prod.sh rollback --ref 4ae2465
EOF
}

log() {
  printf '[deploy-prod] %s\n' "$*"
}

die() {
  printf '[deploy-prod][ERROR] %s\n' "$*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Missing required command: ${cmd}"
}

ensure_file() {
  local f="$1"
  [[ -f "$f" ]] || die "File not found: $f"
}

ensure_clean_git() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "Working tree is not clean. Commit/stash changes before deploy/rollback."
  fi
}

load_env() {
  ensure_file "$ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

compose_cmd() {
  docker compose -p "${COMPOSE_PROJECT_NAME:-petties-prod}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

validate_config() {
  log "Validating compose config..."
  compose_cmd config >/dev/null
  log "Compose config is valid."
}

health_check() {
  local backend_port="${BACKEND_HOST_PORT:-8080}"
  local ai_port="${AI_HOST_PORT:-8000}"

  log "Checking backend health on 127.0.0.1:${backend_port} ..."
  curl -fsS "http://127.0.0.1:${backend_port}/api/actuator/health" >/dev/null

  log "Checking AI service health on 127.0.0.1:${ai_port} ..."
  curl -fsS "http://127.0.0.1:${ai_port}/health" >/dev/null

  log "Health checks passed."
}

record_last_successful_commit() {
  mkdir -p "$DEPLOY_STATE_DIR"
  git rev-parse --short HEAD > "$LAST_SUCCESS_FILE"
  log "Saved last successful commit: $(cat "$LAST_SUCCESS_FILE")"
}

deploy_action() {
  log "Starting production deployment..."
  validate_config

  if [[ "$SKIP_GIT" != "true" ]]; then
    ensure_clean_git
    log "Fetching repository updates..."
    git fetch origin --prune

    if [[ -n "$REF" ]]; then
      log "Checking out ref: $REF"
      git checkout "$REF"
    else
      log "Checking out branch: $BRANCH"
      git checkout "$BRANCH"
      git pull --ff-only origin "$BRANCH"
    fi
  fi

  if [[ "$SKIP_BUILD" == "true" ]]; then
    log "Running compose up without build..."
    compose_cmd up -d
  else
    log "Running compose up with build..."
    compose_cmd up -d --build
  fi

  log "Waiting for services to initialize..."
  sleep 15

  health_check
  record_last_successful_commit

  log "Deployment complete."
  compose_cmd ps
}

status_action() {
  compose_cmd ps
}

logs_action() {
  if [[ "$FOLLOW_LOGS" == "true" ]]; then
    if [[ -n "$SERVICE" ]]; then
      compose_cmd logs -f --tail=100 "$SERVICE"
    else
      compose_cmd logs -f --tail=100
    fi
  else
    if [[ -n "$SERVICE" ]]; then
      compose_cmd logs --tail=100 "$SERVICE"
    else
      compose_cmd logs --tail=100
    fi
  fi
}

restart_action() {
  [[ -n "$SERVICE" ]] || die "restart requires --service <backend|ai-service|nginx>"
  compose_cmd restart "$SERVICE"
  compose_cmd ps
}

rollback_action() {
  ensure_clean_git
  git fetch origin --prune

  local target_ref="$REF"
  if [[ -z "$target_ref" ]]; then
    [[ -f "$LAST_SUCCESS_FILE" ]] || die "No --ref provided and no ${LAST_SUCCESS_FILE} found."
    target_ref="$(cat "$LAST_SUCCESS_FILE")"
  fi

  log "Rolling back to: $target_ref"
  git checkout "$target_ref"
  validate_config
  compose_cmd up -d --build
  sleep 15
  health_check
  record_last_successful_commit
  log "Rollback complete."
}

parse_args() {
  if [[ $# -gt 0 ]]; then
    case "$1" in
      deploy|validate|status|health|logs|restart|rollback)
        ACTION="$1"
        shift
        ;;
      -h|--help)
        print_usage
        exit 0
        ;;
    esac
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env-file)
        ENV_FILE="$2"
        shift 2
        ;;
      --compose-file)
        COMPOSE_FILE="$2"
        shift 2
        ;;
      --branch)
        BRANCH="$2"
        shift 2
        ;;
      --ref)
        REF="$2"
        shift 2
        ;;
      --service)
        SERVICE="$2"
        shift 2
        ;;
      --follow)
        FOLLOW_LOGS="true"
        shift
        ;;
      --skip-git)
        SKIP_GIT="true"
        shift
        ;;
      --skip-build)
        SKIP_BUILD="true"
        shift
        ;;
      -h|--help)
        print_usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

main() {
  cd "$REPO_DIR"

  parse_args "$@"

  require_command git
  require_command docker
  require_command curl

  ensure_file "$COMPOSE_FILE"
  load_env

  case "$ACTION" in
    deploy)
      deploy_action
      ;;
    validate)
      validate_config
      ;;
    status)
      status_action
      ;;
    health)
      health_check
      ;;
    logs)
      logs_action
      ;;
    restart)
      restart_action
      ;;
    rollback)
      rollback_action
      ;;
    *)
      die "Unsupported action: $ACTION"
      ;;
  esac
}

main "$@"
