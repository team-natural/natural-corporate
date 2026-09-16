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
const drawerNav = document.getElementById("nav-menu");

// Closed drawer links stay in the DOM (CSS-only slide via the peer checkbox), so `inert`
// keeps them out of tab order and off-screen readers until the drawer actually opens.
function syncDrawerState() {
  drawerToggle.setAttribute("aria-expanded", String(drawer.checked));
  drawerNav.inert = !drawer.checked;
}

drawerToggle.addEventListener("click", () => {
  drawer.checked = !drawer.checked;
  syncDrawerState();
});

// #nav-overlay is a <label for="nav-drawer">, so tapping it already unchecks
// the checkbox via native label behavior — just keep state in sync.
drawer.addEventListener("change", () => {
  syncDrawerState();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer.checked) {
    drawer.checked = false;
    syncDrawerState();
    drawerToggle.focus();
  }
});
