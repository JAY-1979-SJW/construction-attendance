"""
PDF 계약서 E2E 검증 스크립트 (서버 API 호출)
1. fpdf2로 한글 계약서 PDF 3건 생성
2. JWT 직접 생성 → 서버 parse-pdf API 호출
3. 현장명/주소/시작일/종료일 추출 검증
4. 기존 현장 매칭 검증 (사이트 목록 대조)
5. geocode API 검증 (주소 → 좌표)
"""
import os, sys, json, time, tempfile, requests
import jwt as pyjwt
from fpdf import FPDF

SERVER = "https://attendance.haehan-ai.kr"
JWT_SECRET = "haehan-jwt-secret-2026-construction"
ADMIN_USER_ID = "test_admin_001"

# ─── 정답 데이터 ───────────────────────────────────────────────────────────────
CONTRACTS = [
    {
        "id": "C1",
        "label": "일용직 (강남 아파트)",
        "answer": {
            "siteName": "강남 래미안 아파트 신축공사",
            "siteAddress": "서울특별시 강남구 역삼동 123-45",
            "startDate": "2026-03-01",
            "endDate": "2026-12-31",
        },
        "text": [
            "근 로 계 약 서",
            "",
            "사업주 (갑)",
            "상 호: (주)대한건설",
            "사업자등록번호: 123-45-67890",
            "대표자: 김대한",
            "주 소: 서울특별시 중구 을지로 100",
            "",
            "근로자 (을)",
            "성 명: 박철수",
            "생년월일: 1985-07-15",
            "주 소: 경기도 성남시 분당구 정자동 45-6",
            "연락처: 010-1234-5678",
            "",
            "제1조 (근무장소)",
            "공사명: 강남 래미안 아파트 신축공사",
            "현장주소: 서울특별시 강남구 역삼동 123-45",
            "",
            "제2조 (계약기간)",
            "시작일: 2026년 03월 01일",
            "종료일: 2026년 12월 31일",
            "",
            "제3조 (업무내용)",
            "직 종: 철근공",
            "",
            "제4조 (근로시간)",
            "출근시간: 08:00  퇴근시간: 17:00  휴게시간: 1시간",
            "",
            "제5조 (임금)",
            "일 당: 250,000원  지급일: 매월 10일",
            "",
            "제6조 (계약형태) 일용근로계약",
            "",
            "2026년 02월 25일",
            "사업주: (주)대한건설 (인)   근로자: 박철수 (인)",
        ],
    },
    {
        "id": "C2",
        "label": "상용직 (부산 물류센터)",
        "answer": {
            "siteName": "부산 신항 물류센터 증축공사",
            "siteAddress": "부산광역시 강서구 송정동 1700번지",
            "startDate": "2026-04-01",
            "endDate": "2027-03-31",
        },
        "text": [
            "표준 근로계약서",
            "",
            "1. 사업주 정보",
            "회사명: 삼성물산(주)  사업자번호: 987-65-43210",
            "대표이사: 이삼성",
            "사업장주소: 서울특별시 서초구 서초대로 74길 11",
            "",
            "2. 근로자 정보",
            "성명: 최영호  생년월일: 1990-03-20",
            "주소: 부산광역시 해운대구 우동 1234",
            "전화번호: 010-9876-5432",
            "",
            "3. 근무 장소 및 업무",
            "현장명: 부산 신항 물류센터 증축공사",
            "현장 소재지: 부산광역시 강서구 송정동 1700번지",
            "담당업무: 전기기사",
            "",
            "4. 근로계약 기간",
            "2026년 04월 01일 부터 2027년 03월 31일 까지",
            "",
            "5. 근로시간  시업: 09:00 / 종업: 18:00 / 휴게: 1시간",
            "",
            "6. 급여  월급여: 4,500,000원  지급일: 매월 25일",
            "",
            "7. 계약유형: 상용(정규직)",
            "",
            "2026년 03월 20일",
            "사업주: 삼성물산(주) 이삼성 (서명)  근로자: 최영호 (서명)",
        ],
    },
    {
        "id": "C3",
        "label": "기간제 (대전 도로공사)",
        "answer": {
            "siteName": "대전-세종 고속도로 건설공사 3공구",
            "siteAddress": "대전광역시 유성구 전민동 산 45-1",
            "startDate": "2026-05-15",
            "endDate": "2026-11-14",
        },
        "text": [
            "건설일용근로자 표준근로계약서",
            "",
            "사업체명: 현대건설(주)",
            "사업자등록번호: 111-22-33344  대표자명: 정현대",
            "소재지: 서울특별시 종로구 율곡로 75",
            "",
            "근로자  성명: 이준혁  생년월일: 1988-01-01",
            "주소: 대전광역시 서구 둔산동 456-7",
            "연락처: 010-5555-6666",
            "",
            "근로 장소",
            "공사명칭: 대전-세종 고속도로 건설공사 3공구",
            "소재지: 대전광역시 유성구 전민동 산 45-1",
            "",
            "근로계약기간: 2026. 05. 15. ~ 2026. 11. 14. (6개월)",
            "",
            "담당 직무: 포장공",
            "근무시간: 출근 07:30 / 퇴근 16:30 / 휴게 1시간",
            "",
            "임금: 일급 280,000원  급여지급일: 매월 5일",
            "계약유형: 기간제",
            "",
            "특약사항: 안전교육 이수 필수, 개인보호구 착용 의무",
            "",
            "계약일자: 2026년 05월 10일",
            "사업주: 현대건설(주) 정현대 (인)  근로자: 이준혁 (인)",
        ],
    },
]


def make_token():
    payload = {
        "sub": ADMIN_USER_ID,
        "type": "admin",
        "role": "ADMIN",
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400,
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def create_pdf(contract, out_path):
    pdf = FPDF()
    pdf.add_page()
    font_path = r"C:\Windows\Fonts\malgun.ttf"
    if not os.path.exists(font_path):
        print("[ERROR] malgun.ttf not found")
        sys.exit(1)
    pdf.add_font("K", "", font_path)
    pdf.set_font("K", size=11)
    for line in contract["text"]:
        pdf.cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")
    pdf.output(out_path)
    return os.path.getsize(out_path)


def get_session():
    token = make_token()
    sess = requests.Session()
    sess.cookies.set("admin_token", token, domain="attendance.haehan-ai.kr")
    return sess


def upload_pdf(sess, pdf_path):
    url = f"{SERVER}/api/admin/documents/parse-pdf"
    with open(pdf_path, "rb") as f:
        r = sess.post(url, files={"file": ("contract.pdf", f, "application/pdf")})
    return r.status_code, r.json() if r.status_code == 200 else r.text[:300]


def get_sites(sess):
    r = sess.get(f"{SERVER}/api/admin/sites")
    if r.status_code == 200:
        return r.json().get("data", {}).get("items", [])
    return []


def test_geocode(sess, address):
    r = sess.get(f"{SERVER}/api/admin/geocode", params={"address": address})
    if r.status_code == 200:
        return r.json()
    return {"error": r.status_code, "body": r.text[:200]}


def compare(answer, fields):
    results = []
    for key in ["siteName", "siteAddress", "startDate", "endDate"]:
        expected = answer.get(key, "")
        actual = str(fields.get(key, "") or "")
        match = expected.strip() == actual.strip()
        results.append({"field": key, "expected": expected, "actual": actual, "match": match})
    return results


def normalize_name(name):
    import re
    n = re.sub(r"\s+", "", name).lower()
    n = re.sub(r"\(.*?\)", "", n)
    for suffix in ["공사", "현장", "프로젝트", "사업", "construction", "project"]:
        n = n.replace(suffix, "")
    return n


def find_similar_site(sites, site_name, site_addr):
    """프론트엔드 findSimilarSite 로직 재현"""
    import re
    norm_name = normalize_name(site_name or "")
    norm_addr = re.sub(r"[\s·\-,]", "", (site_addr or "").lower())

    # 1단계: name+address 완전일치
    for s in sites:
        sn = normalize_name(s.get("name", ""))
        sa = re.sub(r"[\s·\-,]", "", (s.get("address", "") or "").lower())
        if sn == norm_name and sa == norm_addr:
            return s, "exact"

    # 2단계: name 포함관계
    for s in sites:
        sn = normalize_name(s.get("name", ""))
        if len(sn) >= 2 and len(norm_name) >= 2:
            if sn in norm_name or norm_name in sn:
                return s, "name_contains"

    # 3단계: address 일치 + name 일부 겹침
    for s in sites:
        sa = re.sub(r"[\s·\-,]", "", (s.get("address", "") or "").lower())
        if sa == norm_addr and sa:
            sn = normalize_name(s.get("name", ""))
            if any(c in norm_name for c in sn if len(c) > 1):
                return s, "addr_match"

    return None, "none"


# ─── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("PDF 계약서 E2E 검증 (서버 API: parse-pdf + geocode + 현장 매칭)")
    print(f"서버: {SERVER}")
    print("=" * 70)

    sess = get_session()

    # 서버 접속 확인
    sites = get_sites(sess)
    print(f"\n기존 현장 수: {len(sites)}건")
    for s in sites[:5]:
        print(f"  - {s['name']} | {s.get('address','')}")
    if len(sites) > 5:
        print(f"  ... 외 {len(sites)-5}건")

    # PDF 생성
    tmp_dir = tempfile.mkdtemp(prefix="pdf_e2e_")
    pdf_paths = []
    print(f"\n[1단계] PDF 생성")
    for c in CONTRACTS:
        path = os.path.join(tmp_dir, f"{c['id']}.pdf")
        size = create_pdf(c, path)
        pdf_paths.append(path)
        print(f"  {c['id']}: {size} bytes")

    # PDF 업로드 + 파싱 + 매칭 검증
    print(f"\n[2단계] 서버 업로드 → 파싱 → 매칭 검증")
    all_results = []

    for i, c in enumerate(CONTRACTS):
        print(f"\n{'─'*60}")
        print(f"[{c['id']}] {c['label']}")
        print(f"{'─'*60}")

        # 2-1) 서버 파싱
        status, resp = upload_pdf(sess, pdf_paths[i])
        if status != 200:
            print(f"  [ERROR] 서버 응답 {status}: {resp}")
            all_results.append({"id": c["id"], "error": str(resp)})
            continue

        fields = resp.get("fields", {})
        method = resp.get("method", "?")
        text_len = resp.get("textLength", 0)
        pages = resp.get("pages", 0)
        print(f"  method={method} | textLength={text_len} | pages={pages}")

        # 2-2) 4필드 정답 대조
        comparisons = compare(c["answer"], fields)
        for r in comparisons:
            tag = "O" if r["match"] else "X"
            print(f"  [{tag}] {r['field']}: '{r['actual']}' (정답: '{r['expected']}')")

        conf = fields.get("confidence", {})
        conf_vals = {k: conf.get(k, "?") for k in ["siteName", "siteAddress", "startDate", "endDate"]}
        print(f"  confidence: {json.dumps(conf_vals)}")

        # 2-3) 현장 매칭 테스트
        extracted_name = fields.get("siteName", "")
        extracted_addr = fields.get("siteAddress", "")
        matched_site, match_type = find_similar_site(sites, extracted_name, extracted_addr)
        if matched_site:
            print(f"  현장 매칭: {match_type} → '{matched_site['name']}' (id={matched_site['id'][:12]}...)")
        else:
            print(f"  현장 매칭: 없음 → 자동 개설 대상")

        # 2-4) Geocode 검증 (주소가 있을 때만)
        geo_result = None
        if extracted_addr:
            geo_result = test_geocode(sess, extracted_addr)
            if "error" in geo_result:
                print(f"  Geocode: 실패 → {geo_result}")
                print(f"  → 자동 개설 금지 (geocode 실패)")
            else:
                lat = geo_result.get("latitude", "?")
                lng = geo_result.get("longitude", "?")
                gc_conf = geo_result.get("confidence", "?")
                norm_addr = geo_result.get("normalizedAddress", "?")
                print(f"  Geocode: lat={lat}, lng={lng}, confidence={gc_conf}")
                print(f"           normalizedAddr='{norm_addr}'")

        # 2-5) 자동 개설 판정
        can_auto_create = (
            not matched_site
            and extracted_name
            and extracted_addr
            and geo_result
            and "error" not in geo_result
        )
        if matched_site:
            auto_action = f"기존 현장 사용 ({match_type})"
        elif can_auto_create:
            auto_action = "자동 개설 가능"
        elif not extracted_name or not extracted_addr:
            auto_action = "자동 개설 금지 (현장명/주소 불확실)"
        else:
            auto_action = "자동 개설 금지 (geocode 실패)"
        print(f"  판정: {auto_action}")

        all_results.append({
            "id": c["id"],
            "label": c["label"],
            "method": method,
            "comparisons": comparisons,
            "match_type": match_type,
            "matched_site": matched_site["name"] if matched_site else None,
            "geocode_ok": geo_result and "error" not in geo_result if geo_result else False,
            "auto_action": auto_action,
        })

    # ─── 최종 보고 ──────────────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print("최종 보고")
    print(f"{'='*70}")

    total = 0
    matched_count = 0
    field_stats = {k: {"total": 0, "match": 0} for k in ["siteName", "siteAddress", "startDate", "endDate"]}

    for r in all_results:
        if "error" in r:
            continue
        for c in r["comparisons"]:
            total += 1
            field_stats[c["field"]]["total"] += 1
            if c["match"]:
                matched_count += 1
                field_stats[c["field"]]["match"] += 1

    print(f"\n■ 필드 추출 정확도")
    if total > 0:
        print(f"  전체: {matched_count}/{total} ({matched_count/total*100:.1f}%)")
        for k, v in field_stats.items():
            if v["total"] > 0:
                print(f"  {k}: {v['match']}/{v['total']} ({v['match']/v['total']*100:.1f}%)")

    print(f"\n■ 현장 매칭/자동 개설 결과")
    for r in all_results:
        if "error" in r:
            print(f"  {r['id']}: ERROR")
            continue
        print(f"  {r['id']} ({r['label']}): {r['auto_action']}")

    print(f"\n■ Geocode 결과")
    for r in all_results:
        if "error" in r:
            continue
        geo_ok = "성공" if r.get("geocode_ok") else "실패"
        print(f"  {r['id']}: {geo_ok}")

    # 실패 유형 분석
    failures = []
    for r in all_results:
        if "error" in r:
            failures.append(f"{r['id']}: API 오류 - {r['error'][:80]}")
            continue
        for c in r["comparisons"]:
            if not c["match"]:
                failures.append(f"{r['id']}.{c['field']}: '{c['actual']}' != '{c['expected']}'")

    print(f"\n■ 실패 유형")
    if failures:
        for f in failures:
            print(f"  - {f}")
    else:
        print("  없음")

    # 운영 가능 여부 판정
    accuracy = matched_count / total * 100 if total > 0 else 0
    errors = len([r for r in all_results if "error" in r])
    print(f"\n■ 운영 가능 여부")
    if accuracy >= 90 and errors == 0:
        print(f"  판정: 운영 가능 (정확도 {accuracy:.1f}%, 오류 {errors}건)")
    else:
        print(f"  판정: 추가 검증 필요 (정확도 {accuracy:.1f}%, 오류 {errors}건)")


if __name__ == "__main__":
    main()
