# Vercel Environment Variables - Ready to Copy

## Environment Variables to Set in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

---

## 1. CRON_STATIONS

**Value (All Stations):**
```
dncltz1,dncltz2,dncltz3,dncltz4,dncltz5,dncltz6,dncltz7,dncltz8,dncltz9,dncltz10
```

**Alternative (Subset - Example):**
If you only want to run cron jobs for specific stations, you can use:
```
dncltz1,dncltz2,dncltz3
```

**Format:** Comma-separated, no spaces (or with spaces, the code will trim them)

---

## 2. CRON_DEFAULT_LOCATION

**Value:**
```
DNCL-Inspection
```

**Alternative Locations Available:**
- `DNCL-Inspection` (default/recommended)
- `DNCL-Testing`
- `DNCL-Storage`
- `DNCL-Warehouse-A`
- `DNCL-Warehouse-B`
- `DNCL-Processing`
- `DNCL-QC`
- `DNCL-Shipping`

---

## 3. CRON_SECRET

**Value:** (You already set this - keep it as is)

---

## Quick Copy-Paste for Vercel Dashboard

### Variable 1:
- **Key:** `CRON_STATIONS`
- **Value:** `dncltz1,dncltz2,dncltz3,dncltz4,dncltz5,dncltz6,dncltz7,dncltz8,dncltz9,dncltz10`
- **Environment:** Production (and Preview if needed)

### Variable 2:
- **Key:** `CRON_DEFAULT_LOCATION`
- **Value:** `DNCL-Inspection`
- **Environment:** Production (and Preview if needed)

---

## Notes

- **Stations:** The codebase shows stations from `dncltz1` to `dncltz10`
- **Location:** `DNCL-Inspection` is the default location used throughout the app
- **Format:** No spaces needed in CRON_STATIONS (code will trim them automatically)
- **After setting:** Redeploy your app for changes to take effect

