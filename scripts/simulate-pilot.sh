#!/bin/bash
BASE="https://attendance.haehan-ai.kr"
COOKIE="/tmp/sim_cookie.txt"
DT=$(date +%s)

c_ok='\033[32mv\033[0m'
c_fail='\033[31mx\033[0m'
c_head='\033[1;33m'
c_reset='\033[0m'

pass=0; fail=0
check() {
  local cond=$1 label=$2 detail=$3
  if [ "$cond" = "true" ]; then echo -e "$c_ok PASS  $label"; ((pass++))
  else echo -e "$c_fail FAIL  $label${detail:+ -- $detail}"; ((fail++)); fi
}

echo -e "${c_head}================================================${c_reset}"
echo -e "${c_head}  파일럿 1일차 시뮬레이션${c_reset}"
echo -e "${c_head}  승인->출근->이동->퇴근->보정->집계->엑셀${c_reset}"
echo -e "${c_head}================================================${c_reset}"

SITE_A_ID=cmmznyrd80004n2555xsus0g2
SITE_B_ID=cmmznyrgh0007n2552a3uceuq
W1_ID=cmmznyrjq000an255lmrcqfog
W2_ID=cmmznyrmt000dn255dg6yg9mt
QR_A=2fmXVd9xWtjCh1-leKmxLR9RrhEgO0ZZ6jD0HQ-ZuxQ
QR_B=lnTp9ShX1bRtYmDZLFT1SZ7CL0HKgdPQXlBAvLmEWsY
DEV_W1="sim_device_w1_${DT}"
DEV_W2="sim_device_w2_${DT}"

# STEP 0. 관리자 로그인
echo -e "\n${c_head}[ STEP 0 ] 관리자 로그인${c_reset}"
LOGIN=$(curl -s -X POST $BASE/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@haehan.com","password":"Haehan@Attend2026"}' \
  -c $COOKIE)
OK=$(echo $LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
check "$OK" "관리자 로그인"

# STEP 1. 근로자 앱 로그인
echo -e "\n${c_head}[ STEP 1 ] 근로자 앱 로그인 (기기 등록 요청 포함)${c_reset}"
W1_LOGIN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"01011110001\",\"deviceToken\":\"${DEV_W1}\",\"deviceName\":\"김철수갤럭시\"}")
W1_STATUS=$(echo $W1_LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status','?'))" 2>/dev/null)
W1_JWT=$(echo $W1_LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)
echo "  W1 status=$W1_STATUS"
check "$([ -n "$W1_JWT" ] && echo true || echo false)" "W1 JWT 발급"

W2_LOGIN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"01022220002\",\"deviceToken\":\"${DEV_W2}\",\"deviceName\":\"이영희아이폰\"}")
W2_JWT=$(echo $W2_LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)
W2_STATUS=$(echo $W2_LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status','?'))" 2>/dev/null)
echo "  W2 status=$W2_STATUS"
check "$([ -n "$W2_JWT" ] && echo true || echo false)" "W2 JWT 발급"

# STEP 2. 관리자 기기 승인
echo -e "\n${c_head}[ STEP 2 ] 관리자 기기 승인${c_reset}"
REQS=$(curl -s "$BASE/api/admin/device-requests?status=PENDING" -b $COOKIE)
REQ_COUNT=$(echo $REQS | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',{}).get('items',[])))" 2>/dev/null)
echo "  대기 기기 요청: ${REQ_COUNT}건"
APPROVED_COUNT=0
for REQ_ID in $(echo $REQS | python3 -c "import sys,json; [print(i['id']) for i in json.load(sys.stdin).get('data',{}).get('items',[])]" 2>/dev/null); do
  RES=$(curl -s -X POST $BASE/api/admin/device-requests \
    -H "Content-Type: application/json" \
    -b $COOKIE \
    -d "{\"requestId\":\"${REQ_ID}\",\"action\":\"APPROVE\"}")
  R_OK=$(echo $RES | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  echo "  승인 $REQ_ID -> $R_OK"
  [ "$R_OK" = "True" ] && ((APPROVED_COUNT++))
done
check "$([ $APPROVED_COUNT -ge 2 ] && echo true || echo false)" "기기 승인 ${APPROVED_COUNT}건 완료"

# STEP 3. 재로그인 (승인 후)
echo -e "\n${c_head}[ STEP 3 ] 재로그인 (승인 후)${c_reset}"
W1_LOGIN2=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"01011110001\",\"deviceToken\":\"${DEV_W1}\",\"deviceName\":\"김철수갤럭시\"}")
W1_JWT=$(echo $W1_LOGIN2 | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))" 2>/dev/null)
W1_STATUS2=$(echo $W1_LOGIN2 | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status','?'))" 2>/dev/null)
echo "  W1 재로그인 status=$W1_STATUS2"
check "$([ -n \"$W1_JWT\" ] && echo true || echo false)" "W1 재로그인 JWT"

W2_LOGIN2=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"01022220002\",\"deviceToken\":\"${DEV_W2}\",\"deviceName\":\"이영희아이폰\"}")
W2_JWT=$(echo $W2_LOGIN2 | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))" 2>/dev/null)

# STEP 4. W1 출근 (A현장)
echo -e "\n${c_head}[ STEP 4 ] W1 출근 (A현장)${c_reset}"
CI_W1=$(curl -s -X POST $BASE/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $W1_JWT" \
  -d "{\"qrToken\":\"${QR_A}\",\"latitude\":37.5013,\"longitude\":127.0400}")
CI_OK=$(echo $CI_W1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
CI_MSG=$(echo $CI_W1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
echo "  응답: success=$CI_OK msg=$CI_MSG"
check "$CI_OK" "W1 출근 성공 (A현장, 반경 내)"

# STEP 5. W1 이동 (A->B)
echo -e "\n${c_head}[ STEP 5 ] W1 이동 (A->B현장)${c_reset}"
MV_W1=$(curl -s -X POST $BASE/api/attendance/move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $W1_JWT" \
  -d "{\"qrToken\":\"${QR_B}\",\"latitude\":37.4983,\"longitude\":127.0276}")
MV_OK=$(echo $MV_W1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
MV_MSG=$(echo $MV_W1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
echo "  응답: success=$MV_OK msg=$MV_MSG"
check "$MV_OK" "W1 이동 성공 (A->B)"

# STEP 6. W1 퇴근 (B현장)
echo -e "\n${c_head}[ STEP 6 ] W1 퇴근 (B현장)${c_reset}"
CO_W1=$(curl -s -X POST $BASE/api/attendance/check-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $W1_JWT" \
  -d "{\"qrToken\":\"${QR_B}\",\"latitude\":37.4983,\"longitude\":127.0276}")
CO_OK=$(echo $CO_W1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
CO_MSG=$(echo $CO_W1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
echo "  응답: success=$CO_OK msg=$CO_MSG"
check "$CO_OK" "W1 퇴근 성공 (B현장)"

# STEP 7. W2 출근만 (퇴근 누락 시나리오)
echo -e "\n${c_head}[ STEP 7 ] W2 출근 (A현장, 퇴근 누락 시나리오)${c_reset}"
CI_W2=$(curl -s -X POST $BASE/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $W2_JWT" \
  -d "{\"qrToken\":\"${QR_A}\",\"latitude\":37.5013,\"longitude\":127.0400}")
CI_W2_OK=$(echo $CI_W2 | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
echo "  응답: $CI_W2_OK"
check "$CI_W2_OK" "W2 출근 성공 (A현장)"

# STEP 8. 예외: 재퇴근 차단
echo -e "\n${c_head}[ STEP 8 ] 예외: W1 재퇴근 차단${c_reset}"
CO_DUP=$(curl -s -X POST $BASE/api/attendance/check-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $W1_JWT" \
  -d "{\"qrToken\":\"${QR_B}\",\"latitude\":37.4983,\"longitude\":127.0276}")
DUP_OK=$(echo $CO_DUP | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
echo "  응답: $DUP_OK (False여야 정상)"
check "$([ "$DUP_OK" = "False" ] && echo true || echo false)" "재퇴근 차단 확인"

# STEP 9. 관리자 화면 반영
echo -e "\n${c_head}[ STEP 9 ] 관리자 화면 반영 확인${c_reset}"
TODAY=$(date +%Y-%m-%d)
ATTN=$(curl -s "$BASE/api/admin/attendance?workDate=$TODAY" -b $COOKIE)
TOTAL=$(echo $ATTN | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('items',[])))" 2>/dev/null)
COMPLETED=$(echo $ATTN | python3 -c "import sys,json; items=json.load(sys.stdin).get('data',{}).get('items',[]); print(sum(1 for i in items if i.get('status')=='COMPLETED'))" 2>/dev/null)
WORKING=$(echo $ATTN | python3 -c "import sys,json; items=json.load(sys.stdin).get('data',{}).get('items',[]); print(sum(1 for i in items if i.get('status')=='WORKING'))" 2>/dev/null)
echo "  전체=${TOTAL} COMPLETED=${COMPLETED} WORKING=${WORKING}"
check "$([ ${TOTAL:-0} -ge 2 ] && echo true || echo false)" "관리자 목록 ${TOTAL}건 반영"
check "$([ ${COMPLETED:-0} -ge 1 ] && echo true || echo false)" "COMPLETED ${COMPLETED}건"
check "$([ ${WORKING:-0} -ge 1 ] && echo true || echo false)" "WORKING ${WORKING}건 (자동퇴근 대상)"

# STEP 10. 이동 이벤트 상세
echo -e "\n${c_head}[ STEP 10 ] W1 이동 이벤트 상세 확인${c_reset}"
W1_LOG_ID=$(echo $ATTN | python3 -c "
import sys,json
items=json.load(sys.stdin).get('data',{}).get('items',[])
for i in items:
    if i.get('workerName')=='김철수': print(i.get('id','')); break
" 2>/dev/null)
echo "  W1_LOG_ID=$W1_LOG_ID"
if [ -n "$W1_LOG_ID" ]; then
  DETAIL=$(curl -s "$BASE/api/admin/attendance/$W1_LOG_ID" -b $COOKIE)
  MOVE_CNT=$(echo $DETAIL | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',{}).get('moveEvents',[])))" 2>/dev/null)
  STATUS=$(echo $DETAIL | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status','?'))" 2>/dev/null)
  echo "  status=$STATUS moveEvents=${MOVE_CNT}건"
  check "$([ ${MOVE_CNT:-0} -ge 1 ] && echo true || echo false)" "MOVE 이벤트 ${MOVE_CNT}건 기록"
  check "$([ \"$STATUS\" = \"COMPLETED\" ] && echo true || echo false)" "W1 COMPLETED 확인"
fi

# STEP 11. 노임 집계
echo -e "\n${c_head}[ STEP 11 ] 노임 집계 확인${c_reset}"
LABOR=$(curl -s "$BASE/api/admin/labor/allocations?dateFrom=$TODAY&dateTo=$TODAY" -b $COOKIE)
ROWS=$(echo $LABOR | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('meta',{}).get('totalRows',0))" 2>/dev/null)
INCLUDED=$(echo $LABOR | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('meta',{}).get('includedCount',0))" 2>/dev/null)
REVIEW=$(echo $LABOR | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('meta',{}).get('needsReviewCount',0))" 2>/dev/null)
echo "  전체=${ROWS} 집계포함=${INCLUDED} 검토필요=${REVIEW}"
check "$([ ${ROWS:-0} -ge 2 ] && echo true || echo false)" "집계 행 ${ROWS}건"
check "$([ ${INCLUDED:-0} -ge 1 ] && echo true || echo false)" "포함 ${INCLUDED}건 (COMPLETED)"
check "$([ ${REVIEW:-0} -ge 1 ] && echo true || echo false)" "검토필요 ${REVIEW}건 (WORKING)"

# STEP 12. 수동 보정 (W2 WORKING -> ADJUSTED)
echo -e "\n${c_head}[ STEP 12 ] 수동 보정: W2 WORKING->ADJUSTED${c_reset}"
W2_LOG_ID=$(echo $ATTN | python3 -c "
import sys,json
items=json.load(sys.stdin).get('data',{}).get('items',[])
for i in items:
    if i.get('workerName')=='이영희': print(i.get('id','')); break
" 2>/dev/null)
if [ -n "$W2_LOG_ID" ]; then
  PATCH=$(curl -s -X PATCH "$BASE/api/admin/attendance/$W2_LOG_ID" \
    -H "Content-Type: application/json" \
    -b $COOKIE \
    -d "{\"checkOutAt\":\"${TODAY}T18:00:00+09:00\",\"status\":\"ADJUSTED\",\"adminNote\":\"시뮬레이션 수동 보정\"}")
  PATCH_OK=$(echo $PATCH | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  PATCH_STATUS=$(echo $PATCH | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status','?'))" 2>/dev/null)
  echo "  보정: success=$PATCH_OK status=$PATCH_STATUS"
  check "$PATCH_OK" "수동 보정 성공"
  check "$([ \"$PATCH_STATUS\" = \"ADJUSTED\" ] && echo true || echo false)" "status=ADJUSTED 확인"
  LABOR2=$(curl -s "$BASE/api/admin/labor/allocations?dateFrom=$TODAY&dateTo=$TODAY" -b $COOKIE)
  INCLUDED2=$(echo $LABOR2 | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('meta',{}).get('includedCount',0))" 2>/dev/null)
  check "$([ ${INCLUDED2:-0} -ge 2 ] && echo true || echo false)" "보정 후 포함 ${INCLUDED2}건 (즉시 재집계)"
fi

# STEP 13. dryRun 자동퇴근
echo -e "\n${c_head}[ STEP 13 ] dryRun 자동퇴근${c_reset}"
SECRET=$(grep '^CRON_SECRET=' ~/app/attendance/.env | cut -d'"' -f2)
DRY=$(curl -s -X POST "$BASE/api/cron/auto-checkout?dryRun=true" \
  -H "Authorization: Bearer $SECRET")
DRY_OK=$(echo $DRY | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
DRY_FOUND=$(echo $DRY | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('totalFound',0))" 2>/dev/null)
echo "  success=$DRY_OK totalFound=$DRY_FOUND"
check "$DRY_OK" "dryRun 자동퇴근 성공"

# 최종
echo ""
echo -e "${c_head}================================================${c_reset}"
echo -e "  결과: \033[32m${pass}통과\033[0m / \033[31m${fail}실패\033[0m"
if [ $fail -eq 0 ]; then
  echo -e "  \033[32m파일럿 1일차 시뮬레이션 전 항목 PASS\033[0m"
else
  echo -e "  \033[31mFAIL 항목 확인 필요\033[0m"
fi
echo -e "${c_head}================================================${c_reset}"
