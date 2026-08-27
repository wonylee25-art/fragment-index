# -*- coding: utf-8 -*-
"""hwpx 파일에서 본문 텍스트와 표를 뽑는다.

기관 공고·지침·목록이 hwpx로만 걸려 있는 일이 잦아, 원문을 눈으로 확인하려면 이게 필요하다.
hwpx는 zip으로 묶인 XML(OWPML)이라 표준 라이브러리만으로 열린다 — 구형 .hwp(OLE 바이너리)는
이 스크립트로 못 읽으니 다른 도구를 써야 한다.

    python3 scripts/read-hwpx.py <파일>          # 본문을 줄글로
    python3 scripts/read-hwpx.py <파일> --table  # 표만 행 단위로(셀 구분 ‖)

--table 쪽은 목록형 문서를 셀 단위로 세야 할 때 쓴다(예: 국사편찬위원회 구술자료 수집
목록에서 연도별 주제·인원·수집시간 합계를 뽑을 때).
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

SECTION_RE = re.compile(r"Contents/section\d+\.xml$")


def _tag(el):
    return el.tag.split("}")[-1]


def _sections(path):
    z = zipfile.ZipFile(path)
    for name in sorted(n for n in z.namelist() if SECTION_RE.match(n)):
        yield ET.fromstring(z.read(name))


def _text(el):
    return "".join(t.text or "" for t in el.iter() if _tag(t) == "t").strip()


def body_text(path):
    """문단은 줄바꿈으로, 표 셀은 | 로 갈라 이어 붙인다."""
    out = []
    for root in _sections(path):
        for el in root.iter():
            tag = _tag(el)
            if tag == "t":
                out.append(el.text or "")
            elif tag in ("p", "tr"):
                out.append("\n")
            elif tag == "tc":
                out.append(" | ")
    s = "".join(out)
    s = re.sub(r"[ \t]*\|[ \t]*\n", "\n", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def table_rows(path):
    """표만 행 단위로 뽑는다. 병합된 셀은 빈 칸으로 나온다."""
    rows = []
    for root in _sections(path):
        for tbl in root.iter():
            if _tag(tbl) != "tbl":
                continue
            for tr in tbl:
                if _tag(tr) != "tr":
                    continue
                rows.append([_text(tc) for tc in tr if _tag(tc) == "tc"])
    return rows


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    target = sys.argv[1]
    if "--table" in sys.argv[2:]:
        for row in table_rows(target):
            print(" ‖ ".join(row))
    else:
        print(body_text(target))
