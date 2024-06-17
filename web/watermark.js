const MutationObserver =
  window.MutationObserver ||
  window.WebKitMutationObserver ||
  window.MozMutationObserver;

function fitScreenWatermark(
  img,
  minCount,
  containerWidth = window.screen.width
) {
  const scaleRate = containerWidth / img.width / minCount;

  if (scaleRate >= 1) {
    return img.src;
  }

  return scaleImage(img, scaleRate);
}

function loadImg(imageSrc) {
  const image = new Image();
  image.src = imageSrc;

  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = reject;
  });
}

function scaleImage(img, scaleRate = 1) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const imgWidth = img.width;
  const imgHeight = img.height;
  canvas.width = imgWidth * scaleRate;
  canvas.height = imgHeight * scaleRate;

  context.scale(scaleRate, scaleRate);
  context.drawImage(img, 0, 0);

  const bs64 = canvas.toDataURL("image/png");

  return bs64;
}

class Watermark {
  constructor(container = document.body, { image }) {
    this.container = container;
    this.ob = null;
    this.obContainer = null;
    this.image = image;
    this.disposed = false;

    this.show({ id: Watermark.genId() });
  }

  async show({ zIndex = 10000, position = "absolute", id = "" } = {}) {
    Watermark.dispose(id);

    const container = this.container;
    Watermark.Map[id] = this;

    const oldImg = await loadImg(this.image);

    if (this.disposed) {
      return;
    }

    const base64Url = await fitScreenWatermark(
      oldImg,
      2,
      container.getBoundingClientRect().width
    );

    if (this.disposed) {
      return;
    }

    const $watermarkBox = container.querySelector(".watermark-box");

    let watermarkDiv = $watermarkBox || document.createElement("div");

    const styleStr = `
      position:${position};
      display: block;
      opacity: 1;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      width: 100%;
      height: 100%;
      z-index: ${zIndex};
      pointer-events: none;
      background-repeat: repeat;
      background-image: url('${base64Url}');
    `;

    watermarkDiv.className = "watermark-box";
    watermarkDiv.setAttribute("style", styleStr);
    watermarkDiv.id = watermarkDiv.id || id;

    let clonedWatermarkDiv = watermarkDiv.cloneNode(true);

    const containerPosition = getComputedStyle(container).position;

    if (!containerPosition || containerPosition === "static") {
      container.style.position = "relative";
    }

    if (!$watermarkBox) {
      container.insertBefore(watermarkDiv, container.firstChild);
    }

    if (MutationObserver) {
      const startObserve = () => {
        if (this.ob) {
          this.ob.disconnect();
        }
        this.ob = null;

        this.ob = new MutationObserver(nodes => {
          if (!watermarkDiv) {
            container.insertBefore(watermarkDiv, container.firstChild);
          } else {
            watermarkDiv.remove();
            this.ob.disconnect();
            this.ob = null;

            watermarkDiv = clonedWatermarkDiv;
            clonedWatermarkDiv = clonedWatermarkDiv.cloneNode(true);
            container.insertBefore(watermarkDiv, container.firstChild);
            startObserve();

            requestAnimationFrame(() => startObserveContainer());
          }
        });

        this.ob.observe(watermarkDiv, { attributes: true });
      };

      startObserve();

      const startObserveContainer = () => {
        if (this.obContainer) {
          this.obContainer.disconnect();
        }
        this.obContainer = null;

        this.obContainer = new MutationObserver(nodes => {
          watermarkDiv = document.getElementById(watermarkDiv.id);

          if (!watermarkDiv) {
            this.obContainer.disconnect();
            this.obContainer = null;

            watermarkDiv = clonedWatermarkDiv;
            clonedWatermarkDiv = clonedWatermarkDiv.cloneNode(true);
            container.insertBefore(watermarkDiv, container.firstChild);
            startObserveContainer();

            requestAnimationFrame(() => startObserve());
          }
        });

        this.obContainer.observe(this.container, { childList: true });
      };

      startObserveContainer();
    }

    // eslint-disable-next-line consistent-return
    return watermarkDiv.id;
  }

  dispose() {
    this.disposed = true;

    if (this.ob) {
      this.ob.disconnect();
    }

    if (this.obContainer) {
      this.obContainer.disconnect();
    }

    if (!this.container) {
      return;
    }

    const $watermarkBox = this.container.querySelector(".watermark-box");

    if ($watermarkBox) {
      $watermarkBox.remove();
      delete Watermark.Map[$watermarkBox.id];
    }
  }
}

Watermark.Map = {};

Watermark.dispose = id => {
  const instance = Watermark.Map[id];

  if (instance) {
    instance.dispose();
  }
};

Watermark.destroy = () => {
  for (const id in Watermark.Map) {
    Watermark.dispose(id);
  }
};

Watermark.genId = () => `id-${Math.random() * 1000000}`;

export { Watermark };
