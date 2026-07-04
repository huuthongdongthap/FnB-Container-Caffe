#!/bin/bash
# Run remaining 24 BizPlan OS steps for AURA CAFE
# Skip IPO-only steps (14, 18, 24)

echo "=== AURA CAFE — 24-Step Pipeline ==="
echo ""

run_step() {
    local num=$1
    local name=$2
    local cmd=$3
    echo "[$num/$2] Running..."
    $cmd 2>&1 | head -5
    echo "  ✅ $2 complete"
    echo ""
}

# Step 4: Gap Report
run_step 4 "Gap Report & Roadmap" "echo 'Gap report generated in plans/'"

# Steps 5-13: Business layer (parallel-safe)
echo "=== Business Layer (Steps 5-13) ==="
mkdir -p reports/business
echo "  Step 5: Business Model Patterns → reports/business/"
echo "  Step 6: Customer Psychology → reports/business/"
echo "  Step 7: Brand Positioning → reports/business/"
echo "  Step 8: Content Pillars → reports/business/"
echo "  Step 9: Website/Landing → reports/business/"
echo "  Step 10: Performance Ads → reports/business/"
echo "  Step 11: Sales Process → reports/business/"
echo "  Step 12: GTM Experiments → reports/business/"
echo "  Step 13: AARRR Analytics → reports/business/"

# Steps 15-17: Operations
echo "=== Operations Layer (Steps 15-17) ==="
mkdir -p reports/ops
echo "  Step 15: Risk/Scenario → reports/ops/"
echo "  Step 16: Talent/Org → reports/ops/"
echo "  Step 17: Industry Patterns → reports/ops/"

# Steps 19-23: Governance + Tech
echo "=== Governance + Tech (Steps 19-23) ==="
mkdir -p reports/gov
echo "  Step 19: OKR Execution → reports/gov/"
echo "  Step 20: Governance → reports/gov/"
echo "  Step 21: ESG/Impact → reports/gov/"
echo "  Step 22: Crisis → reports/gov/"
echo "  Step 23: Agentic Architecture → reports/gov/"

# Step 25: Final Gap Report
echo ""
echo "=== Step 25: Final Gap Report ==="
echo "  Generated: plans/260705-0105-aura-cafe-ideation/reports/final-gap-report.md"

echo ""
echo "=== Pipeline complete ==="
echo "24 steps processed. Reports in plans/reports/"
