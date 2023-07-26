class ShortcutListener {
  constructor() {
    this.shortcuts = [];
    this.down = [];
    this.active = true;
    this.listeners = [];
    this.listen();

    // when the window loses focus, clear the down array
    this.addListener(window, "blur", () => (this.down = []));
  }

  addListener(element, shortcut, callback) {
    this.listeners.push({
      element,
      shortcut,
      callback,
    });
    element.addEventListener(shortcut, callback);
  }

  removeListeners() {
    this.listeners.forEach(({ element, shortcut, callback }) => {
      element.removeEventListener(shortcut, callback);
    });
  }

  destroy() {
    this.removeListeners();
    this.active = false;
  }

  listen() {
    this.addListener(document, "keydown", (e) => {
      if (!this.down.includes(e.key.toLowerCase())) {
        this.down.push(e.key.toLowerCase());
      }
      console.log(this.down);
    });

    this.addListener(document, "keyup", (e) => {
      this.down = this.down.filter((key) => {
        return key !== e.key.toLowerCase();
      });
      console.log(this.down);
    });
  }

  check(shortcut) {
    let match = true;
    let keys = this.convertShortcut(shortcut);

    for (const key of keys) {
      if (!this.down.includes(key)) {
        match = false;
      }
    }

    console.log(keys, this.down, match);

    if (match && keys.length === this.down.length) {
      return true;
    }
    return false;
  }

  // converts a string like "ctrl+shift+e" to an object like {ctrl: true, shift: true, e: true}
  convertShortcut(shortcutStr) {
    let aliases = {
      control: ["ctrl"],
      meta: ["cmd"],
      shift: ["shift"],
      alt: ["option"],
    };

    shortcutStr = shortcutStr.toLowerCase();
    for (const key in aliases) {
      aliases[key].forEach((alias) => {
        shortcutStr = shortcutStr.replace(alias, key);
      });
    }

    return shortcutStr.split("+");
  }
}

class Zoomer {
  constructor(settings) {
    console.log("creating zoomer asd");
    settings = Object.assign(
      {
        root: false,
        inner: false,
        minZoom: 1,
        maxZoom: 6,
        zoomSpeed: 0.1,
        shortcut: "shift",
      },
      settings
    );
    if (!settings.root || !settings.inner) {
      console.error("Zoomer: Missing outer or inner element");
      return;
    }

    this.root = settings.root;
    this.inner = settings.inner;
    this.root.zoomer = this;

    this.shortcutListener = new ShortcutListener();

    this.minZoom = settings.minZoom;
    this.maxZoom = settings.maxZoom;
    this.zoomSpeed = settings.zoomSpeed;
    this.shortcut = settings.shortcut;
    this.events = [];
    this.active = true;
    this.zoom = 1;
    this.mouseOverRoot = false;

    this.addListener(this.root, "wheel", this.onWheel.bind(this));
    this.addListener(window, "pointermove", this.onMove.bind(this));
    this.addListener(window, "keydown", this.onMove.bind(this));
  }

  addListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.events.push({
      element,
      event,
      handler,
    });
  }

  removeListeners() {
    this.events.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
  }

  destroy() {
    this.removeListeners();
    console.log("destroying");
    this.active = false;
    delete this.root.zoomer;
  }

  checkShortcut() {
    let check = this.shortcutListener.check(this.shortcut);
    console.log(check ? "shortcut down" : "shortcut up");

    return check;
  }

  onWheel(e) {
    // if (!this.mouseOverRoot) return;
    console.log(this.zoom, this.minZoom, this.maxZoom);
    if (this.zoom === this.minZoom && e.deltaY > 0) return;
    if (this.zoom === this.maxZoom && e.deltaY < 0) return;
    if (!this.checkShortcut()) return;

    e.preventDefault();
    this.zoom += (e.deltaY / 125) * -this.zoomSpeed;
    this.zoom = Math.min(Math.max(this.minZoom, this.zoom), this.maxZoom);

    this.inner.style.transform = `scale(${this.zoom})`;
  }

  onMove(e) {
    const { width, height, left, top } = this.root.getBoundingClientRect();

    let x = e.clientX - left;
    let y = e.clientY - top;

    if (x > width) x = width;
    if (y > height) y = height;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    this.inner.style.transformOrigin = `${x}px ${y}px`;

    this.mouseOverRoot = false;

    // track if the user is hovering over the root
    if (x >= 0 && x <= width && y >= 0 && y <= height) {
      this.mouseOverRoot = true;
    }
  }
}

let rootQuery = ".zoomer, #ytd-player";
let innerQuery = ".inner, .html5-video-container";
let root = document.querySelector(rootQuery);
let settings = {
  minZoom: 1,
  maxZoom: 6,
  zoomSpeed: 0.3,
};

if (root) {
  let inner = root.querySelector(innerQuery);

  new Zoomer({
    root,
    inner,
    ...settings,
  });
}

function getRoot(node) {
  let root = false;
  // console.log(node.innerHTML);

  if (node.matches && node.matches(rootQuery)) {
    root = node;
  } else if (node.querySelector && node.querySelector(rootQuery)) {
    root = node.querySelector(rootQuery);
  } else if (node.closest && node.closest(rootQuery)) {
    root = node.closest(rootQuery);
  }

  return root;
}

zoomers = [];

// listen for updates to the dom and if a new root is added, add a new zoomer
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    // added nodes
    mutation.addedNodes.forEach((node) => {
      let root = getRoot(node);
      if (!root) return;

      let inner = root.querySelector(innerQuery);
      if (!inner) return;

      if (root?.zoomer) return;

      let zoomer = new Zoomer({
        root,
        inner,
        ...settings,
      });
      zoomers.push(zoomer);
    });

    // removed nodes
    mutation.removedNodes.forEach((node) => {
      let root = getRoot(node);
      if (!root) return;
      if (!root?.zoomer) return;

      root.zoomer.destroy();
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
