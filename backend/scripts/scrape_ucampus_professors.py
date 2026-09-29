#!/usr/bin/env python3
"""Extrae la nómina pública de docentes del catálogo FCFM de U-Campus."""

from __future__ import annotations

import argparse
import html
import json
import re
import unicodedata
import urllib.parse
import urllib.request


CATALOG_URL = "https://ucampus.uchile.cl/m/fcfm_catalogo/"
PERSON_RE = re.compile(
    r'<h1[^>]*>\s*(<img[^>]+alt="Foto de persona"[^>]*>)\s*(.*?)\s*</h1>',
    re.IGNORECASE | re.DOTALL,
)
DEPARTMENT_RE = re.compile(r"<option\b([^>]*)>(.*?)</option>", re.IGNORECASE | re.DOTALL)
VALUE_RE = re.compile(r'\bvalue="([^"]*)"', re.IGNORECASE)
SRC_RE = re.compile(r'\bsrc="([^"]*)"', re.IGNORECASE)
UCAMPUS_USER_RE = re.compile(r"/usuario/[^/]+/([^/]+)/", re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")


def clean_text(value: str) -> str:
    return " ".join(html.unescape(TAG_RE.sub("", value)).split())


def normalized_name(value: str) -> str:
    folded = unicodedata.normalize("NFD", value.casefold())
    without_marks = "".join(char for char in folded if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", without_marks).strip()


def fetch_page(semester: str, department: str | None = None) -> str:
    query = {"semestre": semester}
    if department:
        query["depto"] = department
    url = f"{CATALOG_URL}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(url, headers={"User-Agent": "Beauchapp catalog importer/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("iso-8859-1")


def department_options(page: str) -> list[tuple[str, str]]:
    select_match = re.search(
        r'<select[^>]+(?:name|id)="depto"[^>]*>(.*?)</select>',
        page,
        re.IGNORECASE | re.DOTALL,
    )
    if not select_match:
        raise RuntimeError("No se encontró el selector de departamentos de U-Campus.")
    departments = []
    for attributes, label in DEPARTMENT_RE.findall(select_match.group(1)):
        value_match = VALUE_RE.search(attributes)
        if value_match and value_match.group(1):
            departments.append((value_match.group(1), clean_text(label)))
    return departments


def scrape(semester: str) -> list[dict[str, object]]:
    first_page = fetch_page(semester)
    by_name: dict[str, dict[str, object]] = {}

    for department_id, department_label in department_options(first_page):
        page = fetch_page(semester, department_id)
        for image_tag, raw_name in PERSON_RE.findall(page):
            name = clean_text(raw_name)
            if not name:
                continue
            src_match = SRC_RE.search(image_tag)
            user_match = UCAMPUS_USER_RE.search(src_match.group(1)) if src_match else None
            # El primer hash del recurso identifica a la persona y se usa solo durante
            # la deduplicación. No se guarda en la salida ni en Beauchapp.
            key = f"ucampus:{user_match.group(1)}" if user_match else f"name:{normalized_name(name)}"
            current = by_name.setdefault(key, {"name": name, "departments": []})
            departments = current["departments"]
            if isinstance(departments, list) and department_label not in departments:
                departments.append(department_label)

    return sorted(by_name.values(), key=lambda item: normalized_name(str(item["name"])))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--semester", default="20262", help="Período U-Campus, por ejemplo 20262")
    args = parser.parse_args()
    professors = scrape(args.semester)
    print(json.dumps({"semester": args.semester, "professors": professors}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
