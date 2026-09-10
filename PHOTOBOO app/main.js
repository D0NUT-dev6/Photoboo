const video = document.querySelector('#video');
const canvas = document.querySelector('#canvas');
const viewport = document.querySelector('.viewport-wrap');
const captureButton = document.querySelector('#captureButton');
const flipButton = document.querySelector('#flipButton');
const soundButton = document.querySelector('#soundButton');
const clearButton = document.querySelector('#clearButton');
const downloadButton = document.querySelector('#downloadButton');
const photoStrip = document.querySelector('#photoStrip');
const photoCount = document.querySelector('#photoCount');
const countdown = document.querySelector('#countdown');
const smileGuide = document.querySelector('#smileGuide');
const curtain = document.querySelector('#curtain');
const timerLabel = document.querySelector('#timerLabel');
const statusText = document.querySelector('#statusText');
const newTipButton = document.querySelector('#newTip');
const captionInput = document.querySelector('#captionInput');
const stripDesignButtons = document.querySelectorAll('.design-button');
const stickerButtons = document.querySelectorAll('.sticker-button');
const stickerUpload = document.querySelector('#stickerUpload');
const cropEditor = document.querySelector('#cropEditor');
const cropCanvas = document.querySelector('#cropCanvas');
const selectionBox = document.querySelector('#selectionBox');
const applyCrop = document.querySelector('#applyCrop');
const borderButtons = document.querySelectorAll('.border-button');
const smileToggle = document.querySelector('#smileToggle');
const printedStrip = document.querySelector('#printedStrip');

const photos = [];
let activeFilter = 'normal';
let facingMode = 'user';
let stream;
let soundOn = true;
let activeDesign = 'lilac';
const stickers = [];
let stickerId = 0;
let selectedPhoto = 0;
let selectedStickerId = null;
let pendingUpload = '';
let cropImage = null;
let selecting = false;
let selectionStart = { x: 0, y: 0 };
let selection = { x: 0, y: 0, width: 320, height: 240 };
let stripCaption = '';
let activeBorder = 'stars';
let showSmile = true;
const tips = [
  'Good light looks good on everyone.',
  'Chin up. Shoulders loose. You look great.',
  'The best pose is the one you almost missed.',
  'Keep the weird little smile.',
];

const filters = {
  normal: '',
  warm: 'sepia(.38) saturate(1.22) hue-rotate(-8deg)',
  mono: 'grayscale(1) contrast(1.1)',
  vivid: 'saturate(1.65) contrast(1.08)',
};

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = 'demo mode';
    return;
  }
  try {
    stream?.getTracks().forEach((track) => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    video.srcObject = stream;
    viewport.classList.add('camera-live');
    statusText.textContent = 'camera connected';
  } catch (error) {
    statusText.textContent = 'demo mode';
  }
}

function setFilter(filter) {
  activeFilter = filter;
  viewport.classList.remove('filter-warm', 'filter-mono', 'filter-vivid');
  if (filter !== 'normal') viewport.classList.add(`filter-${filter}`);
  document.querySelectorAll('.filter-button').forEach((button) => button.classList.toggle('active', button.dataset.filter === filter));
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function capturePhoto() {
  if (captureButton.disabled || photos.length >= 4) return;
  captureButton.disabled = true;
  smileGuide.classList.toggle('guide-visible', showSmile);
  timerLabel.textContent = 'GET READY';
  for (let number = 3; number > 0; number -= 1) {
    countdown.textContent = number;
    await wait(650);
  }
  countdown.textContent = '';
  smileGuide.classList.remove('guide-visible');
  curtain.classList.add('curtain-closing');
  await wait(520);
  timerLabel.textContent = 'CAPTURING';
  const width = video.videoWidth || 960;
  const height = video.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (viewport.classList.contains('camera-live')) {
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    context.restore();
  } else {
    context.fillStyle = '#d9cabd';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#f06449';
    context.beginPath();
    context.arc(width * .5, height * .6, Math.min(width, height) * .22, Math.PI, 0);
    context.fill();
    context.fillStyle = '#f7c950';
    context.beginPath();
    context.arc(width * .77, height * .2, Math.min(width, height) * .12, 0, Math.PI * 2);
    context.fill();
  }
  curtain.classList.remove('curtain-closing');
  const dataUrl = canvas.toDataURL('image/jpeg', .9);
  photos.push({ dataUrl, filter: activeFilter });
  selectedPhoto = photos.length - 1;
  renderStrip();
  renderPrinter();
  video.play().catch(() => {});
  viewport.classList.add('photo-flash');
  setTimeout(() => viewport.classList.remove('photo-flash'), 180);
  timerLabel.textContent = photos.length === 4 ? 'STRIP READY' : 'READY';
  captureButton.disabled = photos.length >= 4;
  if (soundOn) playShutter();
}

function renderStrip() {
  photoCount.textContent = `${photos.length} / 4 frames`;
  downloadButton.disabled = photos.length === 0;
  photoStrip.className = `photo-strip strip-${activeDesign} border-${activeBorder}`;
  if (!photos.length) {
    photoStrip.innerHTML = '<div class="empty-strip"><span>+</span><p>Your snapshots<br />will land here.</p></div>';
    return;
  }
  const caption = stripCaption ? `<div class="strip-caption">${escapeHtml(stripCaption)}</div>` : '';
  const border = borderSymbols[activeBorder];
  photoStrip.innerHTML = `${photos.map((photo, index) => `<div class="photo-thumb ${selectedPhoto === index ? 'photo-selected' : ''}" data-photo-index="${index}" data-border="${border}"><img src="${photo.dataUrl}" alt="Snapshot ${index + 1}" style="filter: ${filters[photo.filter] || 'none'}">${stickers.filter((sticker) => sticker.photoIndex === index).map(renderSticker).join('')}<span>0${index + 1}</span><button class="delete-photo" data-photo-index="${index}" type="button" aria-label="Delete photo ${index + 1}">×</button></div>`).join('')}<div class="sticker-trash" aria-label="Drag stickers here to remove them">×<small>drop stickers here</small></div>${caption}`;
  document.querySelectorAll('.photo-thumb').forEach((frame) => frame.addEventListener('click', (event) => {
    if (event.target.closest('.placed-sticker, .delete-photo')) return;
    selectedPhoto = Number(frame.dataset.photoIndex);
    renderStrip();
  }));
  document.querySelectorAll('.delete-photo').forEach((button) => button.addEventListener('click', () => {
    const deletedIndex = Number(button.dataset.photoIndex);
    photos.splice(deletedIndex, 1);
    for (let index = stickers.length - 1; index >= 0; index -= 1) {
      if (stickers[index].photoIndex === deletedIndex) stickers.splice(index, 1);
      else if (stickers[index].photoIndex > deletedIndex) stickers[index].photoIndex -= 1;
    }
    selectedPhoto = Math.max(0, Math.min(selectedPhoto, photos.length - 1));
    renderStrip();
    renderPrinter();
    captureButton.disabled = false;
    timerLabel.textContent = 'READY';
  }));
  enableStickerDragging();
}

function renderSticker(sticker) {
  const content = sticker.src ? `<img src="${sticker.src}" alt="Custom sticker" />` : escapeHtml(sticker.value);
  return `<button class="placed-sticker" data-sticker-id="${sticker.id}" type="button" style="left:${sticker.x}%;top:${sticker.y}%;--sticker-size:${sticker.size || 1};--sticker-rotation:${sticker.rotation || 0}deg" aria-label="Sticker, drag to move"><span class="sticker-content">${content}</span><i class="resize-handle" aria-hidden="true"></i><i class="rotate-handle" aria-hidden="true">↻</i></button>`;
}

function enableStickerDragging() {
  document.querySelectorAll('.placed-sticker').forEach((element) => {
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const sticker = stickers.find((item) => item.id === Number(element.dataset.stickerId));
      const frame = element.closest('.photo-thumb');
      if (!sticker || !frame) return;
      selectedStickerId = sticker.id;
      element.setPointerCapture?.(event.pointerId);
      const action = event.target.closest('.resize-handle') ? 'resize' : event.target.closest('.rotate-handle') ? 'rotate' : 'move';
      const elementBounds = element.getBoundingClientRect();
      const centerX = elementBounds.left + elementBounds.width / 2;
      const centerY = elementBounds.top + elementBounds.height / 2;
      const startingSize = sticker.size || 1;
      const startingRotation = sticker.rotation || 0;
      const moveSticker = (moveEvent) => {
        const bounds = frame.getBoundingClientRect();
        if (action === 'move') {
          sticker.x = Math.max(4, Math.min(96, ((moveEvent.clientX - bounds.left) / bounds.width) * 100));
          sticker.y = Math.max(4, Math.min(96, ((moveEvent.clientY - bounds.top) / bounds.height) * 100));
          } else if (action === 'resize') {
          const distance = Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY);
            sticker.size = Math.max(.25, startingSize * (distance / Math.max(12, elementBounds.width / 2)));
        } else {
          sticker.rotation = startingRotation + (Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI) - 90;
        }
        document.querySelectorAll(`[data-sticker-id="${sticker.id}"]`).forEach((stickerElement) => {
          stickerElement.style.left = `${sticker.x}%`;
          stickerElement.style.top = `${sticker.y}%`;
          stickerElement.style.setProperty('--sticker-size', sticker.size || 1);
          stickerElement.style.setProperty('--sticker-rotation', `${sticker.rotation || 0}deg`);
        });
        if (action === 'move') {
          const trash = document.querySelector('.sticker-trash');
          if (trash) trash.classList.toggle('trash-active', isInside(moveEvent.clientX, moveEvent.clientY, trash.getBoundingClientRect()));
        }
      };
      const stopDragging = (upEvent) => {
        const trash = document.querySelector('.sticker-trash');
        if (action === 'move' && trash) {
          const droppedInTrash = isInside(upEvent.clientX, upEvent.clientY, trash.getBoundingClientRect());
          trash.classList.remove('trash-active');
          if (droppedInTrash) {
            const index = stickers.findIndex((item) => item.id === sticker.id);
            if (index >= 0) stickers.splice(index, 1);
            renderStrip();
          }
        }
        element.removeEventListener('pointermove', moveSticker);
        element.removeEventListener('pointerup', stopDragging);
        element.removeEventListener('pointercancel', stopDragging);
      };
      element.addEventListener('pointermove', moveSticker);
      element.addEventListener('pointerup', stopDragging);
      element.addEventListener('pointercancel', stopDragging);
    });
    element.addEventListener('dblclick', () => {
      const index = stickers.findIndex((item) => item.id === Number(element.dataset.stickerId));
      if (index >= 0) stickers.splice(index, 1);
      renderStrip();
    });
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      selectedStickerId = Number(element.dataset.stickerId);
    });
  });
}

function isInside(x, y, bounds) {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

const borderSymbols = { stars: '✦ ✧ ✦', hearts: '♡ ♥ ♡', swirls: '〰 〰 〰' };

function renderPrinter() {
  if (!photos.length) {
    printedStrip.innerHTML = '';
    return;
  }
  printedStrip.innerHTML = `<span class="printer-doodle">${borderSymbols[activeBorder]}</span><span>${photos.length} / 4</span>`;
  printedStrip.classList.remove('printing');
  void printedStrip.offsetWidth;
  printedStrip.classList.add('printing');
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function downloadStrip() {
  if (!photos.length) return;
  const output = document.createElement('canvas');
  const tileWidth = 600;
  const tileHeight = 790;
  const footerHeight = stripCaption ? 100 : 0;
  output.width = tileWidth;
  output.height = tileHeight * photos.length + footerHeight;
  const context = output.getContext('2d');
  const designs = { lilac: '#eee7ff', night: '#29224d', sky: '#dcecff' };
  context.fillStyle = designs[activeDesign];
  context.fillRect(0, 0, output.width, output.height);
  const loadImage = (source) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = source;
  });
  for (const [index, photo] of photos.entries()) {
    const image = await loadImage(photo.dataUrl);
    context.filter = filters[photo.filter] || 'none';
    context.drawImage(image, 0, index * tileHeight, tileWidth, tileHeight);
    context.filter = 'none';
    context.textAlign = 'center';
    for (const sticker of stickers.filter((item) => item.photoIndex === index)) {
      const x = (sticker.x / 100) * tileWidth;
      const y = (sticker.y / 100) * tileHeight;
      const rotation = (sticker.rotation || 0) * Math.PI / 180;
      context.save();
      context.translate(x, index * tileHeight + y);
      context.rotate(rotation);
      if (sticker.src) {
        const stickerImage = await loadImage(sticker.src);
        const stickerSize = 68 * (sticker.size || 1);
        context.drawImage(stickerImage, -stickerSize / 2, -stickerSize / 2, stickerSize, stickerSize);
      } else {
        context.fillStyle = activeDesign === 'night' ? '#f5c9ff' : '#6045a5';
        context.font = `bold ${54 * (sticker.size || 1)}px "DM Sans", sans-serif`;
        context.fillText(sticker.value, 0, 0);
      }
      context.restore();
    }
    context.fillStyle = activeDesign === 'night' ? '#f5c9ff' : '#6045a5';
    context.font = 'bold 38px "Comic Sans MS", cursive';
    context.fillText(borderSymbols[activeBorder], tileWidth / 2, index * tileHeight + 32);
    context.fillText(borderSymbols[activeBorder], tileWidth / 2, index * tileHeight + tileHeight - 25);
  }
  if (stripCaption) {
    context.fillStyle = activeDesign === 'night' ? '#ffffff' : '#302456';
    context.font = '600 30px "DM Sans", sans-serif';
    context.fillText(stripCaption, output.width / 2, tileHeight * photos.length + 62);
  }
  context.strokeStyle = activeDesign === 'night' ? '#f5c9ff' : '#6045a5';
  context.lineWidth = 14;
  context.strokeRect(7, 7, output.width - 14, output.height - 14);
  const link = document.createElement('a');
  link.download = 'photoboo-strip.jpg';
  link.href = output.toDataURL('image/jpeg', .92);
  link.click();
}

function playShutter() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = 120;
  gain.gain.setValueAtTime(.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .12);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + .12);
}

document.querySelectorAll('.filter-button').forEach((button) => button.addEventListener('click', () => setFilter(button.dataset.filter)));
captureButton.addEventListener('click', capturePhoto);
clearButton.addEventListener('click', () => { photos.length = 0; stickers.length = 0; selectedPhoto = 0; renderStrip(); renderPrinter(); captureButton.disabled = false; timerLabel.textContent = 'READY'; });
downloadButton.addEventListener('click', downloadStrip);
flipButton.addEventListener('click', () => { facingMode = facingMode === 'user' ? 'environment' : 'user'; startCamera(); });
soundButton.addEventListener('click', () => { soundOn = !soundOn; soundButton.textContent = soundOn ? '♫' : '∅'; soundButton.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound'); });
newTipButton.addEventListener('click', () => { const current = document.querySelector('#tipText').textContent; const next = tips.find((tip) => tip !== current) || tips[0]; document.querySelector('#tipText').textContent = next; });
stripDesignButtons.forEach((button) => button.addEventListener('click', () => {
  activeDesign = button.dataset.design;
  stripDesignButtons.forEach((designButton) => designButton.classList.toggle('active', designButton === button));
  renderStrip();
}));
stickerButtons.forEach((button) => button.addEventListener('click', () => {
  stickers.push({ id: ++stickerId, photoIndex: selectedPhoto, value: button.dataset.sticker, x: 50, y: 35, size: 1 });
  selectedStickerId = stickerId;
  renderStrip();
}));
stickerUpload.addEventListener('change', () => {
  const [file] = stickerUpload.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingUpload = reader.result;
    cropImage = new Image();
    cropImage.onload = () => {
      const cropContext = cropCanvas.getContext('2d');
      cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
      cropContext.drawImage(cropImage, 0, 0, cropCanvas.width, cropCanvas.height);
      selection = { x: 0, y: 0, width: cropCanvas.width, height: cropCanvas.height };
      updateSelectionBox();
    };
    cropImage.src = pendingUpload;
    cropEditor.hidden = false;
    stickerUpload.value = '';
  };
  reader.readAsDataURL(file);
});
applyCrop.addEventListener('click', () => {
  if (!cropImage) return;
  const output = document.createElement('canvas');
  output.width = 500;
  output.height = 500;
  output.getContext('2d').drawImage(cropImage, selection.x * cropImage.width / cropCanvas.width, selection.y * cropImage.height / cropCanvas.height, selection.width * cropImage.width / cropCanvas.width, selection.height * cropImage.height / cropCanvas.height, 0, 0, output.width, output.height);
  stickers.push({ id: ++stickerId, photoIndex: selectedPhoto, src: output.toDataURL('image/png'), x: 50, y: 35, size: 1, rotation: 0 });
  selectedStickerId = stickerId;
  cropEditor.hidden = true;
  pendingUpload = '';
  cropImage = null;
  renderStrip();
});
cropCanvas.addEventListener('pointerdown', (event) => {
  const bounds = cropCanvas.getBoundingClientRect();
  selecting = true;
  selectionStart = { x: Math.max(0, Math.min(cropCanvas.width, (event.clientX - bounds.left) * cropCanvas.width / bounds.width)), y: Math.max(0, Math.min(cropCanvas.height, (event.clientY - bounds.top) * cropCanvas.height / bounds.height)) };
  selection = { x: selectionStart.x, y: selectionStart.y, width: 1, height: 1 };
  updateSelectionBox();
});
cropCanvas.addEventListener('pointermove', (event) => {
  if (!selecting) return;
  const bounds = cropCanvas.getBoundingClientRect();
  const current = { x: Math.max(0, Math.min(cropCanvas.width, (event.clientX - bounds.left) * cropCanvas.width / bounds.width)), y: Math.max(0, Math.min(cropCanvas.height, (event.clientY - bounds.top) * cropCanvas.height / bounds.height)) };
  selection = { x: Math.min(selectionStart.x, current.x), y: Math.min(selectionStart.y, current.y), width: Math.abs(current.x - selectionStart.x), height: Math.abs(current.y - selectionStart.y) };
  updateSelectionBox();
});
cropCanvas.addEventListener('pointerup', () => { selecting = false; });
function updateSelectionBox() {
  selectionBox.style.left = `${selection.x / cropCanvas.width * 100}%`;
  selectionBox.style.top = `${selection.y / cropCanvas.height * 100}%`;
  selectionBox.style.width = `${selection.width / cropCanvas.width * 100}%`;
  selectionBox.style.height = `${selection.height / cropCanvas.height * 100}%`;
}
captionInput.addEventListener('input', () => {
  stripCaption = captionInput.value.trim();
  renderStrip();
});
borderButtons.forEach((button) => button.addEventListener('click', () => {
  activeBorder = button.dataset.border;
  borderButtons.forEach((borderButton) => borderButton.classList.toggle('active', borderButton === button));
  renderStrip();
  renderPrinter();
}));
smileToggle.addEventListener('change', () => {
  showSmile = smileToggle.checked;
  renderStrip();
});

startCamera();
