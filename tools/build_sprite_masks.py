"""Builds data/sprite-masks.json, which the screenshot importer uses.

Run this from the project folder whenever you add or change item, weapon or
edge artwork:

    python tools/build_sprite_masks.py

Every sprite is an 18x18 picture. We only need to know which pixels are
"painted" (not the dark background colour), so each sprite becomes a 324-bit
mask written as 81 hex characters.
"""
import json
import os

from PIL import Image

BACKGROUND = (37, 19, 26)
OUTPUT = "data/sprite-masks.json"


def sprite_mask(path):
    """Return the sprite's mask as a hex string, or None if the file is missing or empty."""
    if not os.path.isfile(path):
        return None
    image = Image.open(path).convert("RGBA")
    bits = ""
    painted = 0
    for y in range(18):
        for x in range(18):
            r, g, b, a = image.getpixel((x, y))
            is_painted = a > 0 and abs(r - BACKGROUND[0]) + abs(g - BACKGROUND[1]) + abs(b - BACKGROUND[2]) > 30
            bits += "1" if is_painted else "0"
            painted += is_painted
    if painted == 0:
        return None
    bits = bits.ljust(324, "0")
    return "%081x" % int(bits, 2)


def load(path):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


entries = []


def add(kind, sprite_id, tier, path):
    mask = sprite_mask(path)
    if mask:
        entries.append([kind, sprite_id, tier, mask])


for item in load("data/items.json"):
    if item.get("rarity") == "edge":
        continue
    add("item", item["id"], 0, "assets/items/" + (item.get("image") or ""))
    if item.get("goldImage"):
        add("item", item["id"], 1, "assets/items/Spritesheet_Items_golden/" + item["goldImage"])
    if item.get("diamondImage"):
        add("item", item["id"], 2, "assets/items/Spritesheet_Items_diamond/" + item["diamondImage"])

for weapon in load("data/weapons.json"):
    if weapon.get("image"):
        add("weapon", weapon["id"], 1, "assets/weapons/" + weapon["image"])

# Hidden Dagger shows a different picture for each stack (tier = number of stacks).
for stacks, name in {2: "r03c05", 3: "r03c06", 4: "r03c07"}.items():
    add("weapon", "hidden_dagger", stacks, "assets/weapons/Spritesheet_Weapons_%s.png" % name)

for edge in load("data/edges.json"):
    if edge.get("image"):
        add("edge", edge["id"], 0, "assets/edges/" + edge["image"])

for oil_id, file_name in {"attack": "atk_oil", "armor": "arm_oil", "speed": "spd_oil"}.items():
    add("oil", oil_id, 0, "assets/icons/%s.png" % file_name)

with open(OUTPUT, "w", encoding="utf-8") as file:
    json.dump(entries, file, separators=(",", ":"))

print("Wrote %d sprites to %s" % (len(entries), OUTPUT))
