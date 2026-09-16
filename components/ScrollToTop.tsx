"use client";

// Yenilemede sayfa başına döner. Tarayıcının kendi scroll geri yükleme
// davranışı, uzun bir sayfada F5'e basan ziyaretçiyi sayfanın ortasında
// bırakıyordu; burada `scrollRestoration` manuel'e alınıp ilk boyamada
// başa dönülür. `#bolum` gibi bir çapa varsa dokunulmaz - o durumda
// hedefe gitmek doğru davranıştır.
import { useEffect } from "react";

export default function ScrollToTop() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, []);

  return null;
}
