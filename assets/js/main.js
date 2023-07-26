class ShortcutListener {
  constructor() {
    this.shortcuts = [];
    this.down = [];
    this.active = true;
    this.listeners = [];
    this.listen();

    // when the window loses focus, clear the down array
    this.addListener(window, "blur", () => {
      this.down = [];
      this.triggerShortcuts();
    });
  }

  addListener(element, shortcut, callback) {
    this.listeners.push({
      element,
      shortcut,
      callback,
    });
    element.addEventListener(shortcut, callback);
  }

  on(shortcuts, callback, offCallback) {
    if (typeof shortcuts === "string") shortcuts = [shortcuts];

    for (const shortcut of shortcuts) {
      this.shortcuts.push({
        shortcut: this.convertShortcut(shortcut),
        callback,
        offCallback,
      });
    }
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
        this.triggerShortcuts();
      }
    });

    this.addListener(document, "keyup", (e) => {
      this.down = this.down.filter((key) => {
        return key !== e.key.toLowerCase();
      });
      this.triggerShortcuts();
    });
  }

  triggerShortcuts() {
    for (const shortcutObj of this.shortcuts) {
      const { callback, offCallback, shortcut } = shortcutObj;
      if (this.check(shortcut)) {
        callback();
        shortcut.on = true;
      } else if (shortcut?.on && offCallback) {
        offCallback();
        shortcut.on = false;
      }
    }
  }

  check(shortcut) {
    let match = true;
    let keys = [];

    if (typeof shortcut === "string") keys = this.convertShortcut(shortcut);
    if (shortcut instanceof Array) keys = shortcut;

    for (const key of keys) {
      if (!this.down.includes(key)) {
        match = false;
      }
    }

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
    console.log("creating zoomer");
    settings = Object.assign(
      {
        root: false,
        inner: false,
        minZoom: 1,
        maxZoom: 6,
        zoomSpeed: 0.1,
        shortcut: "shift",
        smoothing: 8,
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
    this.smoothing = settings.smoothing;
    this.events = [];
    this.active = true;
    this.zoomLevel = 1;
    this.mouseOverRoot = false;
    this.smoothingPosBuffer = new Array(this.smoothing).fill(null);
    this.smoothingZoomBuffer = new Array(this.smoothing).fill(1);

    // this.addListener(window, "keydown", this.move.bind(this));

    this.addListener(document.body, "pointermove", (e) => {
      this.pos = { x: e.clientX, y: e.clientY };
    });

    this.addListener(this.root, "wheel", (e) => {
      this.zoomLevel = this.getZoom(e);
    });

    this.addListener(window, "resize", (e) => {
      this.move(this.pos);
    });

    this.addListener(this.root, "pointerenter", (e) => {
      if (!this.checkShortcut()) return;
      this.root.setPointerCapture(e.pointerId);
    });

    this.startLoop();

    this.shortcutListener.on(
      this.shortcut,
      () => {
        this.root.classList.add("zoomer-active");
      },
      () => {
        this.root.classList.remove("zoomer-active");
      }
    );
  }

  startLoop() {
    this.loopEnabled = true;
    this.step();
  }

  smooth(
    arr,
    newVal,
    factor,
    reduceCallback = (acc, cur) => {
      return acc + cur;
    },
    avgCallback = (zoom, factor) => {
      return zoom / factor;
    },
    initVal = 0
  ) {
    arr.shift();
    arr.push(newVal);

    let val = arr.reduce((acc, cur) => {
      if (!cur) return acc;
      return reduceCallback(acc, cur);
    }, initVal);

    val = avgCallback(val, factor);

    return val;
  }

  step() {
    if (!this.checkShortcut()) {
      window.requestAnimationFrame(() => this.step());
      return;
    }

    let pos = this.pos;
    let zoom = this.zoomLevel;

    if (this.smoothing !== 1) {
      pos = this.smooth(
        this.smoothingPosBuffer,
        this.pos,
        this.smoothing,
        (acc, cur) => {
          return {
            x: acc.x + cur.x,
            y: acc.y + cur.y,
          };
        },
        (pos, factor) => {
          return {
            x: pos.x / factor,
            y: pos.y / factor,
          };
        },
        { x: 0, y: 0 }
      );

      zoom = this.smooth(
        this.smoothingZoomBuffer,
        this.zoomLevel,
        this.smoothing
      );

      // console.log(JSON.stringify(pos), zoom + "x");
    }

    this.zoom(zoom);

    this.move(pos);

    if (!this.loopEnabled) return;
    window.requestAnimationFrame(() => this.step());
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
    console.log("destroying zoomer");
    this.active = false;
    delete this.root.zoomer;
    this.shortcutListener.destroy();
    this.loopEnabled = false;
  }

  checkShortcut() {
    let check = this.shortcutListener.check(this.shortcut);

    return check;
  }

  getZoom(e) {
    e.preventDefault();
    this.zoomLevel += (e.deltaY / 125) * -this.zoomSpeed;
    this.zoomLevel = Math.min(
      Math.max(this.minZoom, this.zoomLevel),
      this.maxZoom
    );
    return this.zoomLevel;
  }

  zoom(level) {
    if (!this.checkShortcut()) return;
    this.inner.style.transform = `scale(${level})`;
  }

  fitBounds(pos) {
    const { width, height } = this.root.getBoundingClientRect();
    let { x, y } = pos;
    if (x > width) x = width;
    if (y > height) y = height;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    return { x, y };
  }

  move({ x, y }) {
    if (this.zoomLevel === 1) return;

    const { width, height, left, top } = this.root.getBoundingClientRect();

    x = x - left;
    y = y - top;

    // fit the x and y to the bounds of the root
    ({ x, y } = this.fitBounds({ x, y }));

    this.inner.style.transformOrigin = `${x}px ${y}px`;

    this.mouseOverRoot = false;

    // track if the user is hovering over the root
    if (x >= 0 && x <= width && y >= 0 && y <= height) {
      this.mouseOverRoot = true;
    }
  }
}

class ZoomFactory {
  constructor(params = {}) {
    params = Object.assign(
      {
        settings: {},
        videoSelectors: {
          default: {
            root: ".zoomer",
            inner: ".inner",
          },
        },
      },
      params
    );

    ({ root: this.rootQuery, inner: this.innerQuery } = this.getRootSettings(
      params.videoSelectors
    ));

    console.log("zoom settings", {
      root: this.rootQuery,
      inner: this.innerQuery,
    });

    this.root = document.querySelector(this.rootQuery);
    this.settings = params.settings;

    this.create(document.body);
    this.observe();
  }

  getRootSettings(selectors) {
    let rootSettings = selectors.default;

    for (const key in selectors) {
      const { url } = selectors[key];
      if (window.location.href.includes(url)) {
        rootSettings = selectors[key];
      }
    }

    return rootSettings;
  }

  create(node) {
    let root = this.getRoot(node);
    if (!root) return;

    let inner = root.querySelector(this.innerQuery);
    if (!inner) return;

    if (root?.zoomer) return;

    new Zoomer({
      root,
      inner,
      ...this.settings,
    });
  }

  observe() {
    // listen for updates to the dom and if a new root is added, add a new zoomer
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // added nodes
        mutation.addedNodes.forEach((node) => this.create(node));

        // removed nodes
        mutation.removedNodes.forEach((node) => {
          let root = this.getRoot(node);
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
  }

  getRoot(node) {
    let root = false;

    if (node.matches && node.matches(this.rootQuery)) {
      root = node;
    } else if (node.querySelector && node.querySelector(this.rootQuery)) {
      root = node.querySelector(this.rootQuery);
    } else if (node.closest && node.closest(this.rootQuery)) {
      root = node.closest(this.rootQuery);
    }

    return root;
  }
}

new ZoomFactory({
  settings: {
    shortcut: "shift",
    minZoom: 1,
    maxZoom: 6,
    zoomSpeed: 0.1,
    smoothing: 3,
  },
  videoSelectors: {
    default: {
      root: ".zoomer",
      inner: ".inner",
    },
    youtube: {
      url: "https://www.youtube.com",
      root: "#ytd-player",
      inner: "video",
    },
    netflix: {
      url: "https://www.netflix.com",
      root: ".watch-video",
      inner: "[data-uia='video-canvas']",
    },
    reddit: {
      url: "https://www.reddit.com",
      root: `div:has( > [data-testid="shreddit-player-wrapper"])`,
      inner: `[data-testid="shreddit-player-wrapper"]`,
    },
  },
});

// Bugs:
// scrolling when not holding shift does not work on reddit
