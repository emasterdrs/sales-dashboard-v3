# Sales Performance Dashboard - Implementation Summary

This project is a high-end, secure SaaS Sales Performance Dashboard designed for business-level analytics. It features a premium UI, robust security protocols, and advanced reporting features like multi-level drill-down and automated working day tracking.

## 🚀 Key Features Implemented

### 1. Advanced Dashboard
- **Dynamic Header**: Automatically displays current month/year titles (e.g., `2026년 3월 매출실적`).
- **Core KPIs**: Large visual cards for Goals, Performance, Achievement %, and Progress GAP.
- **Drill-Down Navigation**: Interactively explore data across 4 levels:
    - `Sales Team` → `Staff` → `Client` → `Product Item`.
- **Breadcrumbs**: Integrated navigation path display that allows jumping back to any previous level.
- **Expected Closing Toggle**: A dedicated ON/OFF toggle that projects final month outcomes based on current progress.

### 2. Specialized Settings
- **Working Days Management**: Calendar-based manager that automatically calculates total working days.
    - Excludes weekends (Sat, Sun) by default.
    - Allows manual holiday toggling (e.g., elections, public holidays).
    - Real-time impact on progress rate (%) and GAP analysis.

### 3. Security & Privacy (SaaS Hardened)
- **Supabase RLS (Mandatory)**: Row Level Security ensures users can only access their own company's data.
- **Obfuscated Routing**: Critical areas like admin panels use non-predictable URL paths (Requirement: `/adm-s-2s9k2`).
- **Middleware Guards**: Route protection logic that checks authentication and company approval status before rendering.
- **Error Sanitization**: Custom handlers redact database table names, stack traces, and system paths from user-facing consoles.
- **Server-Side Validation**: Placeholder logic for payment and target validation to prevent client-side manipulation.

## 🛠️ Setup Instructions

### 1. Database Setup (Supabase)
1. Log in to your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** and create a new query.
3. Copy and execute the contents of `supabase_schema.sql` located in the root directory.
4. **Important**: This script enables RLS, creates enums, and sets up triggers for profile creation.

### 2. Environment Variables
1. Rename `.env.example` to `.env`.
2. Enter your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase Settings.

### 3. Running the App
```bash
npm install
npm run dev
```

## 🔒 Security Policy
All company data is protected via Supabase RLS policies. No unauthorized cross-tenant data access is possible at the database kernel level. Administrative actions are logged for security auditing.
