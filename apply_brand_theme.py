"""
해한Ai Engineering 브랜드 테마 일괄 적용
라이트 테마 → 다크 테마 변환
"""
import os, re

BASE = r"C:\Users\skyjw\OneDrive\03. PYTHON\31. construction-attendance\app"
EXTS = {'.tsx', '.ts'}
SKIP = {'node_modules', '.next', '__pycache__', '.git'}

# ── 교체 목록 (순서 중요) ─────────────────────────────────────
# 각 튜플: (검색 문자열, 교체 문자열)
# 긴 패턴 먼저, 짧은 패턴 나중

REPLACEMENTS = [

    # ══ 1. LAYOUT BACKGROUND ══════════════════════════════════
    ("minHeight: '100vh', background: '#f5f5f5'",
     "minHeight: '100vh', background: '#1B2838'"),
    ("minHeight: '100vh', background: '#f4f6fa'",
     "minHeight: '100vh', background: '#1B2838'"),

    # ══ 2. SIDEBAR ════════════════════════════════════════════
    # sidebar bg #1a1a2e → #141E2A
    ("background: '#1a1a2e', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },",
     "background: '#141E2A', padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' },"),
    ("background: '#1a1a2e', padding: '24px 0', flexShrink: 0 },",
     "background: '#141E2A', padding: '24px 0', flexShrink: 0 },"),
    ("background: '#1a1a2e', padding: '24px 0'",
     "background: '#141E2A', padding: '24px 0'"),
    # Login container
    ("display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }",
     "display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1B2838' }"),

    # ══ 3. ACTIVE NAV (orange accent) ═════════════════════════
    ("background: 'rgba(255,255,255,0.12)', borderLeft: '3px solid #90caf9'",
     "background: 'rgba(244,121,32,0.15)', borderLeft: '3px solid #F47920'"),
    ("background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600",
     "background: 'rgba(244,121,32,0.15)', color: 'white', fontWeight: 600"),
    # active border color in dynamic inline styles
    ("borderLeft: '3px solid #90caf9'", "borderLeft: '3px solid #F47920'"),
    ("borderLeft: '3px solid #1976d2'", "borderLeft: '3px solid #F47920'"),

    # ══ 4. CARDS / PANELS ═════════════════════════════════════
    # Card with borderRadius (main content cards)
    ("background: 'white', borderRadius: '10px'",
     "background: '#243144', borderRadius: '10px'"),
    ("background: 'white', borderRadius: '12px'",
     "background: '#243144', borderRadius: '12px'"),
    ("background: 'white', borderRadius: '8px'",
     "background: '#1E3350', borderRadius: '8px'"),
    ("background: 'white', borderRadius: '6px'",
     "background: '#1E3350', borderRadius: '6px'"),
    # boxShadow update
    ("boxShadow: '0 1px 4px rgba(0,0,0,0.06)'",
     "boxShadow: '0 2px 8px rgba(0,0,0,0.35)'"),
    ("boxShadow: '0 1px 4px rgba(0,0,0,0.08)'",
     "boxShadow: '0 2px 8px rgba(0,0,0,0.35)'"),

    # ══ 5. PRIMARY BUTTONS (orange) ═══════════════════════════
    ("background: '#1976d2', color: 'white'",
     "background: '#F47920', color: 'white'"),
    ("background: '#1565c0', color: 'white'",
     "background: '#E06810', color: 'white'"),
    # Login button
    ("background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'",
     "background: '#F47920', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'"),
    # Secondary/purple buttons (keep as is, or adapt)
    ("background: '#7b1fa2', color: 'white'", "background: '#7b1fa2', color: 'white'"),

    # ══ 6. BLUE ACCENT → ORANGE/BRAND ═════════════════════════
    # #90caf9 (light blue) → brand orange (non-nav contexts)
    ("border: '1px solid #90caf9', background: '#e3f2fd', color: '#1565c0'",
     "border: '1px solid #F47920', background: 'rgba(244,121,32,0.12)', color: '#F47920'"),
    ("border: '1px solid #90caf9', background: '#e3f2fd'",
     "border: '1px solid #F47920', background: 'rgba(244,121,32,0.12)'"),
    ("background: '#e3f2fd', color: '#1565c0', fontWeight:",
     "background: 'rgba(244,121,32,0.12)', color: '#F47920', fontWeight:"),
    ("background: '#e3f2fd', color: '#1565c0'",
     "background: 'rgba(244,121,32,0.12)', color: '#F47920'"),
    ("background: '#e3f2fd', color: '#1976d2'",
     "background: 'rgba(91,164,217,0.12)', color: '#5BA4D9'"),
    ("background: '#e3f2fd', border: '1px solid #bbdefb'",
     "background: 'rgba(91,164,217,0.12)', border: '1px solid rgba(91,164,217,0.3)'"),
    ("background: '#e3f2fd'", "background: 'rgba(91,164,217,0.1)'"),
    # #e8f5e9 green tint stays — success color
    # #fff3e0 orange tint stays — warning
    # #ffebee red tint stays — error

    # ══ 7. PRIMARY COLOR TEXTS ════════════════════════════════
    ("color: '#1976d2', textDecoration:", "color: '#5BA4D9', textDecoration:"),
    ("color: '#1976d2'", "color: '#5BA4D9'"),
    ("color: '#1565c0'", "color: '#4A93C8'"),
    ("color: '#1565c0',", "color: '#4A93C8',"),

    # ══ 8. TABLE HEADER ═══════════════════════════════════════
    ("color: '#666', borderBottom: '1px solid #f0f0f0'",
     "color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.2)'"),
    ("color: '#888', borderBottom: '2px solid #f0f0f0'",
     "color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)'"),
    ("color: '#888', borderBottom: '1px solid #f0f0f0'",
     "color: '#A0AEC0', borderBottom: '1px solid rgba(91,164,217,0.15)'"),
    ("color: '#555', borderBottom: '2px solid #eee'",
     "color: '#A0AEC0', borderBottom: '2px solid rgba(91,164,217,0.2)'"),
    ("background: '#f5f6fa', padding:", "background: '#1E3350', padding:"),
    ("background: '#f9fafb', padding:", "background: '#1E3350', padding:"),

    # ══ 9. TABLE ROW BORDERS ══════════════════════════════════
    ("borderBottom: '1px solid #f5f5f5', verticalAlign:",
     "borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign:"),
    ("borderBottom: '1px solid #f9f9f9', verticalAlign:",
     "borderBottom: '1px solid rgba(91,164,217,0.1)', verticalAlign:"),
    ("borderBottom: '1px solid #f5f5f5'}", "borderBottom: '1px solid rgba(91,164,217,0.1)'}"),
    ("borderBottom: '1px solid #eee'}", "borderBottom: '1px solid rgba(91,164,217,0.1)'}"),

    # ══ 10. INPUT / SELECT ════════════════════════════════════
    ("border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', background: 'white'",
     "border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px', background: '#1E3048', color: '#E2E8F0'"),
    ("border: '1px solid #ddd', borderRadius:",
     "border: '1px solid rgba(91,164,217,0.3)', borderRadius:"),
    ("border: '1px solid #e0e0e0', borderRadius: '6px'",
     "border: '1px solid rgba(91,164,217,0.2)', borderRadius: '6px'"),
    ("border: '1px solid #d1d5db'",
     "border: '1px solid rgba(91,164,217,0.3)'"),
    # Filter select (common pattern)
    ("padding: '7px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', background: 'white'",
     "padding: '7px 12px', border: '1px solid rgba(91,164,217,0.3)', borderRadius: '6px', fontSize: '13px', background: '#1E3048', color: '#E2E8F0'"),

    # ══ 11. MUTED TEXT ════════════════════════════════════════
    ("color: '#888', marginBottom:", "color: '#A0AEC0', marginBottom:"),
    ("color: '#888', marginTop:", "color: '#A0AEC0', marginTop:"),
    ("color: '#888', fontSize:", "color: '#A0AEC0', fontSize:"),
    ("color: '#888', textAlign:", "color: '#A0AEC0', textAlign:"),
    ("color: '#888' }", "color: '#A0AEC0' }"),
    ("color: '#888',", "color: '#A0AEC0',"),
    ("color: '#999'}", "color: '#718096'}"),
    ("color: '#999',", "color: '#718096',"),
    ("color: '#aaa'}", "color: '#4A5568'}"),

    # ══ 12. BODY TEXT ═════════════════════════════════════════
    # Table td text
    ("color: '#333', borderBottom:", "color: '#CBD5E0', borderBottom:"),
    # Other #333 text in content
    ("fontSize: '13px', color: '#333'", "fontSize: '13px', color: '#CBD5E0'"),
    ("fontSize: '14px', color: '#333'", "fontSize: '14px', color: '#CBD5E0'"),

    # ══ 13. SECONDARY SURFACES ════════════════════════════════
    # f5f5f5 as bg for minor elements (page buttons, chips)
    ("background: '#f5f5f5', color: '#555'",
     "background: 'rgba(91,164,217,0.1)', color: '#A0AEC0'"),
    ("background: '#f5f5f5', color: '#666'",
     "background: 'rgba(91,164,217,0.1)', color: '#A0AEC0'"),
    # White bg for minor elements
    ("background: 'white', border: '1px solid #e0e0e0'",
     "background: '#1E3350', border: '1px solid rgba(91,164,217,0.2)'"),

    # ══ 14. REMAINING #f5f5f5 (background only) ═══════════════
    ("background: '#f5f5f5'", "background: '#1B2838'"),

    # ══ 15. SIDEBAR TITLE (add bottom border) ═════════════════
    # Already mostly fine — sidebarTitle uses 'white' text

    # ══ 16. MOBILE PAGE ════════════════════════════════════════
    # Mobile pages tend to use lighter theme — update key colors
    ("background: '#e3f2fd', borderRadius:", "background: 'rgba(91,164,217,0.12)', borderRadius:"),
]


def apply_to_file(fpath):
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return 0

    new_content = content
    for old, new in REPLACEMENTS:
        new_content = new_content.replace(old, new)

    if new_content != content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return 1
    return 0


changed = []
for root, dirs, files in os.walk(BASE):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for fname in files:
        if os.path.splitext(fname)[1] not in EXTS:
            continue
        fpath = os.path.join(root, fname)
        if apply_to_file(fpath):
            changed.append(fpath.replace(BASE + os.sep, ''))

print("변경된 파일 수: " + str(len(changed)))
for p in sorted(changed):
    print("  " + p)
