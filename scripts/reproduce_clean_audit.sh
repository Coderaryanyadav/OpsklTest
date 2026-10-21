#!/usr/bin/env bash
# ==============================================================================
# OPSKL FRESH REPRODUCIBLE AUDIT SUITE
# Captures exact runtime environment, executes full verification pipeline,
# and outputs authoritative exit codes for audit reproducibility.
# ==============================================================================

set -u

echo "======================================================================"
echo "  OPSKIL CLEAN REPRODUCIBLE VERIFICATION SUITE"
echo "======================================================================"
echo "Execution Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Host OS:             $(uname -s) $(uname -r) ($(uname -m))"
echo "Node Version:        $(node -v 2>&1 || echo 'Node not found')"
echo "NPM Version:         $(npm -v 2>&1 || echo 'NPM not found')"
echo "Git Commit:          $(git rev-parse --short HEAD 2>&1 || echo 'No git commit')"
echo "Git Branch:          $(git rev-parse --abbrev-ref HEAD 2>&1 || echo 'No git branch')"
echo "======================================================================"
echo ""

EXIT_TYPECHECK=0
EXIT_LINT=0
EXIT_UNIT_TESTS=0
EXIT_SQL_TESTS=0
EXIT_ALL_FEATURES=0

echo ">>> [1/5] RUNNING MONOREPO TYPECHECK..."
npm run typecheck
EXIT_TYPECHECK=$?
echo "Exit Code: $EXIT_TYPECHECK"
echo ""

echo ">>> [2/5] RUNNING MONOREPO ESLINT..."
npm run lint
EXIT_LINT=$?
echo "Exit Code: $EXIT_LINT"
echo ""

echo ">>> [3/5] RUNNING MONOREPO UNIT & INTEGRATION TESTS..."
npm test
EXIT_UNIT_TESTS=$?
echo "Exit Code: $EXIT_UNIT_TESTS"
echo ""

echo ">>> [4/5] RUNNING SQL INVARIANTS & POSTGRESQL CATALOG TESTS..."
npm run test:sql
EXIT_SQL_TESTS=$?
echo "Exit Code: $EXIT_SQL_TESTS"
echo ""

echo ">>> [5/5] RUNNING FULL PLATFORM HEALTH AUDIT (READ-ONLY SAFE)..."
node scripts/check_all_features.mjs
EXIT_ALL_FEATURES=$?
echo "Exit Code: $EXIT_ALL_FEATURES"
echo ""

echo "======================================================================"
echo "  REPRODUCIBILITY AUDIT SUMMARY"
echo "======================================================================"
echo "  Typecheck:               Exit Code $EXIT_TYPECHECK"
echo "  Lint:                    Exit Code $EXIT_LINT"
echo "  Unit & Integration:      Exit Code $EXIT_UNIT_TESTS"
echo "  SQL Catalog & Invariants:Exit Code $EXIT_SQL_TESTS"
echo "  Full Platform Audit:     Exit Code $EXIT_ALL_FEATURES"
echo "======================================================================"

TOTAL_FAILS=$((EXIT_TYPECHECK + EXIT_LINT + EXIT_UNIT_TESTS + EXIT_SQL_TESTS + EXIT_ALL_FEATURES))
if [ "$TOTAL_FAILS" -eq 0 ]; then
  echo ">>> VERDICT: 100% PASS - ALL VERIFICATION SUITES PASSED CLEANLY."
  exit 0
else
  echo ">>> VERDICT: FAIL - ONE OR MORE CHECKS FAILED."
  exit 1
fi
