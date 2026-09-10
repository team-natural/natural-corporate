import AOS from "aos";
import "aos/dist/aos.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

AOS.init({ duration: 800, once: true, offset: 60 });

const header = document.getElementById("site-header");
window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 80);
});

const drawer = document.getElementById("nav-drawer");
const drawerToggle = document.getElementById("nav-toggle");

drawerToggle.addEventListener("click", () => {
  drawer.checked = !drawer.checked;
  drawerToggle.setAttribute("aria-expanded", String(drawer.checked));
});

// #nav-overlay is a <label for="nav-drawer">, so tapping it already unchecks
// the checkbox via native label behavior — just keep aria-expanded in sync.
drawer.addEventListener("change", () => {
  drawerToggle.setAttribute("aria-expanded", String(drawer.checked));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer.checked) {
    drawer.checked = false;
    drawerToggle.setAttribute("aria-expanded", "false");
    drawerToggle.focus();
  }
});
