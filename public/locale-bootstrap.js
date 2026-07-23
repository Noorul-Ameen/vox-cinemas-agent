try {
  const locale = localStorage.getItem("vox_locale") === "ar" ? "ar" : "en";
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
} catch {}
