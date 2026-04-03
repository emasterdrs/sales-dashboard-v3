-- Plan-S: Super-Fast Aggregation Engine for VODA Dashboard (RPC)

-- 1. 연도별/월별 실적 추이용 (260,000건 -> 12건 압축 반환)
CREATE OR REPLACE FUNCTION get_yearly_trend(p_company_id UUID, p_year int)
RETURNS TABLE (month int, total numeric) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cast(extract(month from sales_date) as int) as month,
        coalesce(sum(amount), 0) as total
    FROM sales_records
    WHERE company_id = p_company_id 
      AND extract(year from sales_date) = p_year
    GROUP BY 1
    ORDER BY 1;
END;
$$ LANGUAGE plpgsql;

-- 2. 그룹별 총합 계산용 (모든 Level Drill-Down 대응)
CREATE OR REPLACE FUNCTION get_group_perf_summary(
    p_company_id UUID, p_start date, p_end date, p_group_type text, 
    p_filter_col text DEFAULT NULL, p_filter_val text DEFAULT NULL,
    p_filter_col2 text DEFAULT NULL, p_filter_val2 text DEFAULT NULL
)
RETURNS TABLE (id text, total numeric) AS $$
BEGIN
    IF p_group_type = 'division_id' THEN
        RETURN QUERY 
        SELECT coalesce(t.division_id::text, 'null') as id, coalesce(sum(r.amount), 0) as total 
        FROM sales_records r LEFT JOIN sales_teams t ON r.team_id = t.id 
        WHERE r.company_id = p_company_id AND r.sales_date >= p_start AND r.sales_date <= p_end 
        GROUP BY 1;
        
    ELSIF p_group_type = 'team_id' THEN
        RETURN QUERY 
        SELECT coalesce(team_id::text, 'null') as id, coalesce(sum(amount), 0) as total 
        FROM sales_records 
        WHERE company_id = p_company_id AND sales_date >= p_start AND sales_date <= p_end 
        GROUP BY 1;
        
    ELSIF p_group_type = 'staff_id' THEN
        RETURN QUERY 
        SELECT coalesce(staff_id::text, 'null') as id, coalesce(sum(amount), 0) as total 
        FROM sales_records 
        WHERE company_id = p_company_id AND sales_date >= p_start AND sales_date <= p_end 
          AND (p_filter_col IS NULL OR 
               (p_filter_col = 'team_id' AND team_id::text = p_filter_val) OR
               (p_filter_col = 'category_id' AND category_id::text = p_filter_val))
        GROUP BY 1;
        
    ELSIF p_group_type = 'category_id' THEN
        RETURN QUERY 
        SELECT coalesce(category_id::text, 'null') as id, coalesce(sum(amount), 0) as total 
        FROM sales_records 
        WHERE company_id = p_company_id AND sales_date >= p_start AND sales_date <= p_end 
        GROUP BY 1;
        
    ELSIF p_group_type = 'customer_name' THEN
        RETURN QUERY 
        SELECT coalesce(customer_name, 'null') as id, coalesce(sum(amount), 0) as total 
        FROM sales_records 
        WHERE company_id = p_company_id AND sales_date >= p_start AND sales_date <= p_end 
          AND (p_filter_col = 'staff_id' AND staff_id::text = p_filter_val)
          AND (p_filter_col2 IS NULL OR (p_filter_col2 = 'category_id' AND category_id::text = p_filter_val2))
        GROUP BY 1;
        
    ELSIF p_group_type = 'item_name' THEN
        RETURN QUERY 
        SELECT coalesce(item_name, 'null') as id, coalesce(sum(amount), 0) as total 
        FROM sales_records 
        WHERE company_id = p_company_id AND sales_date >= p_start AND sales_date <= p_end 
          AND (p_filter_col = 'staff_id' AND staff_id::text = p_filter_val)
          AND (p_filter_col2 = 'customer_name' AND customer_name = p_filter_val2)
        GROUP BY 1;
        
    ELSIF p_group_type = 'total' THEN
        RETURN QUERY 
        SELECT 'total' as id, coalesce(sum(amount), 0) as total 
        FROM sales_records 
        WHERE company_id = p_company_id AND sales_date >= p_start AND sales_date <= p_end;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 캐시 새로고침
NOTIFY pgrst, 'reload schema';
