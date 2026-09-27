// يطبّق تفضيلات العرض المحفوظة قبل أول رسم — بلا وميض فاتح لمن اختار الداكن.
// ملف خارجي لا سكربت مضمَّن: سياسة CSP تمنع المضمَّن (script-src 'self').
(function () {
  try {
    var p = JSON.parse(localStorage.getItem("mihwar.prefs") || "{}");
    var d = document.documentElement;
    var dark = p.theme === "dark" || (p.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    d.dataset.theme = dark ? "dark" : "light";
    if (p.headingFont === false) d.dataset.heading = "plain";
    var z = [1, 1.08, 1.16, 1.25, 1.35][p.fontScale | 0] || 1;
    d.style.setProperty("--ui-zoom", String(z));
    d.dataset.fs = String(p.fontScale | 0);
  } catch (e) {}
})();
