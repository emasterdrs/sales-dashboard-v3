-- ==========================================
-- 1. Create Comprehensive sales_summary table
-- ==========================================

DROP TABLE IF EXISTS public.sales_summary;

CREATE TABLE public.sales_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    
    -- Dimensions (NULL = Total)
    division_id UUID,
    team_id UUID,
    staff_id UUID,
    category_id UUID,
    customer_name TEXT,
    item_name TEXT,
    
    -- Metrics
    goal BIGINT DEFAULT 0,
    performance BIGINT DEFAULT 0,
    ly_performance BIGINT DEFAULT 0,
    prev_performance BIGINT DEFAULT 0,
    ytd_performance BIGINT DEFAULT 0,
    expected_performance BIGINT DEFAULT 0,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Unique constraint for upsert/lookup
CREATE UNIQUE INDEX idx_sales_summary_unique ON public.sales_summary (
    company_id, year, month, 
    COALESCE(division_id, '00000000-0000-0000-0000-000000000000'::UUID), 
    COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::UUID), 
    COALESCE(staff_id, '00000000-0000-0000-0000-000000000000'::UUID), 
    COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::UUID), 
    COALESCE(customer_name, ''), 
    COALESCE(item_name, '')
);

-- Index for dashboard performance
CREATE INDEX IF NOT EXISTS idx_sales_summary_lookup 
ON public.sales_summary (company_id, year, month);

-- ==========================================
-- 2. Aggregation Logic Function (Multi-Dimensional Refresh)
-- ==========================================

CREATE OR REPLACE FUNCTION public.refresh_sales_summary(
    p_company_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_start_date DATE := TO_DATE(p_year || '-' || p_month || '-01', 'YYYY-MM-DD');
    v_end_date DATE := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_ly_offset INTERVAL := '1 year';
    
    v_total_wd INTEGER;
    v_current_wd INTEGER;
    v_progress_limit NUMERIC;
BEGIN
    -- 0. Context: Working Days
    SELECT total_days INTO v_total_wd 
    FROM working_days_config 
    WHERE company_id = p_company_id AND year = p_year AND month = p_month;
    
    IF v_total_wd IS NULL OR v_total_wd = 0 THEN v_total_wd := 21; END IF;

    -- Calculate current working days (up to today or month end)
    -- We'll use a simplified version for SQL
    IF CURRENT_DATE < v_start_date THEN
        v_current_wd := 0;
    ELSIF CURRENT_DATE > v_end_date THEN
        v_current_wd := v_total_wd;
    ELSE
        -- Count week days so far this month
        SELECT count(*) INTO v_current_wd
        FROM generate_series(v_start_date, LEAST(CURRENT_DATE, v_end_date), '1 day'::interval) AS d
        WHERE EXTRACT(DOW FROM d) NOT IN (0, 6);
    END IF;
    
    v_progress_limit := CASE WHEN v_total_wd > 0 THEN v_current_wd::NUMERIC / v_total_wd ELSE 0 END;

    -- 1. CLEAN UP existing for this month
    DELETE FROM public.sales_summary 
    WHERE company_id = p_company_id AND year = p_year AND month = p_month;

    -- 2. BASE: Insert Granular Combinations (from sales_records)
    -- We aggregate records grouped by all possible dimensions present in records
    INSERT INTO public.sales_summary (
        company_id, year, month, division_id, team_id, staff_id, category_id, customer_name, item_name, performance
    )
    SELECT 
        p_company_id, p_year, p_month, 
        t.division_id::UUID, r.team_id::UUID, r.staff_id::UUID, r.category_id::UUID, r.customer_name, r.item_name,
        SUM(r.amount)
    FROM public.sales_records r
    JOIN public.sales_teams t ON r.team_id = t.id
    WHERE r.company_id = p_company_id AND r.sales_date BETWEEN v_start_date AND v_end_date
    GROUP BY t.division_id, r.team_id, r.staff_id, r.category_id, r.customer_name, r.item_name;

    -- 3. CALCULATE AGGREGATES (ROLLUP SIMULATION)
    -- Insert higher-level totals (Company, Division, Team, Staff, Category)
    
    -- Company Total
    INSERT INTO public.sales_summary (company_id, year, month, performance)
    SELECT p_company_id, p_year, p_month, SUM(performance)
    FROM public.sales_summary 
    WHERE company_id = p_company_id AND year = p_year AND month = p_month 
    AND division_id IS NOT NULL; -- Avoid double counting if we had other totals

    -- Division Totals
    INSERT INTO public.sales_summary (company_id, year, month, division_id, performance)
    SELECT p_company_id, p_year, p_month, division_id, SUM(performance)
    FROM public.sales_summary 
    WHERE company_id = p_company_id AND year = p_year AND month = p_month AND team_id IS NOT NULL
    GROUP BY division_id;

    -- Team Totals
    INSERT INTO public.sales_summary (company_id, year, month, team_id, performance)
    SELECT p_company_id, p_year, p_month, team_id, SUM(performance)
    FROM public.sales_summary 
    WHERE company_id = p_company_id AND year = p_year AND month = p_month AND staff_id IS NOT NULL
    GROUP BY team_id;

    -- Staff Totals
    INSERT INTO public.sales_summary (company_id, year, month, staff_id, performance)
    SELECT p_company_id, p_year, p_month, staff_id, SUM(performance)
    FROM public.sales_summary 
    WHERE company_id = p_company_id AND year = p_year AND month = p_month AND customer_name IS NOT NULL
    GROUP BY staff_id;

    -- Category Totals
    INSERT INTO public.sales_summary (company_id, year, month, category_id, performance)
    SELECT p_company_id, p_year, p_month, category_id::UUID, SUM(performance)
    FROM public.sales_summary 
    WHERE company_id = p_company_id AND year = p_year AND month = p_month AND customer_name IS NOT NULL
    GROUP BY category_id;

    -- Staff per Category (for Type Mode Level 1)
    INSERT INTO public.sales_summary (company_id, year, month, staff_id, category_id, performance)
    SELECT p_company_id, p_year, p_month, staff_id::UUID, category_id::UUID, SUM(performance)
    FROM public.sales_summary 
    WHERE company_id = p_company_id AND year = p_year AND month = p_month AND customer_name IS NOT NULL
    GROUP BY staff_id, category_id;

    -- 4. ATTACH GOALS
    -- We update the summary rows with goals from sales_targets
    
    -- Team Goals (DIVISION targets skipped due to enum mismatch)
    UPDATE public.sales_summary s
    SET goal = t.target_amount
    FROM sales_targets t
    WHERE s.team_id = t.entity_id AND s.year = t.year AND s.month = t.month AND t.entity_type = 'TEAM'
    AND s.staff_id IS NULL;

    -- Staff Goals
    UPDATE public.sales_summary s
    SET goal = t.target_amount
    FROM sales_targets t
    WHERE s.staff_id = t.entity_id AND s.year = t.year AND s.month = t.month AND t.entity_type = 'STAFF'
    AND s.customer_name IS NULL;

    -- Category Goals
    UPDATE public.sales_summary s
    SET goal = t.target_amount
    FROM sales_targets t
    WHERE s.category_id = t.entity_id AND s.year = t.year AND s.month = t.month AND t.entity_type = 'CATEGORY'
    AND s.staff_id IS NULL;

    -- Company Total Goal (Sum of TEAM goals)
    UPDATE public.sales_summary
    SET goal = (SELECT SUM(goal) FROM public.sales_summary WHERE company_id = p_company_id AND year = p_year AND month = p_month AND team_id IS NOT NULL AND staff_id IS NULL)
    WHERE company_id = p_company_id AND year = p_year AND month = p_month AND division_id IS NULL AND category_id IS NULL;

    -- 5. CALCULATE EXPECTED PERFORMANCE
    UPDATE public.sales_summary
    SET expected_performance = CASE WHEN v_progress_limit > 0 THEN (performance / v_progress_limit) ELSE 0 END
    WHERE company_id = p_company_id AND year = p_year AND month = p_month;

    -- 6. ATTACH LAST YEAR PERFORMANCE (Simplified: only for totals)
    UPDATE public.sales_summary s
    SET ly_performance = (
        SELECT COALESCE(SUM(amount), 0) FROM sales_records 
        WHERE company_id = s.company_id AND sales_date BETWEEN v_start_date - v_ly_offset AND v_end_date - v_ly_offset
        -- We would need consistent grouping for perfect YoYs in all levels
        -- This is a placeholder for now
    )
    WHERE s.company_id = p_company_id AND s.year = p_year AND s.month = p_month;

END;
$$ LANGUAGE plpgsql;
