#!/usr/bin/env python3
"""Convierte la extracción U-Campus en una migración autocontenida de PocketBase."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path


def normalized_name(value: str) -> str:
    folded = unicodedata.normalize("NFD", value.casefold())
    without_marks = "".join(char for char in folded if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", without_marks).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    args = parser.parse_args()
    source = json.loads(args.input.read_text(encoding="utf-8"))
    semester = str(source["semester"])
    professors = [
        {
            "name": item["name"],
            "search_name": normalized_name(item["name"]),
            "departments": sorted({department.split(" - ", 1)[0] for department in item["departments"]}),
        }
        for item in source["professors"]
    ]
    seed = json.dumps(professors, ensure_ascii=False, separators=(",", ":"))

    print('/// <reference path="../pb_data/types.d.ts" />')
    print()
    print(f"// Nómina pública extraída del catálogo FCFM de U-Campus para Primavera 2026 ({semester}).")
    print("// Se guarda solo el nombre publicado y las siglas de sus departamentos; no se copian fotos ni IDs externos.")
    print(f"const PROFESSORS_20262 = {seed};")
    print()
    print(r'''migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const professors = new Collection({
        id: "allianceprofs01",
        name: "alliance_professors",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            { name: "name", type: "text", required: true, max: 160 },
            { name: "search_name", type: "text", required: true, max: 160 },
            { name: "departments", type: "json", required: false, maxSize: 1000 },
            { name: "semester", type: "text", required: true, max: 10 },
            { name: "created", type: "autodate", onCreate: true },
        ],
        indexes: [
            "CREATE INDEX idx_alliance_professors_name ON alliance_professors (name)",
            "CREATE INDEX idx_alliance_professors_search_name ON alliance_professors (search_name)",
            "CREATE INDEX idx_alliance_professors_semester ON alliance_professors (semester)",
        ],
    });
    app.save(professors);

    const claims = new Collection({
        id: "allianceclaims1",
        name: "alliance_professor_claims",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: "professor",
                type: "relation",
                collectionId: professors.id,
                cascadeDelete: true,
                maxSelect: 1,
                required: true,
            },
            {
                name: "user",
                type: "relation",
                collectionId: users.id,
                cascadeDelete: false,
                maxSelect: 1,
                required: true,
            },
            {
                name: "alliance",
                type: "select",
                values: ["urbana", "pop", "gotico", "hiphop", "punk", "rock"],
                maxSelect: 1,
                required: true,
            },
            {
                name: "photo",
                type: "file",
                required: true,
                maxSelect: 1,
                maxSize: 2097152,
                mimeTypes: ["image/jpeg"],
                thumbs: ["100x100"],
            },
            { name: "deleted", type: "bool", required: false },
            { name: "created", type: "autodate", onCreate: true },
        ],
        indexes: [
            "CREATE UNIQUE INDEX idx_alliance_professor_claim ON alliance_professor_claims (professor) WHERE deleted = false",
            "CREATE INDEX idx_alliance_professor_claim_alliance ON alliance_professor_claims (alliance)",
        ],
    });
    app.save(claims);

    for (const professor of PROFESSORS_20262) {
        const record = new Record(professors);
        record.set("name", professor.name);
        record.set("search_name", professor.search_name);
        record.set("departments", professor.departments);
        record.set("semester", "20262");
        app.save(record);
    }
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("alliance_professor_claims")); } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId("alliance_professors")); } catch (e) {}
});''')


if __name__ == "__main__":
    main()
