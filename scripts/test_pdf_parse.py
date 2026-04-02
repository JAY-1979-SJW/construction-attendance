"""
PDF 계약서 파싱 검증 스크립트
- 한글 건설 근로계약서 3건 생성 (fpdf2)
- 로컬 Python으로 텍스트 추출 (pdfminer) + OpenAI API 직접 호출
- 현장명/주소/시작일/종료일 추출 정확도 검증
- 서버 parse-pdf 엔드포인트와 동일한 프롬프트/모델 사용
"""
import os, sys, json, tempfile
from fpdf import FPDF
from openai import OpenAI
import pdfminer.high_level

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ─── 서버와 동일한 시스템 프롬프트 (pdf-parse-service.ts 참조) ────────────────────
SYSTEM_PROMPT = """당신은 한국 건설현장 근로계약서 분석 전문가입니다.
PDF에서 추출된 텍스트를 받아 계약서 필드를 JSON으로 반환하세요.

반환 형식:
{
  "companyName": "사업주/업체명",
  "companyBizNo": "사업자등록번호",
  "companyCeo": "대표자명",
  "companyAddress": "사업장 주소",
  "workerName": "근로자명",
  "workerBirthDate": "YYYY-MM-DD",
  "workerPhone": "연락처",
  "workerAddress": "근로자 주소",
  "siteName": "현장명/공사명",
  "siteAddress": "현장 주소",
  "jobTitle": "직종/업무내용",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "dailyWage": 숫자(원),
  "monthlySalary": 숫자(원),
  "paymentDay": 매월 지급일(숫자),
  "checkInTime": "HH:MM",
  "checkOutTime": "HH:MM",
  "breakHours": 숫자(시간),
  "contractType": "DAILY|REGULAR|FIXED_TERM|SUBCONTRACT|FREELANCER",
  "specialTerms": "특약사항 원문",
  "confidence": { "필드명": 0.0~1.0 }
}

규칙:
- 텍스트에서 확인할 수 없는 필드는 null 반환
- 날짜는 반드시 YYYY-MM-DD 형식
- 금액은 숫자만 (쉼표/원 제거)
- confidence 는 각 필드의 추출 확신도 (0.0~1.0)
- JSON만 반환, 설명 불필요"""

# ─── 정답 데이터 (3건) ─────────────────────────────────────────────────────────
CONTRACTS = [
    {
        "id": "C1",
        "label": "일용직 계약서 (강남 아파트 현장)",
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
            "출근시간: 08:00",
            "퇴근시간: 17:00",
            "휴게시간: 1시간",
            "",
            "제5조 (임금)",
            "일 당: 250,000원",
            "지급일: 매월 10일",
            "",
            "제6조 (계약형태)",
            "일용근로계약",
            "",
            "위 내용에 동의하며 계약을 체결합니다.",
            "",
            "2026년 02월 25일",
            "",
            "사업주: (주)대한건설  (인)",
            "근로자: 박철수  (인)",
        ],
    },
    {
        "id": "C2",
        "label": "상용직 계약서 (부산 물류센터)",
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
            "회사명: 삼성물산(주)",
            "사업자번호: 987-65-43210",
            "대표이사: 이삼성",
            "사업장주소: 서울특별시 서초구 서초대로 74길 11",
            "",
            "2. 근로자 정보",
            "성명: 최영호",
            "생년월일: 1990년 3월 20일",
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
            "5. 근로시간",
            "시업시각: 09:00 / 종업시각: 18:00",
            "휴게시간: 12:00~13:00 (1시간)",
            "",
            "6. 급여",
            "월급여: 4,500,000원",
            "지급일: 매월 25일",
            "",
            "7. 계약유형: 상용(정규직)",
            "",
            "본 계약의 내용을 충분히 이해하고 서명합니다.",
            "2026년 03월 20일",
            "사업주: 삼성물산(주) 이삼성 (서명)",
            "근로자: 최영호 (서명)",
        ],
    },
    {
        "id": "C3",
        "label": "기간제 계약서 (대전 도로공사)",
        "answer": {
            "siteName": "대전-세종 고속도로 건설공사 3공구",
            "siteAddress": "대전광역시 유성구 전민동 산 45-1",
            "startDate": "2026-05-15",
            "endDate": "2026-11-14",
        },
        "text": [
            "건설일용근로자 표준근로계약서",
            "",
            "□ 사업주",
            "사업체명: 현대건설(주)",
            "사업자등록번호: 111-22-33344",
            "대표자명: 정현대",
            "소재지: 서울특별시 종로구 율곡로 75",
            "",
            "□ 근로자",
            "성 명: 이준혁",
            "주민등록번호: 880101-1XXXXXX",
            "주 소: 대전광역시 서구 둔산동 456-7",
            "연 락 처: 010-5555-6666",
            "",
            "□ 근로 장소",
            "공사명칭: 대전-세종 고속도로 건설공사 3공구",
            "소 재 지: 대전광역시 유성구 전민동 산 45-1",
            "",
            "□ 근로계약기간",
            "2026. 05. 15. ~ 2026. 11. 14. (6개월)",
            "",
            "□ 담당 직무: 포장공",
            "",
            "□ 근무시간",
            "출근 07:30 / 퇴근 16:30 / 휴게 12:00~13:00",
            "",
            "□ 임금",
            "일급: 280,000원",
            "급여지급일: 매월 5일",
            "",
            "□ 계약유형: 기간제",
            "",
            "□ 특약사항",
            "안전교육 이수 필수, 개인보호구 착용 의무",
            "",
            "위와 같이 근로계약을 체결함.",
            "계약일자: 2026년 05월 10일",
            "사업주: 현대건설(주) 정현대 (인)",
            "근로자: 이준혁 (인)",
        ],
    },
]


# ─── PDF 생성 (fpdf2 + 한글 폰트) ──────────────────────────────────────────────
def create_pdf(contract: dict, out_path: str):
    pdf = FPDF()
    pdf.add_page()

    font_path = None
    candidates = [
        r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\gulim.ttc",
        r"C:\Windows\Fonts\batang.ttc",
    ]
    for fp in candidates:
        if os.path.exists(fp):
            font_path = fp
            break

    if not font_path:
        print("[ERROR] 한글 폰트를 찾을 수 없습니다.")
        sys.exit(1)

    pdf.add_font("Korean", "", font_path)
    pdf.set_font("Korean", size=11)

    for line in contract["text"]:
        pdf.cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")

    pdf.output(out_path)
    size = os.path.getsize(out_path)
    print(f"  PDF 생성: {out_path} ({size} bytes)")


# ─── 텍스트 추출 (pdfminer - 서버의 pdfjs-dist 대응) ─────────────────────────────
def extract_text(pdf_path: str) -> str:
    return pdfminer.high_level.extract_text(pdf_path)


# ─── OpenAI 구조화 파싱 (서버의 parseContractFields 동일) ──────────────────────────
def parse_with_openai(text: str) -> dict:
    if not OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY not set"}

    client = OpenAI(api_key=OPENAI_API_KEY)

    # 서버와 동일: 16000자 초과 시 앞뒤 8000자
    max_len = 16000
    if len(text) > max_len:
        text = text[: max_len // 2] + "\n...(중략)...\n" + text[-max_len // 2 :]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"다음은 근로계약서 PDF에서 추출된 텍스트입니다. 구조화된 JSON으로 변환해주세요.\n\n{text}",
            },
        ],
    )

    resp_text = response.choices[0].message.content or ""
    import re

    match = re.search(r"\{[\s\S]*\}", resp_text)
    if not match:
        return {"error": "JSON 추출 실패", "raw": resp_text}

    return json.loads(match.group(0))


# ─── 결과 비교 ──────────────────────────────────────────────────────────────────
def compare(answer: dict, fields: dict) -> list:
    results = []
    for key in ["siteName", "siteAddress", "startDate", "endDate"]:
        expected = answer.get(key, "")
        actual = str(fields.get(key, "") or "")
        match = expected.strip() == actual.strip()
        results.append(
            {"field": key, "expected": expected, "actual": actual, "match": match}
        )
    return results


# ─── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("PDF 계약서 파싱 검증 (4필드: 현장명/주소/시작일/종료일)")
    print("서버 동일 프롬프트 + gpt-4o-mini 사용")
    print("=" * 70)

    if not OPENAI_API_KEY:
        print("[ERROR] OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    # 1) PDF 생성
    tmp_dir = tempfile.mkdtemp(prefix="pdf_test_")
    pdf_paths = []
    print("\n[1단계] PDF 생성")
    for c in CONTRACTS:
        path = os.path.join(tmp_dir, f"{c['id']}.pdf")
        create_pdf(c, path)
        pdf_paths.append(path)

    # 2) 텍스트 추출 + OpenAI 파싱
    print("\n[2단계] 텍스트 추출 + OpenAI 파싱")
    all_results = []

    for i, c in enumerate(CONTRACTS):
        print(f"\n--- {c['id']}: {c['label']} ---")

        # 텍스트 추출
        text = extract_text(pdf_paths[i])
        text_len = len(text.strip())
        method = "text" if text_len >= 50 else "vision"
        print(f"  텍스트 추출: {text_len}자 → method: {method}")

        if text_len < 50:
            print(f"  [WARN] 텍스트 50자 미만 → 서버에서는 Vision fallback 사용")
            print(f"  추출된 텍스트: '{text[:100]}'")

        # OpenAI 파싱
        print(f"  OpenAI gpt-4o-mini 호출 중...")
        fields = parse_with_openai(text)

        if "error" in fields:
            print(f"  [ERROR] {fields['error']}")
            all_results.append({"contract": c["id"], "label": c["label"], "error": fields["error"]})
            continue

        # 비교
        comparisons = compare(c["answer"], fields)
        for r in comparisons:
            status = "O" if r["match"] else "X"
            print(f"  [{status}] {r['field']}: '{r['actual']}' (정답: '{r['expected']}')")

        conf = fields.get("confidence", {})
        for key in ["siteName", "siteAddress", "startDate", "endDate"]:
            if key in conf:
                print(f"      confidence[{key}] = {conf[key]}")

        all_results.append(
            {
                "contract": c["id"],
                "label": c["label"],
                "method": method,
                "textLength": text_len,
                "comparisons": comparisons,
                "confidence": {
                    k: conf.get(k) for k in ["siteName", "siteAddress", "startDate", "endDate"]
                },
            }
        )

    # 3) 최종 집계
    print("\n" + "=" * 70)
    print("최종 집계")
    print("=" * 70)

    total = 0
    matched = 0
    field_stats = {
        k: {"total": 0, "match": 0}
        for k in ["siteName", "siteAddress", "startDate", "endDate"]
    }

    for r in all_results:
        if "error" in r:
            print(f"  {r['contract']}: ERROR - {r['error']}")
            continue
        for c in r["comparisons"]:
            total += 1
            field_stats[c["field"]]["total"] += 1
            if c["match"]:
                matched += 1
                field_stats[c["field"]]["match"] += 1

    if total > 0:
        print(f"\n전체 정확도: {matched}/{total} ({matched / total * 100:.1f}%)")
        for k, v in field_stats.items():
            if v["total"] > 0:
                pct = v["match"] / v["total"] * 100
                print(f"  {k}: {v['match']}/{v['total']} ({pct:.1f}%)")
    else:
        print("결과 없음")

    print(f"\n임시 PDF 경로: {tmp_dir}")


if __name__ == "__main__":
    main()
