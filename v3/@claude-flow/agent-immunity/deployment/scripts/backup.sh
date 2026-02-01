#!/bin/bash

# AIS Plugin Backup and Recovery Script
# Automated backup of configurations, data, and deployment state

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="/var/backups/ais-plugin"
NAMESPACE="claude-flow"
BACKUP_TYPE="incremental"
RETENTION_DAYS=30
COMPRESS=true
ENCRYPT=false
REMOTE_SYNC=false
DRY_RUN=false

# Remote backup configuration
S3_BUCKET=""
GCS_BUCKET=""
AZURE_CONTAINER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# Print usage information
usage() {
    cat << EOF
AIS Plugin Backup Script

Usage: $0 [OPTIONS]

Options:
    -t, --type TYPE          Backup type (full|incremental|config-only) [default: incremental]
    -d, --backup-dir DIR     Backup directory [default: /var/backups/ais-plugin]
    -n, --namespace NS       Kubernetes namespace [default: claude-flow]
    -r, --retention DAYS     Backup retention in days [default: 30]
    --compress              Enable compression (default: true)
    --encrypt              Enable encryption
    --s3-bucket BUCKET     S3 bucket for remote backup
    --gcs-bucket BUCKET    GCS bucket for remote backup
    --azure-container CON  Azure container for remote backup
    --dry-run             Show what would be backed up without executing
    -h, --help             Show this help message

Backup Types:
    full         - Complete backup of all data, configs, and state
    incremental  - Backup only changes since last backup
    config-only  - Backup only configuration files

Examples:
    $0 --type full --encrypt --s3-bucket my-backups
    $0 --type incremental --retention 7
    $0 --type config-only --dry-run

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                BACKUP_TYPE="$2"
                shift 2
                ;;
            -d|--backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -r|--retention)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            --compress)
                COMPRESS=true
                shift
                ;;
            --encrypt)
                ENCRYPT=true
                shift
                ;;
            --s3-bucket)
                S3_BUCKET="$2"
                REMOTE_SYNC=true
                shift 2
                ;;
            --gcs-bucket)
                GCS_BUCKET="$2"
                REMOTE_SYNC=true
                shift 2
                ;;
            --azure-container)
                AZURE_CONTAINER="$2"
                REMOTE_SYNC=true
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
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

# Validate backup environment
validate_environment() {
    log_info "Validating backup environment..."

    # Check required tools
    local required_tools=("kubectl" "tar" "gzip")

    if [[ "$ENCRYPT" == "true" ]]; then
        required_tools+=("gpg")
    fi

    if [[ -n "$S3_BUCKET" ]]; then
        required_tools+=("aws")
    fi

    if [[ -n "$GCS_BUCKET" ]]; then
        required_tools+=("gsutil")
    fi

    if [[ -n "$AZURE_CONTAINER" ]]; then
        required_tools+=("az")
    fi

    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done

    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace '$NAMESPACE' does not exist"
        exit 1
    fi

    # Create backup directory
    if [[ "$DRY_RUN" == "false" ]]; then
        mkdir -p "$BACKUP_DIR"
    fi

    log_success "Environment validation completed"
}

# Create backup directory structure
create_backup_structure() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="ais-backup-${BACKUP_TYPE}-${timestamp}"

    CURRENT_BACKUP_DIR="$BACKUP_DIR/$backup_name"

    if [[ "$DRY_RUN" == "false" ]]; then
        mkdir -p "$CURRENT_BACKUP_DIR"/{kubernetes,docker,data,logs,config}
    fi

    log_info "Backup directory: $CURRENT_BACKUP_DIR"
}

# Backup Kubernetes resources
backup_kubernetes() {
    log_info "Backing up Kubernetes resources..."

    local k8s_backup_dir="$CURRENT_BACKUP_DIR/kubernetes"

    if [[ "$DRY_RUN" == "false" ]]; then
        # Backup all resources in namespace
        kubectl get all,configmaps,secrets,pvc,networkpolicies,hpa,pdb \
            -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/all-resources.yaml"

        # Backup specific resource types separately
        kubectl get deployments -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/deployments.yaml"
        kubectl get services -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/services.yaml"
        kubectl get configmaps -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/configmaps.yaml"

        # Backup secrets (without values for security)
        kubectl get secrets -n "$NAMESPACE" -o yaml | \
            sed 's/^\([[:space:]]*\)\([^[:space:]]*\):[[:space:]]*[^[:space:]]*$/\1\2: <redacted>/' \
            > "$k8s_backup_dir/secrets-metadata.yaml"

        # Backup persistent volumes
        kubectl get pv -o yaml > "$k8s_backup_dir/persistent-volumes.yaml"

        # Backup RBAC resources
        kubectl get roles,rolebindings,clusterroles,clusterrolebindings \
            -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/rbac.yaml"

        # Backup custom resources (if any)
        kubectl api-resources --verbs=list --namespaced -o name | \
            xargs -I {} kubectl get {} -n "$NAMESPACE" -o yaml \
            > "$k8s_backup_dir/custom-resources.yaml" 2>/dev/null || true

        # Get resource descriptions for troubleshooting
        kubectl describe all -n "$NAMESPACE" > "$k8s_backup_dir/descriptions.txt"

        log_success "Kubernetes resources backed up"
    else
        log_info "[DRY RUN] Would backup Kubernetes resources to $k8s_backup_dir"
    fi
}

# Backup Docker resources (if applicable)
backup_docker() {
    log_info "Backing up Docker resources..."

    local docker_backup_dir="$CURRENT_BACKUP_DIR/docker"

    if command -v docker &> /dev/null && docker info &> /dev/null; then
        if [[ "$DRY_RUN" == "false" ]]; then
            # Backup docker-compose configuration
            if [[ -f "$SCRIPT_DIR/../docker/docker-compose.yml" ]]; then
                cp "$SCRIPT_DIR/../docker/docker-compose.yml" "$docker_backup_dir/"
            fi

            # Backup Docker images
            docker images --filter "reference=*ais*" --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}" \
                > "$docker_backup_dir/images.txt"

            # Export Docker images
            docker images --filter "reference=*ais*" --format "{{.Repository}}:{{.Tag}}" | \
                while read -r image; do
                    if [[ -n "$image" && "$image" != "<none>:<none>" ]]; then
                        local image_file=$(echo "$image" | sed 's/[\/:]/_/g')
                        docker save "$image" | gzip > "$docker_backup_dir/${image_file}.tar.gz"
                    fi
                done

            # Backup container configurations
            docker ps -a --filter "name=ais" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" \
                > "$docker_backup_dir/containers.txt"

            log_success "Docker resources backed up"
        else
            log_info "[DRY RUN] Would backup Docker resources to $docker_backup_dir"
        fi
    else
        log_info "Docker not available, skipping Docker backup"
    fi
}

# Backup application data
backup_data() {
    log_info "Backing up application data..."

    local data_backup_dir="$CURRENT_BACKUP_DIR/data"

    if [[ "$BACKUP_TYPE" == "config-only" ]]; then
        log_info "Skipping data backup for config-only backup type"
        return
    fi

    if [[ "$DRY_RUN" == "false" ]]; then
        # Backup Redis data (if accessible)
        if kubectl get pod -n "$NAMESPACE" -l app=ais-redis &> /dev/null; then
            local redis_pod=$(kubectl get pod -n "$NAMESPACE" -l app=ais-redis -o jsonpath='{.items[0].metadata.name}')

            if [[ -n "$redis_pod" ]]; then
                # Create Redis backup
                kubectl exec -n "$NAMESPACE" "$redis_pod" -- redis-cli BGSAVE

                # Wait for backup to complete
                sleep 5

                # Copy backup file
                kubectl cp -n "$NAMESPACE" "$redis_pod":/data/dump.rdb "$data_backup_dir/redis-dump.rdb"

                log_info "Redis data backed up"
            fi
        fi

        # Backup persistent volume data
        local pvcs=$(kubectl get pvc -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')

        for pvc in $pvcs; do
            local pod_name="backup-pod-$(date +%s)"

            # Create temporary pod to access PVC data
            kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $pod_name
  namespace: $NAMESPACE
spec:
  containers:
  - name: backup
    image: alpine:latest
    command: ['sleep', '3600']
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: $pvc
  restartPolicy: Never
EOF

            # Wait for pod to be ready
            kubectl wait --for=condition=Ready pod/$pod_name -n "$NAMESPACE" --timeout=300s

            # Create tar archive of PVC data
            kubectl exec -n "$NAMESPACE" "$pod_name" -- tar czf /tmp/pvc-backup.tar.gz -C /data .

            # Copy backup to local system
            kubectl cp -n "$NAMESPACE" "$pod_name":/tmp/pvc-backup.tar.gz "$data_backup_dir/pvc-${pvc}.tar.gz"

            # Cleanup temporary pod
            kubectl delete pod "$pod_name" -n "$NAMESPACE"

            log_info "PVC '$pvc' data backed up"
        done

        log_success "Application data backed up"
    else
        log_info "[DRY RUN] Would backup application data to $data_backup_dir"
    fi
}

# Backup logs
backup_logs() {
    log_info "Backing up application logs..."

    local logs_backup_dir="$CURRENT_BACKUP_DIR/logs"

    if [[ "$DRY_RUN" == "false" ]]; then
        # Get logs from all AIS pods
        local pods=$(kubectl get pods -n "$NAMESPACE" -l app=ais-plugin -o jsonpath='{.items[*].metadata.name}')

        for pod in $pods; do
            # Current logs
            kubectl logs -n "$NAMESPACE" "$pod" > "$logs_backup_dir/${pod}-current.log"

            # Previous logs (if available)
            kubectl logs -n "$NAMESPACE" "$pod" --previous > "$logs_backup_dir/${pod}-previous.log" 2>/dev/null || true

            # Container logs for multi-container pods
            local containers=$(kubectl get pod -n "$NAMESPACE" "$pod" -o jsonpath='{.spec.containers[*].name}')
            for container in $containers; do
                kubectl logs -n "$NAMESPACE" "$pod" -c "$container" > "$logs_backup_dir/${pod}-${container}.log"
            done
        done

        # Get events
        kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' > "$logs_backup_dir/events.txt"

        log_success "Application logs backed up"
    else
        log_info "[DRY RUN] Would backup logs to $logs_backup_dir"
    fi
}

# Backup configuration files
backup_config() {
    log_info "Backing up configuration files..."

    local config_backup_dir="$CURRENT_BACKUP_DIR/config"

    if [[ "$DRY_RUN" == "false" ]]; then
        # Backup deployment directory
        if [[ -d "$SCRIPT_DIR/.." ]]; then
            cp -r "$SCRIPT_DIR/../"* "$config_backup_dir/" 2>/dev/null || true
        fi

        # Backup environment files
        if [[ -f "$SCRIPT_DIR/../.env" ]]; then
            # Sanitize sensitive data
            sed 's/\(PASSWORD\|SECRET\|KEY\)=.*/\1=<redacted>/' "$SCRIPT_DIR/../.env" \
                > "$config_backup_dir/.env.sanitized"
        fi

        # Create backup metadata
        cat > "$config_backup_dir/backup-metadata.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "$BACKUP_TYPE",
  "namespace": "$NAMESPACE",
  "kubernetes_version": "$(kubectl version --short --client 2>/dev/null | grep Client || echo 'unknown')",
  "ais_version": "3.0.0-alpha.1",
  "backup_script_version": "1.0.0",
  "environment": {
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "working_directory": "$(pwd)"
  }
}
EOF

        log_success "Configuration files backed up"
    else
        log_info "[DRY RUN] Would backup configuration to $config_backup_dir"
    fi
}

# Compress backup
compress_backup() {
    if [[ "$COMPRESS" != "true" ]]; then
        return
    fi

    log_info "Compressing backup..."

    if [[ "$DRY_RUN" == "false" ]]; then
        local backup_basename=$(basename "$CURRENT_BACKUP_DIR")
        local compressed_file="${BACKUP_DIR}/${backup_basename}.tar.gz"

        tar czf "$compressed_file" -C "$BACKUP_DIR" "$backup_basename"

        # Verify compression
        if [[ -f "$compressed_file" ]]; then
            local original_size=$(du -sh "$CURRENT_BACKUP_DIR" | cut -f1)
            local compressed_size=$(du -sh "$compressed_file" | cut -f1)

            log_success "Backup compressed: $original_size → $compressed_size"

            # Remove uncompressed backup
            rm -rf "$CURRENT_BACKUP_DIR"
            CURRENT_BACKUP_PATH="$compressed_file"
        else
            log_error "Compression failed"
            exit 1
        fi
    else
        log_info "[DRY RUN] Would compress backup"
    fi
}

# Encrypt backup
encrypt_backup() {
    if [[ "$ENCRYPT" != "true" ]]; then
        return
    fi

    log_info "Encrypting backup..."

    if [[ "$DRY_RUN" == "false" ]]; then
        local backup_file="$CURRENT_BACKUP_PATH"
        local encrypted_file="${backup_file}.gpg"

        # Use GPG encryption with AES-256
        gpg --cipher-algo AES256 --compress-algo 2 --symmetric \
            --output "$encrypted_file" "$backup_file"

        if [[ -f "$encrypted_file" ]]; then
            log_success "Backup encrypted"

            # Remove unencrypted backup
            rm -f "$backup_file"
            CURRENT_BACKUP_PATH="$encrypted_file"
        else
            log_error "Encryption failed"
            exit 1
        fi
    else
        log_info "[DRY RUN] Would encrypt backup with GPG"
    fi
}

# Sync to remote storage
sync_remote() {
    if [[ "$REMOTE_SYNC" != "true" ]]; then
        return
    fi

    log_info "Syncing backup to remote storage..."

    if [[ "$DRY_RUN" == "false" ]]; then
        local backup_file="$CURRENT_BACKUP_PATH"
        local backup_name=$(basename "$backup_file")

        # S3 sync
        if [[ -n "$S3_BUCKET" ]]; then
            aws s3 cp "$backup_file" "s3://${S3_BUCKET}/ais-plugin/${backup_name}"
            log_info "Backup synced to S3: s3://${S3_BUCKET}/ais-plugin/${backup_name}"
        fi

        # GCS sync
        if [[ -n "$GCS_BUCKET" ]]; then
            gsutil cp "$backup_file" "gs://${GCS_BUCKET}/ais-plugin/${backup_name}"
            log_info "Backup synced to GCS: gs://${GCS_BUCKET}/ais-plugin/${backup_name}"
        fi

        # Azure sync
        if [[ -n "$AZURE_CONTAINER" ]]; then
            az storage blob upload \
                --file "$backup_file" \
                --container-name "$AZURE_CONTAINER" \
                --name "ais-plugin/${backup_name}"
            log_info "Backup synced to Azure: ${AZURE_CONTAINER}/ais-plugin/${backup_name}"
        fi

        log_success "Remote sync completed"
    else
        log_info "[DRY RUN] Would sync backup to remote storage"
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: $RETENTION_DAYS days)..."

    if [[ "$DRY_RUN" == "false" ]]; then
        # Local cleanup
        find "$BACKUP_DIR" -name "ais-backup-*" -type f -mtime +$RETENTION_DAYS -delete

        # Remote cleanup
        if [[ -n "$S3_BUCKET" ]]; then
            aws s3api list-objects-v2 \
                --bucket "$S3_BUCKET" \
                --prefix "ais-plugin/" \
                --query "Contents[?LastModified<='$(date -d "$RETENTION_DAYS days ago" -u +%Y-%m-%dT%H:%M:%SZ)'].Key" \
                --output text | \
                xargs -I {} aws s3 rm "s3://${S3_BUCKET}/{}"
        fi

        log_success "Old backups cleaned up"
    else
        log_info "[DRY RUN] Would clean up backups older than $RETENTION_DAYS days"
    fi
}

# Generate backup report
generate_report() {
    log_info "Generating backup report..."

    if [[ "$DRY_RUN" == "false" ]]; then
        local report_file="${BACKUP_DIR}/backup-report-$(date +%Y%m%d).txt"

        cat > "$report_file" <<EOF
AIS Plugin Backup Report
========================
Date: $(date)
Backup Type: $BACKUP_TYPE
Namespace: $NAMESPACE
Backup Path: $CURRENT_BACKUP_PATH

Backup Contents:
$(if [[ -f "$CURRENT_BACKUP_PATH" ]]; then
    if [[ "$CURRENT_BACKUP_PATH" == *.tar.gz ]]; then
        tar tzf "$CURRENT_BACKUP_PATH" | head -20
        echo "... (showing first 20 files)"
    else
        echo "Encrypted backup - contents not listed"
    fi
else
    echo "Backup file not found"
fi)

System Information:
- Kubernetes Version: $(kubectl version --short --client 2>/dev/null | grep Client || echo 'unknown')
- Cluster Info: $(kubectl cluster-info | head -1)
- Namespace Pods: $(kubectl get pods -n "$NAMESPACE" --no-headers | wc -l)

Backup Statistics:
- Start Time: $START_TIME
- End Time: $(date)
- Duration: $(($(date +%s) - $(date -d "$START_TIME" +%s))) seconds
- Compressed: $COMPRESS
- Encrypted: $ENCRYPT
- Remote Sync: $REMOTE_SYNC

EOF

        log_success "Backup report generated: $report_file"
    else
        log_info "[DRY RUN] Would generate backup report"
    fi
}

# Main backup function
main() {
    START_TIME=$(date)
    log_info "Starting AIS Plugin backup..."
    log_info "Backup type: $BACKUP_TYPE, Namespace: $NAMESPACE, DryRun: $DRY_RUN"

    validate_environment
    create_backup_structure

    case "$BACKUP_TYPE" in
        "full")
            backup_kubernetes
            backup_docker
            backup_data
            backup_logs
            backup_config
            ;;
        "incremental")
            backup_kubernetes
            backup_logs
            backup_config
            ;;
        "config-only")
            backup_kubernetes
            backup_config
            ;;
        *)
            log_error "Unknown backup type: $BACKUP_TYPE"
            exit 1
            ;;
    esac

    if [[ "$DRY_RUN" == "false" ]]; then
        compress_backup
        encrypt_backup
        sync_remote
        cleanup_old_backups
        generate_report

        log_success "AIS Plugin backup completed successfully!"
        log_info "Backup location: $CURRENT_BACKUP_PATH"
    else
        log_info "DRY RUN completed - no actual backup performed"
    fi
}

# Cleanup function for script termination
cleanup() {
    if [[ -n "${CURRENT_BACKUP_DIR:-}" && -d "$CURRENT_BACKUP_DIR" && "$DRY_RUN" == "false" ]]; then
        log_warning "Cleaning up incomplete backup: $CURRENT_BACKUP_DIR"
        rm -rf "$CURRENT_BACKUP_DIR"
    fi
}

# Trap for cleanup on script exit
trap cleanup EXIT

# Parse arguments and run main function
parse_args "$@"
main