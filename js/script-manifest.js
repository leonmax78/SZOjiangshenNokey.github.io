// V237 script manifest: core loads first; large feature data/scripts load on first use.
// index.html remains a pure entry.  Add/disable modules here, not in index.html.
window.SZO_SCRIPT_GROUPS = {
  "data": [
    "js/data/type-maps.js",
    "data/build_meta.bundle.js",
    "data/asset_manifest.bundle.js",
    "js/data/asset-media.js",
    "data/item_series.bundle.js",
    "data/item_kind.bundle.js"
  ],
  "data_soul": [
    "js/data/soul-data.js"
  ],
  "data_jiangshen": [
    "js/data/jiangshen/base-data.js",
    "js/data/jiangshen/star-multipliers-data.js",
    "js/data/jiangshen/combo-data.js",
    "js/data/jiangshen/progression-tables-data.js",
    "js/data/jiangshen-data.js"
  ],
  "data_training": [
    "js/data/training/meta-data.js",
    "js/data/training/group-01-data.js",
    "js/data/training/group-02-data.js",
    "js/data/training/group-03-data.js",
    "js/data/training/group-04-data.js",
    "js/data/training/group-05-data.js",
    "js/data/training/group-06-data.js",
    "js/data/training/group-07-data.js",
    "js/data/training/group-08-data.js",
    "js/data/training/group-09-data.js",
    "js/data/training/group-10-data.js",
    "js/data/training-data.js"
  ],
  "core": [
    "js/core/app-settings.js",
    "js/utils/common-utils.js",
    "js/core/data-loader-utils.js",
    "js/core/app-core.js",
    "js/core/config-loader.js",
    "js/core/ui-settings.js"
  ],
  "calc_jiangshen": [
    "js/calc/jiangshen-calc.js"
  ],
  "pages": [
    "js/pages/monster-page.js",
    "js/pages/item-page.js",
    "js/pages/reverse-page.js",
    "js/pages/compound-page.js",
    "js/pages/collectbook-page.js",
    "js/pages/shop-page.js",
    "js/pages/downloads-page.js"
  ],
  "page_monster": [
    "js/pages/monster-page.js"
  ],
  "page_item": [
    "js/pages/item-page.js",
    "js/pages/reverse-page.js"
  ],
  "page_compound": [
    "js/pages/compound-page.js"
  ],
  "page_collect": [
    "js/pages/collectbook-page.js"
  ],
  "page_shop": [
    "js/pages/shop-page.js"
  ],
  "page_downloads": [
    "js/pages/downloads-page.js"
  ],
  "features_equipment": [
    "js/features/equipment/display-and-random-sim.js",
    "js/features/equipment/special-equipment-filter.js",
    "js/features/equipment/stable-group-routing.js",
    "js/features/equipment/underboot-stable70.js",
    "js/features/equipment/stat-renderer.js",
    "js/features/equipment/accessory-filter.js",
    "js/features/equipment/accessory-menu-guard.js",
    "js/features/equipment/equipment-sort-fix.js"
  ],
  "features_soul": [
    "js/pages/soul-page.js",
    "js/pages/soul-data-page.js",
    "js/pages/soul-quick-force-fix.js"
  ],
  "features_auth": [
    "js/features/auth/license-submit.js",
    "js/features/auth/license-countdown.js"
  ],
  "features_monster_item_safety": [
    "js/pages/monster-detail-fix.js",
    "js/features/safety/button-anchor-guard.js"
  ],
  "features_jiangshen": [
    "js/features/jiangshen/basic-compare-stars.js",
    "js/features/jiangshen/support-slots-compare.js"
  ],
  "enhancements": [],
  "enhancements_jiangshen": [
    "js/features/jiangshen/jiangshen-nav-final-guard.js",
    "js/features/jiangshen/excel-tables-fix.js"
  ],
  "not_loaded_legacy": [
    "js/legacy/not-loaded/app-esmodule-unused.js",
    "js/legacy/not-loaded/jiangshen-duplicate-unused.js",
    "js/legacy/not-loaded/archived-patches-v218/",
    "js/legacy/not-loaded/js-modules/",
    "js/legacy/not-loaded/html-modules/",
    "js/legacy/not-loaded/old-jiangshen-support-v222/",
    "js/legacy/not-loaded/root-duplicates-v235/"
  ]
};
window.SZO_SCRIPT_MANIFEST = [
  ...window.SZO_SCRIPT_GROUPS.data,
  ...window.SZO_SCRIPT_GROUPS.core,
  ...window.SZO_SCRIPT_GROUPS.features_auth,
  ...window.SZO_SCRIPT_GROUPS.features_monster_item_safety,
  ...window.SZO_SCRIPT_GROUPS.enhancements
];
