const build = {
    weapon: null,
    weaponStacks: 1,
    oils: {attack: true, armor: true, speed: true},
    items: [null, null, null, null]
};

const rarityIcons = {
  common: "assets/icons/rarity_common.png",
  rare: "assets/icons/rarity_rare.png",
  heroic: "assets/icons/rarity_heroic.png",
  mythic: "assets/icons/rarity_mythic.png",
  cursed: "assets/icons/rarity_cursed.png"
};

const weaponData = "data/weapons.json";
const weaponImgPath = "assets/weapons/";
const itemData = "data/items.json";
const itemImgPath = "assets/items/";

let allWeapons = [];
let allItems = [];

let selectedIndex = null;

function loadItems(jsonPath, callback) {
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            callback(data);
            renderItemGrid();
        });
};

function buildTooltipText(item) {
    let text = item.name;

    if (item.description !== null) {
        text = text + "\n" + item.description;
    }

    if (item.attack !== 0) {
    text = text + "\nAttack: " + item.attack;
    }
    if (item.armor !== 0) {
        text = text + "\nArmor: " + item.armor;
    }
    if (item.speed !== 0) {
        text = text + "\nSpeed: " + item.speed;
    }
    if (item.healthBonus !== 0) {
        text = text + "\nHealth: " + item.healthBonus;
    }

    if (item.tags.length > 0) {
        text = text + "\nTags: " + item.tags.join(", ");
    }

    return text;
}

function renderBuild() {
    const weaponSlot = document.querySelector(".weapon-slot");
    weaponSlot.innerHTML = "";

    if (build.weapon !== null) {
        const img = document.createElement("img");
        img.src = "assets/weapons/" + build.weapon.image;
        img.alt = build.weapon.name;
        weaponSlot.appendChild(createItemVisual(build.weapon, "assets/weapons/"));

        if (build.weaponStacks > 1) {
            const stackLabel = document.createElement("div");
            stackLabel.textContent = "x" + build.weaponStacks;
            stackLabel.classList.add("stack-count");
            weaponSlot.appendChild(createItemVisual(build.weapon, "assets/weapons/", "weapon"));
        }
    }

    const itemSlotElements = document.querySelectorAll(".item-slot-build");

    build.items.forEach((item, index) => {
        const slotElement = itemSlotElements[index];
        slotElement.innerHTML = "";

        if (item !== null) {
            const img = document.createElement("img");
            img.src = "assets/items/" + item.image;
            img.alt = item.name;
            slotElement.appendChild(img);
        }

        if (index === selectedIndex) {
            slotElement.classList.add("selected");
        } else {
            slotElement.classList.remove("selected");
        }
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
    if (build.weapon === null) {
        return;
    }
    
    build.weapon = null;
    build.weaponStacks = 1;
    renderBuild();
    
};

function calculateStats() {
    const totals = { health: 10, attack: 0, armor: 0, speed: 0 };

    if (build.weapon !== null) {
        totals.health += build.weapon.healthBonus;
        totals.attack += build.weapon.attack * build.weaponStacks;
        totals.armor += build.weapon.armor;
        totals.speed += build.weapon.speed;
    };

    build.items.forEach(item => {
        if (item !== null) {
            totals.health += item.healthBonus;
            totals.attack += item.attack;
            totals.armor += item.armor;
            totals.speed += item.speed;
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

    return totals;
};

function handleOilClick(statName) {
    build.oils[statName] = !build.oils[statName];
    renderBuild()
};

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

    const rarityBadge = document.createElement("div");
    rarityBadge.classList.add("rarity-icon");
    rarityBadge.style.backgroundImage = "url('" + rarityIcons[item.rarity] + "')";
    wrapper.appendChild(rarityBadge);

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

function renderItemGrid() {
    const grid = document.querySelector(".item-grid");
    grid.innerHTML = "";

    const rarityFilters = getRarityFiters();
    const tagFilters = getTagFiters();
    const bundleFilters = getBundleFilters();
    const searchFilter = getSearchText();

    const groups = [
        { list: allWeapons, imageFolder: weaponImgPath, category: "weapon" },
        { list: allItems, imageFolder: itemImgPath, category: "item" }
    ];

    groups.forEach(group => {
        group.list.forEach(item => {
            if (!passesFilters(item, rarityFilters, tagFilters, bundleFilters, searchFilter)) {
                return;
            }

            const box = document.createElement("div");
            box.classList.add("item-slot");
            if (group.category === "weapon") {
                box.classList.add("weapon-item-slot");
            }

            const tooltip = document.getElementById("tooltip");

            box.addEventListener("mouseenter", () => {
                tooltip.style.display = "block";
                tooltip.innerHTML = buildTooltipText(item).replaceAll("\n", "<br>");
            });

            box.addEventListener("mouseleave", () => {
                tooltip.style.display = "none";
            });

            box.addEventListener("mousemove", (event) => {
                tooltip.style.left = event.pageX + 10 + "px";
                tooltip.style.top = event.pageY + 10 + "px";
            });

            box.addEventListener("click", () => {
                if (group.category === "weapon") {
                    const isSameStackableWeapon =
                        build.weapon !== null &&
                        build.weapon.id === item.id &&
                        item.stackable &&
                        build.weaponStacks < item.maxStacks;

                    if (isSameStackableWeapon) {
                        build.weaponStacks += 1;
                    } else {
                        build.weapon = item;
                        build.weaponStacks = 1;
                    }
                } else {
                    const emptyIndex = build.items.indexOf(null);
                    if (emptyIndex !== -1) {
                        build.items[emptyIndex] = item;
                    }
                }

                renderBuild();
            });

            box.appendChild(createItemVisual(item, group.imageFolder, group.category));
            grid.appendChild(box);
        });
    });
}

function passesFilters(item, rarityFilters, tagFilters, bundleFilters, searchText) {
    const rarityOk = rarityFilters.length === 0 || rarityFilters.includes(item.rarity);
    const tagOk = tagFilters.length === 0 || tagFilters.every(tag => item.tags.includes(tag));
    const searchOk = item.name.toLowerCase().includes(searchText);
    const wanted = bundleFilters.map(Number);
    let bundleOk = null;

    if (wanted.length !== 0) {
        if (item.rarity === "cauldron") {
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

const itemSlotElements = document.querySelectorAll(".item-slot-build");
itemSlotElements.forEach((slotElement, index) => {
    slotElement.addEventListener("click", () => handleSlotClick(index));
});

const weaponSlotElement = document.querySelector(".weapon-slot");
weaponSlotElement.addEventListener("click", () => handleWeaponClick());

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

loadItems(weaponData, data => { allWeapons = data; });
loadItems(itemData, data => { allItems = data; });

renderBuild();