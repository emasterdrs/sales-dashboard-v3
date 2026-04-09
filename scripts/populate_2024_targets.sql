-- 2024년 테스트용 목표 데이터 생성 및 집계 리프레시 스크립트 (v2.2 - "DIVISION" ENUM 오류 해결)
-- 이 스크립트는 Supabase SQL Editor에서 실행하는 것을 권장합니다.
-- DB 스키마에 "DIVISION"이 정의되어 있지 않은 경우를 대비하여 삭제하고 팀/사원 목표 중심으로 구성했습니다.

DO $$ 
DECLARE 
    v_target_email TEXT := 'emasterdrs@gmail.com'; -- 대상 사용자 이메일
    v_company_id UUID;
    v_year INTEGER := 2024;
    v_month INTEGER;
    v_staff_id UUID;
    v_team_id UUID;
BEGIN
    -- 1. 사용자 이메일을 기반으로 Company ID 조회
    SELECT company_id INTO v_company_id FROM public.profiles WHERE email = v_target_email;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION '사용자(%)를 찾을 수 없거나 소속회사가 없습니다.', v_target_email;
    END IF;

    RAISE NOTICE '--- % (CompanyID: %) 2024년 목표 데이터 삽입 시작 ---', v_target_email, v_company_id;

    -- 2024년 1월부터 12월까지 순회
    FOR v_month IN 1..12 LOOP
        
        -- 1. 팀(Team) 목표 설정 (월 10억)
        FOR v_team_id IN (SELECT DISTINCT team_id FROM public.sales_records WHERE company_id = v_company_id) LOOP
            IF v_team_id IS NOT NULL THEN
                INSERT INTO public.sales_targets (company_id, entity_type, entity_id, year, month, target_amount)
                VALUES (v_company_id, 'TEAM', v_team_id, v_year, v_month, 1000000000)
                ON CONFLICT (company_id, entity_type, entity_id, year, month) DO UPDATE SET target_amount = EXCLUDED.target_amount;
            END IF;
        END LOOP;

        -- 2. 사원(Staff) 목표 설정 (월 1.5억)
        FOR v_staff_id IN (SELECT DISTINCT staff_id FROM public.sales_records WHERE company_id = v_company_id) LOOP
            IF v_staff_id IS NOT NULL THEN
                INSERT INTO public.sales_targets (company_id, entity_type, entity_id, year, month, target_amount)
                VALUES (v_company_id, 'STAFF', v_staff_id, v_year, v_month, 150000000)
                ON CONFLICT (company_id, entity_type, entity_id, year, month) DO UPDATE SET target_amount = EXCLUDED.target_amount;
            END IF;
        END LOOP;

        -- 3. 집계 테이블(sales_summary) 리프레시
        -- (주의: scripts/setup_pre_aggregation.sql 이 먼저 실행되어 있어야 합니다)
        PERFORM public.refresh_sales_summary(v_company_id, v_year, v_month);
        
        RAISE NOTICE '2024년 %월 처리 완료.', v_month;
    END LOOP;
    
    RAISE NOTICE '--- 2024년 1-12월 목표 데이터 생성 및 집계 완료 ---';
END $$;
