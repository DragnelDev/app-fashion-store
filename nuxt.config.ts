// https://nuxt.com/docs/api/configuration/nuxt-config
//
// Variables de entorno (ver .env.example). Nuxt sobreescribe `runtimeConfig` en tiempo de
// ejecución con variables NUXT_* (p. ej. NUXT_MONGODB_URI, NUXT_CLOUDINARY_API_SECRET), por lo
// que ningún secreto queda grabado en el build: aquí solo se declaran valores vacíos.
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss"],

  tailwindcss: {
    cssPath: "~/assets/css/tailwind.css",
  },

  postcss: {
    plugins: {
      "tailwindcss/nesting": false,
      "postcss-nesting": {},
    },
  },

  vite: {
    optimizeDeps: {
      include: ["@vue/devtools-core", "zod"],
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: "es-BO" },
      title: "Vestiq · Moda en Bolivia",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "Vestiq: tienda de ropa online con envíos a toda Bolivia. Precios en Bs. con IVA incluido.",
        },
        { name: "theme-color", content: "#9f1239" },
      ],
    },
  },

  runtimeConfig: {
    // --- Solo servidor (NUXT_*) -------------------------------------------------
    NUXT_MONGODB_URI: "",
    mongodbUri: "",
    NUXT_ADMIN_API_KEY: "",
    adminApiKey: "",
    NUXT_TRUST_PROXY: false,
    trustProxy: false,
    storage: {
      /** NUXT_STORAGE_DRIVER — "local" (desarrollo, disco) | "cloudinary" (producción) */
      driver: "local",
    },
    cloudinary: {
      /** NUXT_CLOUDINARY_CLOUD_NAME */
      cloudName: "",
      /** NUXT_CLOUDINARY_API_KEY */
      apiKey: "",
      /** NUXT_CLOUDINARY_API_SECRET */
      apiSecret: "",
      /** NUXT_CLOUDINARY_FOLDER */
      folder: "vestiq",
    },

    // --- Públicas (NUXT_PUBLIC_*) -----------------------------------------------
    public: {
      siteName: "Vestiq",
      /** NUXT_PUBLIC_UPLOAD_MAX_MB — límite por imagen (cliente y servidor) */
      uploadMaxMb: 5,
      pago: {
        /** NUXT_PUBLIC_PAGO_QR_IMAGE_URL — imagen del QR de cobro (Simple QR) */
        qrImageUrl: "/qr/pago-qr.svg",
        /** NUXT_PUBLIC_PAGO_QR_BANCOS */
        qrBancos: "Simple QR · Banco Bisa · BCP · BNB",
        /** NUXT_PUBLIC_PAGO_TITULAR */
        titular: "Vestiq S.R.L.",
        /** NUXT_PUBLIC_PAGO_TRANSFERENCIA_BANCO */
        transferenciaBanco: "",
        /** NUXT_PUBLIC_PAGO_TRANSFERENCIA_CUENTA */
        transferenciaCuenta: "",
        /** NUXT_PUBLIC_PAGO_WHATSAPP — número con código de país, sin "+", para coordinar pagos */
        whatsapp: "",
      },
    },
  },

  nitro: {
    // Almacenamiento local de imágenes (solo desarrollo). En producción se usa Cloudinary.
    storage: {
      uploads: { driver: "fs", base: "./storage/uploads" },
    },
    routeRules: {
      "/**": {
        headers: {
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "X-Frame-Options": "SAMEORIGIN",
        },
      },
      "/api/**": { headers: { "Cache-Control": "no-store" } },
    },
  },

  typescript: { strict: true },
});
