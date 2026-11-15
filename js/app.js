import { SUPABASE_URL, SUPABASE_ANON_KEY, BIRTHDAY } from "./config.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SENSITIVE_WORDS = [
  "傻逼", "sb", "垃圾", "去死", "滚", "废物", "贱", "操", "妈的", "fuck",
  "shit", "bitch", "nmsl", "草泥马", "卧槽", "抄袭", "我操", "尼玛",
];

const BLESSING_RADIUS = { min: 34, max: 68 };
const OWN_STAR_COLOR = 0xffd27d;
const OTHER_STAR_COLOR = 0x8fc7ff;

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
const MY_STATUS_TEXT = { pending: "待审核", passed: "已通过", rejected: "已驳回" };

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
controls.autoRotateSpeed = 0.4;
controls.enablePan = false;

function makeStarTexture(inner, outer) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(inner, "rgba(255,255,255,0.9)");
  g.addColorStop(outer, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

const starTexture = makeStarTexture(0.3, 0.85);

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
  const scale = (0.8 + Math.random() * 1.4) * 2;
  sprite.scale.set(scale, scale, 1);
  sprite.position.copy(randomPosition());
  sprite.userData = {
    baseScale: scale,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.5,
  };
  blessingGroup.add(sprite);
  blessingSprites.push(sprite);
  blessingMeta.push(bless);
}

async function loadBlessings() {
  let data;
  let error;
  try {
    const res = await supabase
      .from("bless")
      .select("id, nickname, content, photo_url, audio_url, client_key, user_id, create_at")
      .eq("status", "passed")
      .order("create_at", { ascending: true });
    data = res.data;
    error = res.error;
  } catch (err) {
    console.error("加载祝福失败:", err);
    showToast("祝福加载失败，请稍后重试");
    return;
  }

  if (error) {
    console.error("加载祝福失败:", error);
    showToast("祝福加载失败：" + (error.message || "请检查 Supabase 配置"));
    return;
  }

  (data || []).forEach((b) => {
    if (b.client_key && myKeysSet.has(b.client_key)) passedMyKeys.add(b.client_key);
    addBlessingStar(b);
  });
}

function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function openBlessModal(bless) {
  document.getElementById("blessNickname").textContent = "— " + (bless.nickname || "匿名") + " —";
  document.getElementById("blessContent").textContent = bless.content;
  document.getElementById("blessTime").textContent = bless.create_at ? formatTime(bless.create_at) : "";

  const media = document.getElementById("blessMedia");
  media.innerHTML = "";
  if (bless.photo_url) {
    const img = document.createElement("img");
    img.src = bless.photo_url;
    img.alt = "祝福照片";
    img.className = "bless-photo";
    media.appendChild(img);
  }
  if (bless.audio_url) {
    const a = document.createElement("audio");
    a.src = bless.audio_url;
    a.controls = true;
    a.className = "bless-audio";
    media.appendChild(a);
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

function openNikkiModal() {
  document.getElementById("blessNickname").textContent = "— 暖暖 —";
  document.getElementById("blessContent").textContent = "谢谢你，我亲爱的搭配师，今年的生日也很开心";
  document.getElementById("blessTime").textContent = "";
  document.getElementById("blessMedia").innerHTML = "";
  document.getElementById("blessModal").classList.remove("hidden");
}

document.querySelectorAll("[data-close]").forEach((el) => {
  el.addEventListener("click", () => {
    el.closest(".modal").classList.add("hidden");
  });
});

document.getElementById("openSubmit").addEventListener("click", () => {
  document.getElementById("submitModal").classList.remove("hidden");
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

  if (currentUser) {
    const { data, error } = await supabase
      .from("bless")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("create_at", { ascending: false });

    if (error) {
      list.appendChild(makeEmpty("加载失败：" + error.message));
      return;
    }

    if (!data || data.length === 0) {
      list.appendChild(makeEmpty("你还没有提交过祝福"));
      return;
    }

    for (const b of data) {
      list.appendChild(buildMyItem(b.status, b.content, b.create_at));
    }
    return;
  }

  const items = getMyBlessings().slice().reverse();
  if (items.length === 0) {
    list.appendChild(makeEmpty("你还没有提交过祝福"));
  } else {
    for (const it of items) {
      const status = passedMyKeys.has(it.client_key) ? "passed" : "pending";
      list.appendChild(buildMyItem(status, it.content, it.created_at));
    }
  }

  const hint = document.createElement("div");
  hint.className = "my-hint";
  hint.textContent = "当前未登录，仅显示本设备的记录，登录后可跨设备查看。";
  list.appendChild(hint);
}

function buildMyItem(status, content, created_at) {
  const item = document.createElement("div");
  item.className = "my-item";

  const top = document.createElement("div");
  top.className = "my-item-top";

  const s = document.createElement("span");
  s.className =
    "my-status " +
    (status === "passed" ? "passed" : status === "rejected" ? "rejected" : "pending");
  s.textContent = MY_STATUS_TEXT[status] || "待审核";

  const time = document.createElement("span");
  time.className = "my-item-time";
  time.textContent = created_at ? new Date(created_at).toLocaleString("zh-CN") : "";

  top.append(s, time);

  const c = document.createElement("div");
  c.className = "my-item-content";
  c.textContent = content;

  item.append(top, c);
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

async function uploadFile(file, folder) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("bless-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("bless-media").getPublicUrl(path);
  return data.publicUrl;
}

document.getElementById("blessForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  const content = contentInput.value.trim();

  formError.classList.add("hidden");
  if (!nickname || !content) {
    showFormError("昵称和祝福语都不能为空");
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
  btn.textContent = "上传中…";

  const files = {
    photo: photoInput.files[0],
    audio: audioInput.files[0],
  };

  for (const [key, f] of Object.entries(files)) {
    if (!f) continue;
    const lim = FILE_LIMITS[key];
    if (!f.type.startsWith(lim.type)) {
      btn.disabled = false;
      btn.textContent = "提交祝福";
      showFormError(`请选择有效的${lim.label}文件`);
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
    if (files.photo) photo_url = await uploadFile(files.photo, "photos");
    if (files.audio) audio_url = await uploadFile(files.audio, "audio");
  } catch (err) {
    console.error("文件上传失败:", err);
    btn.disabled = false;
    btn.textContent = "提交祝福";
    showFormError("文件上传失败：" + (err.message || "请重试"));
    return;
  }

  btn.textContent = "提交中…";

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
  } else {
    payload.client_key = client_key;
  }

  const { error } = await supabase.from("bless").insert(payload);

  btn.disabled = false;
  btn.textContent = "提交祝福";

  if (error) {
    console.error("提交失败:", error);
    showFormError("提交失败：" + (error.message || "请稍后重试"));
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
  showToast("祝福已提交，审核通过后就会出现在星海中 ✦");
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

function updateCountdown() {
  const target = new Date(BIRTHDAY).getTime();
  const now = Date.now();
  const el = document.getElementById("countdown");

  if (isNaN(target)) {
    el.textContent = "--天--时--分--秒";
    return;
  }

  const diff = target - now;
  if (diff <= 0) {
    el.textContent = "生日快乐 ✦";
    return;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  el.textContent = `${d}天${String(h).padStart(2, "0")}时${String(m).padStart(2, "0")}分${String(s).padStart(2, "0")}秒`;
}

function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;

  for (const s of blessingSprites) {
    const pulse = 0.75 + 0.25 * Math.sin(t * s.userData.speed + s.userData.phase);
    const sc = s.userData.baseScale * pulse;
    s.scale.set(sc, sc, 1);
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

function renderAuthUI() {
  const btn = document.getElementById("authBtn");
  const email = document.getElementById("userEmail");
  if (currentUser) {
    email.textContent = currentUser.email;
    email.classList.remove("hidden");
    btn.textContent = "退出";
  } else {
    email.textContent = "";
    email.classList.add("hidden");
    btn.textContent = "登录 / 注册";
  }
}

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById("authTitle").textContent = mode === "login" ? "登录" : "注册";
  document.getElementById("authSubmit").textContent = mode === "login" ? "登录" : "注册";
  document.getElementById("authToggle").textContent =
    mode === "login" ? "没有账号？注册" : "已有账号？登录";
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
    console.error("获取登录状态失败:", err);
    currentUser = null;
  }
  renderAuthUI();
}

document.getElementById("authBtn").addEventListener("click", async () => {
  if (currentUser) {
    await supabase.auth.signOut();
    currentUser = null;
    renderAuthUI();
    await reloadBlessings();
    showToast("已退出登录");
    return;
  }
  setAuthMode("login");
  document.getElementById("authForm").reset();
  document.getElementById("authModal").classList.remove("hidden");
});

document.getElementById("authToggle").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "register" : "login");
});

document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const err = document.getElementById("authError");
  err.classList.add("hidden");

  if (authMode === "login") {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      err.textContent = "登录失败：" + error.message;
      err.classList.remove("hidden");
      return;
    }
    currentUser = data.user;
  } else {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      err.textContent = "注册失败：" + error.message;
      err.classList.remove("hidden");
      return;
    }
    if (!data.session) {
      err.textContent = "注册成功，请查收邮件确认后登录";
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
    console.error("初始化失败:", err);
  }

  clearTimeout(safetyTimer);
  hideLoading();
  animate();
}

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

init();
