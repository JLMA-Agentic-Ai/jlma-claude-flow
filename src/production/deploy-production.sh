#!/bin/bash

# AIS Production Deployment Script
# Comprehensive deployment with Evidence Chains validation and monitoring
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
LOG_FILE="/var/log/ais/deployment-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${ENVIRONMENT:-prod-us-east-1}"
VERSION="${VERSION:-latest}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_VALIDATION="${SKIP_VALIDATION:-false}"
AUTO_APPROVE="${AUTO_APPROVE:-false}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"

# Usage function
usage() {
    cat << EOF
AIS Production Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENVIRONMENT    Target environment (default: prod-us-east-1)
    -v, --version VERSION           Application version to deploy (default: latest)
    -d, --dry-run                   Perform dry run without actual deployment
    -s, --skip-validation           Skip evidence chain validation (not recommended)
    -a, --auto-approve             Auto-approve deployment phases
    -r, --no-rollback              Disable automatic rollback on failure
    -h, --help                     Show this help message

Environments:
    prod-us-east-1                  Production US East
    prod-eu-west-1                  Production EU West

Examples:
    $0 --environment prod-us-east-1 --version v2.1.0
    $0 --dry-run --version v2.1.0
    $0 --environment prod-eu-west-1 --skip-validation

EOF
}

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅${NC} $*" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌${NC} $*" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️${NC} $*" | tee -a "$LOG_FILE"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        -a|--auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        -r|--no-rollback)
            ROLLBACK_ON_FAILURE=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Function to cleanup on exit
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log_error "Deployment failed with exit code $exit_code"
        if [[ "$ROLLBACK_ON_FAILURE" == "true" && "$DRY_RUN" == "false" ]]; then
            log_warning "Initiating automatic rollback..."
            rollback_deployment || log_error "Rollback failed"
        fi
    fi
    log_info "Deployment script completed. Logs saved to: $LOG_FILE"
}

trap cleanup EXIT

# Validation functions
validate_prerequisites() {
    log_info "Validating prerequisites..."

    # Check required tools
    local required_tools=("docker" "kubectl" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done

    # Check environment variables
    local required_env_vars=("JWT_SECRET" "DB_PASSWORD" "REDIS_PASSWORD" "ENCRYPTION_KEY")
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable '$var' is not set"
            exit 1
        fi
    done

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    log_success "Prerequisites validation passed"
}

validate_environment() {
    log_info "Validating environment configuration..."

    local config_file="$SCRIPT_DIR/deployment/production-config.ts"
    if [[ ! -f "$config_file" ]]; then
        log_error "Configuration file not found: $config_file"
        exit 1
    fi

    # Validate environment exists in configuration
    if ! grep -q "$ENVIRONMENT" "$config_file"; then
        log_error "Environment '$ENVIRONMENT' not found in configuration"
        exit 1
    fi

    log_success "Environment configuration validated"
}

check_health() {
    log_info "Checking system health before deployment..."

    local health_url="https://api.aisystem.com/health"
    if [[ "$ENVIRONMENT" == "prod-eu-west-1" ]]; then
        health_url="https://api-eu.aisystem.com/health"
    fi

    local health_response
    if ! health_response=$(curl -s --max-time 30 "$health_url"); then
        log_error "Cannot reach health endpoint: $health_url"
        exit 1
    fi

    local health_status
    health_status=$(echo "$health_response" | jq -r '.status // "unknown"')

    if [[ "$health_status" != "healthy" ]]; then
        log_warning "System health is not optimal: $health_status"
        if [[ "$AUTO_APPROVE" != "true" ]]; then
            read -p "Continue with deployment? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Deployment cancelled by user"
                exit 0
            fi
        fi
    fi

    log_success "System health check passed"
}

# Evidence chain validation
run_evidence_validation() {
    if [[ "$SKIP_VALIDATION" == "true" ]]; then
        log_warning "Skipping evidence chain validation (not recommended for production)"
        return 0
    fi

    log_info "Starting evidence chain validation..."

    local validation_payload
    validation_payload=$(cat << EOF
{
    "applicationName": "ais-production",
    "version": "$VERSION",
    "environment": "$ENVIRONMENT",
    "releaseCandidate": "stable",
    "evidenceValidation": {
        "requiredEvidenceTypes": [
            "functional_test",
            "security_scan",
            "performance_test",
            "integration_test",
            "operational_readiness"
        ],
        "passThreshold": 85,
        "requireManualAttestation": true
    }
}
EOF
)

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would create evidence chain with payload:"
        echo "$validation_payload" | jq '.'
        return 0
    fi

    # Create evidence chain
    local chain_response
    if ! chain_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${DEPLOYMENT_TOKEN:-}" \
        -d "$validation_payload" \
        "https://api.aisystem.com/api/evidence-chains"); then
        log_error "Failed to create evidence chain"
        exit 1
    fi

    local chain_id
    chain_id=$(echo "$chain_response" | jq -r '.chainId // empty')
    if [[ -z "$chain_id" ]]; then
        log_error "No chain ID returned from evidence validation"
        exit 1
    fi

    log_info "Evidence chain created: $chain_id"

    # Monitor validation progress
    monitor_evidence_validation "$chain_id"
}

monitor_evidence_validation() {
    local chain_id="$1"
    local max_attempts=60  # 30 minutes with 30-second intervals
    local attempt=1

    log_info "Monitoring evidence validation progress..."

    while [[ $attempt -le $max_attempts ]]; do
        local status_response
        if ! status_response=$(curl -s "https://api.aisystem.com/api/evidence-chains/$chain_id/status"); then
            log_warning "Failed to get evidence chain status (attempt $attempt/$max_attempts)"
            ((attempt++))
            sleep 30
            continue
        fi

        local status
        status=$(echo "$status_response" | jq -r '.status // "unknown"')
        local confidence
        confidence=$(echo "$status_response" | jq -r '.overallConfidence // 0')
        local completion
        completion=$(echo "$status_response" | jq -r '.completionPercentage // 0')

        log_info "Evidence validation: $status ($completion% complete, $confidence% confidence)"

        case $status in
            "pass")
                log_success "Evidence validation completed successfully"
                log_info "Final confidence score: $confidence%"
                return 0
                ;;
            "fail")
                log_error "Evidence validation failed"
                local blockers
                blockers=$(echo "$status_response" | jq -r '.blockers[]?' 2>/dev/null || echo "Unknown failure")
                log_error "Blockers: $blockers"
                exit 1
                ;;
            "pending"|"in_progress")
                # Continue monitoring
                ;;
            *)
                log_warning "Unknown validation status: $status"
                ;;
        esac

        ((attempt++))
        sleep 30
    done

    log_error "Evidence validation timed out after 30 minutes"
    exit 1
}

# Deployment functions
prepare_deployment() {
    log_info "Preparing deployment environment..."

    # Create deployment directory
    local deploy_dir="/tmp/ais-deployment-$$"
    mkdir -p "$deploy_dir"

    # Copy deployment files
    cp -r "$SCRIPT_DIR/deployment/"* "$deploy_dir/"

    # Generate docker-compose override for environment
    generate_compose_override "$deploy_dir"

    # Validate configuration
    if ! docker-compose -f "$deploy_dir/docker-compose.production.yml" config &> /dev/null; then
        log_error "Docker Compose configuration is invalid"
        exit 1
    fi

    export DEPLOY_DIR="$deploy_dir"
    log_success "Deployment prepared in: $deploy_dir"
}

generate_compose_override() {
    local deploy_dir="$1"
    local override_file="$deploy_dir/docker-compose.override.yml"

    cat > "$override_file" << EOF
version: '3.8'

services:
  ais-app:
    image: ais-production:$VERSION
    environment:
      - VERSION=$VERSION
      - ENVIRONMENT=$ENVIRONMENT
      - DEPLOYMENT_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  nginx:
    volumes:
      - ./nginx/$ENVIRONMENT.conf:/etc/nginx/nginx.conf:ro

  prometheus:
    volumes:
      - ./prometheus/$ENVIRONMENT.yml:/etc/prometheus/prometheus.yml:ro
EOF

    log_info "Generated environment-specific override file"
}

execute_deployment() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute deployment with the following configuration:"
        docker-compose -f "$DEPLOY_DIR/docker-compose.production.yml" \
                      -f "$DEPLOY_DIR/docker-compose.override.yml" \
                      config
        return 0
    fi

    log_info "Starting production deployment..."

    # Pull latest images
    log_info "Pulling container images..."
    if ! docker-compose -f "$DEPLOY_DIR/docker-compose.production.yml" \
                        -f "$DEPLOY_DIR/docker-compose.override.yml" \
                        pull; then
        log_error "Failed to pull container images"
        exit 1
    fi

    # Start services with blue-green deployment
    execute_blue_green_deployment
}

execute_blue_green_deployment() {
    log_info "Executing blue-green deployment..."

    # Deploy to green environment first
    log_info "Deploying to green environment..."

    local green_compose="$DEPLOY_DIR/docker-compose.green.yml"

    # Create green environment configuration
    sed 's/ais-production/ais-production-green/g' \
        "$DEPLOY_DIR/docker-compose.production.yml" > "$green_compose"

    # Start green environment
    if ! docker-compose -f "$green_compose" \
                        -f "$DEPLOY_DIR/docker-compose.override.yml" \
                        up -d; then
        log_error "Failed to start green environment"
        exit 1
    fi

    # Wait for green environment to be healthy
    wait_for_health "green"

    # Run post-deployment tests
    run_post_deployment_tests "green"

    # Switch traffic to green
    switch_traffic_to_green

    # Verify production traffic
    verify_production_traffic

    # Stop blue environment
    cleanup_blue_environment

    log_success "Blue-green deployment completed successfully"
}

wait_for_health() {
    local environment="$1"
    local max_attempts=30  # 15 minutes with 30-second intervals
    local attempt=1

    log_info "Waiting for $environment environment to become healthy..."

    local health_port="3000"
    if [[ "$environment" == "green" ]]; then
        health_port="3001"  # Green environment uses different port
    fi

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "http://localhost:$health_port/health" &> /dev/null; then
            log_success "$environment environment is healthy"
            return 0
        fi

        log_info "Waiting for $environment environment... (attempt $attempt/$max_attempts)"
        ((attempt++))
        sleep 30
    done

    log_error "$environment environment failed to become healthy"
    exit 1
}

run_post_deployment_tests() {
    local environment="$1"
    log_info "Running post-deployment tests on $environment environment..."

    local test_port="3000"
    if [[ "$environment" == "green" ]]; then
        test_port="3001"
    fi

    # Basic functionality tests
    local tests=(
        "http://localhost:$test_port/health"
        "http://localhost:$test_port/api/status"
        "http://localhost:$test_port/api/agents/status"
    )

    for test_url in "${tests[@]}"; do
        if ! curl -sf "$test_url" &> /dev/null; then
            log_error "Post-deployment test failed: $test_url"
            exit 1
        fi
    done

    # Agent spawning test
    local spawn_response
    if spawn_response=$(curl -s -X POST -H "Content-Type: application/json" \
                           -d '{"type":"test","config":{}}' \
                           "http://localhost:$test_port/api/agents/spawn"); then
        local agent_id
        agent_id=$(echo "$spawn_response" | jq -r '.agentId // empty')
        if [[ -n "$agent_id" ]]; then
            log_success "Agent spawning test passed"
        else
            log_error "Agent spawning test failed"
            exit 1
        fi
    else
        log_error "Agent spawning test failed"
        exit 1
    fi

    log_success "All post-deployment tests passed"
}

switch_traffic_to_green() {
    log_info "Switching traffic to green environment..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would switch load balancer to green environment"
        return 0
    fi

    # Update nginx configuration to point to green environment
    local nginx_config="/etc/nginx/sites-available/ais-production"
    if [[ -f "$nginx_config" ]]; then
        sed -i 's/localhost:3000/localhost:3001/g' "$nginx_config"
        nginx -s reload
    else
        # Use docker-compose to switch
        docker-compose -f "$DEPLOY_DIR/docker-compose.production.yml" \
                      exec nginx \
                      sh -c 'sed -i "s/ais-app:3000/ais-production-green:3000/g" /etc/nginx/nginx.conf && nginx -s reload'
    fi

    log_success "Traffic switched to green environment"
}

verify_production_traffic() {
    log_info "Verifying production traffic..."

    local max_attempts=10
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        local response
        if response=$(curl -s "https://api.aisystem.com/health"); then
            local status
            status=$(echo "$response" | jq -r '.status // "unknown"')
            if [[ "$status" == "healthy" ]]; then
                log_success "Production traffic verification passed"
                return 0
            fi
        fi

        log_info "Verifying production traffic... (attempt $attempt/$max_attempts)"
        ((attempt++))
        sleep 10
    done

    log_error "Production traffic verification failed"
    exit 1
}

cleanup_blue_environment() {
    log_info "Cleaning up blue environment..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would stop blue environment containers"
        return 0
    fi

    # Stop blue environment (original)
    docker-compose -f "$DEPLOY_DIR/docker-compose.production.yml" down

    # Rename green to production
    local containers
    containers=$(docker ps -q -f name=ais-production-green)

    for container in $containers; do
        local new_name
        new_name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/-green//' | sed 's|^/||')
        docker rename "$container" "$new_name" || true
    done

    log_success "Blue environment cleanup completed"
}

# Rollback function
rollback_deployment() {
    log_warning "Initiating deployment rollback..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would rollback to previous version"
        return 0
    fi

    # Get previous version from backup
    local previous_version
    if [[ -f "/tmp/ais-previous-version" ]]; then
        previous_version=$(cat /tmp/ais-previous-version)
    else
        previous_version="previous"
    fi

    log_info "Rolling back to version: $previous_version"

    # Stop current deployment
    docker-compose -f "$DEPLOY_DIR/docker-compose.production.yml" down || true

    # Restore previous version
    if docker image inspect "ais-production:$previous_version" &> /dev/null; then
        export VERSION="$previous_version"
        docker-compose -f "$DEPLOY_DIR/docker-compose.production.yml" up -d

        # Verify rollback
        if wait_for_health "blue"; then
            log_success "Rollback completed successfully"
        else
            log_error "Rollback verification failed"
            exit 1
        fi
    else
        log_error "Previous version image not found: ais-production:$previous_version"
        exit 1
    fi
}

# Monitoring and notification functions
send_deployment_notification() {
    local status="$1"
    local message="$2"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would send notification: $status - $message"
        return 0
    fi

    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        if [[ "$status" == "failure" ]]; then
            color="danger"
        elif [[ "$status" == "warning" ]]; then
            color="warning"
        fi

        local payload
        payload=$(cat << EOF
{
    "attachments": [{
        "color": "$color",
        "title": "AIS Production Deployment",
        "fields": [
            {
                "title": "Environment",
                "value": "$ENVIRONMENT",
                "short": true
            },
            {
                "title": "Version",
                "value": "$VERSION",
                "short": true
            },
            {
                "title": "Status",
                "value": "$status",
                "short": true
            },
            {
                "title": "Message",
                "value": "$message",
                "short": false
            }
        ],
        "ts": $(date +%s)
    }]
}
EOF
)

        curl -s -X POST \
             -H "Content-Type: application/json" \
             -d "$payload" \
             "$SLACK_WEBHOOK_URL" &> /dev/null || true
    fi

    log_info "Notification sent: $status - $message"
}

# Main deployment process
main() {
    log_info "Starting AIS Production Deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    log_info "Dry Run: $DRY_RUN"

    # Save current version for potential rollback
    if [[ "$DRY_RUN" == "false" ]]; then
        docker images --format "{{.Tag}}" ais-production:latest 2>/dev/null | head -1 > /tmp/ais-previous-version || echo "unknown" > /tmp/ais-previous-version
    fi

    # Pre-deployment validation
    validate_prerequisites
    validate_environment
    check_health

    # Evidence chain validation
    if [[ "$SKIP_VALIDATION" == "false" ]]; then
        run_evidence_validation
    fi

    # Deployment approval
    if [[ "$AUTO_APPROVE" != "true" && "$DRY_RUN" == "false" ]]; then
        echo -e "\n${YELLOW}Ready to deploy $VERSION to $ENVIRONMENT${NC}"
        read -p "Continue with deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled by user"
            send_deployment_notification "cancelled" "Deployment cancelled by user"
            exit 0
        fi
    fi

    # Execute deployment
    send_deployment_notification "started" "Deployment started"

    prepare_deployment
    execute_deployment

    # Post-deployment verification
    log_info "Performing final verification..."
    sleep 30  # Allow services to settle
    verify_production_traffic

    # Success notification
    send_deployment_notification "success" "Deployment completed successfully"

    log_success "AIS Production Deployment completed successfully!"
    log_info "Version $VERSION is now live in $ENVIRONMENT"
    log_info "Monitor the deployment at: https://grafana.aisystem.com"
}

# Execute main function
main "$@"