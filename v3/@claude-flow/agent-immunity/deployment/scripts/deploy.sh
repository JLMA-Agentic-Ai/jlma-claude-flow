#!/bin/bash

# AIS Plugin Production Deployment Script
# Supports Docker Compose and Kubernetes deployments with comprehensive validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DEPLOYMENT_DIR")"

# Default values
DEPLOYMENT_TYPE="docker"
ENVIRONMENT="production"
NAMESPACE="claude-flow"
DRY_RUN=false
SKIP_TESTS=false
SKIP_SECURITY_SCAN=false
CANARY_PERCENTAGE=10
MONITORING_ENABLED=true
BACKUP_ENABLED=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print usage information
usage() {
    cat << EOF
AIS Plugin Deployment Script

Usage: $0 [OPTIONS]

Options:
    -t, --type TYPE           Deployment type (docker|kubernetes) [default: docker]
    -e, --env ENV            Environment (development|staging|production) [default: production]
    -n, --namespace NS       Kubernetes namespace [default: claude-flow]
    -c, --canary PERCENT     Canary deployment percentage [default: 10]
    --dry-run               Show what would be deployed without executing
    --skip-tests            Skip pre-deployment tests
    --skip-security         Skip security scanning
    --no-monitoring         Disable monitoring stack deployment
    --no-backup             Disable backup creation
    -h, --help              Show this help message

Examples:
    $0 -t docker -e production
    $0 -t kubernetes -n prod --canary 25
    $0 --dry-run -t kubernetes

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                DEPLOYMENT_TYPE="$2"
                shift 2
                ;;
            -e|--env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -c|--canary)
                CANARY_PERCENTAGE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-security)
                SKIP_SECURITY_SCAN=true
                shift
                ;;
            --no-monitoring)
                MONITORING_ENABLED=false
                shift
                ;;
            --no-backup)
                BACKUP_ENABLED=false
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
}

# Validate deployment environment
validate_environment() {
    log_info "Validating deployment environment..."

    # Check required tools
    local required_tools=("node" "npm" "docker")

    if [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
        required_tools+=("kubectl" "helm")
    fi

    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Check Kubernetes connectivity (if needed)
    if [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
        if ! kubectl cluster-info &> /dev/null; then
            log_error "Cannot connect to Kubernetes cluster"
            exit 1
        fi
    fi

    # Validate environment variables
    local required_vars=()
    if [[ "$ENVIRONMENT" == "production" ]]; then
        required_vars+=("REDIS_PASSWORD" "GRAFANA_PASSWORD")
    fi

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable '$var' is not set"
            exit 1
        fi
    done

    log_success "Environment validation passed"
}

# Run pre-deployment tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping pre-deployment tests"
        return
    fi

    log_info "Running pre-deployment tests..."

    # Build the project
    cd "$PROJECT_ROOT"
    npm run build

    # Run unit tests
    npm test

    # Run integration tests
    if [[ -f "package.json" ]] && npm run | grep -q "test:integration"; then
        npm run test:integration
    fi

    # Validate Docker build
    log_info "Testing Docker build..."
    docker build -t ais-test -f "$DEPLOYMENT_DIR/docker/Dockerfile" .
    docker run --rm ais-test node --version

    log_success "All tests passed"
}

# Run security scans
run_security_scan() {
    if [[ "$SKIP_SECURITY_SCAN" == "true" ]]; then
        log_warning "Skipping security scan"
        return
    fi

    log_info "Running security scans..."

    # NPM audit
    cd "$PROJECT_ROOT"
    npm audit --audit-level moderate

    # Docker image security scan (using Trivy if available)
    if command -v trivy &> /dev/null; then
        log_info "Scanning Docker image with Trivy..."
        docker build -t ais-security-scan -f "$DEPLOYMENT_DIR/docker/Dockerfile" .
        trivy image --exit-code 1 --severity HIGH,CRITICAL ais-security-scan
    else
        log_warning "Trivy not found, skipping Docker image security scan"
    fi

    log_success "Security scans completed"
}

# Create backup (for production)
create_backup() {
    if [[ "$BACKUP_ENABLED" == "false" ]]; then
        log_warning "Backup creation disabled"
        return
    fi

    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "Skipping backup for non-production environment"
        return
    fi

    log_info "Creating backup..."

    local backup_dir="/var/backups/ais-plugin/$(date +%Y%m%d_%H%M%S)"

    if [[ "$DRY_RUN" == "false" ]]; then
        mkdir -p "$backup_dir"

        # Backup current configuration
        if [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
            kubectl get all -n "$NAMESPACE" -o yaml > "$backup_dir/k8s-resources.yaml"
            kubectl get configmaps,secrets -n "$NAMESPACE" -o yaml > "$backup_dir/k8s-config.yaml"
        else
            # Docker Compose backup
            docker-compose -f "$DEPLOYMENT_DIR/docker/docker-compose.yml" config > "$backup_dir/compose-config.yaml"
        fi

        log_success "Backup created at $backup_dir"
    else
        log_info "[DRY RUN] Would create backup at $backup_dir"
    fi
}

# Deploy using Docker Compose
deploy_docker() {
    log_info "Deploying AIS Plugin using Docker Compose..."

    cd "$DEPLOYMENT_DIR/docker"

    # Build images
    if [[ "$DRY_RUN" == "false" ]]; then
        docker-compose build
        docker-compose up -d

        # Wait for services to be healthy
        log_info "Waiting for services to be healthy..."
        timeout 120 bash -c 'until docker-compose ps | grep -q "Up (healthy)"; do sleep 5; done'

        log_success "Docker deployment completed"

        # Show service status
        docker-compose ps

        # Show health check endpoints
        echo ""
        log_info "Health check endpoints:"
        echo "  Health: http://localhost:8080/health"
        echo "  Metrics: http://localhost:9090/metrics"
        echo "  Grafana: http://localhost:3000 (admin/ais-admin)"
    else
        log_info "[DRY RUN] Would run: docker-compose up -d"
    fi
}

# Deploy using Kubernetes
deploy_kubernetes() {
    log_info "Deploying AIS Plugin to Kubernetes..."

    # Create namespace if it doesn't exist
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    else
        log_info "[DRY RUN] Would create namespace: $NAMESPACE"
    fi

    # Apply Kubernetes manifests
    local k8s_dir="$DEPLOYMENT_DIR/kubernetes"

    if [[ "$DRY_RUN" == "false" ]]; then
        # Apply core deployment
        kubectl apply -f "$k8s_dir/ais-deployment.yaml" -n "$NAMESPACE"

        # Wait for rollout to complete
        kubectl rollout status deployment/ais-plugin -n "$NAMESPACE" --timeout=300s

        # Verify deployment
        kubectl get pods -n "$NAMESPACE" -l app=ais-plugin

        log_success "Kubernetes deployment completed"

        # Show service endpoints
        echo ""
        log_info "Service endpoints:"
        kubectl get services -n "$NAMESPACE"

    else
        log_info "[DRY RUN] Would apply Kubernetes manifests to namespace: $NAMESPACE"
    fi
}

# Deploy monitoring stack
deploy_monitoring() {
    if [[ "$MONITORING_ENABLED" == "false" ]]; then
        log_warning "Monitoring deployment disabled"
        return
    fi

    log_info "Deploying monitoring stack..."

    if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
        # Monitoring is included in docker-compose.yml
        log_info "Monitoring stack included in Docker Compose deployment"
    else
        # Deploy Prometheus and Grafana to Kubernetes
        if [[ "$DRY_RUN" == "false" ]]; then
            # Use Helm charts for monitoring
            if command -v helm &> /dev/null; then
                # Add Prometheus community repo
                helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
                helm repo update

                # Install kube-prometheus-stack
                helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
                    --namespace "$NAMESPACE" \
                    --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
                    --set grafana.adminPassword="$GRAFANA_PASSWORD"

                log_success "Monitoring stack deployed"
            else
                log_warning "Helm not found, skipping monitoring stack deployment"
            fi
        else
            log_info "[DRY RUN] Would deploy monitoring stack with Helm"
        fi
    fi
}

# Run canary deployment
deploy_canary() {
    if [[ "$CANARY_PERCENTAGE" -le 0 ]]; then
        log_info "Canary deployment disabled"
        return
    fi

    log_info "Starting canary deployment ($CANARY_PERCENTAGE% traffic)..."

    if [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
        # Implement canary deployment with Kubernetes
        if [[ "$DRY_RUN" == "false" ]]; then
            # Create canary deployment
            local canary_replicas=$((CANARY_PERCENTAGE * 3 / 100))
            if [[ $canary_replicas -lt 1 ]]; then
                canary_replicas=1
            fi

            # Deploy canary version
            kubectl patch deployment ais-plugin -n "$NAMESPACE" -p '{"spec":{"replicas":'$canary_replicas'}}'

            # Monitor canary metrics for 5 minutes
            log_info "Monitoring canary deployment for 5 minutes..."
            sleep 300

            # Check for errors
            local error_rate=$(kubectl top pods -n "$NAMESPACE" -l app=ais-plugin --no-headers | awk '{sum+=$3} END {print sum}' || echo "0")

            if [[ "$error_rate" -lt 10 ]]; then
                log_success "Canary deployment successful, proceeding with full deployment"
                kubectl patch deployment ais-plugin -n "$NAMESPACE" -p '{"spec":{"replicas":3}}'
            else
                log_error "Canary deployment failed, rolling back"
                kubectl rollout undo deployment/ais-plugin -n "$NAMESPACE"
                exit 1
            fi
        else
            log_info "[DRY RUN] Would deploy canary with $CANARY_PERCENTAGE% traffic"
        fi
    else
        log_warning "Canary deployment not implemented for Docker Compose"
    fi
}

# Validate deployment
validate_deployment() {
    log_info "Validating deployment..."

    if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
        # Check Docker services
        local health_url="http://localhost:8080/health"
        local retries=12
        local count=0

        while [[ $count -lt $retries ]]; do
            if curl -f "$health_url" &> /dev/null; then
                log_success "Health check passed"
                break
            fi
            ((count++))
            if [[ $count -eq $retries ]]; then
                log_error "Health check failed after $retries attempts"
                exit 1
            fi
            sleep 10
        done

    else
        # Check Kubernetes deployment
        local pod_ready=$(kubectl get pods -n "$NAMESPACE" -l app=ais-plugin -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}')

        if [[ "$pod_ready" != "True" ]]; then
            log_error "Pod is not ready"
            kubectl describe pods -n "$NAMESPACE" -l app=ais-plugin
            exit 1
        fi

        log_success "Kubernetes deployment validation passed"
    fi
}

# Post-deployment tasks
post_deployment() {
    log_info "Running post-deployment tasks..."

    # Check immunity system status
    if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
        local immunity_url="http://localhost:8080/immunity"
    else
        # Port-forward for Kubernetes
        kubectl port-forward -n "$NAMESPACE" service/ais-plugin-service 8080:8080 &
        local pf_pid=$!
        sleep 5
        local immunity_url="http://localhost:8080/immunity"
    fi

    if curl -f "$immunity_url" &> /dev/null; then
        log_success "Immunity system is operational"
        curl -s "$immunity_url" | jq '.'
    else
        log_warning "Immunity system check failed"
    fi

    # Clean up port-forward
    if [[ -n "${pf_pid:-}" ]]; then
        kill $pf_pid 2>/dev/null || true
    fi

    # Display deployment summary
    echo ""
    log_success "=== DEPLOYMENT SUMMARY ==="
    echo "Environment: $ENVIRONMENT"
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    echo "Namespace: $NAMESPACE"
    echo "Monitoring: $MONITORING_ENABLED"
    echo "Timestamp: $(date)"

    if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
        echo ""
        echo "Services:"
        echo "  AIS Core: http://localhost:8080"
        echo "  Metrics: http://localhost:9090"
        echo "  Grafana: http://localhost:3000"
    fi
}

# Cleanup function for script termination
cleanup() {
    log_info "Cleaning up..."
    # Add any cleanup logic here
}

# Trap for cleanup on script exit
trap cleanup EXIT

# Main deployment function
main() {
    log_info "Starting AIS Plugin deployment..."
    log_info "Configuration: Type=$DEPLOYMENT_TYPE, Env=$ENVIRONMENT, DryRun=$DRY_RUN"

    validate_environment

    if [[ "$BACKUP_ENABLED" == "true" ]]; then
        create_backup
    fi

    run_tests
    run_security_scan

    case "$DEPLOYMENT_TYPE" in
        docker)
            deploy_docker
            ;;
        kubernetes)
            deploy_kubernetes
            deploy_canary
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac

    if [[ "$DRY_RUN" == "false" ]]; then
        deploy_monitoring
        validate_deployment
        post_deployment

        log_success "AIS Plugin deployment completed successfully!"
    else
        log_info "DRY RUN completed - no actual deployment performed"
    fi
}

# Parse arguments and run main function
parse_args "$@"
main