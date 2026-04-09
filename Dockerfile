# Menggunakan sistem Node.js minimalis yang ringan
FROM node:18-bullseye-slim

# Update sistem & Install library OS yang WAJIB untuk menjalankan "Chrome" bohongan (Puppeteer)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    libnss3-dev \
    libgconf-2-4 \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Aturan Mutlak Hugging Face: Aplikasi TIDAK BOLEH berjalan sebagai root, harus menggunakan user 1000
# Karena sistem Node.js sudah punya user bernama "node" dengan ID 1000, kita pakai itu saja:
USER node

# Set working direktori di dalam server cloud
WORKDIR /app

# Copy konfigurasi utama & install module Node.js
COPY --chown=node package*.json ./
RUN npm install

# Tarik semua file index.js dll ke server
COPY --chown=node . .

# Hugging Face Spaces menggunakan Port 7860 secara bawaan
ENV PORT=7860
EXPOSE 7860

# Jalankan Bot-nya!
CMD ["npm", "start"]
