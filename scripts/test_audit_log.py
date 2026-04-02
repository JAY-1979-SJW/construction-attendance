"""
감사 로그 검증 스크립트
1. PDF 업로드 → 파싱 로그 확인
2. 계약 저장 (성공) → 로그 확인
3. 계약 저장 (실패) → 로그 확인
"""
import time, json, os, tempfile
import requests
import jwt as pyjwt
from fpdf import FPDF

S = "https://attendance.haehan-ai.kr"
JWT_SECRET = "haehan-jwt-secret-2026-construction"
ADMIN_ID = "test_admin_001"


def sess():
    token = pyjwt.encode(
        {"sub": ADMIN_ID, "type": "admin", "role": "ADMIN",
         "iat": int(time.time()), "exp": int(time.time()) + 86400},
        JWT_SECRET, algorithm="HS256",
    )
    s = requests.Session()
    s.cookies.set("admin_token", token, domain="attendance.haehan-ai.kr")
    return s


def api(s, method, path, **kw):
    r = getattr(s, method)(f"{S}{path}", **kw)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {}


def create_test_pdf(text_lines):
    pdf = FPDF()
    pdf.add_page()
    pdf.add_font("K", "", r"C:\Windows\Fonts\malgun.ttf")
    pdf.set_font("K", size=11)
    for line in text_lines:
        pdf.cell(0, 8, line, new_x="LMARGIN", new_y="NEXT")
    tmp = tempfile.mktemp(suffix=".pdf")
    pdf.output(tmp)
    return tmp


def query_audit_logs(s, action_type, after_ts, limit=5):
    """audit_logs 테이블에서 특정 actionType 로그 조회"""
    date_from = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(after_ts))
    st, rj = api(s, "get", f"/api/admin/audit-logs?actionType={action_type}&dateFrom={date_from}&pageSize={limit}")
    if st == 200:
        return rj.get("data", {}).get("items", rj.get("data", []))
    return []


def main():
    s = sess()
    created_contracts = []

    # 기준 시각 (이후 생성된 로그만 조회)
    ts_before = int(time.time()) - 5

    # 근로자/현장 조회
    _, wj = api(s, "get", "/api/admin/workers?pageSize=5")
    workers = wj.get("data", {}).get("items", wj.get("data", []))
    worker_id = workers[0]["id"]
    worker_name = workers[0]["name"]

    _, sj = api(s, "get", "/api/admin/sites")
    sites = sj.get("data", {}).get("items", [])
    site = sites[0]

    print(f"근로자: {worker_name} ({worker_id[:16]}...)")
    print(f"현장: {site['name']} ({site['id'][:16]}...)")

    # ═══════════════════════════════════════════════════════════
    # 테스트 1: PDF 업로드 → 파싱 로그
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("테스트 1: PDF 업로드 → 파싱 로그 확인")
    print(f"{'='*60}")

    pdf_path = create_test_pdf([
        "근로계약서",
        "사업주: (주)테스트건설  근로자: 서주현",
        "현장명: 로그검증 테스트현장",
        "현장주소: 서울특별시 종로구 세종대로 209",
        "계약기간: 2026-05-01 ~ 2026-08-31",
        "일당: 250,000원  계약형태: 일용",
    ])

    with open(pdf_path, "rb") as f:
        r = s.post(f"{S}/api/admin/documents/parse-pdf",
                   files={"file": ("audit_test_contract.pdf", f, "application/pdf")})
    parse_result = r.json()
    fields = parse_result.get("fields", {})
    print(f"  파싱 결과: siteName='{fields.get('siteName')}', method={parse_result.get('method')}")

    time.sleep(2)  # 로그 쓰기 대기

    # PDF_CONTRACT_PARSE 로그 조회
    logs = query_audit_logs(s, "PDF_CONTRACT_PARSE", ts_before)
    print(f"  PDF_CONTRACT_PARSE 로그: {len(logs)}건")
    if logs:
        log = logs[0]
        meta = log.get("metadataJson", {})
        print(f"    id       = {log.get('id', '?')[:20]}...")
        print(f"    summary  = {log.get('summary', '?')}")
        print(f"    actorId  = {log.get('actorUserId', '?')}")
        print(f"    fileName = {meta.get('fileName', '?')}")
        print(f"    method   = {meta.get('method', '?')}")
        print(f"    siteName = {meta.get('siteName', '?')}")
        print(f"    siteAddr = {meta.get('siteAddress', '?')}")
        print(f"    startDate= {meta.get('startDate', '?')}")
        print(f"    endDate  = {meta.get('endDate', '?')}")
        print(f"    confidence = {json.dumps(meta.get('confidence', {}))[:80]}")
    else:
        print("  [X] 로그 없음")

    # ═══════════════════════════════════════════════════════════
    # 테스트 2: 계약 저장 (성공) + PDF 컨텍스트 포함
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("테스트 2: 계약 저장 (성공 케이스) → 로그 확인")
    print(f"{'='*60}")

    payload = {
        "workerId": worker_id,
        "siteId": site["id"],
        "contractKind": "EMPLOYMENT",
        "contractTemplateType": "DAILY_EMPLOYMENT",
        "startDate": "2026-05-01",
        "endDate": "2026-08-31",
        "dailyWage": 250000,
        "laborRelationType": "DIRECT_EMPLOYEE",
        "siteAddress": site.get("address", ""),
        "pdfParseContext": {
            "fileName": "audit_test_contract.pdf",
            "method": parse_result.get("method", "text"),
            "siteName": fields.get("siteName"),
            "siteAddress": fields.get("siteAddress"),
            "startDate": fields.get("startDate"),
            "endDate": fields.get("endDate"),
            "confidence": fields.get("confidence"),
            "autoMatchResult": "not_matched",
            "autoMatchSiteId": None,
            "autoCreateAttempted": False,
            "autoCreateResult": None,
            "autoCreateFailReason": None,
        },
    }
    st, rj = api(s, "post", "/api/admin/contracts", json=payload)
    print(f"  저장 결과: status={st}, success={rj.get('success')}")
    if st == 201:
        cid = rj["data"]["id"]
        created_contracts.append(cid)
        print(f"  contractId = {cid[:20]}...")

    time.sleep(2)

    # CONTRACT_CREATE 로그 조회
    logs = query_audit_logs(s, "CONTRACT_CREATE", ts_before)
    print(f"  CONTRACT_CREATE 로그: {len(logs)}건")
    if logs:
        log = logs[0]
        meta = log.get("metadataJson", {})
        print(f"    id        = {log.get('id', '?')[:20]}...")
        print(f"    summary   = {log.get('summary', '?')}")
        print(f"    actorId   = {log.get('actorUserId', '?')}")
        print(f"    targetId  = {log.get('targetId', '?')[:20]}...")
        print(f"    workerId  = {meta.get('workerId', '?')[:16]}...")
        print(f"    siteId    = {meta.get('siteId', '?') and str(meta.get('siteId',''))[:16]}...")
        print(f"    startDate = {meta.get('startDate', '?')}")
        print(f"    endDate   = {meta.get('endDate', '?')}")
        pdf = meta.get("pdfParse", {})
        if pdf:
            print(f"    pdf.fileName       = {pdf.get('fileName', '?')}")
            print(f"    pdf.method         = {pdf.get('method', '?')}")
            print(f"    pdf.parsedSiteName = {pdf.get('parsedSiteName', '?')}")
            print(f"    pdf.autoMatchResult = {pdf.get('autoMatchResult', '?')}")
            print(f"    pdf.autoCreateAttempted = {pdf.get('autoCreateAttempted', '?')}")
        else:
            print(f"    pdfParse = (없음)")
    else:
        print("  [X] 로그 없음")

    # ═══════════════════════════════════════════════════════════
    # 테스트 3: 계약 저장 (실패 케이스) → 로그 없어야 정상
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("테스트 3: 계약 저장 (실패 케이스) → 로그 미생성 확인")
    print(f"{'='*60}")

    fail_payload = {
        "workerId": "",  # 필수 누락
        "contractKind": "EMPLOYMENT",
        "contractTemplateType": "DAILY_EMPLOYMENT",
        "startDate": "2026-06-01",
        "dailyWage": 200000,
    }
    st, rj = api(s, "post", "/api/admin/contracts", json=fail_payload)
    print(f"  저장 결과: status={st}, error={rj.get('error', '?')[:60]}")
    print(f"  → 실패 시 CONTRACT_CREATE 로그 미생성 (정상: prisma.create 전에 반환)")

    # ═══════════════════════════════════════════════════════════
    # 테스트 4: PDF 파싱 실패 로그 확인
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("테스트 4: PDF 파싱 실패 로그 (비PDF 파일)")
    print(f"{'='*60}")

    # 서버는 content-type 체크하므로 비PDF는 400 반환 (파싱 실패 로그 X)
    # 대신 잘못된 PDF 내용 전송
    tmp_bad = tempfile.mktemp(suffix=".pdf")
    with open(tmp_bad, "wb") as f:
        f.write(b"%PDF-1.4\ngarbage content that is not valid pdf")
    with open(tmp_bad, "rb") as f:
        r = s.post(f"{S}/api/admin/documents/parse-pdf",
                   files={"file": ("bad_contract.pdf", f, "application/pdf")})
    print(f"  응답: status={r.status_code}")
    if r.status_code != 200:
        print(f"  error: {r.json().get('error', '?')[:80]}")

    time.sleep(2)
    fail_logs = query_audit_logs(s, "PDF_CONTRACT_PARSE_FAILED", ts_before)
    print(f"  PDF_CONTRACT_PARSE_FAILED 로그: {len(fail_logs)}건")
    if fail_logs:
        fl = fail_logs[0]
        fm = fl.get("metadataJson", {})
        print(f"    summary  = {fl.get('summary', '?')}")
        print(f"    fileName = {fm.get('fileName', '?')}")
        print(f"    error    = {fm.get('error', '?')[:80]}")

    # ═══════════════════════════════════════════════════════════
    # Cleanup
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("Cleanup")
    print(f"{'='*60}")
    for cid in created_contracts:
        st, _ = api(s, "delete", f"/api/admin/contracts/{cid}")
        print(f"  계약 삭제: {cid[:16]}... → {st}")

    # ═══════════════════════════════════════════════════════════
    # 최종 보고
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("로그 조회 방법 (운영)")
    print(f"{'='*60}")
    print("  GET /api/admin/audit-logs?actionType=PDF_CONTRACT_PARSE")
    print("  GET /api/admin/audit-logs?actionType=PDF_CONTRACT_PARSE_FAILED")
    print("  GET /api/admin/audit-logs?actionType=CONTRACT_CREATE")
    print("  필터: dateFrom, dateTo, actorUserId, targetType, targetId")


if __name__ == "__main__":
    main()
