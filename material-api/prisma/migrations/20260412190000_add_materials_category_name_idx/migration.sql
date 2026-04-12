-- (category, name) 복합 인덱스 추가
-- category 필터 + ORDER BY name 조합 성능 개선 (0.735ms → 0.097ms)
CREATE INDEX IF NOT EXISTS "materials_category_name_idx" ON "materials" ("category", "name");
