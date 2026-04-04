#!/usr/bin/env python3
"""
nara_resources → nara_material_catalog 공종별 분류 생성
실행: python3 scripts/build_material_catalog.py

매핑 규칙:
  lvlRsceClsfcNm1/2 → discipline_code/nm
  rsceNm 키워드 → sub_discipline (소방전기/소방설비/조경 등)
"""
import os
import sys
from datetime import datetime

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2
    import psycopg2.extras

_db_pw = os.environ.get("DB_PASSWORD") or os.environ.get("PGPASSWORD")
if not _db_pw:
    raise RuntimeError("DB_PASSWORD 환경변수 미설정 — 실행 전 설정 필요")
_db_host = os.environ.get("DB_HOST", "192.168.120.18")
DB_DSN = (
    f"host={_db_host} port=5432 dbname=construction_attendance "
    f"user=attendance_app password={_db_pw}"
)

# ─── 공종 매핑 테이블 ────────────────────────────────────────────────────────
# (category1, category2) → (discipline_code, discipline_nm)
# category2가 None이면 category1만 매칭

CAT_MAP: list[tuple] = [
    # ── 전기공사 (E) ──────────────────────────────────────────────────────────
    ("전기시스템,조명,부품,액세서리및보조용품",  None,              "E", "전기공사"),
    ("회전기기및경전기",                          None,              "E", "전기공사"),
    ("전자부품및소모품",                          None,              "E", "전기공사"),

    # ── 통신공사 (T) ──────────────────────────────────────────────────────────
    ("정보기술방송및통신기",                      None,              "T", "통신공사"),
    ("인쇄,사진및시청각기기",                     None,              "T", "통신공사"),

    # ── 설비공사 (M) ─────────────────────────────────────────────────────────
    ("배관유체조절시스템장비및부품",               None,              "M", "설비공사"),
    ("위생장비및용품",                            None,              "M", "설비공사"),

    # ── 소방 관련 (공공안전및치안장비) → 중분류로 구분 ──────────────────────
    ("공공안전및치안장비",  "화재예방및소방장비",  "M", "설비공사"),
    ("공공안전및치안장비",  "보안감시및탐지장비",  "E", "전기공사"),
    ("공공안전및치안장비",  "공공안전및통제장비",  "E", "전기공사"),
    ("공공안전및치안장비",  "호신및보호장비",      "기타", "기타"),

    # ── 건축공사 (A) ─────────────────────────────────────────────────────────
    ("건자재",  "기본건축자재",              "A", "건축공사"),
    ("건자재",  "건축용블록벽돌및타일",      "A", "건축공사"),
    ("건자재",  "내장마감재",               "A", "건축공사"),
    ("건자재",  "외장마감재",               "A", "건축공사"),
    ("건자재",  "단열재",                   "A", "건축공사"),
    ("건자재",  "창호및유리",               "A", "건축공사"),
    ("건자재",  "콘크리트,시멘트및플라스터", "A", "건축공사"),
    ("건자재",  "건설및시설운용자재",        "A", "건축공사"),
    ("건자재",  "이동식구조물",             "A", "건축공사"),
    ("건자재",  "조립식건물",               "A", "건축공사"),
    ("건자재",  "영구구조물",               "A", "건축공사"),
    ("건자재",  "배관및위생도기류",          "M", "설비공사"),  # 위생도기 → 설비

    # ── 토목공사 (C) ─────────────────────────────────────────────────────────
    ("건자재",  "도로포장및조경재",          "C", "토목공사"),
    ("건설기계",                None,       "C", "토목공사"),
    ("건축건설기계및보조용품",  None,        "C", "토목공사"),
    ("광물,직물및비식용동식물자원", "토사석", "C", "토목공사"),
    ("광물,직물및비식용동식물자원", "광물,광석및금속", "C", "토목공사"),
    ("광물,직물및비식용동식물자원", "금속폐기물",      "C", "토목공사"),

    # ── 건축+조경 ─────────────────────────────────────────────────────────────
    ("산동식물및동식물성생산품", None,        "A", "건축공사"),
    ("스포츠및레크리에이션장비용품및액세서리", None, "A", "건축공사"),

    # ── 기타 ─────────────────────────────────────────────────────────────────
    ("광물,직물및비식용동식물자원", None,     "기타", "기타"),
    ("제조부품",                   None,     "기타", "기타"),
    ("산업용제조가공기계및액세서리", None,    "기타", "기타"),
    ("물품취급,조정,저장기계,액세서리및소모품", None, "기타", "기타"),
    ("실험실용실험,측정,관측및검사기기", None, "기타", "기타"),
    ("화학제품",                   None,     "기타", "기타"),
    ("연료,연료첨가제,윤활유및방부식제", None, "기타", "기타"),
    ("가구및관련제품",             None,     "기타", "기타"),
    ("가정용품및가전제품",         None,     "기타", "기타"),
    ("출판물",                     None,     "기타", "기타"),
    ("공구및범용기계",             None,     "기타", "기타"),
    ("광산기계및액세서리",         None,     "기타", "기타"),
    ("농.수.임.축산용기계",        None,     "기타", "기타"),
    ("수지,고무,탄성중합체",       None,     "기타", "기타"),
    ("사무용기기액세서리및용품",   None,     "기타", "기타"),
    ("서비스업용기계장비및용품",   None,     "기타", "기타"),
    ("종이원료및종이제품",         None,     "기타", "기타"),
    ("의류,가방및개인관리용품",    None,     "기타", "기타"),
    ("악기,게임,장난감,미술작품,공예품,교육용장비,교재,교육용품및교육용보조품", None, "기타", "기타"),
    ("건물및시설물건설유지보수서비스", None,  "기타", "기타"),
    ("상용,군용,개인용운송기구및액세서리와부품", None, "기타", "기타"),
]

# ─── 세부 공종 키워드 매핑 (sub_discipline) ──────────────────────────────────
# (rsceNm 키워드 포함 시 sub_discipline 설정)

SOFIRE_ELEC_KW = [
    "감지기", "발신기", "수신기", "경보기", "유도등", "유도표지",
    "비상조명", "비상방송", "비상콘센트", "무선통신보조",
    "자동화재탐지", "자동화재속보", "단독경보형",
]
SOFIRE_MECH_KW = [
    "소화기", "소화전", "스프링클러", "헤드", "소방밸브",
    "소방용방수구", "CO2소화", "소화설비", "소화함",
    "송수구", "탱크", "소방용", "피난기구",
]
LANDSCAPING_KW = ["수목", "식재", "잔디", "나무", "묘목", "조경"]


def classify(cat1: str, cat2: str, rsce_nm: str) -> tuple[str, str, str | None]:
    """
    Returns (discipline_code, discipline_nm, sub_discipline)
    """
    # 노무(직종) 별도 처리
    if cat1 == "직종":
        return ("L", "노무", None)

    # 경비(일반경비) 별도 처리
    if cat1 == "일반경비":
        return ("E_cost", "경비", None)

    code, nm = "기타", "기타"

    # 우선 (cat1, cat2) 완전 매칭, 다음 (cat1, None) 매칭
    for rule_cat1, rule_cat2, rule_code, rule_nm in CAT_MAP:
        if cat1 == rule_cat1:
            if rule_cat2 is None or cat2 == rule_cat2:
                code, nm = rule_code, rule_nm
                break

    # sub_discipline 결정
    sub = None
    nm_lower = (rsce_nm or "").lower()
    nm_orig  = rsce_nm or ""

    if code in ("M", "설비공사") or (cat2 == "화재예방및소방장비"):
        for kw in SOFIRE_MECH_KW:
            if kw in nm_orig:
                sub = "소방설비"
                break
    if code in ("E", "전기공사") or (cat2 in ("보안감시및탐지장비", "공공안전및통제장비")):
        for kw in SOFIRE_ELEC_KW:
            if kw in nm_orig:
                sub = "소방전기"
                break
    if not sub and code in ("A", "건축공사"):
        for kw in LANDSCAPING_KW:
            if kw in nm_orig:
                sub = "조경"
                break

    return (code, nm, sub)


# ─── 메인 ────────────────────────────────────────────────────────────────────

def main():
    start = datetime.now()
    print(f"[{start:%H:%M:%S}] 공종별 자재 카탈로그 생성 시작", flush=True)

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur  = conn.cursor()

    # 기존 초기화
    cur.execute("TRUNCATE TABLE nara_material_catalog RESTART IDENTITY")
    conn.commit()
    print("  기존 데이터 초기화", flush=True)

    # 전체 nara_resources 읽기
    cur.execute("""
        SELECT id, rsce_ty_extrnl_cd,
               lvl_rsce_clsfc_nm1, lvl_rsce_clsfc_nm2,
               net_rsce_cd, rsce_nm, rsce_spec_nm, unit, lbrcst
        FROM nara_resources
        ORDER BY id
    """)
    rows = cur.fetchall()
    print(f"  nara_resources {len(rows):,}건 로드", flush=True)

    # 분류 + 배치 INSERT
    catalog_rows = []
    for r in rows:
        sid, rsce_ty, cat1, cat2, net_cd, nm, spec, unit, lbrcst = r
        code, dname, sub = classify(cat1 or "", cat2 or "", nm or "")
        catalog_rows.append((
            sid, code, dname, sub,
            rsce_ty, cat1, cat2,
            net_cd, nm, spec, unit, lbrcst,
        ))

    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO nara_material_catalog
          (source_id, discipline_code, discipline_nm, sub_discipline,
           rsce_ty, category1, category2,
           net_rsce_cd, rsce_nm, rsce_spec_nm, unit, lbrcst, created_at)
        VALUES %s
        """,
        catalog_rows,
        template="(%s,%s,%s,%s, %s,%s,%s, %s,%s,%s,%s,%s, NOW())",
        page_size=1000,
    )
    conn.commit()
    print(f"  INSERT {len(catalog_rows):,}건", flush=True)

    # ─── 검증 ────────────────────────────────────────────────────────────────
    cur.execute("""
        SELECT discipline_code, discipline_nm, COUNT(*) AS cnt
        FROM nara_material_catalog GROUP BY 1,2 ORDER BY 3 DESC
    """)
    by_disc = cur.fetchall()

    cur.execute("""
        SELECT sub_discipline, COUNT(*) AS cnt
        FROM nara_material_catalog
        WHERE sub_discipline IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC
    """)
    by_sub = cur.fetchall()

    cur.execute("""
        SELECT discipline_code, discipline_nm, rsce_ty, COUNT(*) AS cnt
        FROM nara_material_catalog
        WHERE discipline_code IN ('M','E')
          AND sub_discipline IN ('소방설비','소방전기')
        GROUP BY 1,2,3 ORDER BY 1,3
    """)
    sofire = cur.fetchall()

    elapsed = (datetime.now() - start).seconds
    print(f"\n=== 완료 ({elapsed}s) — {len(catalog_rows):,}건 ===")

    print("\n[공종별]")
    for row in by_disc:
        print(f"  {row[0]} {row[1]}: {row[2]:,}건")

    print("\n[세부 공종 (sub_discipline)]")
    for row in by_sub:
        print(f"  {row[0]}: {row[1]:,}건")

    print("\n[소방 분류]")
    for row in sofire:
        print(f"  {row[0]} {row[1]} / {row[2]}: {row[3]:,}건")

    cur.close()
    conn.close()
    print("완료.", flush=True)


if __name__ == "__main__":
    main()
