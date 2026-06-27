# 武冠收錄資料更新流程

## 順序原則

- `data/collectbook_sources.json` 不用名稱排序。
- 武防、法器、配方照「收納清單 Excel」前三張工作表的列順序輸出。
- 武防分類照 Excel 後方分類分頁判斷，例如劍、刀、盾、帽子。
- 封獸照「封獸捕捉位置」工作表列順序輸出。
- 官方如果把新武冠資料補在最後面，重跑產生器後，新資料會自然留在最後面，不會打亂既有順序。

## 更新步驟

1. 用 RPGViewer 開 `E:\神州Online\update.pak`，選「港台 / 宇峻 / 小魚兒與花無缺 ONLINE」，把 `SETTING` 匯出到 `D:\神州拆包資料\日期\SETTING`。
2. 在本專案執行 `import_rpgviewer_setting.bat --apply`，會把最新 `SETTING` 匯入 `raw`。
3. 把新的武冠收納 Excel 和商店購買 Excel 放到桌面。
4. 雙擊專案根目錄的 `build_collectbook_sources.bat`。
5. 開啟離線版網站，進入「武冠收錄資料」確認新資料。

先檢查不覆蓋：

```bat
import_rpgviewer_setting.bat
```

確認來源正確後再匯入：

```bat
import_rpgviewer_setting.bat --apply
```

如果換電腦，匯出路徑不同，可以直接指定：

```bat
import_rpgviewer_setting.bat --export-root "D:\神州拆包資料"
```

或指定某一次匯出的 `SETTING`：

```bat
import_rpgviewer_setting.bat --setting-dir "D:\神州拆包資料\0627\SETTING" --apply
```

## 一鍵更新網站資料

如果已經用 RPGViewer 拆好 `SETTING`，可用：

```bat
weekly_update_from_rpgviewer.bat
```

這會自動找最新 `SETTING`、匯入 raw、重建一般網站資料與武冠收錄資料，但不推送。

自動搜尋支援：

- `D:\神州拆包資料\0627\SETTING`
- `E:\神州拆包資料\0627\SETTING`
- `桌面\神州拆包資料\0627\SETTING`
- `文件\神州拆包資料\0627\SETTING`
- `桌面\0627\SETTING`
- `文件\0627\SETTING`

確認沒問題後，要一併 commit + push：

```bat
weekly_update_from_rpgviewer.bat --push
```

換電腦或路徑不同：

```bat
weekly_update_from_rpgviewer.bat --setting-dir "D:\神州拆包資料\0627\SETTING" --push
```

## 產生器

主要工具是：

```bat
build_collectbook_sources.bat
```

實際執行：

```bat
tools\build_collectbook_sources.py
```

如果檔名改很多，也可以手動指定來源：

```bat
python tools\build_collectbook_sources.py --collect-workbook "C:\path\collect.xlsx" --shop-workbook "C:\path\shop.xlsx" --setting-dir "C:\path\SETTING"
```
