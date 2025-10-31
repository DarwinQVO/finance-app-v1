# US Tax Logic - Expatriate Self-Employed Contractor

**Date**: October 31, 2025
**Status**: Reference Document
**Purpose**: Tax filing logic for US citizen working abroad as independent contractor

---

## 🧾 Taxpayer Profile

- **Citizenship**: US + Mexico (dual)
- **Tax Residence**: Mexico (permanent resident, lived entire year)
- **Work Status**: Independent contractor (self-employed) for foreign clients
- **Year**: 2024 (entire year)
- **Mexico Taxes**: Paid under RESICO regime
- **US Presence**: 0 days in US during tax year

---

## 📋 Income Summary

| Period | Activity | Income Type | US Filing |
|--------|----------|-------------|-----------|
| Jan-Dec 2024 | Independent contractor | Self-Employment Income | Schedule C + Schedule SE |

---

## 📄 Required US Tax Forms

| Form | Purpose | Status |
|------|---------|--------|
| **Form 1040** | Main federal tax return | REQUIRED |
| **Schedule C** | Report self-employment income & expenses | REQUIRED |
| **Schedule SE** | Calculate Self-Employment Tax (15.3%) | REQUIRED |
| **Form 2555** | Foreign Earned Income Exclusion (FEIE) | REQUIRED |
| **Form 1116** | Foreign Tax Credit for Mexico taxes | ❌ NOT USED |
| **FBAR (FinCEN 114)** | Report foreign accounts > $10k | REQUIRED (if applicable) |
| **Form 8938 (FATCA)** | Report foreign assets > threshold | REQUIRED (if applicable) |

---

## 🌍 International Tax Strategy

### ✅ Primary Strategy: FEIE (Form 2555)

**Exclusion Amount**: $126,500 USD (2024)

**Qualification Tests** (need to meet ONE):
1. **Physical Presence Test**: 330+ days outside US in 12-month period ✅
2. **Bona Fide Residence Test**: Permanent resident in Mexico ✅

**CRITICAL**: FEIE does NOT exempt Self-Employment Tax!

### ❌ NOT Using: Foreign Tax Credit (Form 1116)

**Reason**: Cannot claim FTC on income already excluded with FEIE.

**When FTC is useful**:
- Income exceeds $126,500 FEIE limit (use FTC on excess)
- Not using FEIE at all
- Has passive income (dividends, interest)

**Our case**: Income < $126,500, so FEIE alone is optimal.

---

## 💵 Self-Employment Tax (CRITICAL)

**Form**: Schedule SE

**Rate**: 15.3% total
- 12.4% Social Security
- 2.9% Medicare

**Threshold**: Applies if net profit > $400

**IMPORTANT**:
- ✅ FEIE excludes income from regular income tax
- ❌ FEIE does NOT exclude income from Self-Employment Tax
- You ALWAYS pay 15.3% on net profit, regardless of FEIE

**Example**:
```
Gross Income:     $80,000
Business Expenses: -$20,000
Net Profit:        $60,000

Self-Employment Tax = $60,000 × 15.3% = $9,180
Income Tax         = $0 (excluded by FEIE)
Total Tax Due      = $9,180
```

---

## 📅 Filing Deadlines

| Deadline | Description |
|----------|-------------|
| April 15, 2025 | Regular filing deadline |
| **June 17, 2025** | **Automatic extension (living abroad)** ✅ |
| October 15, 2025 | Extended deadline (with Form 4868) |

---

## 📝 Schedule C Deductible Expenses

### ✅ DEDUCTIBLE (Schedule C)

| Category | IRS Line | Notes |
|----------|----------|-------|
| Advertising | Line 8 | Marketing, ads, website |
| Car & Truck | Line 9 | **Requires mileage log** |
| Commissions & Fees | Line 10 | Stripe, PayPal fees |
| Contract Labor | Line 11 | Freelancers, VAs |
| Depletion | Line 12 | (Rarely applies) |
| Depreciation | Line 13 | **Requires Form 4562** |
| Employee Benefits | Line 14 | (If you have employees) |
| Insurance | Line 15 | Business insurance only |
| Interest | Line 16a-b | Business loans/credit cards |
| Legal & Professional | Line 17 | Accountant, lawyer fees |
| Office Expenses | Line 18 | Supplies, software, tools |
| Rent/Lease | Line 20a-b | Office rent (if not home office) |
| Repairs & Maintenance | Line 21 | Equipment repairs |
| Supplies | Line 22 | Office supplies |
| Taxes & Licenses | Line 23 | Business licenses, permits |
| Travel | Line 24a | **100% business travel** |
| Meals | Line 24b | **50% deductible** |
| Utilities | Line 25 | If separate business location |
| Home Office | Line 30 | **Requires Form 8829** |

### ❌ NOT DEDUCTIBLE (Schedule C)

| Expense | Why Not | Alternative |
|---------|---------|-------------|
| Health Insurance | Personal expense | Possible deduction on Form 1040 (self-employed health plan) |
| Charitable Donations | Personal | Schedule A (itemized deductions) |
| Personal Meals | Not business | Only 50% if business-related |
| Commuting | Personal | Only travel from home office to client |
| Personal Phone | Personal | Only business portion |
| Gym Membership | Personal | Unless specific job requirement |

### 🏠 Home Office (Form 8829)

**Requirements**:
- Exclusive use for business
- Regular use
- Principal place of business

**Methods**:
1. **Simplified**: $5/sqft (max 300 sqft = $1,500)
2. **Actual**: Calculate percentage of home used

---

## 🛠️ Tax Software Compatibility

### ✅ Can Use TurboTax Self-Employed

Handles:
- Form 1040
- Schedule C (self-employment income)
- Schedule SE (self-employment tax)
- Form 2555 (FEIE)
- ~~Form 1116 (FTC)~~ - Not needed

### ❌ Cannot Use TurboTax For

- **FBAR (FinCEN 114)**: File separately at [BSA E-Filing](https://bsaefiling.fincen.treas.gov)
- **Form 8938**: Some versions support it, check Premium/Self-Employed

---

## ✅ Tax Filing Checklist

### Before Filing
- [ ] Gather all 1099-NEC/MISC forms (if issued)
- [ ] Calculate total income from all clients
- [ ] Compile business expenses by category
- [ ] Get proof of Mexico tax paid (RESICO receipts)
- [ ] Verify 330+ days outside US (for FEIE)
- [ ] Check foreign bank account balances (FBAR threshold)

### Forms to File
- [ ] Form 1040 (main return)
- [ ] Schedule C (business income/expenses)
- [ ] Schedule SE (self-employment tax)
- [ ] Form 2555 (FEIE)
- [ ] FBAR (if accounts > $10k)
- [ ] Form 8938 (if assets > threshold)

### After Filing
- [ ] Save copies of all forms (7 years)
- [ ] Make quarterly estimated tax payments for next year
- [ ] Track expenses throughout year

---

## 📊 Estimated Tax Payments (For Next Year)

**Who must pay**: If you expect to owe > $1,000 in taxes

**Due dates** (2025):
- Q1: April 15
- Q2: June 15
- Q3: September 15
- Q4: January 15, 2026

**How to calculate**:
1. Estimate net profit for year
2. Calculate 15.3% Self-Employment Tax
3. Divide by 4 = quarterly payment

**Example**:
```
Expected net profit: $60,000
Self-Employment Tax: $9,180
Quarterly payment: $9,180 / 4 = $2,295
```

**Pay via**: [IRS Direct Pay](https://www.irs.gov/payments/direct-pay)

---

## 🚨 Common Mistakes to Avoid

1. ❌ **Not paying Self-Employment Tax** (thinking FEIE covers it)
2. ❌ **Claiming personal expenses as business**
3. ❌ **Missing FBAR deadline** (separate from tax return)
4. ❌ **Not making quarterly estimated payments**
5. ❌ **Mixing personal and business expenses**
6. ❌ **No documentation for deductions**

---

## 📞 Resources

- **IRS FEIE Guide**: [Publication 54](https://www.irs.gov/forms-pubs/about-publication-54)
- **Schedule C Instructions**: [IRS](https://www.irs.gov/forms-pubs/about-schedule-c-form-1040)
- **FBAR Filing**: [FinCEN BSA E-Filing](https://bsaefiling.fincen.treas.gov)
- **Estimated Payments**: [IRS Direct Pay](https://www.irs.gov/payments/direct-pay)

---

## 💡 Tax Strategy Notes

**Current approach**: Use FEIE to exclude up to $126,500, still pay Self-Employment Tax on net profit.

**Why not use Foreign Tax Credit?**
- Already using FEIE to exclude income
- Cannot double-dip (FTC on excluded income)
- Mexico RESICO taxes already paid

**If income > $126,500**:
- FEIE excludes first $126,500
- Pay regular income tax on excess
- Could use Form 1116 (FTC) on excess to offset with Mexico taxes paid

---

**Last Updated**: October 31, 2025
**Next Review**: January 2026 (for 2025 tax year)
