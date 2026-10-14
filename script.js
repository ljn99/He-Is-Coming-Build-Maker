const build = {
    weapon: null,
    edge: null,
    weaponStacks: 1,
    oils: {attack: true, armor: true, speed: true},
    items: Array(12).fill(null)
};

const rarityIcons = {
  common: "assets/icons/rarity_common.png",
  rare: "assets/icons/rarity_rare.png",
  heroic: "assets/icons/rarity_heroic.png",
  mythic: "assets/icons/rarity_mythic.png",
  cursed: "assets/icons/rarity_cursed.png",
  set: "assets/icons/rarity_itemset.png",
  cauldron: "assets/icons/rarity_cauldron.png",
  cauldron_gold: "assets/icons/rarity_cauldron_gold.png",
  gold: "assets/icons/rarity_gold.png",
  diamond: "assets/icons/rarity_diamond.png"
};

const stackImages = {
  hidden_dagger: {
    2: "Spritesheet_Weapons_r03c05.png",
    3: "Spritesheet_Weapons_r03c06.png",
    4: "Spritesheet_Weapons_r03c07.png"
  }
};

const weaponComponents = {
    bloodlords_whip: ["bloodthief_axe", "leather_whip"],
    brittlebark_blade: ["brittlebark_club", "brittlebark_bow"],
    gale_bow: ["gale_staff", "swiftstrike_rapier"],
    heatstroke_scepter: ["heatstroke_trident", "heatstroke_dagger"],
    liferoot_dagger: ["liferoot_staff", "bloodmoon_dagger"],
    pacifist_trident: ["pacifist_staff", "silverscale_trident"],
    perfect_iceblade: ["frozen_iceblade", "melting_iceblade"],
    razorthorn_lance: ["razorthorn_spear", "boom_stick"],
    spear_of_the_hero: ["quickgrowth_spear", "swordofthe_hero"],
    stonesnake_sword: ["serpent_dagger", "stoneslab_sword"],
    twin_saws: ["twin_spear", "rusty_bonesaw"]
};

const rarityOrder = ["common", "rare", "heroic", "mythic", "cursed", "cauldron", "cauldron_gold"];
const categoryOrder = ["weapon", "item", "edge"];

function rarityRank(rarity) {
    const index = rarityOrder.indexOf(rarity);
    return index === -1 ? rarityOrder.length : index;
}

const goldImgPath = "assets/items/Spritesheet_Items_golden/";
const diamondImgPath = "assets/items/Spritesheet_Items_diamond/";
const tierNames = ["", "Golden ", "Diamond "];

function getDefaultWeapon() {
    return allWeapons.find(weapon => weapon.id === "wooden_stick") || null;
}

function itemImageFolder(item) {
    if (item.tier === 1) {
        return goldImgPath;
    }
    if (item.tier === 2) {
        return diamondImgPath;
    }
    return itemImgPath;
}

function makeTier(item, tier) {
    const multiplier = 2 ** tier;
    return {
        ...item,
        tier: tier,
        healthBonus: item.healthBonus * multiplier,
        attack: item.attack * multiplier,
        armor: item.armor * multiplier,
        speed: item.speed * multiplier,
        image: tier === 1 ? item.goldImage : item.diamondImage,
        description: (tier === 1 ? item.goldDescription : item.diamondDescription) || item.description
    };
}

const weaponData = "data/weapons.json";
const weaponImgPath = "assets/weapons/";
const itemData = "data/items.json";
const itemImgPath = "assets/items/";
const edgeData = "data/edges.json";
const edgeImgPath = "assets/edges/";
const setData = "data/sets.json";
const setImgPath = "assets/sets/";

let allWeapons = [];
let allItems = [];
let allEdges = [];
let allSets = [];

let selectedIndex = null;

function loadItems(jsonPath, callback) {
    return fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            callback(data);
            renderItemGrid();
        });
};

const statIcons = {
    health: "assets/icons/icon_health.png",
    attack: "assets/icons/icon_attack.png",
    armor: "assets/icons/icon_armor.png",
    speed: "assets/icons/icon_speed.png"
};

function buildTooltipContent(item) {
    const box = document.createElement("div");

    const name = document.createElement("div");
    name.classList.add("tooltip-name");
    name.textContent = tierNames[item.tier || 0] + item.name;
    box.appendChild(name);

    if (item.description) {
        const desc = document.createElement("div");
        desc.classList.add("tooltip-desc");
        desc.textContent = item.description;
        box.appendChild(desc);
    }

    const stats = [
        { stat: "health", value: item.healthBonus },
        { stat: "attack", value: item.attack },
        { stat: "armor", value: item.armor },
        { stat: "speed", value: item.speed }
    ];

    stats.forEach(entry => {
        if (!entry.value) {
            return;
        }

        const row = document.createElement("div");
        row.classList.add("tooltip-stat");

        const icon = document.createElement("img");
        icon.src = statIcons[entry.stat];
        icon.alt = entry.stat;

        const number = document.createElement("span");
        number.textContent = entry.value;

        row.appendChild(icon);
        row.appendChild(number);
        box.appendChild(row);
    });

    if (item.tags && item.tags.length > 0) {
        const tagRow = document.createElement("div");
        tagRow.classList.add("tooltip-tags");

        item.tags.forEach(tag => {
            const chip = document.createElement("span");
            chip.classList.add("tag-chip");
            chip.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
            tagRow.appendChild(chip);
        });

        box.appendChild(tagRow);
    }

    return box;
}

function renderBuild() {
    autosaveBuild();
    document.getElementById("tooltip").style.display = "none";

    const weaponSlot = document.querySelector(".weapon-slot");
    weaponSlot.innerHTML = "";

    if (build.weapon !== null) {
        let shownWeapon = build.weapon;
        const altImages = stackImages[build.weapon.id];
        const altImage = altImages && altImages[build.weaponStacks];

        if (altImage) {
            shownWeapon = { ...build.weapon, image: altImage };
        }

        const weaponVisual = createItemVisual(shownWeapon, weaponImgPath, "weapon");
        attachTooltip(weaponVisual, build.weapon);
        weaponSlot.appendChild(weaponVisual);

        if (build.weaponStacks > 1 && !altImage) {
            const stackLabel = document.createElement("div");
            stackLabel.textContent = "x" + build.weaponStacks;
            stackLabel.classList.add("stack-count");
            weaponSlot.appendChild(stackLabel);
        }
    }

    const edgeSlot = document.querySelector(".edge-slot");
    edgeSlot.innerHTML = "";

    if (build.edge !== null) {
        const edgeVisual = createItemVisual(build.edge, edgeImgPath, "edge");
        attachTooltip(edgeVisual, build.edge);
        edgeSlot.appendChild(edgeVisual);
    }

    const itemSlotElements = document.querySelectorAll(".item-slot-build");

    build.items.forEach((item, index) => {
        const slotElement = itemSlotElements[index];
        slotElement.innerHTML = "";

        if (item !== null) {
            const itemVisual = createItemVisual(item, itemImageFolder(item), "item");
            attachTooltip(itemVisual, item);
            slotElement.appendChild(itemVisual);
        }

        if (index === selectedIndex) {
            slotElement.classList.add("selected");
        } else {
            slotElement.classList.remove("selected");
        }
    });

    const setColumn = document.querySelector(".set-column");
    setColumn.innerHTML = "";

    getActiveSets().forEach(set => {
        const setBox = document.createElement("div");
        setBox.classList.add("item-slot", "set-slot");

        const setVisual = createItemVisual(set, setImgPath, "set");
        attachTooltip(setVisual, set);

        setBox.appendChild(setVisual);
        setColumn.appendChild(setBox);
    });

    const stats = calculateStats();
    document.getElementById("stat-health").textContent = stats.health;
    document.getElementById("stat-attack").textContent = stats.attack;
    document.getElementById("stat-armor").textContent = stats.armor;
    document.getElementById("stat-speed").textContent = stats.speed;

    document.querySelectorAll(".oil-toggle").forEach(el => {
        if (build.oils[el.dataset.stat]) {
            el.classList.add("active");
        } else {
            el.classList.remove("active");
        }
    });
};

function handleSlotClick(index) {
    if (build.items[index] === null) {
        return;
    }

    if (selectedIndex === null) {
        selectedIndex = index;
    } else if (selectedIndex === index) {
        build.items[index] = null;
        selectedIndex = null;
    } else {
        const temp = build.items[selectedIndex];
        build.items[selectedIndex] = build.items[index];
        build.items[index] = temp;
        selectedIndex = null;
    }

    renderBuild();
};

function handleWeaponClick() {
    build.weapon = getDefaultWeapon();
    build.weaponStacks = 1;
    renderBuild();
};

function conditionMet(when, totals, base) {
    const source = when.source === "base" ? base:totals;
    switch (when.op) {
        case "gt": {
            return source[when.stat] > when.value;
        }
        case "lte": {
            return source[when.stat] <= when.value;
        }
    }
}

function countedStat(value, ignoreNegatives) {
    return ignoreNegatives ? Math.max(0, value) : value;
}

function calculateStats() {
    const totals = { health: 10, attack: 0, armor: 0, speed: 0 };
    const activeSets = getActiveSets();
    const ignoreNegatives = activeSets.some(set => set.dynamicEffect && set.dynamicEffect.type === "ignoreNegatives");

    if (build.weapon !== null) {
        totals.health += countedStat(build.weapon.healthBonus, ignoreNegatives);
        totals.attack += countedStat(build.weapon.attack, ignoreNegatives) * build.weaponStacks;
        totals.armor += countedStat(build.weapon.armor, ignoreNegatives);
        totals.speed += countedStat(build.weapon.speed, ignoreNegatives);
    };

    build.items.forEach(item => {
        if (item !== null) {
            totals.health += countedStat(item.healthBonus, ignoreNegatives);
            totals.attack += countedStat(item.attack, ignoreNegatives);
            totals.armor += countedStat(item.armor, ignoreNegatives);
            totals.speed += countedStat(item.speed, ignoreNegatives);
        }
    });

    if (build.oils.attack) {
        totals.attack += 1;
    }
    if (build.oils.armor) {
        totals.armor += 1;
    }
    if (build.oils.speed) {
        totals.speed += 1;
    }

    activeSets.forEach(set => {
        totals.health += set.healthBonus;
        totals.attack += set.attack;
        totals.armor += set.armor;
        totals.speed += set.speed;
    })

    const base = {...totals};
    const pieces = [build.weapon, build.edge, ...build.items, ...activeSets].filter(piece => piece);

    /* Calculation Pass #2 */
    pieces.forEach(piece => {
        if (!piece.dynamicEffect) {
            return;
        }
        const effect = piece.dynamicEffect;
        switch (effect.type) {
            case "perTag": {
                const count = pieces.filter(other => other.tags.includes(effect.tag)).length;
                totals[effect.stat] += effect.amount * count;
                break;
            }
            case "perEmptySlot": {
                const emptySlotCount = build.items.filter(slot => slot === null).length;
                totals[effect.stat] += effect.amount * emptySlotCount;
                break;
            }
            case "addIf": {
                if (conditionMet(effect.when, totals, base)) {
                    totals[effect.stat] += effect.amount;
                }
                break;
            }
            case "multiply": {
                if (!effect.when || conditionMet(effect.when, totals, base)) {
                    totals[effect.stat] = Math.floor(totals[effect.stat] * effect.factor);
                }
                break;
            }
            case "multiplyBase": {
                totals[effect.stat] += base[effect.stat] * (effect.factor - 1);
                break;
            }
            case "negate": {
                totals[effect.stat] = -totals[effect.stat];
                break;
            }
            case "doubleOwnBonus": {
                if (conditionMet(effect.when, totals, base)) {
                    totals[effect.stat] += piece[effect.field];
                    break;
                }
            }
        }
    });

    /* Calculation Pass #3 */
    pieces.forEach(piece => {
        if (!piece.dynamicEffect) {
            return;
        }
        const effect = piece.dynamicEffect;
        switch (effect.type) {
            case "setStat":
                totals[effect.stat] = effect.value;
                break;
            case "copyStat": {
                const source = effect.source === "base" ? base:totals;
                totals[effect.stat] = source[effect.from];
                break;
            }
        }
    });

    return totals;
};

function handleOilClick(statName) {
    build.oils[statName] = !build.oils[statName];
    renderBuild()
};

function handleEdgeClick() {
    build.edge = null;
    renderBuild()
}

function createItemVisual(item, imageFolder, category) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("item-visual");

    const img = document.createElement("img");
    img.src = imageFolder + item.image;
    img.alt = item.name;
    wrapper.appendChild(img);

    if (category === "weapon") {
        const corner = document.createElement("div");
        corner.classList.add("weapon-corner-icon");
        wrapper.appendChild(corner);
    }

    let iconKey = item.rarity;
    if (category === "set") {
        iconKey = "set";
    }
    if (item.tier === 1) {
        iconKey = "gold";
    }
    if (item.tier === 2) {
        iconKey = "diamond";
    }
    if (rarityIcons[iconKey]) {
        const rarityBadge = document.createElement("div");
        rarityBadge.classList.add("rarity-icon");
        rarityBadge.style.backgroundImage = "url('" + rarityIcons[iconKey] + "')";
        wrapper.appendChild(rarityBadge);
    }

    return wrapper;
}

function getRarityFiters() {
    const rarityFilters = [];

    document.querySelectorAll(".rarity-filter").forEach(el => {
        if (el.checked) {
            rarityFilters.push(el.value);
        };
    });

    return rarityFilters;
};

function getTagFiters() {
    const tagFilters = [];

    document.querySelectorAll(".tag-filter").forEach(el => {
        if (el.checked) {
            tagFilters.push(el.value);
        };
    });

    return tagFilters;
};

function getBundleFilters() {
    const bundleFilters = [];

    document.querySelectorAll(".bundle-filter").forEach(el => {
        if (el.checked) {
            bundleFilters.push(el.value);
        };
    });

    return bundleFilters;
};

function attachTooltip(element, item) {
    const tooltip = document.getElementById("tooltip");

    element.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
        tooltip.innerHTML = "";
        tooltip.appendChild(buildTooltipContent(item));
    });

    element.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });

    element.addEventListener("mousemove", (event) => {
        tooltip.style.left = event.pageX + 10 + "px";
        tooltip.style.top = event.pageY + 10 + "px";
    });
}

function renderItemGrid() {
    const grid = document.querySelector(".item-grid");
    grid.innerHTML = "";

    const rarityFilters = getRarityFiters();
    const tagFilters = getTagFiters();
    const bundleFilters = getBundleFilters();
    const searchFilter = getSearchText();

    const groups = [
        { list: allWeapons, imageFolder: weaponImgPath, category: "weapon" },
        { list: allItems, imageFolder: itemImgPath, category: "item" },
        { list: allEdges, imageFolder: edgeImgPath, category: "edge"}
    ];

    const entries = [];
    groups.forEach(group => {
        group.list.forEach(item => {
            if (passesFilters(item, rarityFilters, tagFilters, bundleFilters, searchFilter)) {
                entries.push({ item: item, group: group });
            }
        });
    });

    entries.sort((a, b) => {
        const rarityDiff = rarityRank(a.item.rarity) - rarityRank(b.item.rarity);
        if (rarityDiff !== 0) {
            return rarityDiff;
        }

        const categoryDiff = categoryOrder.indexOf(a.group.category) - categoryOrder.indexOf(b.group.category);
        if (categoryDiff !== 0) {
            return categoryDiff;
        }

        return a.item.name.localeCompare(b.item.name);
    });

    entries.forEach(entry => {
        const item = entry.item;
        const group = entry.group;

        const box = document.createElement("div");
        box.classList.add("item-slot");
        if (group.category === "weapon") {
            box.classList.add("weapon-item-slot");
        }

        attachTooltip(box, item);

        box.addEventListener("click", (event) => {
            if (group.category === "weapon") {
                const isSameStackableWeapon =
                    build.weapon !== null &&
                    build.weapon.id === item.id &&
                    item.stackable &&
                    build.weaponStacks < item.maxStacks;

                if (isSameStackableWeapon) {
                    build.weaponStacks += 1;
                }
                else {
                    build.weapon = item;
                    build.weaponStacks = 1;
                }
            }
            else if (group.category === "edge") {
                build.edge = item;
            }
            else {
                const emptyIndex = build.items.indexOf(null);
                if (emptyIndex !== -1) {
                    let tier = 0;
                    if (item.goldImage && event.shiftKey) {
                        tier = 1;
                    }
                    if (item.goldImage && (event.ctrlKey || event.metaKey)) {
                        tier = 2;
                    }
                    build.items[emptyIndex] = tier === 0 ? item : makeTier(item, tier);
                }
            }

            renderBuild();
        });

        box.appendChild(createItemVisual(item, group.imageFolder, group.category));
        grid.appendChild(box);
    });
}

function passesFilters(item, rarityFilters, tagFilters, bundleFilters, searchText) {
    const rarityOk = rarityFilters.length === 0 || rarityFilters.includes(item.rarity);
    const tagOk = tagFilters.length === 0 || tagFilters.every(tag => item.tags.includes(tag));
    const searchOk = item.name.toLowerCase().includes(searchText);
    const wanted = bundleFilters.map(Number);
    let bundleOk = null;

    if (wanted.length !== 0) {
        if (item.rarity === "cauldron" || item.rarity === "cauldron_gold") {
            bundleOk = item.regionBundles.every(bundle => wanted.includes(bundle))
        } else {
            bundleOk = wanted.includes(item.kingmakerBundle);
        }

    } else {
        bundleOk = true;
    }

    return rarityOk && tagOk && bundleOk && searchOk;
}

function getSearchText() {
    return document.querySelector("#item-search").value.toLowerCase();
}

function countOwned(name, owned) {
    if (name.startsWith("generic_")) {
        const tag = name.slice("generic_".length);
        return owned.filter(piece => piece.tags.includes(tag)).length;
    }
    return owned.filter(piece => piece.id === name).length;
}

function getOwnedPieces() {
    const owned = [build.weapon, build.edge, ...build.items].filter(piece => piece);

    if (build.weapon && weaponComponents[build.weapon.id]) {
        weaponComponents[build.weapon.id].forEach(componentId => {
            owned.push({ id: componentId, tags: [] });
        });
    }

    return owned;
}

function getActiveSets() {
    const owned = getOwnedPieces();

    return allSets.filter(set => {
        if (set.components.length === 0) {
            return false;
        }
        return set.components.every(name => {
            const needed = set.components.filter(other => other === name).length;
            return countOwned(name, owned) >= needed;
        });
    });
}

// ---------- Saving and loading builds ----------

const SAVE_KEY = "hic-saved-builds";
let saveStatusTimer = null;

// Turn the current build into a small plain object that only stores ids,
// so saved builds keep working even if the item data is edited later.
function serializeBuild() {
    return {
        weapon: build.weapon ? build.weapon.id : null,
        weaponStacks: build.weaponStacks,
        edge: build.edge ? build.edge.id : null,
        oils: { ...build.oils },
        items: build.items.map(item => item ? { id: item.id, tier: item.tier || 0 } : null)
    };
}

// The reverse: look the ids back up in the loaded data and rebuild the build.
function applyBuild(data) {
    if (typeof data !== "object" || data === null) {
        return false;
    }

    build.weapon = allWeapons.find(weapon => weapon.id === data.weapon) || getDefaultWeapon();
    const maxStacks = build.weapon && build.weapon.stackable ? build.weapon.maxStacks : 1;
    build.weaponStacks = Math.min(Math.max(Number(data.weaponStacks) || 1, 1), maxStacks);

    build.edge = allEdges.find(edge => edge.id === data.edge) || null;

    const oils = data.oils || {};
    build.oils = {
        attack: oils.attack !== false,
        armor: oils.armor !== false,
        speed: oils.speed !== false
    };

    build.items.fill(null);
    (Array.isArray(data.items) ? data.items : []).slice(0, build.items.length).forEach((entry, index) => {
        if (!entry) {
            return;
        }
        const item = allItems.find(candidate => candidate.id === entry.id);
        if (!item) {
            return;
        }
        const tier = item.goldImage ? Math.min(Math.max(Number(entry.tier) || 0, 0), 2) : 0;
        build.items[index] = tier > 0 ? makeTier(item, tier) : item;
    });

    selectedIndex = null;
    renderBuild();
    return true;
}

function readSavedBuilds() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function writeSavedBuilds(saved) {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
        return true;
    } catch (error) {
        return false;
    }
}

function showSaveStatus(message) {
    const status = document.getElementById("save-status");
    status.textContent = message;
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => {
        status.textContent = "";
    }, 2500);
}

function refreshSavedList(selectName) {
    const select = document.getElementById("saved-builds");
    select.innerHTML = "";

    const names = readSavedBuilds().map(entry => entry.name).sort((a, b) => a.localeCompare(b));

    if (names.length === 0) {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "No saved builds";
        select.appendChild(empty);
        return;
    }

    names.forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    if (selectName) {
        select.value = selectName;
    }
}

function handleSaveClick() {
    const nameInput = document.getElementById("build-name");
    const name = nameInput.value.trim();

    if (name === "") {
        showSaveStatus("Enter a name first");
        return;
    }

    const saved = readSavedBuilds();
    const existingIndex = saved.findIndex(entry => entry.name === name);

    if (existingIndex !== -1 && !confirm('Overwrite "' + name + '"?')) {
        return;
    }

    const entry = { name: name, build: serializeBuild() };
    if (existingIndex !== -1) {
        saved[existingIndex] = entry;
    } else {
        saved.push(entry);
    }

    if (writeSavedBuilds(saved)) {
        refreshSavedList(name);
        showSaveStatus('Saved "' + name + '"');
    } else {
        showSaveStatus("Couldn't save (browser storage is unavailable)");
    }
}

function handleLoadClick() {
    const name = document.getElementById("saved-builds").value;
    const entry = readSavedBuilds().find(candidate => candidate.name === name);

    if (!entry) {
        showSaveStatus("Nothing to load");
        return;
    }

    applyBuild(entry.build);
    document.getElementById("build-name").value = name;
    showSaveStatus('Loaded "' + name + '"');
}

function handleDeleteClick() {
    const name = document.getElementById("saved-builds").value;
    if (name === "") {
        return;
    }
    if (!confirm('Delete "' + name + '"?')) {
        return;
    }

    writeSavedBuilds(readSavedBuilds().filter(entry => entry.name !== name));
    refreshSavedList();
    showSaveStatus('Deleted "' + name + '"');
}

// A share link stores the whole build in the part of the URL after "#".
function buildShareLink() {
    const encoded = btoa(JSON.stringify(serializeBuild()));
    return location.origin + location.pathname + "#build=" + encodeURIComponent(encoded);
}

function handleShareClick() {
    const link = buildShareLink();

    if (!navigator.clipboard) {
        window.prompt("Copy this link:", link);
        return;
    }

    navigator.clipboard.writeText(link).then(
        () => showSaveStatus("Link copied"),
        () => window.prompt("Copy this link:", link)
    );
}

// ---------- Autosave ----------
// Every time the build is drawn we also stash it in localStorage, so a
// refresh or a closed tab doesn't lose your work.

const AUTOSAVE_KEY = "hic-autosave";
let autosaveReady = false;   // stays false until the data has loaded, so the empty startup render can't overwrite your build
let autosavePaused = false;  // true while a shared link is showing, until you click something

function autosaveBuild() {
    if (!autosaveReady || autosavePaused) {
        return;
    }
    try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeBuild()));
    } catch (error) {
        // storage blocked or full: autosave just quietly does nothing
    }
}

function loadAutosave() {
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (raw) {
            applyBuild(JSON.parse(raw));
        }
    } catch (error) {
        // corrupted autosave: ignore it and start with a fresh build
    }
}

function loadBuildFromHash() {
    const match = location.hash.match(/^#build=(.+)$/);
    if (!match) {
        return;
    }

    try {
        applyBuild(JSON.parse(atob(decodeURIComponent(match[1]))));
    } catch (error) {
        showSaveStatus("Couldn't read that build link");
    }
}

const itemSlotsContainer = document.querySelector(".item-slots")
for (let i = 0; i < build.items.length; i++) {
    const el = document.createElement("div");
    el.classList.add("item-slot", "item-slot-build");
    itemSlotsContainer.appendChild(el)
}

const itemSlotElements = document.querySelectorAll(".item-slot-build");
itemSlotElements.forEach((slotElement, index) => {
    slotElement.addEventListener("click", () => handleSlotClick(index));
});

const weaponSlotElement = document.querySelector(".weapon-slot");
weaponSlotElement.addEventListener("click", () => handleWeaponClick());

const edgeSlotElement = document.querySelector(".edge-slot");
edgeSlotElement.addEventListener("click", handleEdgeClick)

document.querySelectorAll(".oil-toggle").forEach(el => {
    el.addEventListener("click", () => handleOilClick(el.dataset.stat));
});

document.querySelectorAll(".rarity-filter").forEach(el => {
    el.addEventListener("change", () => renderItemGrid());
});

document.querySelectorAll(".tag-filter").forEach(el => {
    el.addEventListener("change", () => renderItemGrid());
});

document.querySelectorAll(".bundle-filter").forEach(el => {
    el.addEventListener("change", () => renderItemGrid());
});

document.querySelector("#item-search").addEventListener("input", () => renderItemGrid());

document.getElementById("save-build").addEventListener("click", handleSaveClick);
document.getElementById("load-build").addEventListener("click", handleLoadClick);
document.getElementById("delete-build").addEventListener("click", handleDeleteClick);
document.getElementById("share-build").addEventListener("click", handleShareClick);
document.getElementById("build-name").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        handleSaveClick();
    }
});
refreshSavedList();

// Promise.all waits until every file has finished loading, so a build saved
// in the URL can be restored once all the data it refers to exists.
Promise.all([
    loadItems(weaponData, data => {
        allWeapons = data;
        build.weapon = getDefaultWeapon();
        renderBuild();
    }),
    loadItems(itemData, data => { allItems = data; }),
    loadItems(edgeData, data => { allEdges = data; }),
    loadItems(setData, data => { allSets = data; })
]).then(() => {
    if (location.hash.startsWith("#build=")) {
        // A shared link wins over the autosave. Don't overwrite your own
        // autosave with it until you actually click something.
        autosavePaused = true;
        document.addEventListener("click", () => { autosavePaused = false; }, { once: true });
        loadBuildFromHash();
    } else {
        loadAutosave();
    }
    autosaveReady = true;
    renderBuild();
});

renderBuild();

// ---------- Music player ----------

// File names in assets/music. The dropdown labels are made from them.
const musicTracks = [
    "Gauntlet_Boss.ogg",
    "Gauntlet_Overworld.ogg",
    "He is Coming - Kingmaker Victory.ogg",
    "a_long_time_ago.ogg",
    "abondoned_quarry_island.ogg",
    "audience_with_the_pumpking.ogg",
    "b_heavy_is_the_crown.ogg",
    "b_lost_hope.ogg",
    "b_showtime.ogg",
    "boss_intro.ogg",
    "boss_intro_long.ogg",
    "challenger_island.ogg",
    "champion_defeated.ogg",
    "fanfare.ogg",
    "glyph_ruins_island.ogg",
    "halloween_main_menu.ogg",
    "hic_boss_leshen_1.ogg",
    "hydra_boss.ogg",
    "kingmaker_champion.ogg",
    "kingmaker_overworld.ogg",
    "kingmaker_overworld_champion.ogg",
    "lushwood_island.ogg",
    "main_menu.ogg",
    "miniboss_music.ogg",
    "misplaced_mire_island.ogg",
    "old_b_showtime.ogg",
    "pumpkin_land.ogg",
    "scorched_hill_island.ogg",
    "serpent_basin_island.ogg",
    "start_island.ogg",
    "sunken_palace_island.ogg",
    "toadstool_town.ogg",
    "trick_or_treat.ogg",
    "witch_march_island.ogg",
    "woodland_battle.ogg",
    "woodland_day.ogg",
    "woodland_night.ogg"
];

const musicAudio = new Audio();
musicAudio.volume = 0.5;
const trackSelect = document.getElementById("track-select");
const playButton = document.getElementById("music-play");
const loopButton = document.getElementById("music-loop");
const volumeSlider = document.getElementById("music-volume");

// "a_long_time_ago.ogg" -> "A Long Time Ago"
function trackLabel(fileName) {
    return fileName
        .replace(/\.ogg$/, "")
        .replace(/_/g, " ")
        .replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

musicTracks.forEach(fileName => {
    const option = document.createElement("option");
    option.value = fileName;
    option.textContent = trackLabel(fileName);
    trackSelect.appendChild(option);
});

function playTrack(fileName) {
    // encodeURIComponent keeps file names with spaces working in the URL
    musicAudio.src = "assets/music/" + encodeURIComponent(fileName);
    musicAudio.play().catch(() => {});
}

trackSelect.addEventListener("change", () => {
    if (trackSelect.value) {
        playTrack(trackSelect.value);
    } else {
        musicAudio.pause();
    }
});

playButton.addEventListener("click", () => {
    if (!trackSelect.value) {
        return;
    }
    if (musicAudio.paused) {
        musicAudio.play().catch(() => {});
    } else {
        musicAudio.pause();
    }
});

loopButton.addEventListener("click", () => {
    musicAudio.loop = !musicAudio.loop;
    loopButton.setAttribute("aria-pressed", musicAudio.loop);
    loopButton.textContent = musicAudio.loop ? "Loop: On" : "Loop: Off";
});

volumeSlider.addEventListener("input", () => {
    musicAudio.volume = Number(volumeSlider.value);
});

// Keep the button text in sync with what the audio is really doing.
musicAudio.addEventListener("play", () => { playButton.textContent = "Pause"; });
musicAudio.addEventListener("pause", () => { playButton.textContent = "Play"; });
musicAudio.addEventListener("ended", () => { playButton.textContent = "Play"; });
