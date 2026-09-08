const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const axios = require('axios');
const path = require('node:path');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');

// 1. Konfigurasi CORS (Lokal & Live Domain)
app.use(cors({
  origin: (origin, callback) => {
    const defaultAllowed = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://cyeecare-beauty.online',
      'http://cyeecare-beauty.online'
    ];

    const envOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((val) => val.trim())
      .filter(Boolean);

    const allowedOrigins = [...defaultAllowed, ...envOrigins];

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// 2. Static Middleware untuk folder public (sejajar dengan backend)
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// 3. Konfigurasi Kredensial Vendor (Toewin)
const VENDOR_CONFIG = {
  apiUrl: process.env.VENDOR_API_URL || 'https://web.mark.toewin.com/webapi1/channel/api/codeStatusInfo/tCheckCode',
  brandId: process.env.CYEECARE_BRAND_ID || 80,
  account: process.env.CYEECARE_ACCOUNT || 'www',
  password: process.env.CYEECARE_PASSWORD || 'bbb'
};

// Fungsi Pembuat MD5 Sign 32-bit Uppercase
function generateToewinSign(brandId, account, password, type, fwm) {
  const rawString = `brandId=${brandId}&account=${account}&password=${password}&type=${type}&fwm=${fwm}`;
  // Required by the vendor's legacy signing protocol; this is not used for password storage.
  return crypto.createHash('md5').update(rawString).digest('hex').toUpperCase(); // NOSONAR
}

// 4. Routes
// Serve index.html saat root domain dibuka
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'active', message: 'Cyeecare API Backend Running Successfully' });
});

// Endpoint Verifikasi Produk
app.post('/api/verify', async (req, res) => {
  const { code, type, vCode, brandName } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Kode produk wajib diisi."
    });
  }

  try {
    const selectedType = Number.parseInt(type) || 1;

    const sign = generateToewinSign(
      VENDOR_CONFIG.brandId,
      VENDOR_CONFIG.account,
      VENDOR_CONFIG.password,
      selectedType,
      code
    );

    const payload = {
      brandId: VENDOR_CONFIG.brandId,
      account: VENDOR_CONFIG.account,
      fwm: code,
      type: selectedType,
      sign: sign
    };

    if (selectedType === 2 && vCode) {
      payload.vCode = vCode;
    }

    const vendorResponse = await axios.post(VENDOR_CONFIG.apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    const resData = vendorResponse.data;

    if (resData._code === 0 && resData._success) {
      return res.status(200).json({
        success: true,
        message: resData._message || "Produk Terverifikasi Asli",
        data: {
          brand: brandName || "Cyeecare",
          productName: "Official Authentic Product",
          firstCheckTime: resData._data?.E || "-",
          totalCheckCount: resData._data?.C || 1,
          currentCheckCount: resData._data?.D || 1
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: resData._message || "Kode tidak valid atau produk palsu."
    });

  } catch (error) {
    console.error("Vendor Connection Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Gagal terhubung ke server verifikasi vendor."
    });
  }
});

// Port otomatis mengikut Hostinger / default 5000
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Express berjalan di port ${PORT}`);
});