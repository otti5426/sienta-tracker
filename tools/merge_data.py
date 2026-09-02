# -*- coding: utf-8 -*-
"""取込フォルダの CSV / JSON を data.json にマージする。

使い方:  ダブルクリックで「取り込む.bat」を実行するだけ。
  1. 取込/ にある CSV（給油ログ・メンテナンス記録）と JSON（アプリのバックアップ）を読む
  2. data.json に追加マージ（同じ記録は二重に入らない）
  3. 取り込んだファイルは 取込済み/ に移動
  4. バックアップ/ にその日のスナップショットを保存
  5. --push を付けると GitHub へ commit & push（スマホのアプリに反映される）
"""
import csv
import datetime as dt
import io
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_NAME = "data-05873f399d42.json"  # 公開リポジトリなので推測されにくい名前
DATA = os.path.join(ROOT, DATA_NAME)
INBOX = os.path.join(ROOT, "取込")
DONE = os.path.join(ROOT, "取込済み")
BACKUP = os.path.join(ROOT, "バックアップ")

CAT_FROM_JP = {"洗車": "wash", "タイヤ": "tire", "点検": "inspection", "その他": "other"}

DEFAULT_VEHICLE = {
    "id": "v1",
    "name": "SIENTA",
    "sub": "URBAN KHAKI",
    "themeColor": "#7A8B76",
    "settings": {
        "baseMpg": 10.0, "targetAmount": 350000, "gasPrice": 160,
        "tankCapacity": 36, "oilInterval": 5000, "lastOilChangeOdo": 0,
    },
    "logs": [],
    "maintenance": [],
}


def load_data():
    if os.path.exists(DATA):
        with io.open(DATA, encoding="utf-8") as f:
            return json.load(f)
    return {"activeVehicleId": "v1", "vehicles": [json.loads(json.dumps(DEFAULT_VEHICLE))]}


def active_vehicle(data):
    for v in data["vehicles"]:
        if v["id"] == data.get("activeVehicleId"):
            return v
    return data["vehicles"][0]


def log_key(l):
    return (str(l["date"]), float(l["odo"]), float(l["liters"]))


def maint_key(m):
    return (str(m["date"]), m["category"], int(m.get("price") or 0), (m.get("note") or "").strip())


def new_id(seq):
    # アプリ側と衝突しない一意ID
    return str(int(dt.datetime.now().timestamp() * 1000) + seq)


def norm_date(v):
    """2026/8/15 や 2026.8.15 も 2026-08-15 に揃える（Excel保存対策）。"""
    t = str(v).strip().replace("/", "-").replace(".", "-")
    parts = t.split("-")
    if len(parts) == 3 and all(p.strip().isdigit() for p in parts):
        y, m, d = (p.strip() for p in parts)
        return "%04d-%02d-%02d" % (int(y), int(m), int(d))
    return t


def read_rows(path):
    """CSV / JSON を (logs, maints) に正規化して返す。"""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".json":
        with io.open(path, encoding="utf-8-sig") as f:
            d = json.load(f)
        logs, maints = [], []
        for v in d.get("vehicles", []):
            logs += v.get("logs", []) or []
            maints += v.get("maintenance", []) or []
        for r in logs + maints:
            r["date"] = norm_date(r.get("date", ""))
        return logs, maints

    with io.open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    if not rows:
        return [], []
    header = ",".join(rows[0])

    if "給油量" in header or "走行距離" in header:
        logs = []
        for r in rows[1:]:
            if len(r) < 4 or not r[0].strip():
                continue
            logs.append({
                "date": norm_date(r[0]),
                "odo": float(r[1]),
                "liters": float(r[2]),
                "price": int(float(r[3])),
                "isFull": (r[4].strip() == "1") if len(r) > 4 else True,
                "isWinter": (r[5].strip() == "1") if len(r) > 5 else False,
            })
        return logs, []

    if "区分" in header:
        maints = []
        for r in rows[1:]:
            if len(r) < 2 or not r[0].strip():
                continue
            maints.append({
                "date": norm_date(r[0]),
                "category": CAT_FROM_JP.get(r[1].strip(), "other"),
                "price": int(float(r[2])) if len(r) > 2 and r[2].strip() else 0,
                "note": r[3].strip() if len(r) > 3 else "",
            })
        return [], maints

    raise ValueError("ヘッダーから種類を判別できません: " + header)


def main():
    do_push = "--push" in sys.argv
    for d in (INBOX, DONE, BACKUP):
        os.makedirs(d, exist_ok=True)

    data = load_data()
    v = active_vehicle(data)
    v.setdefault("logs", [])
    v.setdefault("maintenance", [])
    seen_logs = {log_key(l) for l in v["logs"]}
    seen_maints = {maint_key(m) for m in v["maintenance"]}

    candidates = sorted(
        f for f in os.listdir(INBOX)
        if os.path.splitext(f)[1].lower() in (".csv", ".json")
    )
    files = []
    for f in candidates:
        if f.startswith("_"):
            print("  [ひな形なのでスキップ] %s" % f)
            continue
        files.append(f)
    if not files:
        print("取込フォルダは空です。CSV か バックアップJSON を 取込/ に入れてから実行してください。")
        return 0

    total_logs = total_maints = 0
    seq = 0
    processed = []
    for name in files:
        path = os.path.join(INBOX, name)
        try:
            logs, maints = read_rows(path)
        except Exception as e:
            print("  [スキップ] %s : %s" % (name, e))
            continue
        add_l = add_m = 0
        for l in logs:
            k = log_key(l)
            if k in seen_logs:
                continue
            seen_logs.add(k)
            seq += 1
            v["logs"].append({"id": l.get("id") or new_id(seq), **{x: l[x] for x in ("date", "odo", "liters", "price", "isFull", "isWinter") if x in l}})
            add_l += 1
        for m in maints:
            k = maint_key(m)
            if k in seen_maints:
                continue
            seen_maints.add(k)
            seq += 1
            v["maintenance"].append({
                "id": m.get("id") or new_id(seq),
                "date": m["date"], "category": m["category"],
                "price": int(m.get("price") or 0), "note": m.get("note") or "",
            })
            add_m += 1
        print("  %s : 給油 +%d / 整備 +%d" % (name, add_l, add_m))
        total_logs += add_l
        total_maints += add_m
        processed.append(path)

    v["logs"].sort(key=lambda l: (l["date"], l["odo"]))
    v["maintenance"].sort(key=lambda m: m["date"], reverse=True)
    data["updatedAt"] = dt.datetime.now().isoformat(timespec="seconds")

    with io.open(DATA, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    today = dt.date.today().isoformat()
    shutil.copy2(DATA, os.path.join(BACKUP, "data_%s.json" % today))

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    for path in processed:
        shutil.move(path, os.path.join(DONE, "%s_%s" % (stamp, os.path.basename(path))))

    print("")
    print("合計: 給油 +%d件 / 整備 +%d件" % (total_logs, total_maints))
    print("data-05873f399d42.json: 給油 %d件 / 整備 %d件" % (len(v["logs"]), len(v["maintenance"])))

    if do_push:
        if total_logs == 0 and total_maints == 0:
            print("新しい記録が無いので push しません。")
            return 0
        subprocess.check_call(["git", "add", DATA_NAME], cwd=ROOT)
        msg = "data: add %d fuel / %d maintenance records\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>" % (total_logs, total_maints)
        subprocess.check_call(["git", "commit", "-m", msg], cwd=ROOT)
        subprocess.check_call(["git", "push"], cwd=ROOT)
        print("GitHubへ反映しました。スマホでアプリを開くと取り込まれます。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
