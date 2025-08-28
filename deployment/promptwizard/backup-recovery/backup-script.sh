#!/bin/bash

# @fileoverview Production backup script for PromptWizard deployment
# @lastmodified 2024-08-26T16:10:00Z
# 
# Features: Automated backup of databases, configurations, persistent volumes
# Main APIs: Database backup, file system backup, S3 upload, monitoring integration
# Constraints: Requires AWS CLI, kubectl, database access credentials
# Patterns: Full and incremental backups, retention policies, verification

set -euo pipefail

# Configuration
BACKUP_ROOT="/var/backups/promptwizard"
S3_BUCKET="promptwizard-backups"
RETENTION_DAYS=30
POSTGRES_DB="promptwizard"
REDIS_HOST="redis-master"
REDIS_PORT="6379"
NAMESPACE="promptwizard"

# Logging setup
LOGFILE="${BACKUP_ROOT}/logs/backup-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOGFILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

error() {
    log "ERROR: $*" >&2
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    for tool in kubectl aws pg_dump redis-cli tar gzip; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is not installed or not in PATH"
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
    fi
    
    # Check Kubernetes access
    if ! kubectl auth can-i get pods --namespace="$NAMESPACE" &> /dev/null; then
        error "Insufficient Kubernetes permissions for namespace $NAMESPACE"
    fi
    
    log "Prerequisites check completed"
}

# Create backup directory structure
setup_backup_dirs() {
    local backup_date=$(date +%Y%m%d-%H%M%S)
    BACKUP_DIR="${BACKUP_ROOT}/${backup_date}"
    
    mkdir -p "$BACKUP_DIR"/{database,redis,configs,volumes,logs}
    
    log "Created backup directory: $BACKUP_DIR"
}

# Backup PostgreSQL database
backup_database() {
    log "Starting database backup..."
    
    local db_backup="$BACKUP_DIR/database/promptwizard-$(date +%Y%m%d-%H%M%S).sql"
    
    # Get database credentials from Kubernetes secret
    local db_host=$(kubectl get secret promptwizard-secrets -n "$NAMESPACE" -o jsonpath='{.data.DB_HOST}' | base64 -d)
    local db_user=$(kubectl get secret promptwizard-secrets -n "$NAMESPACE" -o jsonpath='{.data.DB_USER}' | base64 -d)
    local db_password=$(kubectl get secret promptwizard-secrets -n "$NAMESPACE" -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
    
    # Create database dump
    PGPASSWORD="$db_password" pg_dump \
        --host="$db_host" \
        --username="$db_user" \
        --dbname="$POSTGRES_DB" \
        --verbose \
        --format=custom \
        --no-owner \
        --no-privileges \
        --file="$db_backup"
    
    # Verify backup integrity
    if PGPASSWORD="$db_password" pg_restore --list "$db_backup" &> /dev/null; then
        log "Database backup completed and verified: $db_backup"
    else
        error "Database backup verification failed"
    fi
    
    # Compress backup
    gzip "$db_backup"
    log "Database backup compressed: ${db_backup}.gz"
}

# Backup Redis data
backup_redis() {
    log "Starting Redis backup..."
    
    local redis_backup="$BACKUP_DIR/redis/redis-$(date +%Y%m%d-%H%M%S).rdb"
    
    # Get Redis password from secret
    local redis_password=$(kubectl get secret promptwizard-secrets -n "$NAMESPACE" -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d)
    
    # Create Redis backup using SAVE command
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$redis_password" --no-auth-warning BGSAVE
    
    # Wait for background save to complete
    local save_in_progress=1
    local timeout=300  # 5 minutes timeout
    local elapsed=0
    
    while [[ $save_in_progress -eq 1 && $elapsed -lt $timeout ]]; do
        sleep 5
        elapsed=$((elapsed + 5))
        
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$redis_password" --no-auth-warning lastsave | read -r timestamp; then
            if [[ $timestamp -gt $(date -d '1 minute ago' +%s) ]]; then
                save_in_progress=0
            fi
        fi
    done
    
    if [[ $save_in_progress -eq 1 ]]; then
        error "Redis backup timed out"
    fi
    
    # Copy RDB file from Redis container
    kubectl cp "$NAMESPACE/redis-master-0:/data/dump.rdb" "$redis_backup"
    
    # Verify backup
    if [[ -f "$redis_backup" && -s "$redis_backup" ]]; then
        gzip "$redis_backup"
        log "Redis backup completed: ${redis_backup}.gz"
    else
        error "Redis backup failed or is empty"
    fi
}

# Backup Kubernetes configurations
backup_configs() {
    log "Starting configuration backup..."
    
    local config_backup="$BACKUP_DIR/configs/k8s-configs-$(date +%Y%m%d-%H%M%S).yaml"
    
    # Backup all Kubernetes resources in namespace
    kubectl get all,configmaps,secrets,pvc,ingress,networkpolicies \
        --namespace="$NAMESPACE" \
        --output=yaml \
        --export > "$config_backup" 2>/dev/null || {
        # Fallback for newer kubectl versions without --export
        kubectl get all,configmaps,secrets,pvc,ingress,networkpolicies \
            --namespace="$NAMESPACE" \
            --output=yaml > "$config_backup"
    }
    
    # Remove managed fields and status
    kubectl neat < "$config_backup" > "${config_backup}.clean" 2>/dev/null || {
        # If kubectl neat is not available, use basic cleanup
        grep -v '^\s*resourceVersion:\|^\s*uid:\|^\s*selfLink:\|^\s*creationTimestamp:' "$config_backup" > "${config_backup}.clean"
    }
    
    mv "${config_backup}.clean" "$config_backup"
    
    # Compress configs
    gzip "$config_backup"
    log "Configuration backup completed: ${config_backup}.gz"
}

# Backup persistent volumes
backup_volumes() {
    log "Starting persistent volume backup..."
    
    local volumes_dir="$BACKUP_DIR/volumes"
    
    # Get all PVCs in namespace
    local pvcs=$(kubectl get pvc -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for pvc in $pvcs; do
        log "Backing up PVC: $pvc"
        
        # Create temporary pod to access PVC
        local backup_pod="backup-${pvc}-$(date +%s)"
        
        kubectl run "$backup_pod" \
            --image=alpine:3.14 \
            --restart=Never \
            --namespace="$NAMESPACE" \
            --overrides="{
                \"spec\": {
                    \"containers\": [{
                        \"name\": \"backup-pod\",
                        \"image\": \"alpine:3.14\",
                        \"command\": [\"sleep\", \"3600\"],
                        \"volumeMounts\": [{
                            \"name\": \"data\",
                            \"mountPath\": \"/data\"
                        }]
                    }],
                    \"volumes\": [{
                        \"name\": \"data\",
                        \"persistentVolumeClaim\": {
                            \"claimName\": \"$pvc\"
                        }
                    }]
                }
            }"
        
        # Wait for pod to be ready
        kubectl wait --for=condition=Ready pod/"$backup_pod" -n "$NAMESPACE" --timeout=300s
        
        # Create archive of volume data
        local volume_backup="$volumes_dir/${pvc}-$(date +%Y%m%d-%H%M%S).tar.gz"
        kubectl exec "$backup_pod" -n "$NAMESPACE" -- tar czf - -C /data . > "$volume_backup"
        
        # Cleanup backup pod
        kubectl delete pod "$backup_pod" -n "$NAMESPACE" --grace-period=0 --force
        
        log "Volume backup completed: $volume_backup"
    done
}

# Create backup manifest
create_manifest() {
    log "Creating backup manifest..."
    
    local manifest="$BACKUP_DIR/backup-manifest.json"
    
    cat > "$manifest" << EOF
{
    "backup_id": "$(basename "$BACKUP_DIR")",
    "timestamp": "$(date -Iseconds)",
    "namespace": "$NAMESPACE",
    "environment": "${ENVIRONMENT:-production}",
    "version": "$(kubectl get deployment promptwizard-service -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)",
    "components": {
        "database": {
            "type": "postgresql",
            "size_bytes": $(stat -c%s "$BACKUP_DIR"/database/*.gz 2>/dev/null || echo 0),
            "checksum": "$(md5sum "$BACKUP_DIR"/database/*.gz 2>/dev/null | cut -d' ' -f1 || echo 'none')"
        },
        "redis": {
            "type": "redis",
            "size_bytes": $(stat -c%s "$BACKUP_DIR"/redis/*.gz 2>/dev/null || echo 0),
            "checksum": "$(md5sum "$BACKUP_DIR"/redis/*.gz 2>/dev/null | cut -d' ' -f1 || echo 'none')"
        },
        "configs": {
            "type": "kubernetes",
            "size_bytes": $(stat -c%s "$BACKUP_DIR"/configs/*.gz 2>/dev/null || echo 0),
            "checksum": "$(md5sum "$BACKUP_DIR"/configs/*.gz 2>/dev/null | cut -d' ' -f1 || echo 'none')"
        },
        "volumes": {
            "type": "persistent-volumes",
            "count": $(ls -1 "$BACKUP_DIR"/volumes/*.tar.gz 2>/dev/null | wc -l),
            "total_size_bytes": $(du -sb "$BACKUP_DIR"/volumes/ 2>/dev/null | cut -f1 || echo 0)
        }
    },
    "backup_size_bytes": $(du -sb "$BACKUP_DIR" | cut -f1),
    "retention_until": "$(date -d "+$RETENTION_DAYS days" -Iseconds)"
}
EOF
    
    log "Backup manifest created: $manifest"
}

# Upload to S3
upload_to_s3() {
    log "Uploading backup to S3..."
    
    local backup_name=$(basename "$BACKUP_DIR")
    local s3_path="s3://$S3_BUCKET/backups/$backup_name/"
    
    # Upload with server-side encryption
    aws s3 sync "$BACKUP_DIR" "$s3_path" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 \
        --exclude "*.log" \
        --metadata "backup-date=$(date -Iseconds),environment=${ENVIRONMENT:-production}"
    
    # Verify upload
    local uploaded_size=$(aws s3 ls --recursive "$s3_path" --summarize | grep "Total Size" | awk '{print $3}')
    local local_size=$(du -sb "$BACKUP_DIR" | cut -f1)
    
    if [[ $uploaded_size -eq $local_size ]]; then
        log "Backup successfully uploaded to: $s3_path"
    else
        error "Upload verification failed: size mismatch (local: $local_size, S3: $uploaded_size)"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Local cleanup
    find "$BACKUP_ROOT" -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    
    # S3 cleanup
    aws s3 ls "s3://$S3_BUCKET/backups/" | while read -r line; do
        local backup_date=$(echo "$line" | awk '{print $2}' | tr -d '/')
        local backup_timestamp=$(date -d "$backup_date" +%s 2>/dev/null || echo 0)
        local retention_timestamp=$(date -d "$RETENTION_DAYS days ago" +%s)
        
        if [[ $backup_timestamp -lt $retention_timestamp ]]; then
            log "Removing old backup: $backup_date"
            aws s3 rm "s3://$S3_BUCKET/backups/$backup_date/" --recursive
        fi
    done
    
    log "Old backup cleanup completed"
}

# Send monitoring alert
send_monitoring_alert() {
    local status="$1"
    local message="$2"
    
    # Send to monitoring system (example: webhook)
    if [[ -n "${MONITORING_WEBHOOK_URL:-}" ]]; then
        curl -X POST "$MONITORING_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"status\": \"$status\",
                \"service\": \"promptwizard-backup\",
                \"message\": \"$message\",
                \"timestamp\": \"$(date -Iseconds)\",
                \"backup_id\": \"$(basename "${BACKUP_DIR:-unknown}")\"
            }" || log "Failed to send monitoring alert"
    fi
}

# Main execution
main() {
    log "Starting PromptWizard backup process..."
    
    trap 'send_monitoring_alert "failed" "Backup process failed"; exit 1' ERR
    
    check_prerequisites
    setup_backup_dirs
    
    # Perform backups
    backup_database
    backup_redis
    backup_configs
    backup_volumes
    
    # Finalize
    create_manifest
    upload_to_s3
    cleanup_old_backups
    
    local backup_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "Backup process completed successfully. Total size: $backup_size"
    
    send_monitoring_alert "success" "Backup completed successfully (size: $backup_size)"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi