#!/usr/bin/env bash
# ==============================================================================
# consolidate_sailing_almanac.sh — sailing-almanac Monorepo Consolidation
#
# Execution Environment: chantecler-01 VPS (Native Linux)
# ==============================================================================

set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

REPO="sailing-almanac"
SRC_SAILING_RECORDS="/home/aewoodyard/repos/sailing-records"
SRC_YACHT_SCORING="/home/aewoodyard/repos/yacht_scoring"
TARGET_DIR="/home/aewoodyard/repos/sailing-almanac"
BRANCH_NAME="refactor/sailing-almanac-monorepo-consolidation"

echo "=== STAX Fleet Monorepo Consolidation: Sailing Almanac ==="
echo "Repo:          ${REPO}"
echo "Target Dir:    ${TARGET_DIR}"
echo "Branch:        ${BRANCH_NAME}"
echo "=========================================================="

# 1. Rename sailing-records to sailing-almanac if not already renamed
if [ -d "${SRC_SAILING_RECORDS}" ] && [ ! -d "${TARGET_DIR}" ]; then
    echo "==> Renaming sailing-records to sailing-almanac..."
    mv "${SRC_SAILING_RECORDS}" "${TARGET_DIR}"
fi

cd "${TARGET_DIR}"

git checkout master
git checkout -B "${BRANCH_NAME}"

# Clean up any leftover remotes
git remote remove remote-yacht-scoring 2>/dev/null || true

TMP_DIR="$(mktemp -d /tmp/sailing-almanac-consolidation-XXXXXX)"
echo "Staging directory: ${TMP_DIR}"

# 2. Process yacht_scoring history
echo "==> Cloning and filtering yacht_scoring into apps/layline-scoring..."
git clone "${SRC_YACHT_SCORING}" "${TMP_DIR}/yacht-scoring-staging"
(
    cd "${TMP_DIR}/yacht-scoring-staging"
    git tag -l | while read -r tag; do
        if [ -n "$tag" ]; then
            git tag "layline-scoring/${tag}" "$tag"
            git tag -d "$tag"
        fi
    done
    git-filter-repo --to-subdirectory-filter apps/layline-scoring --force
)

# 3. Merge yacht_scoring history into sailing-almanac
echo "==> Merging yacht_scoring history into ${BRANCH_NAME}..."
git remote add remote-yacht-scoring "${TMP_DIR}/yacht-scoring-staging"
git fetch remote-yacht-scoring
git merge remote-yacht-scoring/main --allow-unrelated-histories -m "chore: merge yacht_scoring into apps/layline-scoring with full commit history" --no-edit
git remote remove remote-yacht-scoring
rm -rf "${TMP_DIR}"

# 4. Restructure sailing-records source files into packages/sailing-records
echo "==> Restructuring source trees..."
mkdir -p packages/sailing-records/src/sailing_records

for folder in ingestion analysis schema verify; do
    if [ -d "$folder" ]; then
        git mv "$folder" packages/sailing-records/src/sailing_records/
    fi
done

echo "============================================================"
echo "SUCCESS: sailing-almanac commit histories merged & tree restructured!"
echo "============================================================"
