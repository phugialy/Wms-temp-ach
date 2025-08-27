# Google Sheets API Setup Guide

You have **3 simple options** to set up Google Sheets API access. Choose the one that works best for you:

## 🎯 **Option 1: API Key (Recommended - Simplest)**

**Best for:** Read-only access, no file management needed

### Setup Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Sheets API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the API key
6. Add to your `.env` file:

```env
GOOGLE_API_KEY=your_api_key_here
```

**That's it!** No files to manage, no complex setup.

---

## 🔐 **Option 2: Service Account JSON in Environment Variable**

**Best for:** More secure, production-ready

### Setup Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Sheets API**
4. Go to **Credentials** → **Create Credentials** → **Service Account**
5. Download the JSON file
6. Copy the **entire JSON content** and add to your `.env` file:

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

**Note:** The entire JSON goes on one line in the `.env` file.

---

## 📁 **Option 3: Service Account JSON File**

**Best for:** Traditional file-based approach

### Setup Steps:
1. Follow steps 1-5 from Option 2
2. Save the JSON file in your project (e.g., `google-service-account.json`)
3. Add to your `.env` file:

```env
GOOGLE_SERVICE_ACCOUNT_KEY=./google-service-account.json
```

---

## 🔗 **Share Your Google Sheet**

After setting up authentication, make sure your Google Sheet is shared:

1. Open your Google Sheet: `https://docs.google.com/spreadsheets/d/18Zo9Z9n7D6j0dzYpPTj9_zgrg0poNFJ5rU5iss593qo/edit`
2. Click **Share** (top right)
3. If using **API Key**: Make the sheet **Public** (anyone with link can view)
4. If using **Service Account**: Share with the service account email (found in the JSON)

---

## 🧪 **Test Your Setup**

Once configured, you can test the connection:

1. Start your server: `npm run server`
2. Visit: `http://localhost:3001/sku-matching`
3. Click **"Refresh Stats"** to test the connection

---

## 🚨 **Security Notes**

- **API Key**: Simple but less secure. Good for development/testing.
- **Service Account**: More secure, recommended for production.
- **Never commit** your `.env` file to version control.
- **Restrict API key** in Google Cloud Console for production use.

---

## ❓ **Need Help?**

If you get authentication errors:
1. Check that the Google Sheets API is enabled
2. Verify your sheet is shared correctly
3. Check the console logs for specific error messages
4. Make sure your `.env` file is in the project root
