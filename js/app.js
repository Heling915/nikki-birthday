import { SUPABASE_URL, SUPABASE_ANON_KEY, BIRTHDAY, BGM_URLS, GROUP_QR_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./config.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SURPRISE_START = new Date("2026-12-06T00:00:00+08:00").getTime();
const SURPRISE_END = new Date("2026-12-07T00:00:00+08:00").getTime();

function isBirthdayMode() {
  if (new URLSearchParams(location.search).has("birthday")) return true;
  const now = Date.now();
  return now >= SURPRISE_START && now < SURPRISE_END;
}

const birthdayDay = isBirthdayMode();
let birthdayActive = false;
let birthdayStartTime = 0;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const SENSITIVE_WORDS = [
  "傻�?, "sb", "垃圾", "去死", "�?, "废物", "�?, "�?, "妈的", "fuck",
  "shit", "bitch", "nmsl", "草泥�?, "卧槽", "抄袭", "我操", "尼玛",
];

const BLESSING_RADIUS = { min: 34, max: 68 };
const OWN_STAR_COLOR = 0xffd27d;
const OTHER_STAR_COLOR = 0x8fc7ff;
const BIRTHDAY_COLOR = new THREE.Color(0xff8fb8);

function optimizeImageUrl(url, width) {
  if (!url || url.indexOf("res.cloudinary.com") === -1) return url;
  const t = "f_auto,q_auto" + (width ? ",w_" + width : "");
  return url.replace("/upload/", "/upload/" + t + "/");
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getMyKeys() {
  try {
    return JSON.parse(localStorage.getItem("nikki_my_keys") || "[]");
  } catch {
    return [];
  }
}

function saveMyKeys(keys) {
  localStorage.setItem("nikki_my_keys", JSON.stringify(keys));
}

function getMyBlessings() {
  try {
    return JSON.parse(localStorage.getItem("nikki_my_blessings") || "[]");
  } catch {
    return [];
  }
}

function saveMyBlessings(list) {
  localStorage.setItem("nikki_my_blessings", JSON.stringify(list));
}

const myKeysSet = new Set(getMyKeys());
const passedMyKeys = new Set();

let currentUser = null;
const MY_STATUS_TEXT = { pending: "待审�?, passed: "已通过", rejected: "已驳�? };

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 0, 90);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.getElementById("starfield").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 30;
controls.maxDistance = 160;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.20;
controls.enablePan = false;

function taubinHeart(x, y, z) {
  const a = x * x + (9 / 4) * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - (9 / 80) * y * y * z * z * z;
}

function computeHeartScale() {
  const fov = (camera.fov * Math.PI) / 180;
  const dist = camera.position.length();
  const visibleHeight = 2 * dist * Math.tan(fov / 2);
  const visibleWidth = visibleHeight * (innerWidth / innerHeight);
  const raw = 2.3;
  return Math.min((visibleWidth * 0.75) / raw, (visibleHeight * 0.75) / raw);
}

function computeHeartPoint() {
  const scale = computeHeartScale();
  let x, y, z;
  do {
    x = (Math.random() * 2 - 1) * 1.15;
    y = (Math.random() * 2 - 1) * 0.75;
    z = (Math.random() * 2 - 1) * 1.15;
  } while (taubinHeart(x, y, z) >= 0);
  return new THREE.Vector3(x * scale, z * scale, y * scale * 1.4);
}

function makeStarTexture(inner, outer) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(inner, "rgba(255,255,255,1)");
  g.addColorStop(outer, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

const starTexture = makeStarTexture(0.5, 0.8);

function buildAmbientStars() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 120 + Math.random() * 150;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xbfc7e6,
    size: 0.35,
    map: makeStarTexture(0.4, 0.9),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return points;
}

const ambientStars = buildAmbientStars();

const blessingGroup = new THREE.Group();
scene.add(blessingGroup);

const blessingSprites = [];
const blessingMeta = [];

function buildNikkiStar() {
  const group = new THREE.Group();

  const star = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTexture,
      color: 0xff8fb8,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  star.scale.set(3, 3, 1);
  star.userData.baseScale = 3;
  group.add(star);

  group.userData.star = star;
  return group;
}

const nikkiGroup = buildNikkiStar();
scene.add(nikkiGroup);
const nikkiStars = [nikkiGroup.userData.star];

function randomPosition() {
  const r = BLESSING_RADIUS.min + Math.random() * (BLESSING_RADIUS.max - BLESSING_RADIUS.min);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  );
}

function addBlessingStar(bless) {
  const isMine =
    (currentUser && bless.user_id === currentUser.id) ||
    (currentUser && bless.owner_email && bless.owner_email === currentUser.email) ||
    (bless.client_key && myKeysSet.has(bless.client_key));
  const color = isMine ? OWN_STAR_COLOR : OTHER_STAR_COLOR;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTexture,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const scale = (0.8 + Math.random() * 1.4) * 0.8;
  sprite.scale.set(scale, scale, 1);
  sprite.position.copy(randomPosition());
  sprite.userData = {
    baseScale: scale,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.5,
    startPos: sprite.position.clone(),
    heartPoint: null,
    flyDelay: 0.5 + Math.random() * 4,
    flyDuration: 1.5 + Math.random() * 2,
    isMine,
  };
  blessingGroup.add(sprite);
  blessingSprites.push(sprite);
  blessingMeta.push(bless);
}

async function loadBlessings() {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  try {
    while (true) {
      const { data, error } = await supabase
        .from("bless")
        .select("id, nickname, content, photo_url, audio_url, client_key, user_id, owner_email, create_at")
        .eq("status", "passed")
        .order("create_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) {
        console.error("加载祝福失败:", error);
        showToast("祝福加载失败�? + (error.message || "请检�?Supabase 配置"));
        return;
      }
      if (data && data.length) all = all.concat(data);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  } catch (err) {
    console.error("加载祝福失败:", err);
    showToast("祝福加载失败，请稍后重试");
    return;
  }

  all.forEach((b) => {
    if (b.client_key && myKeysSet.has(b.client_key)) passedMyKeys.add(b.client_key);
    addBlessingStar(b);
  });
  applyMineOnly();
}

let mineOnly = false;

function applyMineOnly() {
  for (const s of blessingSprites) {
    if (!s.userData.isMine) {
      s.material.opacity = mineOnly ? 0.12 : 1;
    }
  }
}

document.getElementById("mineOnlyToggle").addEventListener("click", () => {
  mineOnly = !mineOnly;
  const btn = document.getElementById("mineOnlyToggle");
  btn.textContent = mineOnly ? "显示全部" : "只看我的";
  btn.classList.toggle("active", mineOnly);
  applyMineOnly();
});

function activateBirthday() {
  birthdayActive = true;
  birthdayStartTime = performance.now();

  blessingSprites.forEach((s) => {
    s.userData.fromColor = s.material.color.clone();
    s.userData.heartPoint = computeHeartPoint();
    s.userData.startPos = s.position.clone();
    s.userData.flyDelay = 1 + Math.random() * 6;
    s.userData.flyDuration = 3 + Math.random() * 3;
  });

  nikkiGroup.visible = true;
  nikkiGroup.userData.star.material.color.set(0xa78bfa);
  const fov = (camera.fov * Math.PI) / 180;
  const dist = camera.position.length();
  const visibleHeight = 2 * dist * Math.tan(fov / 2);
    nikkiGroup.position.y = innerWidth <= 640 ? visibleHeight / 20 : visibleHeight / 10;

  ambientStars.material.color.set(0xff9ec7);

  const hint = document.getElementById("hint");
  if (hint) hint.textContent = "点击爱心查看祝福 · 拖动旋转 · 双指缩放";
}

function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function isAmrUrl(url) {
  return /\.amr($|\?)/i.test(url || "");
}

function createAmrPlayer(url) {
  const wrap = document.createElement("div");
  wrap.className = "amr-player";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "amr-play";
  btn.textContent = "播放录音";

  let amr = null;

  function setPlaying(on) {
    btn.textContent = on ? "停止" : "播放录音";
  }

  btn.addEventListener("click", () => {
    if (!amr) {
      btn.disabled = true;
      btn.textContent = "加载中�?;
      amr = new window.BenzAMRRecorder();
      amr.onEnded(() => {
        setPlaying(false);
      });
      amr
        .initWithUrl(url)
        .then(() => {
          btn.disabled = false;
          setPlaying(true);
          amr.play();
        })
        .catch(() => {
          btn.disabled = false;
          btn.textContent = "播放失败";
        });
      return;
    }

    if (amr.isPlaying()) {
      amr.stop();
      setPlaying(false);
    } else {
      amr.play();
      setPlaying(true);
    }
  });

  wrap.appendChild(btn);
  return wrap;
}

function createAudioPlayer(url) {
  if (isAmrUrl(url)) {
    return createAmrPlayer(url);
  }
  const a = document.createElement("audio");
  a.src = url;
  a.controls = true;
  a.className = "bless-audio";
  return a;
}

function openBlessModal(bless) {
  document.getElementById("blessNickname").textContent = "�?" + (bless.nickname || "匿名") + " �?;
  document.getElementById("blessContent").textContent = bless.content;
  document.getElementById("blessTime").textContent = bless.create_at ? formatTime(bless.create_at) : "";

  const media = document.getElementById("blessMedia");
  media.innerHTML = "";
  if (bless.photo_url) {
    const img = document.createElement("img");
    img.src = optimizeImageUrl(bless.photo_url, 1000);
    img.alt = "祝福照片";
    img.className = "bless-photo";
    img.onerror = () => img.remove();
    media.appendChild(img);
  }
  if (bless.audio_url) {
    media.appendChild(createAudioPlayer(bless.audio_url));
  }

  document.getElementById("blessModal").classList.remove("hidden");
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener("pointerdown", (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const nikkiHits = raycaster.intersectObjects(nikkiStars);
  if (nikkiHits.length > 0) {
    openNikkiModal();
    return;
  }

  const hits = raycaster.intersectObjects(blessingSprites);
  if (hits.length > 0) {
    const idx = blessingSprites.indexOf(hits[0].object);
    if (idx >= 0) openBlessModal(blessingMeta[idx]);
  }
});

let nikkiOpening = false;

async function openNikkiModal() {
  if (nikkiOpening) return;
  nikkiOpening = true;

  let content = "谢谢你，我亲爱的搭配师，今年的生日也很开�?;
  let imageUrl = "";
  try {
    const { data } = await supabase
      .from("notice")
      .select("nikki_content, nikki_image_url")
      .eq("id", 1)
      .single();
    if (data) {
      if (data.nikki_content) content = data.nikki_content;
      imageUrl = data.nikki_image_url || "";
    }
  } catch (err) {
    console.error("加载暖暖消息失败:", err);
  }

  document.getElementById("blessNickname").textContent = "�?暖暖 �?;
  document.getElementById("blessTime").textContent = "";
  document.getElementById("blessContent").textContent = content;

  const media = document.getElementById("blessMedia");
  media.innerHTML = "";
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = optimizeImageUrl(imageUrl, 1000);
    img.alt = "暖暖";
    img.className = "bless-photo";
    img.onerror = () => img.remove();
    media.appendChild(img);
  }

  document.getElementById("blessModal").classList.remove("hidden");
  nikkiOpening = false;
}

document.querySelectorAll("[data-close]").forEach((el) => {
  el.addEventListener("click", () => {
    el.closest(".modal").classList.add("hidden");
  });
});

document.getElementById("openSubmit").addEventListener("click", () => {
  document.getElementById("submitModal").classList.remove("hidden");
});

document.getElementById("openGroup").addEventListener("click", () => {
  openGroupModal();
});

document.getElementById("openAbout").addEventListener("click", async () => {
  const el = document.getElementById("aboutContent");
  try {
    const { data } = await supabase.from("notice").select("about").eq("id", 1).single();
    el.textContent = (data && data.about) || "暂无介绍";
  } catch (err) {
    console.error("加载关于我们失败:", err);
    el.textContent = "暂无介绍";
  }
  document.getElementById("aboutModal").classList.remove("hidden");
});

document.getElementById("openMyBlessings").addEventListener("click", async () => {
  await renderMyBlessings();
  document.getElementById("myBlessingsModal").classList.remove("hidden");
});

function makeEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "my-empty";
  empty.textContent = text;
  return empty;
}

async function renderMyBlessings() {
  const list = document.getElementById("myBlessingsList");
  list.innerHTML = "";

  if (!currentUser) {
    const wrap = document.createElement("div");
    wrap.className = "my-login-prompt";

    const msg = document.createElement("div");
    msg.className = "my-login-text";
    msg.textContent = "登录后才能查看你的历史祝�?;

    const btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.textContent = "去登�?;
    btn.addEventListener("click", () => {
      document.getElementById("myBlessingsModal").classList.add("hidden");
      setAuthMode("login");
      document.getElementById("authForm").reset();
      document.getElementById("authModal").classList.remove("hidden");
    });

    wrap.append(msg, btn);
    list.appendChild(wrap);
    return;
  }

  const { data, error } = await supabase
    .from("bless")
    .select("*")
    .eq("owner_email", currentUser.email)
    .order("create_at", { ascending: false });

  if (error) {
    list.appendChild(makeEmpty("加载失败�? + error.message));
    return;
  }

  if (!data || data.length === 0) {
    list.appendChild(makeEmpty("你还没有提交过祝�?));
    return;
  }

  for (const b of data) {
    list.appendChild(buildMyItem(b.status, b.content, b.create_at, b.reject_reason, b.photo_url, b.audio_url));
  }
}

function buildMyItem(status, content, created_at, reject_reason, photo_url, audio_url) {
  const item = document.createElement("div");
  item.className = "my-item";

  const top = document.createElement("div");
  top.className = "my-item-top";

  const s = document.createElement("span");
  s.className =
    "my-status " +
    (status === "passed" ? "passed" : status === "rejected" ? "rejected" : "pending");
  s.textContent = MY_STATUS_TEXT[status] || "待审�?;

  const time = document.createElement("span");
  time.className = "my-item-time";
  time.textContent = created_at ? new Date(created_at).toLocaleString("zh-CN") : "";

  top.append(s, time);

  const c = document.createElement("div");
  c.className = "my-item-content";
  c.textContent = content;

  item.append(top, c);

  if (photo_url) {
    const img = document.createElement("img");
    img.src = optimizeImageUrl(photo_url, 500);
    img.alt = "照片";
    img.className = "my-item-photo";
    img.onerror = () => img.remove();
    img.loading = "lazy";
    item.appendChild(img);
  }

  if (audio_url) {
    item.appendChild(createAudioPlayer(audio_url));
  }

  if (status === "rejected" && reject_reason) {
    const r = document.createElement("div");
    r.className = "my-item-reason";
    r.textContent = "驳回理由�? + reject_reason;
    item.appendChild(r);
  }

  return item;
}

const nicknameInput = document.getElementById("nickname");
const contentInput = document.getElementById("content");
const nicknameCount = document.getElementById("nicknameCount");
const contentCount = document.getElementById("contentCount");
const formError = document.getElementById("formError");

const photoInput = document.getElementById("photoInput");
const audioInput = document.getElementById("audioInput");
const photoName = document.getElementById("photoName");
const audioName = document.getElementById("audioName");

const FILE_LIMITS = {
  photo: { type: "image", max: 8 * 1024 * 1024, label: "照片" },
  audio: { type: "audio", max: 2 * 1024 * 1024, label: "语音" },
};

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "heic", "heif", "tiff", "tif", "svg"];
const AUDIO_EXTS = ["mp3", "m4a", "wav", "aac", "ogg", "amr", "flac", "webm", "3gp", "m4r"];

function fileExt(file) {
  return (file.name.split(".").pop() || "").toLowerCase();
}

function isImageFile(file) {
  if (file.type && file.type.startsWith("image/")) return true;
  return IMAGE_EXTS.includes(fileExt(file));
}

function isAudioFile(file) {
  if (file.type && file.type.startsWith("audio/")) return true;
  return AUDIO_EXTS.includes(fileExt(file));
}

photoInput.addEventListener("change", () => {
  photoName.textContent = photoInput.files[0] ? photoInput.files[0].name : "未选择";
});
audioInput.addEventListener("change", () => {
  audioName.textContent = audioInput.files[0] ? audioInput.files[0].name : "未选择";
});

nicknameInput.addEventListener("input", () => {
  nicknameCount.textContent = nicknameInput.value.length;
});
contentInput.addEventListener("input", () => {
  contentCount.textContent = contentInput.value.length;
});

function checkSensitive(text) {
  const lower = text.toLowerCase();
  return SENSITIVE_WORDS.find((w) => lower.includes(w.toLowerCase())) || null;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 200 * 1024) return file;

  const img = await loadImage(file).catch(() => null);
  if (!img) return file;

  const MAX_DIM = 1024;
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.65));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

async function uploadFile(file, folder) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error((data && data.error && data.error.message) || "上传失败");
  }
  return data.secure_url;
}

document.getElementById("blessForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  const content = contentInput.value.trim();

  formError.classList.add("hidden");
  if (!nickname || !content) {
    showFormError("昵称和祝福语都不能为�?);
    return;
  }
  const badNick = checkSensitive(nickname);
  const badContent = checkSensitive(content);
  if (badNick || badContent) {
    showFormError(`内容包含不合适的词语，请修改后再提交`);
    return;
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "上传中�?;

  const files = {
    photo: photoInput.files[0],
    audio: audioInput.files[0],
  };

  for (const [key, f] of Object.entries(files)) {
    if (!f) continue;
    const lim = FILE_LIMITS[key];
    const valid = key === "photo" ? isImageFile(f) : isAudioFile(f);
    if (!valid) {
      btn.disabled = false;
      btn.textContent = "提交祝福";
      showFormError(`请选择有效�?{lim.label}文件`);
      return;
    }
    if (f.size > lim.max) {
      btn.disabled = false;
      btn.textContent = "提交祝福";
      showFormError(`${lim.label}不能超过 ${Math.round(lim.max / 1024 / 1024)}MB`);
      return;
    }
  }

  let photo_url = null;
  let audio_url = null;
  try {
    if (files.photo) {
      const compressed = await compressImage(files.photo);
      photo_url = await uploadFile(compressed, "photos");
    }
    if (files.audio) audio_url = await uploadFile(files.audio, "audio");
  } catch (err) {
    console.error("文件上传失败:", err);
    btn.disabled = false;
    btn.textContent = "提交祝福";
    showFormError("文件上传失败�? + (err.message || "请重�?));
    return;
  }

  btn.textContent = "提交中�?;

  const client_key = uuid();
  const payload = {
    nickname,
    content,
    status: "pending",
    photo_url,
    audio_url,
  };
  if (currentUser) {
    payload.user_id = currentUser.id;
    payload.owner_email = currentUser.email;
  } else {
    payload.client_key = client_key;
  }

  const { error } = await supabase.from("bless").insert(payload);

  btn.disabled = false;
  btn.textContent = "提交祝福";

  if (error) {
    console.error("提交失败:", error);
    showFormError("提交失败�? + (error.message || "请稍后重�?));
    return;
  }

  if (!currentUser) {
    myKeysSet.add(client_key);
    const keys = getMyKeys();
    keys.push(client_key);
    saveMyKeys(keys);

    const myList = getMyBlessings();
    myList.push({ client_key, nickname, content, created_at: new Date().toISOString() });
    saveMyBlessings(myList);
  }

  document.getElementById("submitModal").classList.add("hidden");
  document.getElementById("blessForm").reset();
  nicknameCount.textContent = "0";
  contentCount.textContent = "0";
  photoName.textContent = "未选择";
  audioName.textContent = "未选择";
  showToast("祝福已提交，审核通过后就会出现在星海�?�?);
  openGroupModal(true);
});

function showFormError(msg) {
  formError.textContent = msg;
  formError.classList.remove("hidden");
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

let groupQrUrl = "";

async function loadGroupQr() {
  try {
    const { data } = await supabase
      .from("notice")
      .select("group_qr_url")
      .eq("id", 1)
      .single();
    if (data && data.group_qr_url) groupQrUrl = data.group_qr_url;
  } catch (err) {
    console.error("加载通知群图片失�?", err);
  }
}

function openGroupModal(showThanks) {
  const img = document.getElementById("groupQr");
  const url = groupQrUrl || GROUP_QR_URL;
  if (url) {
    img.src = url;
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
  }
  document.getElementById("groupText").textContent = showThanks
    ? "感谢你的祝福！这是本站的通知和答疑群，活动的重要消息都会在群内统一发布，若未进群可能会错过，请及时加入哦～"
    : "这是本站的通知和答疑群，活动的重要消息都会在群内统一发布，若未进群可能会错过，请及时加入哦～";
  document.getElementById("groupModal").classList.remove("hidden");
}

async function loadNotice() {
  if (birthdayDay) {
    document.getElementById("letterButton").classList.remove("hidden");
    return;
  }
  try {
    const { data, error } = await supabase
      .from("notice")
      .select("content, enabled")
      .eq("id", 1)
      .single();
    if (error || !data || !data.enabled || !data.content) return;
    document.getElementById("noticeContent").textContent = data.content;
    document.getElementById("noticeModal").classList.remove("hidden");
  } catch (err) {
    console.error("加载通知失败:", err);
  }
}

async function loadInvite() {
  let content = "";
  let imageUrl = "";
  try {
    const { data } = await supabase
      .from("notice")
      .select("invite_content, invite_image_url")
      .eq("id", 1)
      .single();
    if (data) {
      content = data.invite_content || "";
      imageUrl = data.invite_image_url || "";
    }
  } catch (err) {
    console.error("加载邀请函失败:", err);
  }

  const contentEl = document.getElementById("inviteContent");
  if (content) {
    contentEl.textContent = content;
    contentEl.classList.remove("hidden");
  } else {
    contentEl.classList.add("hidden");
  }

  const img = document.getElementById("inviteImage");
  if (imageUrl) {
    img.src = imageUrl;
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
  }

  document.getElementById("letterButton").classList.add("hidden");
  document.getElementById("inviteModal").classList.remove("hidden");
}

document.getElementById("letterButton").addEventListener("click", () => {
  loadInvite();
});

document.getElementById("inviteConfirm").addEventListener("click", () => {
  document.getElementById("inviteModal").classList.add("hidden");
  activateBirthday();
});

document.getElementById("noticeConfirm").addEventListener("click", () => {
  document.getElementById("noticeModal").classList.add("hidden");
});

function updateCountdown() {
  const target = new Date(BIRTHDAY).getTime();
  const now = Date.now();
  const el = document.getElementById("countdown");

  if (isNaN(target)) {
    el.textContent = "--�?-�?-�?-�?;
    return;
  }

  const diff = target - now;
  if (diff <= 0) {
    el.textContent = "生日快乐 �?;
    return;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  el.textContent = `${d}�?{String(h).padStart(2, "0")}�?{String(m).padStart(2, "0")}�?{String(s).padStart(2, "0")}秒`;
}

const _heartTarget = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;

  if (birthdayActive) {
    const elapsed = (performance.now() - birthdayStartTime) / 1000;
    const heartPulse = 1 + 0.07 * Math.sin(t * 2.2);
    for (const s of blessingSprites) {
      const p = easeInOutCubic(clamp01((elapsed - s.userData.flyDelay) / s.userData.flyDuration));
      _heartTarget.copy(s.userData.heartPoint).multiplyScalar(heartPulse);
      s.position.lerpVectors(s.userData.startPos, _heartTarget, p);
      s.material.color.lerpColors(s.userData.fromColor, BIRTHDAY_COLOR, p);
      const scalePulse = 0.75 + 0.25 * Math.sin(t * s.userData.speed + s.userData.phase);
      const sc = s.userData.baseScale * scalePulse;
      s.scale.set(sc, sc, 1);
    }
  } else {
    for (const s of blessingSprites) {
      const pulse = 0.75 + 0.25 * Math.sin(t * s.userData.speed + s.userData.phase);
      const sc = s.userData.baseScale * pulse;
      s.scale.set(sc, sc, 1);
    }
  }

  const nikkiStar = nikkiGroup.userData.star;
  const np = 0.5 + 0.5 * Math.sin(t * 1.5);
  const ns = nikkiStar.userData.baseScale * (0.55 + 0.45 * np);
  nikkiStar.scale.set(ns, ns, 1);

  ambientStars.rotation.y += 0.0001;

  controls.update();
  renderer.render(scene, camera);
}

let authMode = "login";

const authBtnDesktop = document.getElementById("authBtn");
const authBtnMobile = document.getElementById("authBtnMobile");

function renderAuthUI() {
  const email = document.getElementById("userEmail");
  const label = currentUser ? "退�? : "登录 / 注册";
  if (currentUser) {
    email.textContent = currentUser.email;
    email.classList.remove("hidden");
  } else {
    email.textContent = "";
    email.classList.add("hidden");
  }
  authBtnDesktop.textContent = label;
  authBtnMobile.textContent = label;
}

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById("authTitle").textContent = mode === "login" ? "登录" : "注册";
  document.getElementById("authSubmit").textContent = mode === "login" ? "登录" : "注册";
  document.getElementById("authToggle").textContent =
    mode === "login" ? "没有账号？注�? : "已有账号？登�?;
  document.getElementById("authError").classList.add("hidden");
}

function clearBlessingStars() {
  for (const s of blessingSprites) blessingGroup.remove(s);
  blessingSprites.length = 0;
  blessingMeta.length = 0;
  passedMyKeys.clear();
}

async function reloadBlessings() {
  clearBlessingStars();
  await loadBlessings();
}

async function initAuth() {
  try {
    const { data } = await supabase.auth.getSession();
    currentUser = data.session?.user || null;
  } catch (err) {
    console.error("获取登录状态失�?", err);
    currentUser = null;
  }
  renderAuthUI();
}

async function handleAuthClick() {
  if (currentUser) {
    await supabase.auth.signOut();
    currentUser = null;
    renderAuthUI();
    await reloadBlessings();
    showToast("已退出登�?);
    return;
  }
  setAuthMode("login");
  document.getElementById("authForm").reset();
  document.getElementById("authModal").classList.remove("hidden");
}

authBtnDesktop.addEventListener("click", handleAuthClick);
authBtnMobile.addEventListener("click", handleAuthClick);

document.getElementById("authToggle").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "register" : "login");
});

function translateAuthError(err) {
  const msg = (err && err.message) || "";
  if (/already registered/i.test(msg)) return "该邮箱已注册，请直接登录";
  if (/at least 6/i.test(msg)) return "密码至少需�?6 �?;
  if (/invalid login credentials/i.test(msg)) return "邮箱或密码错�?;
  if (/email not confirmed/i.test(msg)) return "邮箱尚未验证，请先查收验证邮�?;
  if (/rate limit/i.test(msg)) return "操作太频繁，请稍后再�?;
  return msg || "操作失败，请重试";
}

document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const err = document.getElementById("authError");
  err.classList.add("hidden");

  if (password.length < 6) {
    err.textContent = "密码至少需�?6 �?;
    err.classList.remove("hidden");
    return;
  }

  if (authMode === "login") {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      err.textContent = translateAuthError(error);
      err.classList.remove("hidden");
      return;
    }
    currentUser = data.user;
  } else {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      err.textContent = translateAuthError(error);
      err.classList.remove("hidden");
      return;
    }
    if (!data.session) {
      err.textContent = "注册成功，但需邮件确认后才能登录，请查收邮箱并点击确认链接";
      err.classList.remove("hidden");
      return;
    }
    currentUser = data.user;
  }

  document.getElementById("authForm").reset();
  document.getElementById("authModal").classList.add("hidden");
  renderAuthUI();
  await reloadBlessings();
  showToast("已登录：" + currentUser.email);
});

const bgmUrls = BGM_URLS.filter(Boolean);

const player = new Audio();
player.preload = "none";
player.loop = true;

const musicBtn = document.getElementById("musicToggle");
let musicOff = false;
let musicStarted = false;

function tryPlayBgm() {
  if (!musicStarted) {
    player.src = bgmUrls[0];
    musicStarted = true;
  }
  player
    .play()
    .then(() => musicBtn.classList.add("playing"))
    .catch(() => {});
}

if (bgmUrls.length) {
  musicBtn.classList.remove("hidden");

  musicBtn.addEventListener("click", () => {
    if (player.paused) {
      musicOff = false;
      tryPlayBgm();
    } else {
      musicOff = true;
      player.pause();
      musicBtn.classList.remove("playing");
    }
  });

  window.addEventListener("pointerdown", function startOnce() {
    window.removeEventListener("pointerdown", startOnce);
    if (!musicOff && player.paused) tryPlayBgm();
  });

  tryPlayBgm();
}

async function init() {
  updateCountdown();
  setInterval(updateCountdown, 1000);

  const loading = document.getElementById("loading");
  const hideLoading = () => loading.classList.add("hidden");
  const safetyTimer = setTimeout(hideLoading, 8000);

  try {
    await initAuth();
    await loadBlessings();
  } catch (err) {
    console.error("初始化失�?", err);
  }

  clearTimeout(safetyTimer);
  hideLoading();
  animate();
  loadNotice();
  loadGroupQr();
}

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);

  if (birthdayActive) {
    const fov = (camera.fov * Math.PI) / 180;
    const dist = camera.position.length();
    const visibleHeight = 2 * dist * Math.tan(fov / 2);
  nikkiGroup.position.y = innerWidth <= 640 ? visibleHeight / 20 : visibleHeight / 10;
  }
});

init();
