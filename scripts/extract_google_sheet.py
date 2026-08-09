#!/usr/bin/env python3
"""Extract a Site-Manager-tabbed auction tracking workbook into the raw row
format consumed by src/lib/sheetsImport.ts.

This is the mechanical, column-name-standardization half of the import
pipeline (see src/lib/sheetsImport.ts for the business-logic half: batch
resolution, request-status inference, and note classification).

Usage:
    python3 scripts/extract_google_sheet.py <month-label> <xlsx-path> [xlsx-path ...] > out.json

Example (regenerating this repo's dataset from fresh downloads):
    python3 scripts/extract_google_sheet.py "September 2026" september.xlsx > src/data/september-rows.json
    # then merge that array into src/data/raw-imported-rows.json and add the
    # new batch's auction-date -> deadline mapping to BATCH_BY_DATE in
    # src/lib/sheetsImport.ts.

Requires: pip install openpyxl

Deliberately excluded from extraction (not part of the dashboard's data
model, and shouldn't be duplicated into another system): lock codes, gate
codes, key-access instructions, and tenant names. Only facility, unit
number, site-manager name, auction date, and free-text status/notes are
pulled out.
"""
import json
import sys
import datetime
import openpyxl

# Tabs known not to be per-manager tracking sheets (lookup tables, rollups,
# scratch sheets). Extend this if a new workbook has other non-tracking tabs.
SKIP_SHEETS = {"NoAddressEmail", "Location Manager", "MasterFile", "Sheet1"}

FACILITY_HEADERS = {"sitename", "location"}
UNIT_HEADERS = {"unitname", "unit"}
AUCTION_DATE_HEADERS = {"auctionend", "auction date"}
PHOTO_STATUS_HEADERS = {"photos", "pictures", "photo status"}
LOCATION_CODE_HEADERS = {"locationcode", "aqq", "gen"}


def norm_header(h):
    if h is None:
        return ""
    return str(h).strip().lower().rstrip(":").replace("'s", "").strip()


def resolve_columns(header_row):
    cols = {}
    notes_idx = None
    for i, h in enumerate(header_row):
        hn = norm_header(h)
        if not hn:
            continue
        if hn in FACILITY_HEADERS and "facility" not in cols:
            cols["facility"] = i
        elif hn in UNIT_HEADERS and "unit" not in cols:
            cols["unit"] = i
        elif hn in AUCTION_DATE_HEADERS and "auction" not in cols:
            cols["auction"] = i
        elif hn in PHOTO_STATUS_HEADERS and "photo" not in cols:
            cols["photo"] = i
        elif hn in LOCATION_CODE_HEADERS and "loccode" not in cols:
            cols["loccode"] = i
        elif "note" in hn:
            notes_idx = i
    if notes_idx is not None:
        cols["notes"] = notes_idx
    return cols


def cell_to_str(v):
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        s = str(int(v))
    else:
        s = str(v).strip()
    return s if s else None


def extract_workbook(path, month_label):
    wb = openpyxl.load_workbook(path, data_only=True)
    records = []
    warnings = []
    for ws in wb.worksheets:
        if ws.title in SKIP_SHEETS:
            continue
        rows = list(ws.iter_rows(min_row=1, values_only=True))
        if not rows:
            continue
        header = rows[0]
        cols = resolve_columns(header)
        if "facility" not in cols or "unit" not in cols or "auction" not in cols:
            warnings.append(f"{path}:{ws.title} - could not resolve required columns, header={header[:8]}")
            continue

        manager = ws.title
        row_num = 1
        for row in rows[1:]:
            row_num += 1
            facility = cell_to_str(row[cols["facility"]]) if cols["facility"] < len(row) else None
            unit = cell_to_str(row[cols["unit"]]) if cols["unit"] < len(row) else None
            auction_raw = row[cols["auction"]] if cols["auction"] < len(row) else None

            if facility and "batch" in facility.lower() and unit is None:
                continue  # merged "SECOND BATCH" marker row
            if not facility and not unit:
                continue

            auction_date = None
            if isinstance(auction_raw, datetime.datetime):
                auction_date = auction_raw.date().isoformat()
            elif isinstance(auction_raw, datetime.date):
                auction_date = auction_raw.isoformat()
            if not auction_date:
                continue

            notes = cell_to_str(row[cols["notes"]]) if "notes" in cols and cols["notes"] < len(row) else None
            photo_raw = cell_to_str(row[cols["photo"]]) if "photo" in cols and cols["photo"] < len(row) else None
            loccode = cell_to_str(row[cols["loccode"]]) if "loccode" in cols and cols["loccode"] < len(row) else None

            records.append(
                {
                    "month": month_label,
                    "sourceSheetName": f"{month_label} Auction Tracker - {manager}",
                    "sourceRowKey": f"{month_label}::{manager}::row-{row_num}",
                    "manager": manager,
                    "facility": facility,
                    "locationCode": loccode,
                    "unitNumber": str(unit),
                    "auctionDate": auction_date,
                    "notesRaw": notes,
                    "photoStatusRaw": photo_raw,
                }
            )
    return records, warnings


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    month_label = sys.argv[1]
    all_records = []
    all_warnings = []
    for path in sys.argv[2:]:
        records, warnings = extract_workbook(path, month_label)
        all_records.extend(records)
        all_warnings.extend(warnings)

    print(json.dumps(all_records, indent=2))
    if all_warnings:
        for w in all_warnings:
            print("WARNING:", w, file=sys.stderr)


if __name__ == "__main__":
    main()
