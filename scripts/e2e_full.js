const http = require("http");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();

function adminToken() {
  return jwt.sign({ sub: "clz00000000000000000000000", type: "admin", role: "SUPER_ADMIN" }, SECRET, { expiresIn: "1d" });
}
function workerToken(workerId) {
  return jwt.sign({ sub: workerId, type: "worker" }, SECRET, { expiresIn: "7d" });
}

function call(method, path, body, tokenType, tokenValue) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : "";
    const cookieName = tokenType === "admin" ? "admin_token" : "worker_token";
    const opts = {
      hostname: "localhost", port: 3002, method,
      path,
      headers: { "Content-Type": "application/json", "Cookie": cookieName + "=" + tokenValue }
    };
    if (bodyStr) opts.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    const req = http.request(opts, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = { raw: data.substring(0, 500) }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function step(num, label, r, expectOk) {
  const ok = expectOk ? (r.status >= 200 && r.status < 300) : (r.status >= 400);
  const mark = ok ? "PASS" : "FAIL";
  const summary = typeof r.body === "object" ? JSON.stringify(r.body).substring(0, 400) : String(r.body).substring(0, 400);
  console.log("[" + mark + " " + r.status + "] " + num + ". " + label);
  console.log("  " + summary);
  console.log("");
  return ok;
}

async function main() {
  const AT = adminToken();
  const TS = Date.now().toString(36);

  console.log("============================================================");
  console.log("  전체 운영 시나리오 E2E 검증 시작");
  console.log("  timestamp: " + new Date().toISOString());
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;
  let bugs = [];
  function check(ok, bugDesc) {
    if (ok) passed++; else { failed++; if (bugDesc) bugs.push(bugDesc); }
  }

  // ========== 1. 신규 근로자 등록 (관리자 직접) ==========
  const phone = "010" + (70000000 + Math.floor(Math.random() * 9999999)).toString().padStart(8, "0");
  const workerName = "E2E검증자_" + TS;
  const r1 = await call("POST", "/api/admin/workers", {
    name: workerName,
    phone: phone,
    jobTitle: "배관공",
    employmentType: "DAILY_CONSTRUCTION",
    organizationType: "DIRECT",
    birthDate: "19850315"
  }, "admin", AT);
  check(step("1", "신규 근로자 등록", r1, true), "근로자 등록 실패");
  if (r1.status >= 300) { console.log("STOP: 근로자 등록 실패. 이후 단계 불가."); await prisma.$disconnect(); return; }
  const workerId = r1.body.data ? r1.body.data.id : r1.body.id;
  console.log("  workerId = " + workerId);
  console.log("  phone = " + phone);
  console.log("");

  // DB 확인
  const w1 = await prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, name: true, phone: true, accountStatus: true, isActive: true } });
  console.log("  [DB] accountStatus=" + w1.accountStatus + " isActive=" + w1.isActive);
  console.log("");

  // ========== 2. 관리자 승인 상태 확인 ==========
  const r2ok = w1.accountStatus === "APPROVED";
  console.log("[" + (r2ok ? "PASS" : "FAIL") + "] 2. 관리자 직접 등록 근로자 승인 상태");
  console.log("  accountStatus=" + w1.accountStatus + " (기대: APPROVED)");
  console.log("");
  check(r2ok, "관리자 직접 등록 근로자가 APPROVED가 아님: " + w1.accountStatus);

  // ========== 3. 현장 개설 ==========
  const siteName = "E2E검증현장_" + TS;
  const r3 = await call("POST", "/api/admin/sites", {
    name: siteName,
    address: "서울시 종로구 세종대로 209",
    latitude: 37.5759,
    longitude: 126.9769,
    allowedRadius: 200,
    notes: "E2E 전체 검증용 현장"
  }, "admin", AT);
  check(step("3", "현장 개설", r3, true), "현장 개설 실패");
  if (r3.status >= 300) { console.log("STOP: 현장 개설 실패."); await prisma.$disconnect(); return; }
  const siteId = r3.body.data ? r3.body.data.id : r3.body.id;
  console.log("  siteId = " + siteId);
  console.log("");

  // DB 확인
  const s1 = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, isActive: true, qrToken: true, latitude: true, longitude: true } });
  console.log("  [DB] isActive=" + s1.isActive + " qrToken=" + (s1.qrToken ? s1.qrToken.substring(0, 8) + "..." : "없음"));
  console.log("");

  // ========== 4. 근로자 현장 배정 (관리자 직접) ==========
  const companies = await prisma.company.findMany({ take: 1, select: { id: true, companyName: true } });
  let companyId = null;
  if (companies.length > 0) {
    companyId = companies[0].id;
    console.log("  [기존 회사] " + companies[0].id + " " + companies[0].companyName);
  } else {
    console.log("  [경고] 회사 없음");
  }
  console.log("");

  const r4 = await call("POST", "/api/admin/workers/" + workerId + "/site-assignments", {
    siteId: siteId,
    companyId: companyId,
    assignedFrom: new Date().toISOString().slice(0, 10),
    tradeType: "배관",
    isPrimary: true,
    notes: "E2E 검증용 배정"
  }, "admin", AT);
  check(step("4", "근로자 현장 배정", r4, true), "근로자 현장 배정 실패");

  // DB 확인
  const assign = await prisma.workerSiteAssignment.findFirst({
    where: { workerId, siteId },
    select: { id: true, isActive: true, isPrimary: true, assignedFrom: true, tradeType: true }
  });
  if (assign) {
    console.log("  [DB] assignmentId=" + assign.id + " isActive=" + assign.isActive + " isPrimary=" + assign.isPrimary);
  } else {
    console.log("  [DB] 배정 레코드 없음");
  }
  console.log("");

  // ========== 5. 계약서 생성 ==========
  const r5 = await call("POST", "/api/admin/contracts", {
    workerId: workerId,
    siteId: siteId,
    contractType: "DAILY",
    contractKind: "EMPLOYMENT",
    contractTemplateType: "DAILY_EMPLOYMENT",
    startDate: new Date().toISOString().slice(0, 10),
    dailyWage: 250000,
    paymentDay: 25,
    nationalPensionYn: false,
    healthInsuranceYn: false,
    employmentInsuranceYn: false,
    industrialAccidentYn: true,
    safetyClauseYn: true,
    checkInTime: "08:00",
    checkOutTime: "17:00",
    workDays: "현장 여건에 따름",
    paymentMethod: "계좌이체",
    companyName: "주식회사 해한",
    companyRepName: "홍길동",
    companyBizNo: "123-45-67890",
    companyAddress: "서울시 강남구",
    companyPhone: "02-1234-5678",
    workerBankName: "국민은행",
    workerAccountNumber: "999-888-7777",
    workerAccountHolder: workerName,
    breakStartTime: "12:00",
    breakEndTime: "13:00",
    breakHours: "1",
    workDate: new Date().toISOString().slice(0, 10),
    projectName: "E2E전체검증공사",
    workType: "배관",
    jobCategory: "배관공",
    taskDescription: "배관설비 작업",
    siteAddress: "서울시 종로구 세종대로 209",
    laborRelationType: "DIRECT_EMPLOYEE"
  }, "admin", AT);
  check(step("5", "계약서 생성 (DAILY_EMPLOYMENT)", r5, true), "계약서 생성 실패");
  if (r5.status >= 300) { console.log("STOP: 계약서 생성 실패."); await prisma.$disconnect(); return; }
  const contractId = r5.body.data.id;
  console.log("  contractId = " + contractId);
  console.log("  contractStatus = " + r5.body.data.contractStatus);
  console.log("  contractTemplateType = " + r5.body.data.contractTemplateType);
  console.log("");

  // ========== 6. generate-doc ==========
  const r6 = await call("POST", "/api/admin/contracts/" + contractId + "/generate-doc", { docType: "CONTRACT" }, "admin", AT);
  check(step("6", "generate-doc (CONTRACT)", r6, true), "generate-doc 실패");
  if (r6.status >= 300) { console.log("STOP: generate-doc 실패. " + JSON.stringify(r6.body)); await prisma.$disconnect(); return; }
  console.log("  docId = " + r6.body.data.id);
  console.log("  fileName = " + r6.body.data.fileName);
  console.log("  contentText length = " + (r6.body.data.contentText ? r6.body.data.contentText.length : 0));
  console.log("");

  // ========== 7. 근로자 모바일 — 계약서 조회 ==========
  const WT = workerToken(workerId);

  const r7 = await call("GET", "/api/worker/contracts/" + contractId, null, "worker", WT);
  check(step("7", "근로자 계약서 조회", r7, true), "근로자 계약서 조회 실패");
  if (r7.body.data) {
    console.log("  guide.code = " + (r7.body.data.guide ? r7.body.data.guide.code : "null"));
    console.log("  wage = " + r7.body.data.wage);
    console.log("  viewConfirmed = " + r7.body.data.viewConfirmed);
    console.log("");
  }

  // ========== 8. 모바일 3단계 서명 ==========
  const r8a = await call("POST", "/api/worker/contracts/" + contractId + "/confirm", { stage: "VIEW" }, "worker", WT);
  check(step("8a", "VIEW confirm", r8a, true), "VIEW confirm 실패");

  const r8b = await call("GET", "/api/worker/contracts/" + contractId + "/document", null, "worker", WT);
  check(step("8b", "문서 열람", r8b, true), "문서 열람 실패");
  if (r8b.body.data && r8b.body.data.document) {
    const cj = r8b.body.data.document.contentJson;
    console.log("  title = " + cj.title);
    console.log("  sections = " + cj.sections.length);
    console.log("  signatureBlock = " + (!!cj.signatureBlock));
    console.log("");
  }

  const r8c = await call("POST", "/api/worker/contracts/" + contractId + "/confirm", { stage: "PRESIGN" }, "worker", WT);
  check(step("8c", "PRESIGN confirm", r8c, true), "PRESIGN confirm 실패");

  const sigData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0AEYBxVOHIUAgBGWAgE/dLkGAAAAABJRU5ErkJggg==";
  const r8d = await call("POST", "/api/worker/contracts/" + contractId + "/sign", { signatureData: sigData }, "worker", WT);
  check(step("8d", "전자서명", r8d, true), "전자서명 실패");

  // ========== 9. 계약 상태 반영 확인 ==========
  const cFinal = await prisma.workerContract.findUnique({
    where: { id: contractId },
    select: { contractStatus: true, signedAt: true, workerSignatureData: true, notes: true }
  });
  const r9ok = cFinal.contractStatus === "REVIEW_REQUESTED" && !!cFinal.workerSignatureData && !!cFinal.signedAt;
  console.log("[" + (r9ok ? "PASS" : "FAIL") + "] 9. 계약 상태 반영 확인");
  console.log("  contractStatus = " + cFinal.contractStatus);
  console.log("  signedAt = " + cFinal.signedAt);
  console.log("  workerSignatureData = " + (cFinal.workerSignatureData ? cFinal.workerSignatureData.length + "자" : "없음"));
  console.log("  notes 단계 이력:");
  if (cFinal.notes) cFinal.notes.split("\n").forEach(l => console.log("    " + l));
  console.log("");
  check(r9ok, "계약 상태 전이 비정상: " + cFinal.contractStatus);

  // ========== 10. 출근 가능 대상 상태 확인 ==========
  const r10 = await call("GET", "/api/worker/my-status", null, "worker", WT);
  check(step("10a", "근로자 상태 조회 (my-status)", r10, true), "my-status 조회 실패");
  if (r10.body.data) {
    const d = r10.body.data;
    console.log("  accountStatus = " + JSON.stringify(d.accountStatus));
    console.log("  assignedSites = " + (d.assignedSites ? d.assignedSites.length + "건" : "없음"));
    if (d.assignedSites && d.assignedSites.length > 0) {
      d.assignedSites.forEach(s => console.log("    " + s.siteName + " isActive=" + s.isActive));
    }
    if (d.attendanceEligibility) {
      console.log("  canCheckIn = " + d.attendanceEligibility.canCheckIn);
      if (d.attendanceEligibility.blockReasons && d.attendanceEligibility.blockReasons.length > 0) {
        d.attendanceEligibility.blockReasons.forEach(b => console.log("    [BLOCK] " + b.code + ": " + b.message));
      }
      console.log("  summary = " + d.attendanceEligibility.summary);
    }
    console.log("");
  }

  // 출근 가능 현장 조회
  const r10b = await call("GET", "/api/attendance/available-sites?lat=37.5759&lng=126.9769", null, "worker", WT);
  check(step("10b", "출근 가능 현장 조회", r10b, true), "출근 가능 현장 조회 실패");
  if (r10b.body.data && Array.isArray(r10b.body.data)) {
    console.log("  available sites = " + r10b.body.data.length + "건");
    r10b.body.data.forEach(s => console.log("    " + s.siteName + " dist=" + s.distanceMeters + "m within=" + s.withinRadius));
    console.log("");
  }

  // ========== 10c. 기기 등록 + 승인 + 사진 레코드 생성 (DB 직접) ==========
  const deviceToken = "e2e-test-device-" + TS;
  const device = await prisma.workerDevice.create({
    data: {
      workerId: workerId,
      deviceToken: deviceToken,
      deviceName: "E2E 테스트 기기",
      platform: "Android",
      browser: "Chrome",
      isPrimary: true,
      isActive: true,
      isBlocked: false,
      approvedAt: new Date(),
      approvedBy: "clz00000000000000000000000",
    }
  });
  console.log("[PASS] 10c. 기기 등록 + 승인 (DB 직접)");
  console.log("  deviceId = " + device.id);
  console.log("  deviceToken = " + deviceToken);
  console.log("");
  passed++;

  // 기기 등록 후 canCheckIn 재확인
  const r10c2 = await call("GET", "/api/worker/my-status", null, "worker", WT);
  if (r10c2.body.data && r10c2.body.data.attendanceEligibility) {
    console.log("  [기기 승인 후] canCheckIn = " + r10c2.body.data.attendanceEligibility.canCheckIn);
    if (r10c2.body.data.attendanceEligibility.blockReasons && r10c2.body.data.attendanceEligibility.blockReasons.length > 0) {
      r10c2.body.data.attendanceEligibility.blockReasons.forEach(b => console.log("    [BLOCK] " + b.code + ": " + b.message));
    }
    console.log("");
  }

  // 출근 사진 AttendancePhotoEvidence 생성
  const photoRecord = await prisma.attendancePhotoEvidence.create({
    data: {
      workerId: workerId,
      siteId: siteId,
      photoType: "CHECK_IN",
      filePath: "/uploads/e2e-test-photo-" + TS + ".jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 1024,
      latitude: 37.5759,
      longitude: 126.9769,
      deviceToken: deviceToken,
    }
  });
  console.log("  photoId = " + photoRecord.id);
  console.log("");

  // ========== 11. 실제 출근 시도 (QR) ==========
  if (s1.qrToken) {
    const r11 = await call("POST", "/api/attendance/check-in", {
      qrToken: s1.qrToken,
      latitude: 37.5759,
      longitude: 126.9769,
      deviceToken: deviceToken,
      checkInPhotoId: photoRecord.id
    }, "worker", WT);
    check(step("11", "QR 출근 시도", r11, true), "QR 출근 실패: " + JSON.stringify(r11.body).substring(0, 200));
    if (r11.body.data) {
      console.log("  attendanceId = " + r11.body.data.attendanceId);
      console.log("  distance = " + r11.body.data.distance + "m");
      console.log("  withinRadius = " + r11.body.data.withinRadius);
      console.log("");
    }
  } else {
    console.log("[SKIP] 11. QR 출근 — qrToken 없음\n");
  }

  // ========== 결과 요약 ==========
  console.log("============================================================");
  console.log("  E2E 검증 결과 요약");
  console.log("============================================================");
  console.log("  통과: " + passed + "건");
  console.log("  실패: " + failed + "건");
  if (bugs.length > 0) {
    console.log("  발견된 버그:");
    bugs.forEach((b, i) => console.log("    " + (i + 1) + ". " + b));
  } else {
    console.log("  발견된 버그: 없음");
  }
  console.log("");
  console.log("  생성된 데이터:");
  console.log("    근로자: " + workerId + " (" + workerName + ", " + phone + ")");
  console.log("    현장: " + siteId + " (" + siteName + ")");
  console.log("    계약서: " + contractId);
  console.log("============================================================");

  await prisma.$disconnect();
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
