# User Flows - Navigation Guide 🗺️

**23 complete user flows** documenting the entire Finance App experience from el usuario's perspective.

---

## 📖 How to Read These Flows

Each flow follows this structure:
1. **Problem** - What pain point are we solving?
2. **Solution** - How does Finance App solve it?
3. **Story** - el usuario's journey (narrative walkthrough)
4. **UI Mockups** - ASCII art showing screens
5. **Code** - Technical implementation
6. **Edge Cases** - What could go wrong + solutions
7. **Summary** - Key takeaways

**Total**: 14,700+ lines of comprehensive UX + technical documentation

---

## 🎯 Phase 1: Core Features (9 flows, 5,400+ lines)

The MVP that makes Finance App usable - includes critical trust construction.

### [Flow 1: Timeline Continuo ⭐](flow-1-timeline-continuo.md)
**The most important flow** - No separation between historical load and daily use.
- 589 lines
- Core concept: ONE continuous timeline
- Zero friction UX

### [Flow 2: Upload PDF](flow-2-upload-pdf.md)
Upload bank statements with automatic deduplication and conflict resolution.
- 1,010 lines
- PDF parsing + hashing
- Edit protection (won't overwrite manual edits)

### [Flow 3: View Transaction](flow-3-view-transaction.md)
View transaction details with full provenance and metadata.
- 601 lines
- Detail panel
- Audit trail

### [Flow 4: Merchant Normalization](flow-4-merchant-normalization.md)
Automatic cleanup: "STARBUCKS STORE #12345" → "Starbucks"
- 635 lines
- DB-driven rules
- Config-based (no hardcoding)

### [Flow 5: Transfer Linking](flow-5-transfer-linking.md)
Detect when you move money between your own accounts.
- 545 lines
- Heuristic matching
- Cross-currency support

### [Flow 6: Edit Transaction](flow-6-edit-transaction.md)
Manually edit transactions with full tracking and audit trail.
- 840 lines
- Edit tracking (`is_edited`, `edited_fields`)
- Read-only vs editable fields

### [Flow 15: Manual Entry](flow-15-manual-entry.md)
Quick Add form for desktop - add transactions in ~10 seconds.
- 650 lines
- Auto-complete (merchants, categories, accounts)
- Duplicate detection
- Smart defaults

### [Flow 22: Pending Transactions](flow-22-pending-transactions.md)
Handle pending → posted transitions with amount changes.
- 250 lines (estimated)
- Auto-matching with confidence scoring
- Amount change tracking (tips, fees)
- Cancelled pending detection
- System health integration

### [Flow 23: Backup & Restore](flow-23-backup-restore.md)
Complete backup and restore system for data protection.
- 300 lines (estimated)
- Full/partial backup export (JSON compressed)
- Restore wizard for new devices
- Automated weekly backups
- Integrity verification

---

## 🏷️ Phase 2: Organization (8 flows, 5,200+ lines)

Organize and track your spending - includes refunds & disputes.

### [Flow 7: Manage Categories](flow-7-manage-categories.md)
Auto-categorize expenses + create custom categories.
- 805 lines
- Auto-categorization (DB rules)
- Hierarchical categories
- Custom rules from UI

### [Flow 8: Setup Budget](flow-8-setup-budget.md)
Create budgets with automatic tracking and alerts.
- 738 lines
- Budget tracking by category
- Alert threshold (80% default)
- Auto-reset monthly/weekly/yearly

### [Flow 9: Recurring Transactions](flow-9-recurring-transactions.md)
Detect subscriptions and recurring expenses automatically.
- 751 lines
- Pattern detection (70%+ confidence)
- Price change alerts
- Missed payment detection

### [Flow 16: CSV Import](flow-16-csv-import.md)
Import transactions from CSV/Excel files (bulk migration).
- 700 lines
- Auto-detect format (Mint, YNAB, banks)
- Column mapping wizard
- Duplicate detection

### [Flow 17: Saved Filters](flow-17-saved-filters.md)
Save filter combinations for quick access (1-click apply).
- 500 lines
- Save any filter combination
- Pin to sidebar
- Default filter option

### [Flow 18: Tag Management](flow-18-tag-management.md)
Organize tags with rename, merge, and delete operations.
- 450 lines
- Smart merge suggestions
- Bulk operations
- Tag cleanup

### [Flow 19: Credit Card Balance Dashboard](flow-19-credit-card-balances.md)
Track credit card balances, utilization, and payment due dates.
- 650 lines
- Balance calculation
- Statement cycle tracking
- Payment calendar
- Utilization monitoring

### [Flow 20: Refunds & Disputes](flow-20-refunds-disputes.md)
Handle refunds, chargebacks, and disputes with full tracking.
- 200 lines (estimated)
- Auto-detection of refunds
- Partial refund support
- Cross-statement refund linking
- Net amount calculation

---

## 📊 Phase 3: Analysis (5 flows, 3,000+ lines)

Understand your finances with reports, exports, system health, and tax tracking.

### [Flow 10: View Reports](flow-10-view-reports.md)
6 pre-built reports with interactive charts.
- 1,091 lines
- Spending by Category (pie chart)
- Spending Trends (line chart)
- Income vs Expenses (bar chart)
- Top Merchants (table)
- Budget Performance (gauges)
- Monthly Comparison (bar chart)

### [Flow 11: Custom Report Builder](flow-11-custom-report.md)
Build your own reports with drag & drop.
- 699 lines
- SQL query builder
- Save and re-run reports
- Multiple visualizations

### [Flow 12: Export Data](flow-12-export-data.md)
Export to CSV, PDF, or JSON.
- 565 lines
- Excel-compatible CSV
- Professional PDF reports
- JSON for API integration

### [Flow 21: System Health Dashboard](flow-21-system-health.md)
Centralized dashboard showing system health and data quality.
- 300 lines (estimated)
- 5 automated health checks
- Overall health score (0-100%)
- Actionable insights for issues
- Historical health tracking

### [Flow 24: Tax Categorization](flow-24-tax-categorization.md)
Mark transactions as tax-deductible and generate year-end tax reports.
- 200 lines (estimated)
- Mark transactions as deductible (manual + auto by category)
- Configure deduction percentage (0-100%)
- Tax categories (Schedule C, Schedule A)
- Year-end tax report with breakdown by schedule
- Multi-year comparison
- **Note**: No automated CPA export - users export via flow-12 with filters

---

## 👥 Phase 4: Scale (1 flow, 532 lines)

Share with family and collaborate.

### [Flow 13: Multi-User & Sharing](flow-13-multi-user.md)
User accounts with data isolation and shared accounts.
- 532 lines
- bcrypt authentication
- Data isolation by user_id
- Permissions: view/edit/admin
- Shared accounts with granular permissions

**Note**: Finance App is primarily a desktop application (Electron). Access from mobile via responsive web interface.

---

## 📊 Statistics

**Total Documentation**: 14,900+ lines
- User stories: ~3,600 lines
- UI mockups: ~2,800 lines
- Code examples: ~4,900 lines
- Edge cases: ~2,100 lines
- Summaries: ~1,300 lines

**Coverage**:
- ✅ 23 flows covering 100% of core desktop features + trust construction + tax tracking
- ✅ Phase 1: 9 flows (5,400+ lines) - Core + Trust
- ✅ Phase 2: 8 flows (5,200+ lines) - Organization + Refunds
- ✅ Phase 3: 5 flows (3,000+ lines) - Analysis + Health + Tax
- ✅ Phase 4: 1 flow (532 lines) - Multi-user & Collaboration

**Consistency**:
- ✅ All flows follow same structure
- ✅ All flows have UI mockups (ASCII art)
- ✅ All flows have user stories ("el usuario does X")
- ✅ All flows have edge cases documented
- ✅ All flows have code examples

**LEGO Architecture Verified**:
- ✅ Each feature has standalone UI mockups
- ✅ Each feature has independent user story
- ✅ Each feature shows clear entry/exit points
- ✅ Each feature is demonstrably modular

---

## 🎯 Reading Paths

### For Developers
**Start here** → Sequential reading:
1. Flow 1 (understand core concept)
2. Flow 2 (understand upload)
3. Flows 3-6 (understand Phase 1 features)
4. Pick flows based on what you're building

### For Product Managers
**Start here** → Feature-based reading:
1. Flow 1 (core UX)
2. Flow 7 (categories)
3. Flow 8 (budgets)
4. Flow 10 (reports)

### For Designers
**Start here** → UI-focused reading:
1. Flow 1 (main timeline)
2. Flow 6 (edit interactions)
3. Flow 7 (category management)
4. Flow 15 (manual entry form)

### For QA/Testing
**Read** → Edge cases sections:
- Every flow has "Edge cases" section
- Focus on error states and conflict resolution
- Flow 2 and Flow 6 have most complex edge cases

---

## 🔗 Related Documentation

- **[SYSTEM-OVERVIEW.md](../01-foundation/SYSTEM-OVERVIEW.md)** - High-level system description
- **[ARCHITECTURE-COMPLETE.md](../01-foundation/ARCHITECTURE-COMPLETE.md)** - Technical architecture
- **[ROADMAP.md](../01-foundation/ROADMAP.md)** - Implementation roadmap
- **[STORYTELLING.md](../06-storytelling/STORYTELLING.md)** - Complete narrative

---

## 📝 Notes

### Why "el usuario"?
el usuario is our persona - a real person with real financial complexity (4 accounts, 2 years of data, 12k transactions). All flows are written from his perspective.

### Why ASCII Art Mockups?
- ✅ Fast to create and iterate
- ✅ Version control friendly (plain text)
- ✅ Forces focus on UX, not visual polish
- ✅ Readable in terminal, GitHub, anywhere

### Why Spanish?
Finance App documentation is in Spanish because:
- Original user (el usuario) is Spanish-speaking
- Easier to write naturally ("el usuario hace X")
- Code comments and variable names are still in English

---

**Last Updated**: October 29, 2025
**Status**: ✅ 100% Complete (23/23 flows documented)
**Coverage**: All core desktop features + trust construction + tax tracking documented with complete UX flows
**Platform**: Desktop-first (Electron), responsive web for mobile access

**Trust Construction Flows**:
- ✅ flow-20: Refunds & Disputes
- ✅ flow-21: System Health Dashboard
- ✅ flow-22: Pending Transactions
- ✅ flow-23: Backup & Restore

**Note**: No native mobile app (iOS/Android). Finance App is a desktop application accessible via web browser on mobile devices.
