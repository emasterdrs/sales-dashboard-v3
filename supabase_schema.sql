-- Sales Performance Dashboard - Supabase SQL Schema

-- 1. ENUMS & ROLES
CREATE TYPE public.user_role AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'USER');
CREATE TYPE public.company_status AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'SUSPENDED');
CREATE TYPE public.target_entity_type AS ENUM ('TEAM', 'STAFF', 'CATEGORY');

-- 2. TABLES
-- Companies (Tenants)
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    business_reg_no TEXT UNIQUE,
    business_reg_doc_url TEXT, -- Link to storage
    status public.company_status DEFAULT 'PENDING_APPROVAL',
    subscription_plan TEXT DEFAULT 'BASIC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles (Linked to Supabase Auth)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nickname TEXT,
    role public.user_role DEFAULT 'USER',
    company_id UUID REFERENCES public.companies(id),
    tel TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization: Sales Teams
CREATE TABLE public.sales_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization: Sales Staff
CREATE TABLE public.sales_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.sales_teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Hierarchy (2-level)
CREATE TABLE public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.product_categories(id),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Working Days Config
CREATE TABLE public.working_days_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL,
    total_days INT NOT NULL,
    holidays JSONB DEFAULT '[]'::JSONB, -- Array of holiday dates
    UNIQUE(company_id, year, month)
);

-- Sales Performance Data
CREATE TABLE public.sales_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.sales_staff(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    customer_name TEXT,
    item_name TEXT,
    amount BIGINT DEFAULT 0, -- Store in KRW
    sales_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    team_id UUID REFERENCES public.sales_teams(id) ON DELETE SET NULL, -- Added team_id for easier querying
    UNIQUE(company_id, staff_id, customer_name, item_name, sales_date)
);

-- Sales Targets
CREATE TABLE public.sales_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    entity_type public.target_entity_type NOT NULL,
    entity_id UUID NOT NULL, -- UUID of Team, Staff, or Category
    year INT NOT NULL,
    month INT NOT NULL,
    target_amount BIGINT DEFAULT 0,
    UNIQUE(company_id, entity_type, entity_id, year, month)
);

-- Inquiries (Board)
CREATE TABLE public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id),
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    answer_content TEXT,
    status TEXT DEFAULT 'OPEN', -- OPEN, CLOSED
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROW LEVEL SECURITY (RLS) policies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_days_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Super admin policy (Can do everything)
CREATE POLICY super_admin_all ON public.companies FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- Company isolation policies (Main logic)
CREATE POLICY company_isolation ON public.sales_teams FOR ALL USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY staff_isolation ON public.sales_staff FOR ALL USING (
    team_id IN (SELECT id FROM public.sales_teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY categories_isolation ON public.product_categories FOR ALL USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY performance_isolation ON public.sales_records FOR ALL USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY targets_isolation ON public.sales_targets FOR ALL USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY working_days_isolation ON public.working_days_config FOR ALL USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- Profile policy (Self and Super Admin)
CREATE POLICY profiles_policy ON public.profiles FOR ALL USING (
    id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- Inquiry logic (User's own or Super Admin)
CREATE POLICY inquiry_access ON public.inquiries FOR ALL USING (
    user_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- 4. FUNCTIONS & TRIGGERS
-- Function to automatically handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nickname)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'nickname');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
