#!/bin/bash

# @fileoverview Production recovery script for PromptWizard deployment
# @lastmodified 2024-08-26T16:15:00Z
# 
# Features: Complete disaster recovery, point-in-time restore, validation procedures
# Main APIs: Database restore, volume restore, configuration restoration, service verification
# Constraints: Requires backup availability, proper access credentials, downtime window
# Patterns: Step-by-step recovery, validation checks, rollback capabilities

set -euo pipefail

# Configuration
BACKUP_ROOT="/var/backups/promptwizard"
S3_BUCKET="promptwizard-backups"
NAMESPACE="promptwizard"
RECOVERY_TIMEOUT=1800  # 30 minutes

# Command line arguments
BACKUP_ID="${1:-}"
RESTORE_TYPE="${2:-full}"  # full, database-only, config-only, volume-only
DRY_RUN="${3:-false}"

# Logging setup
LOGFILE="/var/log/promptwizard-recovery-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOGFILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

error() {
    log "ERROR: $*" >&2
    exit 1
}

warn() {
    log "WARNING: $*" >&2
}

# Display usage information
usage() {
    cat << EOF
Usage: $0 <backup_id> [restore_type] [dry_run]

Arguments:
    backup_id       Backup ID to restore from (required)
    restore_type    Type of restore: full, database-only, config-only, volume-only (default: full)
    dry_run         Set to 'true' for validation without actual restore (default: false)

Examples:
    $0 20240826-143022                    # Full restore
    $0 20240826-143022 database-only      # Database only
    $0 20240826-143022 full true          # Dry run validation

Available backups:
EOF
    list_available_backups | head -10
}

# List available backups
list_available_backups() {
    log "Listing available backups..."
    
    # Check local backups
    if [[ -d "$BACKUP_ROOT" ]]; then
        echo "Local backups:"
        ls -1t "$BACKUP_ROOT" | head -20
    fi
    
    # Check S3 backups
    if aws s3 ls "s3://$S3_BUCKET/backups/" &>/dev/null; then
        echo -e "\nS3 backups:"
        aws s3 ls "s3://$S3_BUCKET/backups/" | awk '{print $2}' | tr -d '/' | head -20
    fi
}

# Validate backup ID and download if needed
prepare_backup() {
    local backup_dir="$BACKUP_ROOT/$BACKUP_ID"
    
    # Check if backup exists locally
    if [[ -d "$backup_dir" ]]; then
        log "Using local backup: $backup_dir"
        BACKUP_PATH="$backup_dir"
        return 0
    fi
    
    # Download from S3
    log "Downloading backup from S3..."
    local s3_path="s3://$S3_BUCKET/backups/$BACKUP_ID/"
    
    if ! aws s3 ls "$s3_path" &>/dev/null; then
        error "Backup $BACKUP_ID not found in S3"
    fi
    
    mkdir -p "$backup_dir"
    aws s3 sync "$s3_path" "$backup_dir/" --quiet
    
    BACKUP_PATH="$backup_dir"
    log "Backup downloaded to: $BACKUP_PATH"
}

# Validate backup integrity
validate_backup() {
    log "Validating backup integrity..."
    
    local manifest="$BACKUP_PATH/backup-manifest.json"
    
    if [[ ! -f "$manifest" ]]; then
        error "Backup manifest not found: $manifest"
    fi
    
    # Validate backup components
    local database_backup=$(find "$BACKUP_PATH/database" -name "*.gz" -type f | head -1)
    local redis_backup=$(find "$BACKUP_PATH/redis" -name "*.gz" -type f | head -1)
    local config_backup=$(find "$BACKUP_PATH/configs" -name "*.gz" -type f | head -1)
    
    [[ -f "$database_backup" ]] || warn "Database backup file not found"
    [[ -f "$redis_backup" ]] || warn "Redis backup file not found"
    [[ -f "$config_backup" ]] || warn "Config backup file not found"
    
    # Verify checksums if available
    if command -v jq &>/dev/null && [[ -f "$manifest" ]]; then
        local db_checksum=$(jq -r '.components.database.checksum' "$manifest")
        if [[ "$db_checksum" != "null" && "$db_checksum" != "none" ]]; then
            local actual_checksum=$(md5sum "$database_backup" | cut -d' ' -f1)
            if [[ "$actual_checksum" != "$db_checksum" ]]; then
                error "Database backup checksum mismatch"
            fi
        fi
    fi
    
    log "Backup validation completed"
}

# Create pre-recovery snapshot
create_pre_recovery_snapshot() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would create pre-recovery snapshot"
        return 0
    fi
    
    log "Creating pre-recovery snapshot..."
    
    local snapshot_dir="/var/backups/promptwizard/pre-recovery-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$snapshot_dir"
    
    # Snapshot current configurations
    kubectl get all,configmaps,secrets,pvc,ingress,networkpolicies \
        --namespace="$NAMESPACE" \
        --output=yaml > "$snapshot_dir/current-state.yaml"
    
    log "Pre-recovery snapshot created: $snapshot_dir"
    echo "$snapshot_dir" > /tmp/promptwizard-recovery-snapshot
}

# Scale down services
scale_down_services() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would scale down services"
        return 0
    fi
    
    log "Scaling down services for recovery..."
    
    # Scale down main deployment
    kubectl scale deployment promptwizard-service --replicas=0 -n "$NAMESPACE"
    
    # Wait for pods to terminate
    kubectl wait --for=delete pod -l app=promptwizard -n "$NAMESPACE" --timeout=300s
    
    log "Services scaled down successfully"
}

# Scale up services
scale_up_services() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would scale up services"
        return 0
    fi
    
    log "Scaling up services after recovery..."
    
    # Scale up main deployment
    kubectl scale deployment promptwizard-service --replicas=3 -n "$NAMESPACE"
    
    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=promptwizard -n "$NAMESPACE" --timeout=600s
    
    log "Services scaled up successfully"
}

# Restore database
restore_database() {
    log "Starting database restore..."
    
    local db_backup=$(find "$BACKUP_PATH/database" -name "*.gz" -type f | head -1)
    
    if [[ ! -f "$db_backup" ]]; then
        error "Database backup file not found"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would restore database from: $db_backup"
        return 0
    fi
    
    # Get database credentials
    local db_host=$(kubectl get secret promptwizard-secrets -n "$NAMESPACE" -o jsonpath='{.data.DB_HOST}' | base64 -d)
    local db_user=$(kubectl get secret promptwizard-secrets -n "$NAMESPACE" -o jsonpath='{.data.DB_USER}' | base64 -d)
    local db_password=$(kubectl get secret promptwizard-secrets -n "$NAMESPACE" -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
    
    # Decompress backup
    local temp_backup="/tmp/promptwizard-restore-$(date +%s).sql"
    gunzip -c "$db_backup" > "$temp_backup"
    
    # Drop existing database and recreate
    PGPASSWORD="$db_password" dropdb --if-exists --host="$db_host" --username="$db_user" promptwizard
    PGPASSWORD="$db_password" createdb --host="$db_host" --username="$db_user" promptwizard
    
    # Restore database
    PGPASSWORD="$db_password" pg_restore \
        --host="$db_host" \
        --username="$db_user" \
        --dbname=promptwizard \
        --verbose \
        --no-owner \
        --no-privileges \
        "$temp_backup"
    
    # Cleanup
    rm -f "$temp_backup"
    
    log "Database restore completed"
}

# Restore Redis data
restore_redis() {
    log "Starting Redis restore..."
    
    local redis_backup=$(find "$BACKUP_PATH/redis" -name "*.gz" -type f | head -1)
    
    if [[ ! -f "$redis_backup" ]]; then
        error "Redis backup file not found"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would restore Redis from: $redis_backup"
        return 0
    fi
    
    # Get Redis password
    local redis_password=$(kubectl get secret promptwizard-secrets -n "$NAMESPACE" -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d)
    
    # Decompress backup
    local temp_rdb="/tmp/restore-dump.rdb"
    gunzip -c "$redis_backup" > "$temp_rdb"
    
    # Stop Redis temporarily
    kubectl scale statefulset redis-master --replicas=0 -n "$NAMESPACE"
    kubectl wait --for=delete pod -l app=redis,role=master -n "$NAMESPACE" --timeout=300s
    
    # Copy restore file to Redis volume
    kubectl run redis-restore --image=redis:7-alpine --restart=Never -n "$NAMESPACE" \
        --overrides="{
            \"spec\": {
                \"containers\": [{
                    \"name\": \"redis-restore\",
                    \"image\": \"redis:7-alpine\",
                    \"command\": [\"sleep\", \"3600\"],
                    \"volumeMounts\": [{
                        \"name\": \"redis-data\",
                        \"mountPath\": \"/data\"
                    }]
                }],
                \"volumes\": [{
                    \"name\": \"redis-data\",
                    \"persistentVolumeClaim\": {
                        \"claimName\": \"redis-master-data\"
                    }
                }]
            }
        }"
    
    kubectl wait --for=condition=Ready pod/redis-restore -n "$NAMESPACE" --timeout=300s
    kubectl cp "$temp_rdb" "$NAMESPACE/redis-restore:/data/dump.rdb"
    kubectl delete pod redis-restore -n "$NAMESPACE" --grace-period=0 --force
    
    # Start Redis
    kubectl scale statefulset redis-master --replicas=1 -n "$NAMESPACE"
    kubectl wait --for=condition=ready pod -l app=redis,role=master -n "$NAMESPACE" --timeout=300s
    
    # Cleanup
    rm -f "$temp_rdb"
    
    log "Redis restore completed"
}

# Restore configurations
restore_configs() {
    log "Starting configuration restore..."
    
    local config_backup=$(find "$BACKUP_PATH/configs" -name "*.gz" -type f | head -1)
    
    if [[ ! -f "$config_backup" ]]; then
        error "Configuration backup file not found"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would restore configurations from: $config_backup"
        return 0
    fi
    
    # Decompress configs
    local temp_config="/tmp/promptwizard-configs-$(date +%s).yaml"
    gunzip -c "$config_backup" > "$temp_config"
    
    # Apply configurations (excluding some resources that shouldn't be restored)
    kubectl apply -f "$temp_config" --prune --all --prune-whitelist-resource=core/v1/ConfigMap \
        --prune-whitelist-resource=core/v1/Secret --prune-whitelist-resource=apps/v1/Deployment
    
    # Cleanup
    rm -f "$temp_config"
    
    log "Configuration restore completed"
}

# Restore persistent volumes
restore_volumes() {
    log "Starting volume restore..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would restore persistent volumes"
        return 0
    fi
    
    # Find volume backups
    local volume_backups=$(find "$BACKUP_PATH/volumes" -name "*.tar.gz" -type f)
    
    for volume_backup in $volume_backups; do
        local pvc_name=$(basename "$volume_backup" .tar.gz | sed 's/-[0-9]\{8\}-[0-9]\{6\}$//')
        
        log "Restoring PVC: $pvc_name from $volume_backup"
        
        # Create restore pod
        local restore_pod="restore-${pvc_name}-$(date +%s)"
        
        kubectl run "$restore_pod" --image=alpine:3.14 --restart=Never -n "$NAMESPACE" \
            --overrides="{
                \"spec\": {
                    \"containers\": [{
                        \"name\": \"restore-pod\",
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
                            \"claimName\": \"$pvc_name\"
                        }
                    }]
                }
            }"
        
        kubectl wait --for=condition=Ready "pod/$restore_pod" -n "$NAMESPACE" --timeout=300s
        
        # Clear existing data and restore
        kubectl exec "$restore_pod" -n "$NAMESPACE" -- rm -rf /data/*
        kubectl exec -i "$restore_pod" -n "$NAMESPACE" -- tar xzf - -C /data < "$volume_backup"
        
        # Cleanup
        kubectl delete pod "$restore_pod" -n "$NAMESPACE" --grace-period=0 --force
        
        log "Volume restore completed for PVC: $pvc_name"
    done
}

# Verify restoration
verify_restoration() {
    log "Verifying restoration..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would verify restoration"
        return 0
    fi
    
    local max_attempts=30
    local attempt=1
    
    # Wait for service to be healthy
    while [[ $attempt -le $max_attempts ]]; do
        if kubectl get pods -l app=promptwizard -n "$NAMESPACE" | grep -q "Running"; then
            # Check health endpoint
            local pod_name=$(kubectl get pods -l app=promptwizard -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}')
            
            if kubectl exec "$pod_name" -n "$NAMESPACE" -- wget -q -O- http://localhost:8000/api/v1/health | grep -q "healthy"; then
                log "Service verification successful"
                return 0
            fi
        fi
        
        log "Waiting for service to be healthy (attempt $attempt/$max_attempts)..."
        sleep 10
        ((attempt++))
    done
    
    error "Service verification failed after $max_attempts attempts"
}

# Cleanup after recovery
cleanup_recovery() {
    log "Cleaning up recovery artifacts..."
    
    # Remove temporary files
    rm -rf /tmp/promptwizard-*
    
    # Keep recovery logs but compress them
    if [[ -f "$LOGFILE" ]]; then
        gzip "$LOGFILE"
        log "Recovery log compressed: ${LOGFILE}.gz"
    fi
}

# Rollback recovery if needed
rollback_recovery() {
    warn "Rolling back recovery due to failure..."
    
    if [[ -f "/tmp/promptwizard-recovery-snapshot" ]]; then
        local snapshot_dir=$(cat /tmp/promptwizard-recovery-snapshot)
        
        if [[ -f "$snapshot_dir/current-state.yaml" ]]; then
            log "Restoring pre-recovery state from: $snapshot_dir"
            kubectl apply -f "$snapshot_dir/current-state.yaml"
        fi
    fi
    
    error "Recovery rolled back"
}

# Main recovery orchestration
main() {
    if [[ -z "$BACKUP_ID" ]]; then
        usage
        exit 1
    fi
    
    log "Starting PromptWizard recovery process..."
    log "Backup ID: $BACKUP_ID, Restore Type: $RESTORE_TYPE, Dry Run: $DRY_RUN"
    
    # Setup error handling
    trap 'rollback_recovery' ERR
    
    # Prepare for recovery
    prepare_backup
    validate_backup
    create_pre_recovery_snapshot
    
    # Stop services for restore
    if [[ "$RESTORE_TYPE" == "full" || "$RESTORE_TYPE" == "database-only" ]]; then
        scale_down_services
    fi
    
    # Perform restoration based on type
    case "$RESTORE_TYPE" in
        "full")
            restore_database
            restore_redis
            restore_configs
            restore_volumes
            ;;
        "database-only")
            restore_database
            ;;
        "config-only")
            restore_configs
            ;;
        "volume-only")
            restore_volumes
            ;;
        *)
            error "Invalid restore type: $RESTORE_TYPE"
            ;;
    esac
    
    # Restart services and verify
    if [[ "$RESTORE_TYPE" == "full" || "$RESTORE_TYPE" == "database-only" ]]; then
        scale_up_services
        verify_restoration
    fi
    
    cleanup_recovery
    
    log "Recovery process completed successfully"
    
    # Send notification
    if [[ -n "${MONITORING_WEBHOOK_URL:-}" ]]; then
        curl -X POST "$MONITORING_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"status\": \"success\",
                \"service\": \"promptwizard-recovery\",
                \"message\": \"Recovery completed successfully\",
                \"backup_id\": \"$BACKUP_ID\",
                \"restore_type\": \"$RESTORE_TYPE\",
                \"timestamp\": \"$(date -Iseconds)\"
            }" || log "Failed to send recovery notification"
    fi
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi